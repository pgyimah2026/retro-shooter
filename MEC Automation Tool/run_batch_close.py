"""run_batch_close.py — Overnight batch month-end close using the Anthropic Batch API.

Two-step workflow:

  Step 1 — Submit (run before you leave for the day):
      python run_batch_close.py submit --client abc_corporation --month 2026-04

      This will:
        • Load the client config and trial balance files
        • Calculate variances and export the variance Excel report
        • Submit an Anthropic Message Batches job (50 % cost discount)
        • Save a manifest JSON so the retrieve step is self-contained

  Step 2 — Retrieve (run the next morning, or pass --wait to block):
      python run_batch_close.py retrieve --manifest output/abc_corporation/2026-04/batch_manifest.json
      python run_batch_close.py retrieve --manifest ... --wait   # block until done

      This will:
        • Check (or wait for) batch completion
        • Pull results from the Anthropic Batch API
        • Generate the Word report and journal entry template
        • Print a final summary

Usage examples:
    python run_batch_close.py submit --client abc_corporation --month 2026-04
    python run_batch_close.py submit --client abc_corporation --month 2026-04 --model opus
    python run_batch_close.py retrieve --manifest output/abc_corporation/2026-04/batch_manifest.json
    python run_batch_close.py retrieve --manifest ... --wait --poll-interval 120
    python run_batch_close.py status  --manifest output/abc_corporation/2026-04/batch_manifest.json
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

# Local modules
import commentary_generator as cg
from config_manager import load_client_config, merge_with_defaults
from variance_calculator import calculate_variances, export_to_excel

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column aliases accepted when loading a single-period trial balance file
# ---------------------------------------------------------------------------

_ACCT_ALIASES  = ["account_number", "account", "acct_no", "acct_num", "account_no"]
_NAME_ALIASES  = ["account_name", "name", "description", "acct_name", "account_desc"]
_BAL_ALIASES   = ["balance", "amount", "ending_balance", "end_balance",
                  "current_balance", "period_balance"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def _load_single_period(path: Path) -> pd.DataFrame:
    """Load one trial balance Excel file and normalise column names.

    Accepts many common column name conventions and returns a DataFrame with
    exactly three columns: Account_Number (str), Account_Name (str),
    Balance (float).

    Args:
        path: Path to the .xlsx / .csv file.

    Returns:
        Normalised DataFrame.

    Raises:
        FileNotFoundError: If path does not exist.
        ValueError: If required columns cannot be identified.
    """
    if not path.exists():
        raise FileNotFoundError(f"Trial balance file not found: {path}")

    if path.suffix.lower() == ".csv":
        raw = pd.read_csv(path, dtype=str)
    else:
        raw = pd.read_excel(path, dtype=str)

    raw.columns = [c.strip() for c in raw.columns]
    lower_cols  = {c.lower().replace(" ", "_"): c for c in raw.columns}

    def _find(aliases: list[str]) -> str | None:
        for a in aliases:
            if a in lower_cols:
                return lower_cols[a]
        return None

    acct_col = _find(_ACCT_ALIASES)
    name_col = _find(_NAME_ALIASES)
    bal_col  = _find(_BAL_ALIASES)

    missing = [
        label
        for label, found in [("account number", acct_col), ("account name", name_col), ("balance", bal_col)]
        if found is None
    ]
    if missing:
        raise ValueError(
            f"Could not identify column(s): {missing} in {path}. "
            f"Found: {list(raw.columns)}"
        )

    df = raw[[acct_col, name_col, bal_col]].copy()
    df.columns = ["Account_Number", "Account_Name", "Balance"]
    df["Account_Number"] = df["Account_Number"].astype(str).str.strip()
    df["Account_Name"]   = df["Account_Name"].astype(str).str.strip()
    df["Balance"]        = pd.to_numeric(df["Balance"], errors="coerce").fillna(0.0)
    df = df.dropna(subset=["Account_Number"])
    df = df[df["Account_Number"].str.len() > 0]
    return df


def _find_tb_file(client_id: str, year: int, month: int, data_dir: Path) -> Path:
    """Locate a trial balance file using the standard naming convention.

    Tries the exact name first (``<client_id>_<YYYY-MM>.xlsx``), then falls
    back to a glob for xlsx / csv variants.

    Args:
        client_id: Client identifier slug.
        year:      Four-digit year.
        month:     Month number (1-12).
        data_dir:  Root data directory.

    Returns:
        Resolved Path to the TB file.

    Raises:
        FileNotFoundError: If no matching file is found.
    """
    month_str = f"{year}-{month:02d}"
    client_dir = data_dir / client_id

    for suffix in (".xlsx", ".csv"):
        candidate = client_dir / f"{client_id}_{month_str}{suffix}"
        if candidate.exists():
            return candidate

    matches = sorted(client_dir.glob(f"*{month_str}*"))
    if matches:
        return matches[0]

    raise FileNotFoundError(
        f"No trial balance file found for {client_id} {month_str} in {client_dir}. "
        f"Expected: {client_dir / f'{client_id}_{month_str}.xlsx'}"
    )


def _prior_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _period_label(year: int, month: int) -> str:
    return datetime(year, month, 1).strftime("%B %Y")


def _save_manifest(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _load_manifest(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _print_separator() -> None:
    print("─" * 70)


# ---------------------------------------------------------------------------
# Submit subcommand
# ---------------------------------------------------------------------------

def cmd_submit(args: argparse.Namespace) -> int:
    """Submit a batch close job.  Returns 0 on success, 1 on error."""

    _print_separator()
    print("  MEC Batch Close — SUBMIT")
    _print_separator()

    # --- resolve directories -------------------------------------------------
    config_dir = Path(args.config_dir)
    data_dir   = Path(args.data_dir)
    output_dir = Path(args.output_dir)

    # --- parse month ---------------------------------------------------------
    try:
        year, month = [int(p) for p in args.month.split("-")]
    except ValueError:
        log.error("--month must be in YYYY-MM format (got '%s').", args.month)
        return 1

    # --- load config ---------------------------------------------------------
    print(f"\n[1/5] Loading config: {args.client}")
    try:
        config = load_client_config(args.client, config_dir=str(config_dir))
        config = merge_with_defaults(config)
    except Exception as exc:
        log.error("Failed to load client config: %s", exc)
        return 1

    threshold = args.threshold if args.threshold is not None else config.get("variance_threshold_pct", 5.0)
    client_name = config.get("client_name", args.client)
    period_lbl  = _period_label(year, month)
    print(f"    Client: {client_name}  |  Period: {period_lbl}  |  Threshold: {threshold}%")

    # --- locate TB files -----------------------------------------------------
    print(f"\n[2/5] Locating trial balance files")
    prior_year, prior_month = _prior_month(year, month)
    try:
        cur_path  = Path(args.current) if args.current else _find_tb_file(args.client, year, month, data_dir)
        prior_path = Path(args.prior)  if args.prior   else _find_tb_file(args.client, prior_year, prior_month, data_dir)
    except FileNotFoundError as exc:
        log.error("%s", exc)
        return 1

    print(f"    Current: {cur_path}")
    print(f"    Prior:   {prior_path}")

    # --- load & variance calc -------------------------------------------------
    print(f"\n[3/5] Calculating variances")
    try:
        cur_df  = _load_single_period(cur_path)
        prior_df = _load_single_period(prior_path)
        report   = calculate_variances(
            cur_df, prior_df,
            balance_col="Balance",
            threshold_pct=threshold,
        )
    except Exception as exc:
        log.error("Variance calculation failed: %s", exc)
        return 1

    flagged_count = int(report["Flagged"].sum())
    print(f"    {len(report)} accounts | {flagged_count} flagged (>{threshold}% variance)")

    if flagged_count == 0:
        print("\n    No flagged variances — nothing to submit. Exiting.")
        return 0

    # --- export variance Excel -----------------------------------------------
    print(f"\n[4/5] Exporting variance report to Excel")
    client_slug  = args.client.lower().replace(" ", "_")
    month_slug   = f"{year}-{month:02d}"
    out_dir      = output_dir / client_slug / month_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    variance_xlsx = out_dir / f"variance_report_{month_slug}.xlsx"

    try:
        export_to_excel(report, str(variance_xlsx))
        print(f"    → {variance_xlsx}")
    except Exception as exc:
        log.warning("Could not export variance Excel: %s", exc)
        variance_xlsx = None

    # --- submit batch --------------------------------------------------------
    print(f"\n[5/5] Submitting Anthropic Batch API job")
    model = cg._resolve_model(args.model)
    flagged_df = report[report["Flagged"]].copy()

    try:
        batch_meta = cg.submit_commentary_batch(flagged_df, model=model)
    except Exception as exc:
        log.error("Batch submission failed: %s", exc)
        return 1

    print(f"    Batch ID:  {batch_meta['batch_id']}")
    print(f"    Requests:  {len(batch_meta['accounts'])}")
    print(f"    Model:     {model}")

    # --- save manifest -------------------------------------------------------
    manifest = {
        "batch_id":        batch_meta["batch_id"],
        "client_id":       args.client,
        "client_name":     client_name,
        "month":           month_slug,
        "period_label":    period_lbl,
        "model":           model,
        "threshold":       threshold,
        "submitted_at":    batch_meta["submitted_at"],
        "config_dir":      str(config_dir),
        "output_dir":      str(out_dir),
        "variance_excel":  str(variance_xlsx) if variance_xlsx else None,
        "accounts":        batch_meta["accounts"],
        "flagged_records": flagged_df.to_dict(orient="records"),
        "full_report_records": report.to_dict(orient="records"),
    }

    manifest_path = out_dir / "batch_manifest.json"
    _save_manifest(manifest, manifest_path)

    _print_separator()
    print(f"\n  Batch submitted successfully!")
    print(f"\n  Manifest saved → {manifest_path}")
    print(f"\n  Next step (tomorrow morning):")
    print(f"    python run_batch_close.py retrieve --manifest \"{manifest_path}\"")
    print(f"  Or to wait now:")
    print(f"    python run_batch_close.py retrieve --manifest \"{manifest_path}\" --wait")
    _print_separator()

    return 0


# ---------------------------------------------------------------------------
# Status subcommand
# ---------------------------------------------------------------------------

def cmd_status(args: argparse.Namespace) -> int:
    """Check the status of a submitted batch job."""
    manifest_path = Path(args.manifest)
    try:
        manifest = _load_manifest(manifest_path)
    except FileNotFoundError as exc:
        log.error("%s", exc)
        return 1

    batch_id = manifest["batch_id"]
    print(f"\nChecking status for batch: {batch_id}")

    try:
        info = cg.check_batch_status(batch_id)
    except Exception as exc:
        log.error("Status check failed: %s", exc)
        return 1

    counts = info["counts"]
    _print_separator()
    print(f"  Batch ID:   {batch_id}")
    print(f"  Status:     {info['status']}")
    print(f"  Succeeded:  {counts['succeeded']}")
    print(f"  Processing: {counts['processing']}")
    print(f"  Errored:    {counts['errored']}")
    print(f"  Expired:    {counts['expired']}")
    if info["ended_at"]:
        print(f"  Ended at:   {info['ended_at']}")
    _print_separator()

    if info["status"] == "ended":
        print(f"\nBatch is complete. Run retrieve to generate reports:")
        print(f'  python run_batch_close.py retrieve --manifest "{manifest_path}"')

    return 0


# ---------------------------------------------------------------------------
# Retrieve subcommand
# ---------------------------------------------------------------------------

def cmd_retrieve(args: argparse.Namespace) -> int:
    """Retrieve results and generate final reports.  Returns 0 on success."""

    _print_separator()
    print("  MEC Batch Close — RETRIEVE")
    _print_separator()

    # --- load manifest -------------------------------------------------------
    manifest_path = Path(args.manifest)
    try:
        manifest = _load_manifest(manifest_path)
    except FileNotFoundError as exc:
        log.error("%s", exc)
        return 1

    batch_id     = manifest["batch_id"]
    client_id    = manifest["client_id"]
    client_name  = manifest.get("client_name", client_id)
    period_lbl   = manifest.get("period_label", manifest["month"])
    out_dir      = Path(manifest["output_dir"])
    accounts     = manifest["accounts"]
    config_dir   = manifest.get("config_dir", "config")

    print(f"\n  Client:    {client_name}")
    print(f"  Period:    {period_lbl}")
    print(f"  Batch ID:  {batch_id}")
    print(f"  Accounts:  {len(accounts)}")

    # --- retrieve / wait for results -----------------------------------------
    print(f"\n[1/4] {'Waiting for' if args.wait else 'Retrieving'} batch results")

    try:
        if args.wait:
            poll_interval = args.poll_interval
            max_hours     = args.max_wait_hours

            def _on_progress(info: dict) -> None:
                c = info["counts"]
                print(
                    f"    status={info['status']}  "
                    f"done={c['succeeded']}/{sum(c.values())}  "
                    f"errored={c['errored']}"
                )

            commentary = cg.poll_and_retrieve(
                batch_id,
                accounts,
                poll_interval=poll_interval,
                max_wait_hours=max_hours,
                on_progress=_on_progress,
            )
        else:
            commentary = cg.retrieve_batch_results(batch_id, accounts)
    except RuntimeError as exc:
        log.error("%s", exc)
        print("\n  Hint: the batch is still processing. Try again later or pass --wait.")
        return 1
    except TimeoutError as exc:
        log.error("%s", exc)
        return 1
    except Exception as exc:
        log.error("Failed to retrieve batch results: %s", exc)
        return 1

    succeeded = sum(1 for c in commentary if not c["commentary"].startswith("["))
    print(f"    Retrieved {len(commentary)} result(s) | {succeeded} succeeded")

    # --- reload data from manifest -------------------------------------------
    print(f"\n[2/4] Rebuilding variance data from manifest")
    try:
        flagged_df = pd.DataFrame(manifest["flagged_records"])
        full_report = pd.DataFrame(manifest["full_report_records"])
    except KeyError as exc:
        log.error("Manifest is missing data key: %s. Was it created by this version?", exc)
        return 1

    # --- load config for report generation -----------------------------------
    print(f"\n[3/4] Generating Word report and JE template")
    try:
        config = load_client_config(client_id, config_dir=str(config_dir))
        config = merge_with_defaults(config)
    except Exception as exc:
        log.warning("Could not load client config (%s) — using defaults.", exc)
        config = {
            "client_name": client_name,
            "preparer": "",
            "firm": "",
            "report_settings": {"include_je_template": True},
        }

    out_dir.mkdir(parents=True, exist_ok=True)
    month_slug  = manifest["month"]
    client_slug = client_id.lower().replace(" ", "_")
    errors      = []

    # Word report
    try:
        from report_generator import generate_report
        report_path = out_dir / f"mec_report_{client_slug}_{month_slug}.docx"
        generate_report(
            full_report=full_report,
            commentary=commentary,
            config=config,
            output_path=str(report_path),
            period_label=period_lbl,
        )
        print(f"    Word report  → {report_path}")
    except Exception as exc:
        log.error("Report generation failed: %s", exc)
        errors.append(f"Word report: {exc}")
        report_path = None

    # JE template
    include_je = config.get("report_settings", {}).get("include_je_template", True)
    je_path = None
    if include_je and not flagged_df.empty:
        try:
            from je_generator import create_je_template
            je_path = create_je_template(
                flagged=flagged_df,
                config=config,
                period_label=period_lbl,
                output_dir=str(out_dir),
                commentary=commentary,
                full_report=full_report,
            )
            print(f"    JE template  → {je_path}")
        except Exception as exc:
            log.error("JE template generation failed: %s", exc)
            errors.append(f"JE template: {exc}")

    # --- summary -------------------------------------------------------------
    print(f"\n[4/4] Summary")
    _print_separator()
    print(f"  Client:          {client_name}")
    print(f"  Period:          {period_lbl}")
    print(f"  Batch ID:        {batch_id}")
    print(f"  Accounts:        {len(commentary)} retrieved  |  {succeeded} succeeded")
    print(f"  Output folder:   {out_dir}")
    if report_path:
        print(f"  Word report:     {report_path.name}")
    if je_path:
        print(f"  JE template:     {Path(je_path).name}")
    if errors:
        print(f"\n  Warnings ({len(errors)}):")
        for e in errors:
            print(f"    • {e}")
    _print_separator()

    return 0 if not errors else 1


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="run_batch_close.py",
        description="Overnight batch month-end close via the Anthropic Batch API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    root.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging.")

    subs = root.add_subparsers(dest="command", metavar="COMMAND")
    subs.required = True

    # ---- submit -------------------------------------------------------------
    sub_submit = subs.add_parser(
        "submit",
        help="Submit a batch commentary job for an overnight run.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub_submit.add_argument("--client",   required=True,  help="Client ID (matches config/<client_id>.json).")
    sub_submit.add_argument("--month",    required=True,  help="Period in YYYY-MM format.")
    sub_submit.add_argument("--model",    default="sonnet", choices=["haiku", "sonnet", "opus"],
                            help="AI model to use (default: sonnet).")
    sub_submit.add_argument("--threshold", type=float, default=None,
                            help="Variance flag threshold %% (overrides config).")
    sub_submit.add_argument("--current",  default=None, help="Path to current-period TB file (auto-detected if omitted).")
    sub_submit.add_argument("--prior",    default=None, help="Path to prior-period TB file (auto-detected if omitted).")
    sub_submit.add_argument("--config-dir",  default="config",  dest="config_dir",  help="Config directory (default: config/).")
    sub_submit.add_argument("--data-dir",    default="data",    dest="data_dir",    help="Data directory (default: data/).")
    sub_submit.add_argument("--output-dir",  default="output",  dest="output_dir",  help="Output directory (default: output/).")

    # ---- status -------------------------------------------------------------
    sub_status = subs.add_parser(
        "status",
        help="Check the status of a submitted batch job.",
    )
    sub_status.add_argument("--manifest", required=True, help="Path to the batch_manifest.json saved by submit.")

    # ---- retrieve -----------------------------------------------------------
    sub_retrieve = subs.add_parser(
        "retrieve",
        help="Retrieve batch results and generate final reports.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub_retrieve.add_argument("--manifest",  required=True, help="Path to the batch_manifest.json saved by submit.")
    sub_retrieve.add_argument("--wait", action="store_true",
                              help="Block until the batch finishes instead of failing if still in progress.")
    sub_retrieve.add_argument("--poll-interval", type=int, default=60, dest="poll_interval",
                              help="Seconds between status checks when --wait is set (default: 60).")
    sub_retrieve.add_argument("--max-wait-hours", type=float, default=12.0, dest="max_wait_hours",
                              help="Hours before giving up when --wait is set (default: 12).")

    return root


def main() -> int:
    parser = _build_parser()
    args   = parser.parse_args()

    _setup_logging(args.verbose)

    if args.command == "submit":
        return cmd_submit(args)
    elif args.command == "status":
        return cmd_status(args)
    elif args.command == "retrieve":
        return cmd_retrieve(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
