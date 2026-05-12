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

from aging import analyze_aging, export_aging_excel, load_aging_report
from bank_rec import (export_multi_reconciliation, export_reconciliation,
                      load_bank_statement, load_gl_subledger, reconcile)
from close_automation import _load_single_period
from commentary_generator import (generate_aging_commentary, generate_bank_rec_commentary,
                                  generate_commentary, generate_flux_commentary)
from flux_analysis import analyze_flux, export_flux_excel
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


@app.route("/api/bank_rec", methods=["POST"])
def api_bank_rec():
    client_id    = request.form.get("client_id", "").strip()
    month        = request.form.get("month", "").strip()
    mode         = request.form.get("mode", "quick").strip()
    model_key    = request.form.get("model", "sonnet").strip()
    model_id     = _MODEL_ALIASES.get(model_key, model_key)
    account_name = request.form.get("account_name", "Cash").strip()
    bank_file    = request.files.get("bank_statement")
    gl_file      = request.files.get("gl_subledger")

    try:
        bank_ending = float(request.form.get("bank_ending_balance", "0").replace(",", ""))
        gl_ending   = float(request.form.get("gl_ending_balance",   "0").replace(",", ""))
    except ValueError:
        return jsonify({"error": "Ending balances must be numeric."}), 400

    if not all([client_id, month, bank_file, gl_file]):
        return jsonify({"error": "Missing required fields."}), 400

    try:
        config = load_client_config(client_id, config_dir=str(_HERE / "config"))
    except Exception as exc:
        return jsonify({"error": f"Config error: {exc}"}), 400

    tmp_dir   = Path(tempfile.mkdtemp())
    bank_path = tmp_dir / (bank_file.filename or "bank_statement.xlsx")
    gl_path   = tmp_dir / (gl_file.filename   or "gl_subledger.xlsx")
    bank_file.save(str(bank_path))
    gl_file.save(str(gl_path))

    output_dir = _HERE / "output" / client_id / month
    job_id     = str(uuid.uuid4())[:8]

    with _lock:
        _jobs[job_id] = {
            "job_id":        job_id,
            "job_type":      "bank_rec",
            "client_id":     client_id,
            "client_name":   config.get("client_name", client_id),
            "month":         month,
            "account_name":  account_name,
            "mode":          mode,
            "model":         model_id,
            "status":        "running",
            "step":          "Starting",
            "progress":      0,
            "outputs":       {},
            "errors":        [],
            "output_dir":    str(output_dir),
            "started":       datetime.now().isoformat(),
            "matched":       0,
            "exceptions":    0,
            "difference":    0.0,
            "is_reconciled": False,
            "cost_usd":      0.0,
            "elapsed_s":     0.0,
        }

    threading.Thread(
        target=_bank_rec_worker,
        args=(job_id, client_id, month, mode, model_id, account_name,
              bank_path, gl_path, bank_ending, gl_ending, output_dir, config, tmp_dir),
        daemon=True,
    ).start()

    return jsonify({"job_id": job_id})


@app.route("/api/bank_rec_status/<job_id>")
def api_bank_rec_status(job_id):
    with _lock:
        job = _jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route("/api/multi_bank_rec", methods=["POST"])
