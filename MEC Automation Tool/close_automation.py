#!/usr/bin/env python3
"""close_automation.py — Month-End Close Automation Tool (main orchestrator).

Ties together all MEC modules into a single command-line workflow.

Usage:
    # Full run with AI commentary
    python close_automation.py --client abc_corporation --month 2026-04 --mode full

    # Quick run — variance analysis and reports only, no API calls
    python close_automation.py --client abc_corporation --month 2026-04 --mode quick

    # See what would happen without touching any files or APIs
    python close_automation.py --client abc_corporation --month 2026-04 --dry-run

    # Override variance threshold and model for this run
    python close_automation.py --client abc_corporation --month 2026-04 \\
        --threshold 3.5 --model haiku

    # Supply explicit file paths instead of relying on naming convention
    python close_automation.py --client abc_corporation --month 2026-04 \\
        --current data/abc_corporation/apr.xlsx \\
        --prior   data/abc_corporation/mar.xlsx

Trial Balance File Convention (auto-detected when --current/--prior are omitted):
    data/<client_id>/<client_id>_<YYYY-MM>.xlsx   (.csv also accepted)

Output:
    output/<client_id>/<YYYY-MM>/
        variance_report.xlsx
        close_report_<client_id>_<YYYY-MM>.docx
        journal_entries_template_<Client>_<Month_Year>.xlsx
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

try:
    from tqdm import tqdm
except ImportError:
    print(
        "tqdm is required but not installed.  Run:  pip install tqdm",
        file=sys.stderr,
    )
    sys.exit(1)

# Load .env file automatically if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=False)
except ImportError:
    pass

from config_manager      import load_client_config
from variance_calculator import calculate_variances, export_to_excel
import commentary_generator as _cg
from commentary_generator import generate_commentary
from report_generator     import generate_report
from je_generator         import create_je_template

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL_ALIASES: dict = {
    "haiku":  "claude-haiku-4-5",
    "sonnet": "claude-sonnet-4-6",
    "opus":   "claude-opus-4-7",
}

# Pricing per 1M tokens (USD)
_PRICING: dict = {
    "claude-haiku-4-5":  {"input": 1.00,  "output":  5.00},
    "claude-sonnet-4-6": {"input": 3.00,  "output": 15.00},
    "claude-opus-4-7":   {"input": 5.00,  "output": 25.00},
}

# Estimated token usage per flagged account in a single batch call
_SYS_TOKENS    = 75
_IN_PER_ACCT   = 130   # account JSON in user message
_OUT_PER_ACCT  = 190   # 2-3 sentence commentary

_BAR_FMT = "{desc:<42} {bar} {n_fmt}/{total_fmt}  [{elapsed}]"
_SEP     = "-" * 56


# ---------------------------------------------------------------------------
# Logging: route through tqdm.write so bars aren't broken
# ---------------------------------------------------------------------------

class _TqdmHandler(logging.StreamHandler):
    """StreamHandler that uses tqdm.write to avoid corrupting progress bars."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            tqdm.write(self.format(record), file=self.stream)
        except Exception:
            self.handleError(record)


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="close_automation.py",
        description="Month-End Close Automation Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Required
    p.add_argument("--client", required=True,
                   help="Client ID — matches config/<client>.json and data/<client>/")
    p.add_argument("--month",  required=True,
                   help="Reporting period in YYYY-MM format, e.g. 2026-04")

    # Workflow control
    p.add_argument("--mode", choices=["full", "quick"], default="full",
                   help="full: complete analysis with AI commentary (default); "
                        "quick: variance + reports only, no API calls")
    p.add_argument("--dry-run", action="store_true",
                   help="Show what would happen without writing files or calling the API")

    # Overrides
    p.add_argument("--threshold", type=float, default=None, metavar="PCT",
                   help="Override the client config variance threshold, e.g. 3.5 (%%)")
    p.add_argument("--model", default="sonnet",
                   choices=list(_MODEL_ALIASES) + list(_MODEL_ALIASES.values()),
                   help="AI model: haiku | sonnet (default) | opus")
    p.add_argument("--current", default=None, metavar="FILE",
                   help="Explicit path to the current-period trial balance")
    p.add_argument("--prior",   default=None, metavar="FILE",
                   help="Explicit path to the prior-period trial balance")

    # Directory overrides
    p.add_argument("--config-dir", default="config",  metavar="DIR")
    p.add_argument("--data-dir",   default="data",    metavar="DIR")
    p.add_argument("--output-dir", default="output",  metavar="DIR")

    # Debug
    p.add_argument("--verbose", "-v", action="store_true",
                   help="Enable DEBUG logging to stderr")

    return p.parse_args()


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------

