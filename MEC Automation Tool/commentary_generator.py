"""commentary_generator.py — Generate AI-powered variance commentary via the Anthropic API.

Two modes:

  Real-time (default):
      All flagged accounts are sent in one API call; results come back immediately.

  Batch mode (50 % cost discount):
      Each account becomes an independent Batch API request; returns an empty list
      right away. Retrieve results later with retrieve_batch_results() or
      poll_and_retrieve() once the job finishes (typically minutes to hours).

Typical usage:
    from commentary_generator import generate_commentary

    # Real-time
    comments = generate_commentary(flagged_df, model="claude-sonnet-4-6")

    # Batch — submit now, retrieve later
    generate_commentary(
        flagged_df,
        model="claude-sonnet-4-6",
        batch_mode=True,
        batch_save_path="output/batch_meta.json",
    )
    # … later …
    from commentary_generator import load_batch_job, poll_and_retrieve
    meta     = load_batch_job("output/batch_meta.json")
    comments = poll_and_retrieve(meta["batch_id"], meta["accounts"])
"""

import argparse
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import anthropic
import pandas as pd

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL_ALIASES = {
    "haiku":  "claude-haiku-4-5",
    "sonnet": "claude-sonnet-4-6",
    "opus":   "claude-opus-4-7",
}

_DEFAULT_MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = (
    "You are an accounting expert analyzing month-over-month financial variances. "
    "Provide concise, professional explanations for balance changes. "
    "Focus on common business drivers: revenue timing, expense accruals, "
    "seasonal patterns, one-time items, and payment cycles."
)

_MAX_TOKENS = 1024

_ACCT_USER_TMPL = (
    "Analyze this month-over-month financial variance and provide a 2-3 sentence "
    "professional explanation of the most likely business drivers.\n\n"
    "Account: {account_number} — {account_name}\n"
    "Current Balance: ${current_balance:,.2f}\n"
    "Prior Balance:   ${prior_balance:,.2f}\n"
    "Variance Amount: ${variance_amount:,.2f}\n"
    "Variance %:      {variance_pct:.1f}%\n\n"
    "Respond with ONLY the 2-3 sentence explanation — no headers, no JSON, "
    "just the explanation text."
)

_POLL_INTERVAL_SEC = 60
_MAX_WAIT_HOURS    = 12

# Populated after every real-time API call; read by callers for reporting.
_last_usage: dict = {
    "input_tokens":                0,
    "output_tokens":               0,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens":     0,
}


# ---------------------------------------------------------------------------
# Public API — real-time mode
# ---------------------------------------------------------------------------

def generate_commentary(
    flagged: pd.DataFrame,
    model: str = _DEFAULT_MODEL,
    api_key: Optional[str] = None,
    batch_mode: bool = False,
    batch_save_path: Optional[str] = None,
) -> list[dict]:
    """Generate 2-3 sentence variance explanations for each flagged account.

    In **real-time mode** (``batch_mode=False``, the default):
        All flagged rows are sent in a single API call with a cached system
        prompt (5-min TTL). Returns the full commentary list immediately.

    In **batch mode** (``batch_mode=True``):
        Submits an Anthropic Message Batches job — one request per account —
        at a 50 % cost discount. Returns ``[]`` immediately. Batch metadata
        (including batch_id and account list) is saved to *batch_save_path*
        if provided. Retrieve results later with ``retrieve_batch_results()``
        or ``poll_and_retrieve()``.

    Args:
        flagged:         DataFrame of flagged rows; may also be the full variance
                         report (rows with Flagged == False are silently skipped).
        model:           Anthropic model ID or short alias ("haiku", "sonnet",
                         "opus"). Defaults to "claude-sonnet-4-6".
        api_key:         Optional API key. Falls back to ANTHROPIC_API_KEY env var.
        batch_mode:      When True, submit via the Batch API instead of real-time.
        batch_save_path: File path to save the batch metadata JSON (batch mode only).

    Returns:
        Real-time: list of dicts with keys account_number, account_name, commentary.
        Batch mode: empty list [] — retrieve results later.

    Raises:
        ValueError: If *flagged* is missing required variance columns.
    """
    model = _resolve_model(model)

    if "Flagged" in flagged.columns:
        subset = flagged[flagged["Flagged"]].copy()
    else:
        subset = flagged.copy()

    if subset.empty:
        log.info("No flagged variances — skipping API call.")
        return []

    _validate_flagged_columns(subset)

    if batch_mode:
        meta = submit_commentary_batch(subset, model=model, api_key=api_key)
        if batch_save_path:
            _save_json(meta, batch_save_path)
            log.info("Batch metadata saved → %s", batch_save_path)
        log.info(
            "Batch submitted: id=%s | %d request(s) | model=%s",
            meta["batch_id"], len(meta["accounts"]), model,
        )
        log.info(
            "Run  check_batch_status('%s')  to poll, or  poll_and_retrieve(...)  to wait.",
            meta["batch_id"],
        )
        return []

    client = _make_client(api_key)
    user_message = _build_user_message(subset)
    log.debug("Calling %s with %d flagged account(s).", model, len(subset))
    raw_text = _call_api(client, model, user_message)
    return _parse_response(raw_text, subset)