def api_multi_bank_rec():
    client_id = request.form.get("client_id", "").strip()
    month     = request.form.get("month", "").strip()
    mode      = request.form.get("mode", "quick").strip()
    model_key = request.form.get("model", "sonnet").strip()
    model_id  = _MODEL_ALIASES.get(model_key, model_key)

    try:
        n = int(request.form.get("num_accounts", "0"))
    except ValueError:
        return jsonify({"error": "num_accounts must be an integer."}), 400

    if not all([client_id, month]) or n == 0:
        return jsonify({"error": "Missing required fields."}), 400

    try:
        config = load_client_config(client_id, config_dir=str(_HERE / "config"))
    except Exception as exc:
        return jsonify({"error": f"Config error: {exc}"}), 400

    tmp_dir  = Path(tempfile.mkdtemp())
    accounts = []
    for i in range(n):
        name     = request.form.get(f"name_{i}", f"Account {i+1}").strip()
        bank_bal = request.form.get(f"bank_bal_{i}", "0").replace(",", "")
        gl_bal   = request.form.get(f"gl_bal_{i}", "0").replace(",", "")
        bf       = request.files.get(f"bank_file_{i}")
        gf       = request.files.get(f"gl_file_{i}")

        if not bf or not gf:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return jsonify({"error": f"Missing files for account {i+1}."}), 400

        bp = tmp_dir / f"bank_{i}_{bf.filename or 'bank.xlsx'}"
        gp = tmp_dir / f"gl_{i}_{gf.filename or 'gl.xlsx'}"
        bf.save(str(bp)); gf.save(str(gp))

        try:
            accounts.append({
                "name":     name,
                "bank_bal": float(bank_bal),
                "gl_bal":   float(gl_bal),
                "bank_path": bp,
                "gl_path":   gp,
            })
        except ValueError:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return jsonify({"error": f"Invalid balance for account {i+1}."}), 400

    output_dir = _HERE / "output" / client_id / month
    job_id     = str(uuid.uuid4())[:8]

    with _lock:
        _jobs[job_id] = {
            "job_id":        job_id,
            "job_type":      "multi_bank_rec",
            "client_id":     client_id,
            "client_name":   config.get("client_name", client_id),
            "month":         month,
            "mode":          mode,
            "model":         model_id,
            "status":        "running",
            "step":          "Starting",
            "progress":      0,
            "outputs":       {},
            "errors":        [],
            "output_dir":    str(output_dir),
            "started":       datetime.now().isoformat(),
            "accounts_total": n,
            "accounts_reconciled": 0,
            "total_exceptions": 0,
            "cost_usd":      0.0,
            "elapsed_s":     0.0,
        }

    threading.Thread(
        target=_multi_bank_rec_worker,
        args=(job_id, client_id, month, mode, model_id,
              accounts, output_dir, config, tmp_dir),
        daemon=True,
    ).start()

    return jsonify({"job_id": job_id})


@app.route("/api/aging", methods=["POST"])
def api_aging():
    client_id   = request.form.get("client_id", "").strip()
    month       = request.form.get("month", "").strip()
    report_type = request.form.get("report_type", "AR").strip().upper()
    mode        = request.form.get("mode", "quick").strip()
    model_key   = request.form.get("model", "sonnet").strip()
    model_id    = _MODEL_ALIASES.get(model_key, model_key)
    aging_file  = request.files.get("aging_file")

    if not all([client_id, month, aging_file]):
        return jsonify({"error": "Missing required fields."}), 400

    try:
        config = load_client_config(client_id, config_dir=str(_HERE / "config"))
    except Exception as exc:
        return jsonify({"error": f"Config error: {exc}"}), 400

    tmp_dir    = Path(tempfile.mkdtemp())
    aging_path = tmp_dir / (aging_file.filename or "aging.xlsx")
    aging_file.save(str(aging_path))

    output_dir = _HERE / "output" / client_id / month
    job_id     = str(uuid.uuid4())[:8]

    with _lock:
        _jobs[job_id] = {
            "job_id":        job_id,
            "job_type":      "aging",
            "client_id":     client_id,
            "client_name":   config.get("client_name", client_id),
            "month":         month,
            "report_type":   report_type,
            "mode":          mode,
            "model":         model_id,
            "status":        "running",
            "step":          "Starting",
            "progress":      0,
            "outputs":       {},
            "errors":        [],
            "output_dir":    str(output_dir),
            "started":       datetime.now().isoformat(),
            "entity_count":  0,
            "flagged_count": 0,
            "total_ar_ap":   0.0,
            "overdue_pct":   0.0,
            "cost_usd":      0.0,
            "elapsed_s":     0.0,
        }

    threading.Thread(
        target=_aging_worker,
        args=(job_id, client_id, month, report_type, mode, model_id,
              aging_path, output_dir, config, tmp_dir),
        daemon=True,
    ).start()

    return jsonify({"job_id": job_id})