def _setup_logging(verbose: bool) -> None:
    level   = logging.DEBUG if verbose else logging.WARNING
    handler = _TqdmHandler(sys.stderr)
    handler.setFormatter(logging.Formatter("%(levelname)-8s %(name)s: %(message)s"))
    logging.basicConfig(level=level, handlers=[handler], force=True)


def _resolve_model(alias: str) -> str:
    return _MODEL_ALIASES.get(alias.lower(), alias)


def _parse_month(s: str) -> tuple:
    """Return (year, month) from a YYYY-MM string."""
    try:
        dt = datetime.strptime(s, "%Y-%m")
        return dt.year, dt.month
    except ValueError:
        print(f"Error: --month must be YYYY-MM format, got '{s}'", file=sys.stderr)
        sys.exit(1)


def _prior_month(year: int, month: int) -> tuple:
    return (year - 1, 12) if month == 1 else (year, month - 1)


def _period_label(year: int, month: int) -> str:
    return datetime(year, month, 1).strftime("%B %Y")


# ---------------------------------------------------------------------------
# Trial balance file discovery and loading
# ---------------------------------------------------------------------------

def _find_tb_file(client_id: str, year: int, month: int, data_dir: str) -> Path:
    """Locate a trial balance file for the given client and period.

    Searches ``data/<client_id>/`` for files whose name contains the
    YYYY-MM string.  Preference order: exact name match → glob match.

    Args:
        client_id: Client identifier.
        year:      Period year.
        month:     Period month (1-12).
        data_dir:  Root data directory.

    Returns:
        Path to the located file.

    Raises:
        FileNotFoundError: If no matching file can be found.
    """
    period   = f"{year:04d}-{month:02d}"
    base_dir = Path(data_dir) / client_id

    for ext in (".xlsx", ".xls", ".csv"):
        exact = base_dir / f"{client_id}_{period}{ext}"
        if exact.exists():
            return exact

    for ext in (".xlsx", ".xls", ".csv"):
        matches = sorted(base_dir.glob(f"*{period}*{ext}"))
        if matches:
            if len(matches) > 1:
                log.warning("Multiple files match *%s*%s -- using %s", period, ext, matches[0].name)
            return matches[0]

    raise FileNotFoundError(
        f"No trial balance found for client '{client_id}' period '{period}'.\n"
        f"  Expected: {base_dir / f'{client_id}_{period}.xlsx'}\n"
        f"  Searched: {base_dir}\n"
        f"  Tip: use --current / --prior to specify paths explicitly."
    )


