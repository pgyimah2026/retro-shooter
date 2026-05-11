"""check_log.py -- View and summarize MEC Automation Tool run history.

Reads logs/close_runs.log (JSONL) and prints a formatted table.

Usage:
    python check_log.py                       # last 10 runs, all clients
    python check_log.py --n 25               # show last 25 runs
    python check_log.py --client abc_corp    # filter by client ID
    python check_log.py --failures           # show only failed / partial runs
    python check_log.py --summary            # per-client success-rate + cost table
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

_SEP = "-" * 70


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _read_jsonl(path: Path) -> list:
    if not path.exists():
        return []
    records = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def _fmt_ts(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return (iso or "?")[:16]


def _status_tag(status: str) -> str:
    return {"success": "OK  ", "partial": "WARN", "failed": "FAIL"}.get(
        status, (status or "?")[:4].upper()
    )


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_list(records: list, args: argparse.Namespace) -> None:
    """Print a row-per-run table of recent runs."""
    if args.client:
        norm    = args.client.lower().replace("-", "_")
        records = [r for r in records if norm in r.get("client_id", "").lower()]
    if args.failures:
        records = [r for r in records if r.get("status") in ("failed", "partial")]

    records = records[-args.n:]

    if not records:
        print("No runs found.")
        return

    print(
        f"\n  {'Finished':<17} {'Client':<22} {'Period':<8} "
        f"{'M':1} {'Status':<4}  {'Accts':>5} {'Flag':>4}  {'Cost':>8}  {'Time':>6}"
    )
    print(f"  {_SEP}")

    for r in reversed(records):
        client = r.get("client_id", "?")[:21]
        status = _status_tag(r.get("status", "?"))
        cost   = f"${r.get('cost_usd', 0):.4f}" if r.get("cost_usd") else "     --"
        mode   = (r.get("mode") or "?")[0].upper()   # F=full  Q=quick
        errs   = r.get("errors", [])
        print(
            f"  {_fmt_ts(r.get('finished','')):<17} {client:<22} "
            f"{r.get('period','?'):<8} {mode:1} {status:<4}  "
            f"{r.get('accounts',0):>5} {r.get('flagged',0):>4}  "
            f"{cost:>8}  {r.get('elapsed_s',0):>5.1f}s"
        )
        if status.strip() != "OK" and errs:
            for e in errs[:2]:
                print(f"    ! {str(e)[:78]}")

    print()


def cmd_summary(records: list, alert_path: Path) -> None:
    """Print per-client success rates, total cost, and recent alerts."""
    if not records:
        print("No run history found.")
        return

    by_client: dict = defaultdict(
        lambda: {"total": 0, "success": 0, "partial": 0, "failed": 0, "cost": 0.0, "last": ""}
    )
    for r in records:
        cid  = r.get("client_id", "unknown")
        s    = r.get("status", "failed")
        ts   = r.get("finished", "")
        by_client[cid]["total"] += 1
        by_client[cid][s]        = by_client[cid].get(s, 0) + 1
        by_client[cid]["cost"]  += r.get("cost_usd", 0.0)
        if ts > by_client[cid]["last"]:
            by_client[cid]["last"] = ts

    total_runs = sum(s["total"]   for s in by_client.values())
    total_cost = sum(s["cost"]    for s in by_client.values())
    total_ok   = sum(s["success"] for s in by_client.values())
    overall    = total_ok / total_runs * 100 if total_runs else 0.0

    print(
        f"\n  {'Client':<24} {'Runs':>4}  {'OK':>4} {'WARN':>4} {'FAIL':>4}  "
        f"{'Rate':>6}  {'Cost':>8}  Last run"
    )
    print(f"  {_SEP}")

    for cid, s in sorted(by_client.items()):
        rate = s["success"] / s["total"] * 100 if s["total"] else 0.0
        print(
            f"  {cid:<24} {s['total']:>4}  {s['success']:>4} "
            f"{s.get('partial',0):>4} {s.get('failed',0):>4}  "
            f"{rate:>5.0f}%  ${s['cost']:>7.4f}  {_fmt_ts(s['last'])}"
        )

    print(f"  {_SEP}")
    print(
        f"  {'TOTAL':<24} {total_runs:>4}  {total_ok:>4}{'':>15}"
        f"  {overall:>5.0f}%  ${total_cost:>7.4f}"
    )

    alerts = _read_jsonl(alert_path)
    if alerts:
        recent = alerts[-5:]
        print(f"\n  Recent alerts  ({len(alerts)} total -- see logs/alerts.log for full list):")
        for a in reversed(recent):
            lvl  = a.get("level", "?")
            errs = a.get("errors", [])
            print(
                f"    [{lvl}]  {_fmt_ts(a.get('finished',''))}  "
                f"{a.get('client_id','?')}  {a.get('period','?')}"
            )
            if errs:
                print(f"           {str(errs[0])[:72]}")
    else:
        print("\n  No alerts on record.")

    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        prog="check_log.py",
        description="View MEC Automation Tool run history",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--n", type=int, default=10, metavar="N",
        help="Number of recent runs to show in list view (default: 10)",
    )
    parser.add_argument(
        "--client", default=None,
        help="Filter list view by client ID (partial match OK)",
    )
    parser.add_argument(
        "--failures", action="store_true",
        help="Show only failed and partial runs",
    )
    parser.add_argument(
        "--summary", action="store_true",
        help="Per-client success rate and total cost summary",
    )
    parser.add_argument(
        "--log-dir", default="logs", metavar="DIR",
        help="Directory containing log files (default: logs)",
    )
    args = parser.parse_args()

    log_dir    = Path(args.log_dir)
    log_file   = log_dir / "close_runs.log"
    alert_file = log_dir / "alerts.log"

    records = _read_jsonl(log_file)

    if args.summary:
        cmd_summary(records, alert_file)
    else:
        cmd_list(records, args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
