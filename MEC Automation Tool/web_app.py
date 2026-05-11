#!/usr/bin/env python3
"""web_app.py -- Flask web interface for the MEC Automation Tool.

Run:
    python web_app.py

Then open http://localhost:5000 in your browser.
"""

import json
import os
import shutil
import sys
import tempfile
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

try:
    from flask import Flask, jsonify, render_template, request, send_file
except ImportError:
    print("Flask is required. Run:  pip install flask", file=sys.stderr)
    sys.exit(1)

_HERE = Path(__file__).parent
sys.path.insert(0, str(_HERE))

from close_automation import _load_single_period
from commentary_generator import generate_commentary
from config_manager import list_clients, load_client_config
from je_generator import create_je_template
from report_generator import generate_report
from run_logger import RunLogger
from variance_calculator import calculate_variances, export_to_excel

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

_jobs: dict = {}
_lock = threading.Lock()

_MODEL_ALIASES = {
    "haiku":  "claude-haiku-4-5",
    "sonnet": "claude-sonnet-4-6",
    "opus":   "claude-opus-4-7",
}
_PRICING = {
    "claude-haiku-4-5":  {"input": 1.00,  "output":  5.00},
    "claude-sonnet-4-6": {"input": 3.00,  "output": 15.00},
    "claude-opus-4-7":   {"input": 5.00,  "output": 25.00},
}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/clients")
def api_clients():
    clients = list_clients(str(_HERE / "config"))
    result = []
    for cid in clients:
        try:
            cfg = load_client_config(cid, config_dir=str(_HERE / "config"))
            result.append({"id": cid, "name": cfg.get("client_name", cid)})
        except Exception:
            result.append({"id": cid, "name": cid})
    return jsonify(result)


@app.route("/api/run", methods=["POST"])
def api_run():
    client_id    = request.form.get("client_id", "").strip()
    month        = request.form.get("month", "").strip()
    mode         = request.form.get("mode", "quick").strip()
    model_key    = request.form.get("model", "sonnet").strip()
    model_id     = _MODEL_ALIASES.get(model_key, model_key)
    current_file = request.files.get("current_tb")
    prior_file   = request.files.get("prior_tb")

    if not all([client_id, month, current_file, prior_file]):
        return jsonify({"error": "Missing required fields."}), 400

    try:
        config = load_client_config(client_id, config_dir=str(_HERE / "config"))
    except Exception as exc:
        return jsonify({"error": f"Config error: {exc}"}), 400

    tmp_dir      = Path(tempfile.mkdtemp())
    current_path = tmp_dir / (current_file.filename or "current.xlsx")
    prior_path   = tmp_dir / (prior_file.filename   or "prior.xlsx")
    current_file.save(str(current_path))
    prior_file.save(str(prior_path))

    output_dir = _HERE / "output" / client_id / month
    job_id     = str(uuid.uuid4())[:8]

    with _lock:
        _jobs[job_id] = {
            "job_id":      job_id,
            "client_id":   client_id,
            "client_name": config.get("client_name", client_id),
            "month":       month,
            "mode":        mode,
            "model":       model_id,
            "status":      "running",
            "step":        "Starting",
            "progress":    0,
            "outputs":     {},
            "errors":      [],
            "output_dir":  str(output_dir),
            "started":     datetime.now().isoformat(),
            "accounts":    0,
            "flagged":     0,
            "cost_usd":    0.0,
            "elapsed_s":   0.0,
        }

    threading.Thread(
        target=_worker,
        args=(job_id, client_id, month, mode, model_id,
              current_path, prior_path, output_dir, config, tmp_dir),
        daemon=True,
    ).start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def api_status(job_id):
    with _lock:
        job = _jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route("/api/download/<job_id>/<filename>")
def api_download(job_id, filename):
    with _lock:
        job = _jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job not found"}), 404

    output_dir = Path(job["output_dir"])
    file_path  = (output_dir / filename).resolve()

    if not file_path.exists() or not str(file_path).startswith(str(output_dir.resolve())):
        return jsonify({"error": "File not found"}), 404

    return send_file(str(file_path), as_attachment=True, download_name=filename)