def _load_single_period(path: Path) -> pd.DataFrame:
    """Load a single-period trial balance file into a DataFrame.

    Accepts ``Account_Number``, ``Account_Name``, and ``Balance`` columns, and
    normalises common aliases (``Account``, ``Description``, ``Amount``, etc.).

    Args:
        path: Path to the trial balance file (.xlsx, .xls, or .csv).

    Returns:
        DataFrame with columns: Account_Number (str), Account_Name (str),
        Balance (float64).

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError:        If required columns cannot be found.
        RuntimeError:      If the file cannot be parsed.
    """
    if not path.exists():
        raise FileNotFoundError(f"Trial balance file not found: '{path}'")

    try:
        if path.suffix.lower() in (".xlsx", ".xls"):
            raw = pd.read_excel(path, dtype=str)
        else:
            raw = pd.read_csv(path, dtype=str)
    except Exception as exc:
        raise RuntimeError(f"Could not parse '{path.name}': {exc}") from exc

    raw.columns = raw.columns.str.strip()

    # Column alias normalisation
    aliases = {
        "Account_Number": {"account_number", "account", "acct", "acct_number",
                           "acct_no", "account_no"},
        "Account_Name":   {"account_name", "description", "name", "acct_name",
                           "account_description", "desc"},
        "Balance":        {"balance", "amount", "ending_balance", "end_balance",
                           "current_balance", "bal"},
    }
    rename = {}
    for col in raw.columns:
        key = col.lower().replace(" ", "_").replace("-", "_")
        for canonical, variants in aliases.items():
            if key in variants and canonical not in rename.values():
                rename[col] = canonical
                break

    df = raw.rename(columns=rename)

    missing = [c for c in ("Account_Number", "Balance") if c not in df.columns]
    if missing:
        raise ValueError(
            f"'{path.name}' is missing column(s) {missing}. "
            f"Found: {list(df.columns)}. "
            f"Expected headers: Account_Number, Account_Name, Balance."
        )

    if "Account_Name" not in df.columns:
        df["Account_Name"] = df["Account_Number"]

    df = df.dropna(how="all").reset_index(drop=True)
    df["Account_Number"] = df["Account_Number"].astype(str).str.strip()
    df["Account_Name"]   = df["Account_Name"].fillna("").astype(str).str.strip()
    df["Balance"]        = pd.to_numeric(df["Balance"], errors="coerce").fillna(0.0)

    log.debug("Loaded %d rows from '%s'.", len(df), path.name)
    return df[["Account_Number", "Account_Name", "Balance"]]


# ---------------------------------------------------------------------------
# Cost estimation
# ---------------------------------------------------------------------------

def _estimate_cost(n_flagged: int, model_id: str) -> dict:
    """Estimate the API cost for a batch commentary call.

    Accounts for the cached system prompt (priced at 10% of normal input rate
    on subsequent calls; assume the first call creates the cache).

    Args:
        n_flagged: Number of flagged accounts that will be sent to the API.
        model_id:  Full model ID string.

    Returns:
        Dict with input_tokens, output_tokens, estimated_cost_usd.
    """
    pricing = _PRICING.get(model_id, _PRICING["claude-sonnet-4-6"])

    input_tokens  = _SYS_TOKENS + _IN_PER_ACCT  * n_flagged
    output_tokens = _OUT_PER_ACCT * n_flagged

    # Cache creation pricing is same as input; cache reads are 10%
    cost = (input_tokens  / 1_000_000 * pricing["input"] +
            output_tokens / 1_000_000 * pricing["output"])

    return {
        "input_tokens":        input_tokens,
        "output_tokens":       output_tokens,
        "estimated_cost_usd":  cost,
    }


# ---------------------------------------------------------------------------
# Console output helpers
# ---------------------------------------------------------------------------

def _print_banner(
    client_name: str,
    period_label: str,
    month: str,
    mode: str,
    model_id: str,
    output_dir: Path,
    dry_run: bool,
) -> None:
    tag = "  [DRY RUN -- no files will be written]" if dry_run else ""
    print(f"\n{'=' * 56}")
    print(f"  MEC Automation Tool  |  Month-End Close{tag}")
    print(f"{'=' * 56}")
    print(f"  Client   {client_name}")
    print(f"  Period   {period_label}  ({month})")
    if dry_run:
        print(f"  Mode     {mode}  (dry run)")
    else:
        ai_note = f"  (AI model: {model_id})" if mode == "full" else "  (no AI)"
        print(f"  Mode     {mode}{ai_note}")
        print(f"  Output   {output_dir}")
    print(f"{'=' * 56}\n")


