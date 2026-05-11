"""run_logger.py -- Append-only JSONL run logger for the MEC Automation Tool.

Each completed run (dry runs excluded) appends one JSON line to
logs/close_runs.log.  Runs that fail or produce warnings also write
an entry to logs/alerts.log for quick triage.

Public API:
    from run_logger import RunLogger

    rl  = RunLogger()
    rid = rl.start("abc_corporation", "ABC Corporation", "2026-04", "full", "claude-sonnet-4-6")
    rl.finish(rid, "success", ["variance_report.xlsx"], [], elapsed_s=1.2,
              cost_usd=0.02, accounts=50, flagged=6)

Status values:
    "success"  -- all steps completed with no errors
    "partial"  -- completed but with non-fatal warnings (some outputs still written)
    "failed"   -- run did not complete; no usable outputs
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)


class RunLogger:
    """Append-only JSONL logger. Call start() then finish() once per run."""

    def __init__(self, log_dir: str = "logs"):
        self._dir = Path(log_dir)
        self._dir.mkdir(parents=True, exist_ok=True)
        self._log_path   = self._dir / "close_runs.log"
        self._alert_path = self._dir / "alerts.log"
        self._pending: dict = {}   # run_id -> start metadata (in memory only)

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def start(
        self,
        client_id: str,
        client_name: str,
        period: str,
        mode: str,
        model: str = "",
    ) -> str:
        """Register a run start in memory; returns a unique run_id string.

        Nothing is written to disk until finish() is called, so a crashed run
        simply produces no log entry rather than a dangling 'started' record.
        """
        ts     = datetime.now(timezone.utc)
        run_id = f"{client_id}_{period}_{ts.strftime('%Y%m%dT%H%M%SZ')}"
        self._pending[run_id] = {
            "started":     ts.isoformat(),
            "client_id":   client_id,
            "client_name": client_name,
            "period":      period,
            "mode":        mode,
            "model":       model,
        }
        log.debug("Run registered: %s", run_id)
        return run_id

    def finish(
        self,
        run_id: str,
        status: str,        # "success" | "partial" | "failed"
        outputs: list,      # output file names (not full paths)
        errors: list,       # warning / error strings
        elapsed_s: float,
        cost_usd: float = 0.0,
        accounts: int = 0,
        flagged: int = 0,
    ) -> None:
        """Write the completion record to logs/close_runs.log.

        Also appends to logs/alerts.log when status is 'failed' or 'partial'.
        """
        meta   = self._pending.pop(run_id, {})
        record = {
            "run_id":      run_id,
            "finished":    datetime.now(timezone.utc).isoformat(),
            "started":     meta.get("started", ""),
            "client_id":   meta.get("client_id", ""),
            "client_name": meta.get("client_name", ""),
            "period":      meta.get("period", ""),
            "mode":        meta.get("mode", ""),
            "model":       meta.get("model", ""),
            "status":      status,
            "accounts":    accounts,
            "flagged":     flagged,
            "outputs":     outputs,
            "errors":      [str(e) for e in errors],
            "elapsed_s":   round(elapsed_s, 2),
            "cost_usd":    round(cost_usd, 6),
        }
        self._write(self._log_path, record)

        if status in ("failed", "partial"):
            self._write(self._alert_path, {
                "finished":  record["finished"],
                "level":     "ERROR" if status == "failed" else "WARNING",
                "run_id":    run_id,
                "client_id": record["client_id"],
                "period":    record["period"],
                "errors":    record["errors"],
            })

        log.debug(
            "Run logged: %s  status=%s  elapsed=%.1fs  cost=$%.4f",
            run_id, status, elapsed_s, cost_usd,
        )

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _write(path: Path, record: dict) -> None:
        try:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, default=str) + "\n")
        except OSError as exc:
            log.warning("Could not write log to '%s': %s", path, exc)