# ---------------------------------------------------------------------------
# Public API — batch mode
# ---------------------------------------------------------------------------

def submit_commentary_batch(
    flagged: pd.DataFrame,
    model: str = _DEFAULT_MODEL,
    api_key: Optional[str] = None,
) -> dict:
    """Submit a Message Batches job — one request per flagged account.

    The system prompt is included in every request but NOT cached (the Batch
    API does not support ephemeral caching). The 50 % batch discount more than
    offsets this for overnight or non-urgent workloads.

    Args:
        flagged:  DataFrame of flagged rows (Flagged column already filtered,
                  or absent — all rows are submitted).
        model:    Full model ID or short alias.
        api_key:  Optional API key; falls back to ANTHROPIC_API_KEY env var.

    Returns:
        Metadata dict:
            batch_id      – str (Anthropic batch ID)
            model         – str (resolved model ID)
            submitted_at  – str (ISO 8601 UTC timestamp)
            accounts      – list[dict] (one entry per account; preserves order):
                                custom_id, account_number, account_name,
                                current_balance, prior_balance,
                                variance_amount, variance_pct

    Raises:
        anthropic.APIError subclasses on submission failure.
    """
    model = _resolve_model(model)

    if "Flagged" in flagged.columns:
        subset = flagged[flagged["Flagged"]].copy()
    else:
        subset = flagged.copy()

    _validate_flagged_columns(subset)

    client   = _make_client(api_key)
    requests, accounts = _build_batch_requests(subset, model)

    log.info("Submitting Batch API job: %d request(s) → %s", len(requests), model)
    batch = client.messages.batches.create(requests=requests)

    meta = {
        "batch_id":     batch.id,
        "model":        model,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "accounts":     accounts,
    }
    log.info("Batch created → id=%s  status=%s", batch.id, batch.processing_status)
    return meta


def check_batch_status(
    batch_id: str,
    api_key: Optional[str] = None,
) -> dict:
    """Return the current processing status of a Message Batches job.

    Args:
        batch_id: Anthropic batch ID returned by submit_commentary_batch.
        api_key:  Optional API key; falls back to ANTHROPIC_API_KEY env var.

    Returns:
        Dict with keys:
            batch_id  – str
            status    – "in_progress" | "ended"
            counts    – dict: succeeded / errored / expired / processing / canceled
            ended_at  – ISO str or None
    """
    client = _make_client(api_key)
    batch  = client.messages.batches.retrieve(batch_id)

    counts = {
        "succeeded":  getattr(batch.request_counts, "succeeded",  0),
        "errored":    getattr(batch.request_counts, "errored",    0),
        "expired":    getattr(batch.request_counts, "expired",    0),
        "processing": getattr(batch.request_counts, "processing", 0),
        "canceled":   getattr(batch.request_counts, "canceled",   0),
    }
    ended_at = getattr(batch, "ended_at", None)
    if ended_at is not None and hasattr(ended_at, "isoformat"):
        ended_at = ended_at.isoformat()
    elif ended_at is not None:
        ended_at = str(ended_at)

    return {
        "batch_id": batch_id,
        "status":   batch.processing_status,
        "counts":   counts,
        "ended_at": ended_at,
    }