def _print_dry_run_plan(
    config: dict,
    period_label: str,
    month: str,
    mode: str,
    model_id: str,
    output_dir: Path,
    report_df: pd.DataFrame,
    current_path: Path,
    prior_path: Path,
) -> None:
    flagged = report_df[report_df["Flagged"]]
    n_total   = len(report_df)
    n_flagged = len(flagged)
    threshold = config["variance_threshold"]

    print(f"\n  {_SEP}")
    print(f"  DRY RUN -- What would happen")
    print(f"  {_SEP}")

    print(f"\n  Input Files")
    print(f"  {'Current TB:':<24} {current_path}")
    print(f"  {'Prior TB:':<24} {prior_path}")

    print(f"\n  Variance Analysis")
    print(f"  {'Accounts:':<24} {n_total}")
    print(f"  {f'Flagged (>{threshold:.1f}%):':<24} {n_flagged}")

    if n_flagged and not flagged.empty:
        idx = flagged["Variance_Amount"].abs().idxmax()
        largest     = float(flagged.loc[idx, "Variance_Amount"])
        largest_acct = str(flagged.loc[idx, "Account_Name"])
        print(f"  {'Largest variance:':<24} ${abs(largest):,.0f}  ({largest_acct})")

    print(f"\n  Files That Would Be Written  ->  {output_dir}")
    print(f"  {'Variance Excel:':<24} variance_report.xlsx")
    print(f"  {'Word Report:':<24} close_report_{config['client_id']}_{month}.docx")
    print(f"  {'JE Template:':<24} journal_entries_template_*.xlsx")

    if mode == "full" and n_flagged > 0:
        est = _estimate_cost(n_flagged, model_id)
        print(f"\n  AI Commentary  ({model_id})")
        print(f"  {'Accounts to analyze:':<24} {n_flagged}")
        print(f"  {'Est. input tokens:':<24} {est['input_tokens']:,}")
        print(f"  {'Est. output tokens:':<24} {est['output_tokens']:,}")
        print(f"  {'Est. cost:':<24} ${est['estimated_cost_usd']:.4f}")
    elif mode == "quick":
        print(f"\n  AI Commentary   skipped (mode=quick)")
    else:
        print(f"\n  AI Commentary   skipped (no flagged variances)")

    print(f"\n  Run without --dry-run to execute.\n")