@app.route("/api/flux", methods=["POST"])
def api_flux():
    client_id    = request.form.get("client_id", "").strip()
    month        = request.form.get("month", "").strip()
    mode         = request.form.get("mode", "quick").strip()
    model_key    = request.form.get("model", "sonnet").strip()
    model_id     = _MODEL_ALIASES.get(model_key, model_key)
    current_file = request.files.get("current_tb")
    prior_m_file = request.files.get("prior_month_tb")
    prior_y_file = request.files.get("prior_year_tb")   # optional

    if not all([client_id, month, current_file, prior_m_file]):
        return jsonify({"error": "Missing required fields."}), 400

    try:
        config = load_client_config(client_id, config_dir=str(_HERE / "config"))
    except Exception as exc:
        return jsonify({"error": f"Config error: {exc}"}), 400

    tmp_dir      = Path(tempfile.mkdtemp())
    current_path = tmp_dir / (current_file.filename or "current.xlsx")
    prior_m_path = tmp_dir / (prior_m_file.filename or "prior_month.xlsx")
    current_file.save(str(current_path))
    prior_m_file.save(str(prior_m_path))

    prior_y_path = None
    if prior_y_file and prior_y_file.filename:
        prior_y_path = tmp_dir / prior_y_file.filename
        prior_y_file.save(str(prior_y_path))

    output_dir = _HERE / "output" / client_id / month
    job_id     = str(uuid.uuid4())[:8]

    with _lock:
        _jobs[job_id] = {
            "job_id":          job_id,
            "job_type":        "flux",
            "client_id":       client_id,
            "client_name":     config.get("client_name", client_id),
            "month":           month,
            "mode":            mode,
            "model":           model_id,
            "has_yoy":         prior_y_path is not None,
            "status":          "running",
            "step":            "Starting",
            "progress":        0,
            "outputs":         {},
            "errors":          [],
            "output_dir":      str(output_dir),
            "started":         datetime.now().isoformat(),
            "total_accounts":  0,
            "mom_flagged":     0,
            "yoy_flagged":     0,
            "cost_usd":        0.0,
            "elapsed_s":       0.0,
        }

    threading.Thread(
        target=_flux_worker,
        args=(job_id, client_id, month, mode, model_id,
              current_path, prior_m_path, prior_y_path, output_dir, config, tmp_dir),
        daemon=True,
    ).start()

    return jsonify({"job_id": job_id})


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
# Multi-account bank rec worker
# ---------------------------------------------------------------------------

def _multi_bank_rec_worker(
    job_id, client_id, month, mode, model_id,
    accounts, output_dir, config, tmp_dir,
):
    start    = time.monotonic()
    errors   = []
    est_cost = 0.0
    results  = []

    def _step(label, pct):
        with _lock:
            _jobs[job_id].update({"step": label, "progress": pct})

    try:
        total = len(accounts)
        for i, acct in enumerate(accounts):
            pct = int(10 + (i / total) * 70)
            _step(f"Reconciling {acct['name']} ({i+1}/{total})", pct)

            try:
                bank_df = load_bank_statement(acct["bank_path"])
                gl_df   = load_gl_subledger(acct["gl_path"])
                result  = reconcile(bank_df, gl_df, acct["bank_bal"], acct["gl_bal"])
            except Exception as exc:
                errors.append(f"{acct['name']}: {exc}")
                results.append({"name": acct["name"], "result": None, "commentary": []})
                continue

            commentary = []
            if mode == "full" and os.getenv("ANTHROPIC_API_KEY"):
                n_exc = result["summary"]["bank_only_count"] + result["summary"]["gl_only_count"]
                if n_exc > 0:
                    try:
                        commentary = generate_bank_rec_commentary(result, model=model_id)
                        pricing    = _PRICING.get(model_id, _PRICING["claude-sonnet-4-6"])
                        est_cost  += (
                            (100 + 80 * n_exc) / 1_000_000 * pricing["input"] +
                            (150 * n_exc)      / 1_000_000 * pricing["output"]
                        )
                    except Exception as exc:
                        errors.append(f"AI commentary failed for {acct['name']}: {exc}")

            results.append({"name": acct["name"], "result": result, "commentary": commentary})

        output_dir.mkdir(parents=True, exist_ok=True)

        _step("Exporting workbook", 85)
        year_n, mon_n = map(int, month.split("-"))
        period_label  = datetime(year_n, mon_n, 1).strftime("%B %Y")
        out_path      = output_dir / f"multi_bank_rec_{client_id}_{month}.xlsx"

        valid = [r for r in results if r["result"] is not None]
        export_multi_reconciliation(
            valid, out_path,
            period_label=period_label,
            client_name=config.get("client_name", client_id),
        )

        rec_count    = sum(1 for r in valid if r["result"]["is_reconciled"])
        total_exc    = sum(
            r["result"]["summary"]["bank_only_count"] + r["result"]["summary"]["gl_only_count"]
            for r in valid
        )
        elapsed = round(time.monotonic() - start, 1)
        status  = "success" if not errors else "partial"

        with _lock:
            _jobs[job_id].update({
                "status":              "complete",
                "run_status":          status,
                "step":                "Done",
                "progress":            100,
                "outputs":             {"Multi-Account Rec Workbook": out_path.name},
                "errors":              errors,
                "elapsed_s":           elapsed,
                "accounts_reconciled": rec_count,
                "total_exceptions":    total_exc,
                "cost_usd":            round(est_cost, 4),
            })

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
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Aging worker
# ---------------------------------------------------------------------------