def retrieve_batch_results(
    batch_id: str,
    accounts: list[dict],
    api_key: Optional[str] = None,
) -> list[dict]:
    """Retrieve results from a completed Message Batches job.

    Each account that errored or expired receives a placeholder commentary so
    downstream report generation can still produce a complete document.

    Args:
        batch_id: Anthropic batch ID.
        accounts: The ``accounts`` list from the batch metadata dict (preserves
                  submission order and maps custom_id → account details).
        api_key:  Optional API key; falls back to ANTHROPIC_API_KEY env var.

    Returns:
        List of commentary dicts (same format as generate_commentary), one per
        account in the same order as *accounts*.

    Raises:
        RuntimeError: If the batch has not yet ended.
    """
    status_info = check_batch_status(batch_id, api_key=api_key)
    if status_info["status"] != "ended":
        raise RuntimeError(
            f"Batch {batch_id} is not complete yet "
            f"(status={status_info['status']}). "
            "Use poll_and_retrieve() to wait, or check again later."
        )

    client = _make_client(api_key)
    return _collect_batch_results(client, batch_id, accounts)


def poll_and_retrieve(
    batch_id: str,
    accounts: list[dict],
    api_key: Optional[str] = None,
    poll_interval: int = _POLL_INTERVAL_SEC,
    max_wait_hours: float = _MAX_WAIT_HOURS,
    on_progress: Optional[Callable[[dict], None]] = None,
) -> list[dict]:
    """Block until a batch job ends, then retrieve and return results.

    Args:
        batch_id:       Anthropic batch ID.
        accounts:       The ``accounts`` list from the batch metadata dict.
        api_key:        Optional API key; falls back to ANTHROPIC_API_KEY env var.
        poll_interval:  Seconds between status checks. Default: 60.
        max_wait_hours: Give up after this many hours. Default: 12.
        on_progress:    Optional callback called with the status dict on each poll.

    Returns:
        List of commentary dicts (same format as generate_commentary).

    Raises:
        TimeoutError: If the batch does not end within *max_wait_hours*.
    """
    deadline  = time.monotonic() + max_wait_hours * 3600
    poll_num  = 0

    while True:
        status_info = check_batch_status(batch_id, api_key=api_key)
        poll_num   += 1
        counts      = status_info["counts"]
        log.info(
            "[poll %d] %s | status=%s | done=%d/%d | errored=%d | expired=%d",
            poll_num, batch_id, status_info["status"],
            counts["succeeded"],
            sum(counts.values()),
            counts["errored"],
            counts["expired"],
        )

        if on_progress is not None:
            on_progress(status_info)

        if status_info["status"] == "ended":
            log.info("Batch %s ended — collecting results.", batch_id)
            return retrieve_batch_results(batch_id, accounts, api_key=api_key)

        if time.monotonic() >= deadline:
            raise TimeoutError(
                f"Batch {batch_id} did not complete within {max_wait_hours} hour(s). "
                "Run check_batch_status() / retrieve_batch_results() manually later."
            )

        log.debug("Next poll in %d s…", poll_interval)
        time.sleep(poll_interval)