def _print_summary(
    config: dict,
    period_label: str,
    month: str,
    mode: str,
    model_id: str,
    report_df: pd.DataFrame,
    outputs: dict,
    commentary: list,
    est_cost: float,
    errors: list,
    start_time: float,
) -> None:
    flagged   = report_df[report_df["Flagged"]]
    n_total   = len(report_df)
    n_flagged = len(flagged)
    threshold = config["variance_threshold"]
    elapsed   = time.monotonic() - start_time

    print(f"\n{'=' * 56}")
    print(f"  Complete  |  {config['client_name']}  |  {period_label}")
    print(f"{'=' * 56}")

    print(f"\n  Results")
    print(f"  {_SEP}")
    print(f"  {'Accounts reviewed:':<28} {n_total}")
    print(f"  {'Flagged variances:':<28} {n_flagged}  (threshold: {threshold:.1f}%)")

    if n_flagged and not flagged.empty:
        idx         = flagged["Variance_Amount"].abs().idxmax()
        largest     = float(flagged.loc[idx, "Variance_Amount"])
        largest_acc = str(flagged.loc[idx, "Account_Name"])
        pct         = float(flagged.loc[idx, "Variance_Pct"])
        print(f"  {'Largest variance:':<28} ${abs(largest):>10,.0f}  "
              f"{largest_acc}  ({pct:+.1f}%)")

    if outputs:
        out_dir = list(outputs.values())[0].parent
        print(f"\n  Output  ->  {out_dir}")
        print(f"  {_SEP}")
        for label, path in outputs.items():
            print(f"  {label + ':':<28} {path.name}")

    if mode == "full":
        print(f"\n  AI Commentary  ({model_id})")
        print(f"  {_SEP}")
        if commentary:
            u = _cg._last_usage
            in_tok   = u["input_tokens"]
            out_tok  = u["output_tokens"]
            c_create = u["cache_creation_input_tokens"]
            c_read   = u["cache_read_input_tokens"]
            total_in = in_tok + c_create + c_read
            cache_pct = (c_read / total_in * 100) if total_in else 0.0
            print(f"  {'Accounts analyzed:':<28} {len(commentary)}")
            print(f"  {'Input tokens:':<28} {in_tok:,}  (cache_create: {c_create:,}  cache_read: {c_read:,})")
            print(f"  {'Output tokens:':<28} {out_tok:,}")
            print(f"  {'Cache hit rate:':<28} {cache_pct:.1f}%")
            print(f"  {'Estimated cost:':<28} ${est_cost:.4f}")
        else:
            print(f"  No commentary generated  (0 flagged or API unavailable)")

    if errors:
        print(f"\n  Warnings ({len(errors)})")
        print(f"  {_SEP}")
        for e in errors:
            print(f"  !  {e}")

    print(f"\n  Elapsed: {elapsed:.1f}s")
    print(f"{'=' * 56}\n")


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def main() -> int:  # noqa: C901 — complexity is inherent to a workflow orchestrator
    args       = _parse_args()
    _setup_logging(args.verbose)

    # ── Resolve run parameters ────────────────────────────────────────────────
    # client_id_raw: original value — used for data dir and output dir paths
    # client_id:     normalized — passed to config_manager for file lookup
    client_id_raw = args.client
    client_id     = args.client.lower().replace("-", "_")
    year, mon  = _parse_month(args.month)
    py, pm     = _prior_month(year, mon)
    p_label    = _period_label(year, mon)
    model_id   = _resolve_model(args.model)
    output_dir = Path(args.output_dir) / client_id_raw / args.month

    # Number of tqdm steps: full has AI step, quick doesn't
    n_steps    = 7 if args.mode == "full" else 6

    start_time = time.monotonic()
    outputs: dict  = {}
    commentary: list = []
    errors: list   = []
    est_cost       = 0.0
    report_df      = pd.DataFrame()

    # ── Step 1: Load config ───────────────────────────────────────────────────
    try:
        config = load_client_config(client_id, config_dir=args.config_dir)
    except (FileNotFoundError, ValueError) as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        return 1

    if args.threshold is not None:
        config["variance_threshold"]     = args.threshold
        config["variance_threshold_pct"] = args.threshold

    _print_banner(
        config["client_name"], p_label, args.month,
        args.mode, model_id, output_dir, args.dry_run,
    )

    # ── Step 2: Locate trial balance files ───────────────────────────────────
    try:
        current_path = (Path(args.current) if args.current
                        else _find_tb_file(client_id_raw, year, mon, args.data_dir))
        prior_path   = (Path(args.prior)   if args.prior
                        else _find_tb_file(client_id_raw, py,   pm,  args.data_dir))
    except FileNotFoundError as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        return 1

    # ── Steps 2-3 outside the bar (fast, no API) ─────────────────────────────
    with tqdm(total=n_steps, bar_format=_BAR_FMT, file=sys.stdout) as pbar:

        # Step 1 (config already done — count it)
        pbar.set_description("Config loaded")
        pbar.update(1)

        # Step 2: Load trial balances
        pbar.set_description("Loading trial balances")
        try:
            current_df = _load_single_period(current_path)
            prior_df   = _load_single_period(prior_path)
        except (FileNotFoundError, ValueError, RuntimeError) as exc:
            tqdm.write(f"\nError: {exc}", file=sys.stderr)
            return 1
        pbar.update(1)

        # Step 3: Variance analysis
        pbar.set_description("Variance analysis")
        try:
            report_df = calculate_variances(
                current_df,
                prior_df,
                threshold_pct=config["variance_threshold"],
            )
        except Exception as exc:
            tqdm.write(f"\nError during variance analysis: {exc}", file=sys.stderr)
            return 1
        pbar.update(1)

        # ── Dry-run exits here after showing the plan ─────────────────────────
        if args.dry_run:
            pbar.close()
            _print_dry_run_plan(
                config, p_label, args.month, args.mode, model_id,
                output_dir, report_df, current_path, prior_path,
            )
            return 0

        # Create output directory for this run
        output_dir.mkdir(parents=True, exist_ok=True)

        # Step 4: Export variance Excel
        pbar.set_description("Exporting variance workbook")
        try:
            excel_path = output_dir / "variance_report.xlsx"
            export_to_excel(report_df, str(excel_path))
            outputs["Variance Excel"] = excel_path
        except Exception as exc:
            tqdm.write(f"\nWarning: Could not write variance Excel: {exc}", file=sys.stderr)
            errors.append(f"Variance Excel: {exc}")
        pbar.update(1)

        # Step 5: AI Commentary (full mode only)
        if args.mode == "full":
            pbar.set_description("Generating AI commentary")
            n_flagged = int(report_df["Flagged"].sum())
            if n_flagged == 0:
                tqdm.write("  No flagged variances — skipping AI commentary.")
            else:
                # Check for API key before calling
                if not os.getenv("ANTHROPIC_API_KEY"):
                    msg = (
                        "ANTHROPIC_API_KEY is not set — skipping AI commentary.\n"
                        "  Set it in a .env file or as an environment variable:\n"
                        "    Windows PowerShell: $env:ANTHROPIC_API_KEY = 'sk-ant-...'\n"
                        "    .env file:          ANTHROPIC_API_KEY=sk-ant-..."
                    )
                    tqdm.write(f"\n  Warning: {msg}", file=sys.stderr)
                    errors.append("ANTHROPIC_API_KEY not set — AI commentary skipped")
                else:
                    try:
                        commentary = generate_commentary(report_df, model=model_id)
                        est_cost   = _estimate_cost(n_flagged, model_id)["estimated_cost_usd"]
                    except Exception as exc:
                        msg = (
                            "AI commentary failed — continuing without it. "
                            f"({type(exc).__name__}: {exc})"
                        )
                        tqdm.write(f"\n  Warning: {msg}", file=sys.stderr)
                        errors.append(msg)
            pbar.update(1)

        # Step 6: Word report
        pbar.set_description("Creating Word report")
        try:
            docx_path = output_dir / f"close_report_{client_id}_{args.month}.docx"
            generate_report(
                full_report=report_df,
                commentary=commentary,
                config=config,
                output_path=str(docx_path),
                period_label=p_label,
            )
            outputs["Word Report"] = docx_path
        except Exception as exc:
            tqdm.write(f"\nWarning: Could not write Word report: {exc}", file=sys.stderr)
            errors.append(f"Word Report: {exc}")
        pbar.update(1)

        # Step 7: JE template
        pbar.set_description("Creating JE template")
        try:
            je_path = create_je_template(
                flagged=report_df,
                config=config,
                period_label=p_label,
                output_dir=str(output_dir),
                commentary=commentary,
                full_report=report_df,
            )
            outputs["JE Template"] = je_path
        except Exception as exc:
            tqdm.write(f"\nWarning: Could not write JE template: {exc}", file=sys.stderr)
            errors.append(f"JE Template: {exc}")
        pbar.update(1)

        pbar.set_description("Done")

    # ── Summary ───────────────────────────────────────────────────────────────
    _print_summary(
        config, p_label, args.month, args.mode, model_id,
        report_df, outputs, commentary, est_cost, errors, start_time,
    )

    return 1 if errors else 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    sys.exit(main())