def _aging_worker(
    job_id, client_id, month, report_type, mode, model_id,
    aging_path, output_dir, config, tmp_dir,
):
    start    = time.monotonic()
    errors   = []
    est_cost = 0.0

    def _step(label, pct):
        with _lock:
            _jobs[job_id].update({"step": label, "progress": pct})

    try:
        _step("Loading aging report", 20)
        df = load_aging_report(aging_path, report_type=report_type)

        _step("Analyzing aging buckets", 45)
        result = analyze_aging(df, report_type=report_type)

        output_dir.mkdir(parents=True, exist_ok=True)

        commentary = []
        if mode == "full":
            _step("Generating AI analysis", 65)
            if os.getenv("ANTHROPIC_API_KEY"):
                n_flag = result["summary"]["flagged_count"]
                if n_flag > 0:
                    try:
                        commentary = generate_aging_commentary(result, model=model_id)
                        pricing    = _PRICING.get(model_id, _PRICING["claude-sonnet-4-6"])
                        est_cost   = (
                            (120 + 100 * n_flag) / 1_000_000 * pricing["input"] +
                            (200 * n_flag)       / 1_000_000 * pricing["output"]
                        )
                    except Exception as exc:
                        errors.append(f"AI analysis failed: {exc}")
                else:
                    errors.append("No flagged items -- AI analysis skipped")
            else:
                errors.append("ANTHROPIC_API_KEY not set -- AI analysis skipped")

        _step("Exporting aging workbook", 85)
        year_n, mon_n = map(int, month.split("-"))
        period_label  = datetime(year_n, mon_n, 1).strftime("%B %Y")
        prefix        = report_type.lower()
        out_path      = output_dir / f"{prefix}_aging_{client_id}_{month}.xlsx"
        export_aging_excel(
            result, out_path,
            commentary=commentary or None,
            period_label=period_label,
            client_name=config.get("client_name", client_id),
        )

        s       = result["summary"]
        elapsed = round(time.monotonic() - start, 1)
        status  = "success" if not errors else "partial"

        with _lock:
            _jobs[job_id].update({
                "status":        "complete",
                "run_status":    status,
                "step":          "Done",
                "progress":      100,
                "outputs":       {f"{report_type} Aging Workbook": out_path.name},
                "errors":        errors,
                "elapsed_s":     elapsed,
                "entity_count":  s["entity_count"],
                "flagged_count": s["flagged_count"],
                "total_ar_ap":   s["total"],
                "overdue_pct":   s["overdue_pct"],
                "cost_usd":      round(est_cost, 4),
            })

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
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Bank rec background worker
# ---------------------------------------------------------------------------

def _bank_rec_worker(
    job_id, client_id, month, mode, model_id, account_name,
    bank_path, gl_path, bank_ending, gl_ending, output_dir, config, tmp_dir,
):
    start   = time.monotonic()
    outputs = {}
    errors  = []
    est_cost = 0.0

    def _step(label, pct):
        with _lock:
            _jobs[job_id].update({"step": label, "progress": pct})

    try:
        _step("Loading bank statement", 15)
        bank_df = load_bank_statement(bank_path)

        _step("Loading GL subledger", 30)
        gl_df = load_gl_subledger(gl_path)

        _step("Running reconciliation", 50)
        result = reconcile(bank_df, gl_df, bank_ending, gl_ending)

        output_dir.mkdir(parents=True, exist_ok=True)

        commentary = []
        if mode == "full":
            _step("Generating AI commentary", 65)
            n_exc = result["summary"]["bank_only_count"] + result["summary"]["gl_only_count"]
            if n_exc > 0:
                if os.getenv("ANTHROPIC_API_KEY"):
                    try:
                        commentary = generate_bank_rec_commentary(result, model=model_id)
                        pricing    = _PRICING.get(model_id, _PRICING["claude-sonnet-4-6"])
                        est_cost   = (
                            (100 + 80 * n_exc) / 1_000_000 * pricing["input"] +
                            (150 * n_exc)      / 1_000_000 * pricing["output"]
                        )
                    except Exception as exc:
                        errors.append(f"AI commentary failed: {exc}")
                else:
                    errors.append("ANTHROPIC_API_KEY not set -- AI commentary skipped")

        _step("Exporting reconciliation workbook", 85)
        year_n, mon_n = map(int, month.split("-"))
        period_label  = datetime(year_n, mon_n, 1).strftime("%B %Y")
        rec_path      = output_dir / f"bank_rec_{client_id}_{month}.xlsx"
        export_reconciliation(
            result, rec_path,
            commentary=commentary or None,
            period_label=period_label,
            client_name=config.get("client_name", client_id),
        )
        outputs["Bank Rec Workbook"] = rec_path

        elapsed = round(time.monotonic() - start, 1)
        status  = "success" if not errors else "partial"
        s       = result["summary"]

        with _lock:
            _jobs[job_id].update({
                "status":        "complete",
                "run_status":    status,
                "step":          "Done",
                "progress":      100,
                "outputs":       {k: v.name for k, v in outputs.items()},
                "errors":        errors,
                "elapsed_s":     elapsed,
                "matched":       s["matched_count"],
                "exceptions":    s["bank_only_count"] + s["gl_only_count"],
                "difference":    s["difference"],
                "is_reconciled": result["is_reconciled"],
                "cost_usd":      round(est_cost, 4),
            })

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

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Flux analysis worker
# ---------------------------------------------------------------------------