def generate_aging_commentary(
    aging_result: dict,
    model: str = _DEFAULT_MODEL,
    api_key: Optional[str] = None,
) -> list[dict]:
    """Generate AI collection-risk analysis for flagged aging items.

    Args:
        aging_result: Return value from aging.analyze_aging().
        model:        Anthropic model ID or short alias.
        api_key:      Optional API key; falls back to ANTHROPIC_API_KEY env var.

    Returns:
        List of dicts with keys: name, risk, analysis, action.
        Covers all flagged entities (61+ days overdue). Empty list if none.
    """
    flagged      = aging_result.get("flagged", pd.DataFrame())
    entity_label = aging_result.get("entity_label", "Customer")
    summary      = aging_result.get("summary", {})

    if isinstance(flagged, pd.DataFrame) and flagged.empty:
        log.info("No aging exceptions -- skipping AI commentary.")
        return []

    model  = _resolve_model(model)
    client = _make_client(api_key)

    items = []
    for _, row in flagged.iterrows():
        items.append({
            "name":       str(row["Name"]),
            "b61_90":     float(row.get("B61_90", 0)),
            "b90_plus":   float(row.get("B90_Plus", 0)),
            "overdue":    float(row.get("Overdue", 0)),
            "total":      float(row.get("Total", 0)),
            "risk":       str(row.get("Risk", "Elevated")),
        })

    ctx = json.dumps({
        "report_type":   aging_result.get("report_type", "AR"),
        "entity_label":  entity_label,
        "total_balance": summary.get("total", 0),
        "overdue_pct":   summary.get("overdue_pct", 0),
        "flagged_items": items,
    }, indent=2)

    rt = aging_result.get("report_type", "AR")
    collect_word = "collect" if rt == "AR" else "pay"
    user_message = (
        f"You are a CPA analyzing {'accounts receivable' if rt == 'AR' else 'accounts payable'} "
        f"aging for collection risk. For each flagged {entity_label.lower()} below:\n"
        f"  1. A 1-2 sentence analysis of the collection risk or urgency.\n"
        f"  2. A specific recommended action (e.g., 'Send 90-day demand letter', "
        f"'Place account on hold', 'Escalate to collections').\n\n"
        f"Context:\n{ctx}\n\n"
        "Return a JSON array where each element has:\n"
        '  "index":    integer (1-based, matching flagged_items order)\n'
        '  "analysis": string (1-2 sentences)\n'
        '  "action":   string (specific recommended action)\n\n'
        "Return ONLY the JSON array."
    )

    log.debug("Calling %s for aging commentary (%d flagged).", model, len(items))
    raw_text = _call_api(client, model, user_message)

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array.")
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("Could not parse aging commentary response: %s", exc)
        parsed = []

    by_index = {item.get("index"): item for item in parsed}
    result   = []
    for i, item in enumerate(items, start=1):
        ai = by_index.get(i, {})
        result.append({
            "name":     item["name"],
            "risk":     item["risk"],
            "analysis": ai.get("analysis", "[No analysis returned.]"),
            "action":   ai.get("action",   "[No action suggested.]"),
        })

    return result