@app.route("/api/history")
def api_history():
    log_file = _HERE / "logs" / "close_runs.log"
    if not log_file.exists():
        return jsonify([])
    records = []
    with open(log_file, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return jsonify(list(reversed(records[-20:])))


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

def _worker(job_id, client_id, month, mode, model_id,
            current_path, prior_path, output_dir, config, tmp_dir):

    rl  = RunLogger(log_dir=str(_HERE / "logs"))
    rid = rl.start(client_id, config.get("client_name", client_id), month, mode, model_id)

    start      = time.monotonic()
    outputs    = {}
    errors     = []
    commentary = []
    est_cost   = 0.0
    report_df  = None

    def _step(label, pct):
        with _lock:
            _jobs[job_id].update({"step": label, "progress": pct})

    try:
        _step("Loading trial balances", 15)
        current_df = _load_single_period(current_path)
        prior_df   = _load_single_period(prior_path)

        _step("Calculating variances", 35)
        report_df = calculate_variances(
            current_df, prior_df,
            threshold_pct=config["variance_threshold"],
        )

        output_dir.mkdir(parents=True, exist_ok=True)

        _step("Exporting variance workbook", 50)
        excel_path = output_dir / "variance_report.xlsx"
        export_to_excel(report_df, str(excel_path))
        outputs["Variance Excel"] = excel_path

        if mode == "full":
            _step("Generating AI commentary", 65)
            n_flagged = int(report_df["Flagged"].sum())
            if n_flagged > 0:
                if os.getenv("ANTHROPIC_API_KEY"):
                    try:
                        commentary = generate_commentary(report_df, model=model_id)
                        pricing    = _PRICING.get(model_id, _PRICING["claude-sonnet-4-6"])
                        est_cost   = (
                            (75 + 130 * n_flagged) / 1_000_000 * pricing["input"] +
                            (190 * n_flagged)       / 1_000_000 * pricing["output"]
                        )
                    except Exception as exc:
                        errors.append(f"AI commentary failed: {exc}")
                else:
                    errors.append("ANTHROPIC_API_KEY not set -- AI commentary skipped")

        _step("Creating Word report", 80)
        year_n, mon_n = map(int, month.split("-"))
        period_label  = datetime(year_n, mon_n, 1).strftime("%B %Y")
        docx_path     = output_dir / f"close_report_{client_id}_{month}.docx"
        generate_report(
            full_report=report_df,
            commentary=commentary,
            config=config,
            output_path=str(docx_path),
            period_label=period_label,
        )
        outputs["Word Report"] = docx_path

        _step("Creating JE template", 92)
        je_path = create_je_template(
            flagged=report_df,
            config=config,
            period_label=period_label,
            output_dir=str(output_dir),
            commentary=commentary,
            full_report=report_df,
        )
        outputs["JE Template"] = je_path

        elapsed = round(time.monotonic() - start, 1)
        status  = "success" if not errors else "partial"

        with _lock:
            _jobs[job_id].update({
                "status":    "complete",
                "run_status": status,
                "step":      "Done",
                "progress":  100,
                "outputs":   {k: v.name for k, v in outputs.items()},
                "errors":    errors,
                "elapsed_s": elapsed,
                "accounts":  len(report_df),
                "flagged":   int(report_df["Flagged"].sum()),
                "cost_usd":  round(est_cost, 4),
            })

        rl.finish(
            rid, status, [p.name for p in outputs.values()], errors,
            elapsed_s=elapsed, cost_usd=est_cost,
            accounts=len(report_df), flagged=int(report_df["Flagged"].sum()),
        )

    except Exception as exc:
        elapsed = round(time.monotonic() - start, 1)
        with _lock:
            _jobs[job_id].update({
                "status":    "error",
                "run_status": "failed",
                "step":      "Failed",
                "progress":  100,
                "errors":    errors + [str(exc)],
                "elapsed_s": elapsed,
            })
        rl.finish(rid, "failed", [], errors + [str(exc)], elapsed_s=elapsed)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print()
    print("  MEC Automation Tool -- Web Interface")
    print("  --------------------------------------")
    print("  Open http://localhost:5000 in your browser")
    print()
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