def _flux_worker(
    job_id, client_id, month, mode, model_id,
    current_path, prior_m_path, prior_y_path, output_dir, config, tmp_dir,
):
    start    = time.monotonic()
    errors   = []
    est_cost = 0.0

    def _step(label, pct):
        with _lock:
            _jobs[job_id].update({"step": label, "progress": pct})

    try:
        _step("Loading trial balances", 15)
        current_df = _load_single_period(current_path)
        prior_m_df = _load_single_period(prior_m_path)
        prior_y_df = _load_single_period(prior_y_path) if prior_y_path else None

        _step("Calculating flux", 40)
        threshold = config.get("variance_threshold", 5.0)
        result    = analyze_flux(current_df, prior_m_df, prior_y_df, threshold_pct=threshold)

        output_dir.mkdir(parents=True, exist_ok=True)

        commentary = []
        if mode == "full":
            _step("Generating AI commentary", 65)
            n_flagged = result["summary"]["any_flagged"]
            if n_flagged > 0:
                if os.getenv("ANTHROPIC_API_KEY"):
                    try:
                        commentary = generate_flux_commentary(result, model=model_id)
                        pricing    = _PRICING.get(model_id, _PRICING["claude-sonnet-4-6"])
                        est_cost   = (
                            (100 + 120 * n_flagged) / 1_000_000 * pricing["input"] +
                            (180 * n_flagged)       / 1_000_000 * pricing["output"]
                        )
                    except Exception as exc:
                        errors.append(f"AI commentary failed: {exc}")
                else:
                    errors.append("ANTHROPIC_API_KEY not set -- AI commentary skipped")

        _step("Exporting flux workbook", 85)
        year_n, mon_n = map(int, month.split("-"))
        period_label  = datetime(year_n, mon_n, 1).strftime("%B %Y")
        if mon_n == 1:
            prior_mon_dt = datetime(year_n - 1, 12, 1)
        else:
            prior_mon_dt = datetime(year_n, mon_n - 1, 1)
        prior_month_label = prior_mon_dt.strftime("%B %Y")
        prior_year_label  = datetime(year_n - 1, mon_n, 1).strftime("%B %Y") if prior_y_path else ""

        out_path = output_dir / f"flux_analysis_{client_id}_{month}.xlsx"
        export_flux_excel(
            result, out_path,
            commentary=commentary or None,
            period_label=period_label,
            prior_month_label=prior_month_label,
            prior_year_label=prior_year_label,
            client_name=config.get("client_name", client_id),
        )

        s       = result["summary"]
        elapsed = round(time.monotonic() - start, 1)
        status  = "success" if not errors else "partial"

        with _lock:
            _jobs[job_id].update({
                "status":         "complete",
                "run_status":     status,
                "step":           "Done",
                "progress":       100,
                "outputs":        {"Flux Analysis Workbook": out_path.name},
                "errors":         errors,
                "elapsed_s":      elapsed,
                "total_accounts": s["total_accounts"],
                "mom_flagged":    s["mom_flagged"],
                "yoy_flagged":    s["yoy_flagged"],
                "cost_usd":       round(est_cost, 4),
            })

    except Exception as exc:
        elapsed = round(time.monotonic() - start, 1)
        with _lock:
            _jobs[job_id].update({
                "status":     "error",
                "run_status": "failed",
                "step":       "Failed",
                "progress":   100,
                "errors":     errors + [str(exc)],
                "elapsed_s":  elapsed,
            })
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