def generate_bank_rec_commentary(
    rec_result: dict,
    model: str = _DEFAULT_MODEL,
    api_key: Optional[str] = None,
) -> list[dict]:
    """Generate AI explanations for bank reconciliation exceptions.

    Args:
        rec_result: Return value from bank_rec.reconcile().
        model:      Anthropic model ID or short alias ("haiku", "sonnet", "opus").
        api_key:    Optional API key; falls back to ANTHROPIC_API_KEY env var.

    Returns:
        List of dicts with keys: source, date, description, amount, category,
        explanation, action. Empty list if there are no exceptions.
    """
    bank_only = rec_result.get("bank_only", pd.DataFrame())
    gl_only   = rec_result.get("gl_only",   pd.DataFrame())

    if (
        (isinstance(bank_only, pd.DataFrame) and bank_only.empty) and
        (isinstance(gl_only,   pd.DataFrame) and gl_only.empty)
    ):
        log.info("No bank rec exceptions -- skipping AI commentary.")
        return []

    model  = _resolve_model(model)
    client = _make_client(api_key)

    items = []
    for _, row in bank_only.iterrows():
        d = row["Date"]
        items.append({
            "source":      "Bank Statement",
            "date":        str(d.date()) if hasattr(d, "date") else str(d),
            "description": str(row.get("Description", "")),
            "amount":      float(row["Amount"]),
            "category":    str(row.get("Category", "")),
        })
    for _, row in gl_only.iterrows():
        d = row["Date"]
        items.append({
            "source":      "GL Subledger",
            "date":        str(d.date()) if hasattr(d, "date") else str(d),
            "description": str(row.get("Description", "")),
            "amount":      float(row["Amount"]),
            "category":    str(row.get("Category", "")),
        })

    block = json.dumps(items, indent=2)
    user_message = (
        "You are a CPA reviewing bank reconciliation exceptions.\n"
        "For each unmatched item below provide:\n"
        "  1. A 1-2 sentence explanation of the most likely reason it is unmatched.\n"
        "  2. A brief suggested action (e.g., 'Record journal entry for interest income',\n"
        "     'Confirm wire cleared -- resubmit if not received', 'Void and reissue check').\n\n"
        f"Exceptions:\n{block}\n\n"
        "Return a JSON array where each element has:\n"
        '  "index":       integer (1-based, matching item order above)\n'
        '  "explanation": string (1-2 sentences)\n'
        '  "action":      string (brief suggested action)\n\n'
        "Return ONLY the JSON array -- no preamble, no trailing text."
    )

    log.debug("Calling %s for bank rec commentary (%d exceptions).", model, len(items))
    raw_text = _call_api(client, model, user_message)

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array.")
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("Could not parse bank rec commentary response: %s", exc)
        parsed = []

    by_index = {item.get("index"): item for item in parsed}
    result   = []
    for i, item in enumerate(items, start=1):
        ai = by_index.get(i, {})
        result.append({
            "source":      item["source"],
            "date":        item["date"],
            "description": item["description"],
            "amount":      item["amount"],
            "category":    item["category"],
            "explanation": ai.get("explanation", "[No explanation returned.]"),
            "action":      ai.get("action",      "[No action suggested.]"),
        })

    return result


def generate_flux_commentary(
    flux_result: dict,
    model: str = _DEFAULT_MODEL,
    api_key: Optional[str] = None,
) -> list[dict]:
    """Generate AI explanations for material flux items.

    Args:
        flux_result: Return value from flux_analysis.analyze_flux().
        model:       Anthropic model ID or short alias ("haiku", "sonnet", "opus").
        api_key:     Optional API key; falls back to ANTHROPIC_API_KEY env var.

    Returns:
        List of dicts with keys: account_number, account_name, mom_pct,
        (yoy_pct if has_yoy), analysis, action.
        Empty list if there are no flagged items.
    """
    flagged = flux_result.get("flagged", pd.DataFrame())
    has_yoy = flux_result.get("has_yoy", False)

    if isinstance(flagged, pd.DataFrame) and flagged.empty:
        log.info("No flagged flux items -- skipping AI commentary.")
        return []

    model  = _resolve_model(model)
    client = _make_client(api_key)

    items = []
    for _, row in flagged.iterrows():
        item = {
            "account_number": str(row["Account_Number"]),
            "account_name":   str(row["Account_Name"]),
            "current":        float(row["Current"]),
            "prior_month":    float(row["Prior_Month"]),
            "mom_change":     float(row["MoM_Change"]),
            "mom_pct":        float(row["MoM_Pct"]),
            "mom_flagged":    bool(row.get("MoM_Flag", False)),
        }
        if has_yoy:
            item.update({
                "prior_year":  float(row.get("Prior_Year", 0)),
                "yoy_change":  float(row.get("YoY_Change", 0)),
                "yoy_pct":     float(row.get("YoY_Pct",   0)),
                "yoy_flagged": bool(row.get("YoY_Flag",   False)),
            })
        items.append(item)

    block = json.dumps(items, indent=2)
    if has_yoy:
        user_message = (
            "You are a CPA analyzing month-over-month AND year-over-year account fluctuations "
            "during a month-end close review. For each flagged account below:\n"
            "  1. A 1-2 sentence analysis of the most likely business drivers.\n"
            "  2. A specific recommended action for the accountant (e.g., 'Verify accrual "
            "reversal was posted', 'Confirm revenue cutoff is correct', 'Review vendor "
            "invoices for timing differences').\n\n"
            f"Flagged accounts:\n{block}\n\n"
            "Return a JSON array where each element has:\n"
            '  "index":    integer (1-based, matching item order above)\n'
            '  "analysis": string (1-2 sentences)\n'
            '  "action":   string (specific recommended action)\n\n'
            "Return ONLY the JSON array."
        )
    else:
        user_message = (
            "You are a CPA analyzing month-over-month account fluctuations during a "
            "month-end close review. For each flagged account below:\n"
            "  1. A 1-2 sentence analysis of the most likely business drivers.\n"
            "  2. A specific recommended action for the accountant.\n\n"
            f"Flagged accounts:\n{block}\n\n"
            "Return a JSON array where each element has:\n"
            '  "index":    integer (1-based, matching item order above)\n'
            '  "analysis": string (1-2 sentences)\n'
            '  "action":   string (specific recommended action)\n\n'
            "Return ONLY the JSON array."
        )

    log.debug("Calling %s for flux commentary (%d flagged).", model, len(items))
    raw_text = _call_api(client, model, user_message)

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array.")
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("Could not parse flux commentary response: %s", exc)
        parsed = []

    by_index = {entry.get("index"): entry for entry in parsed}
    result   = []
    for i, item in enumerate(items, start=1):
        ai    = by_index.get(i, {})
        entry = {
            "account_number": item["account_number"],
            "account_name":   item["account_name"],
            "mom_pct":        item["mom_pct"],
            "analysis":       ai.get("analysis", "[No analysis returned.]"),
            "action":         ai.get("action",   "[No action suggested.]"),
        }
        if has_yoy:
            entry["yoy_pct"] = item.get("yoy_pct", 0)
        result.append(entry)

    return result


def load_batch_job(json_path: str) -> dict:
    """Load batch metadata previously saved by generate_commentary (batch mode).

    Args:
        json_path: Path to the batch metadata JSON file.

    Returns:
        Metadata dict with at minimum: batch_id, model, submitted_at, accounts.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If required keys are absent.
    """
    path = Path(json_path)
    if not path.exists():
        raise FileNotFoundError(f"Batch metadata file not found: {json_path}")

    meta = json.loads(path.read_text(encoding="utf-8"))
    for key in ("batch_id", "model", "accounts"):
        if key not in meta:
            raise ValueError(f"Batch metadata is missing required key: '{key}'")
    return meta


# ---------------------------------------------------------------------------
# Internal helpers — shared
# ---------------------------------------------------------------------------

def _resolve_model(model: str) -> str:
    return _MODEL_ALIASES.get(model.lower(), model)


def _make_client(api_key: Optional[str]) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()


def _validate_flagged_columns(df: pd.DataFrame) -> None:
    required = {
        "Account_Number", "Account_Name",
        "Current_Balance", "Prior_Balance",
        "Variance_Amount", "Variance_Pct",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"flagged DataFrame is missing required column(s): {sorted(missing)}. "
            f"Found: {list(df.columns)}"
        )


def _save_json(data: dict, path: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# Internal helpers — real-time
# ---------------------------------------------------------------------------

def _build_user_message(df: pd.DataFrame) -> str:
    accounts = []
    for i, (_, row) in enumerate(df.iterrows(), start=1):
        accounts.append({
            "index":           i,
            "account_number":  str(row["Account_Number"]),
            "account_name":    str(row["Account_Name"]),
            "current_balance": float(row["Current_Balance"]),
            "prior_balance":   float(row["Prior_Balance"]),
            "variance_amount": float(row["Variance_Amount"]),
            "variance_pct":    round(float(row["Variance_Pct"]), 2),
        })

    block = json.dumps(accounts, indent=2)
    return (
        "Analyze the following flagged account variances and provide a 2-3 sentence "
        "professional explanation of likely business drivers for each one.\n\n"
        f"Accounts:\n{block}\n\n"
        "Return your response as a JSON array where each element has:\n"
        '  "index":      integer matching the account index above\n'
        '  "commentary": string with the 2-3 sentence explanation\n\n'
        "Return ONLY the JSON array — no preamble, no trailing text."
    )


def _call_api(client: anthropic.Anthropic, model: str, user_message: str) -> str:
    try:
        response = client.messages.create(
            model=model,
            max_tokens=_MAX_TOKENS,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.RateLimitError as exc:
        log.error("Anthropic rate limit: %s", exc)
        raise
    except anthropic.APIStatusError as exc:
        log.error("Anthropic API error %s: %s", exc.status_code, exc.message)
        raise
    except anthropic.APIConnectionError as exc:
        log.error("Anthropic connection error: %s", exc)
        raise

    usage = response.usage
    cache_create = getattr(usage, "cache_creation_input_tokens", 0)
    cache_read   = getattr(usage, "cache_read_input_tokens",     0)

    # Expose stats so callers can surface them in run summaries
    global _last_usage
    _last_usage = {
        "input_tokens":                usage.input_tokens,
        "output_tokens":               usage.output_tokens,
        "cache_creation_input_tokens": cache_create,
        "cache_read_input_tokens":     cache_read,
    }

    log.info(
        "API call -- model: %s | in: %d | out: %d | cache_create: %d | cache_read: %d",
        model,
        usage.input_tokens,
        usage.output_tokens,
        cache_create,
        cache_read,
    )
    text_content = next(
        (block.text for block in response.content if getattr(block, "type", "") == "text"),
        "",
    )
    if not text_content:
        log.warning(
            "No text content block found in response (content types: %s)",
            [getattr(b, "type", "?") for b in response.content],
        )
    return text_content


def _parse_response(raw_text: str, df: pd.DataFrame) -> list[dict]:
    rows = list(df.itertuples(index=False))

    # Strip markdown code fences if the model wrapped the JSON
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]          # drop opening fence line
        cleaned = cleaned.rsplit("```", 1)[0].strip()  # drop closing fence

    try:
        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            raise ValueError("Expected a JSON array at the top level.")
    except (json.JSONDecodeError, ValueError) as exc:
        log.warning("Could not parse model response as JSON: %s", exc)
        return [
            {
                "account_number": str(r.Account_Number),
                "account_name":   str(r.Account_Name),
                "commentary":     "[Commentary unavailable — API response could not be parsed.]",
            }
            for r in rows
        ]

    by_index = {item.get("index"): item.get("commentary", "") for item in parsed}
    result   = []
    for i, r in enumerate(rows, start=1):
        commentary = by_index.get(i, "")
        if not commentary:
            log.warning(
                "No commentary returned for account %s (index %d).", r.Account_Number, i
            )
            commentary = "[No commentary returned for this account.]"
        result.append({
            "account_number": str(r.Account_Number),
            "account_name":   str(r.Account_Name),
            "commentary":     commentary,
        })

    return result


# ---------------------------------------------------------------------------
# Internal helpers — batch mode
# ---------------------------------------------------------------------------

def _build_batch_requests(
    subset: pd.DataFrame,
    model: str,
) -> tuple[list[dict], list[dict]]:
    """Build the API requests list and accounts metadata list for a batch job.

    custom_id format: ``acct-{i:04d}-{account_number}`` where ``i`` is the
    zero-based row index. Using an index prefix guarantees uniqueness even if
    the same account number appears on multiple flagged rows.

    Returns:
        (requests, accounts):
            requests – list of dicts for client.messages.batches.create()
            accounts – ordered list of metadata dicts for the manifest
    """
    requests = []
    accounts = []

    for i, (_, row) in enumerate(subset.iterrows()):
        acct_num  = str(row["Account_Number"])
        acct_name = str(row["Account_Name"])
        curr      = float(row["Current_Balance"])
        prior     = float(row["Prior_Balance"])
        var_amt   = float(row["Variance_Amount"])
        var_pct   = round(float(row["Variance_Pct"]), 2)
        custom_id = f"acct-{i:04d}-{acct_num}"

        prompt = _ACCT_USER_TMPL.format(
            account_number=acct_num,
            account_name=acct_name,
            current_balance=curr,
            prior_balance=prior,
            variance_amount=var_amt,
            variance_pct=var_pct,
        )

        requests.append({
            "custom_id": custom_id,
            "params": {
                "model":      model,
                "max_tokens": _MAX_TOKENS,
                "system":     [{"type": "text", "text": _SYSTEM_PROMPT}],
                "messages":   [{"role": "user", "content": prompt}],
            },
        })

        accounts.append({
            "custom_id":       custom_id,
            "account_number":  acct_num,
            "account_name":    acct_name,
            "current_balance": curr,
            "prior_balance":   prior,
            "variance_amount": var_amt,
            "variance_pct":    var_pct,
        })

    return requests, accounts


def _collect_batch_results(
    client: anthropic.Anthropic,
    batch_id: str,
    accounts: list[dict],
) -> list[dict]:
    """Stream batch results and map them back to the ordered accounts list."""
    commentary_by_id: dict[str, str] = {}

    for result in client.messages.batches.results(batch_id):
        cid = result.custom_id
        if result.result.type == "succeeded":
            text = result.result.message.content[0].text.strip()
            commentary_by_id[cid] = text or "[No text in batch response.]"
        elif result.result.type == "errored":
            err = getattr(result.result, "error", "unknown error")
            log.warning("Batch request %s errored: %s", cid, err)
            commentary_by_id[cid] = "[Commentary unavailable — batch request errored.]"
        else:
            log.warning("Batch request %s expired.", cid)
            commentary_by_id[cid] = "[Commentary unavailable — batch request expired.]"

    output = []
    for acct in accounts:
        cid = acct["custom_id"]
        commentary = commentary_by_id.get(cid, "[No result returned for this account.]")
        output.append({
            "account_number": acct["account_number"],
            "account_name":   acct["account_name"],
            "commentary":     commentary,
        })

    return output


# ---------------------------------------------------------------------------
# Standalone execution — sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(levelname)-8s %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Generate AI commentary for flagged account variances.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Requires ANTHROPIC_API_KEY to be set in the environment.\n\n"
            "Batch mode: pass --batch to submit a Batch API job (50 % cheaper).\n"
            "            Results are saved to batch_meta.json and not printed."
        ),
    )
    parser.add_argument(
        "--model",
        default="sonnet",
        choices=["haiku", "sonnet", "opus"] + list(_MODEL_ALIASES.values()),
        help="Model to use (default: sonnet → claude-sonnet-4-6)",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Use Batch API instead of real-time (saves to batch_meta.json)",
    )
    args = parser.parse_args()

    sample = pd.DataFrame({
        "Account_Number":  ["4000", "5000", "6000"],
        "Account_Name":    ["Product Sales", "Materials", "Salaries"],
        "Current_Balance": [178_000, 72_000, 42_000],
        "Prior_Balance":   [150_000, 60_000, 35_000],
        "Variance_Amount": [28_000,  12_000,  7_000],
        "Variance_Pct":    [18.67,   20.00,   20.00],
        "Flagged":         [True,    True,    True],
    })

    resolved = _resolve_model(args.model)
    n        = int(sample["Flagged"].sum())
    mode_str = "batch" if args.batch else "real-time"
    print(f"Calling {resolved} ({mode_str}) with {n} flagged account(s)…\n")

    try:
        if args.batch:
            generate_commentary(
                sample,
                model=args.model,
                batch_mode=True,
                batch_save_path="batch_meta.json",
            )
            print("Batch submitted. Check batch_meta.json for the batch_id.")
            print("Use poll_and_retrieve(meta['batch_id'], meta['accounts']) to wait for results.")
        else:
            comments = generate_commentary(sample, model=args.model)
            for c in comments:
                print(f"[{c['account_number']}] {c['account_name']}")
                print(f"  {c['commentary']}\n")
    except (anthropic.RateLimitError, anthropic.APIStatusError, anthropic.APIConnectionError) as e:
        print(f"API error: {e}")
        raise SystemExit(1)
