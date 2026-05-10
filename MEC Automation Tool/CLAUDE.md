# CLAUDE.md — MEC Automation Tool

This file provides Claude Code with project context for the Month-End Close (MEC) Automation Tool. It is loaded automatically when Claude Code is opened in this directory.

---

## Project Purpose

An accounting automation tool used by a CPA consulting practice to:
1. Load two months of trial balance data (current and prior period)
2. Calculate account-level variances and flag material changes
3. Generate AI-powered narrative commentary explaining each flagged variance
4. Produce deliverable-quality outputs: Word close report, Excel variance analysis, Excel JE template

The primary user is an accounting professional, not a developer. The tool should be reliable, produce professional outputs, and never silently produce wrong numbers.

---

## Python Interpreter

Anaconda is installed at `C:\Users\gyima\anaconda3\python.exe`. The `python` shell command maps to the Microsoft Store stub on this Windows machine — always use the full Anaconda path or activate the conda environment before running scripts.

```powershell
$py = "C:\Users\gyima\anaconda3\python.exe"
& $py close_automation.py --client abc_corporation --month 2026-04
```

---

## Running the Tool

```bash
# Full run with AI commentary
python close_automation.py --client abc_corporation --month 2026-04

# Quick run — no AI calls, no cost
python close_automation.py --client abc_corporation --month 2026-04 --mode quick

# Dry run — no files written, no API calls
python close_automation.py --client abc_corporation --month 2026-04 --dry-run

# Overnight batch (50% cheaper)
python run_batch_close.py submit --client abc_corporation --month 2026-04
python run_batch_close.py retrieve --manifest output/abc_corporation/2026-04/batch_manifest.json
```

---

## Architecture

All modules are in the flat `MEC Automation Tool/` directory. No packages, no `__init__.py`.

```
close_automation.py      ← Main CLI orchestrator (entry point for users)
run_batch_close.py       ← Overnight batch workflow entry point
commentary_generator.py  ← Anthropic API: real-time + Batch API
variance_calculator.py   ← Core math: outer join, flag logic, Excel export
report_generator.py      ← python-docx Word report generation
je_generator.py          ← openpyxl Excel JE template with dropdowns/CF
data_parser.py           ← Single-file TB loader with strict validation
config_manager.py        ← JSON client config: load, validate, merge defaults
generate_sample_data.py  ← Creates test data (not part of the close workflow)
```

### Data flow

```
data/<client_id>/<client_id>_<YYYY-MM>.xlsx  (current period)
data/<client_id>/<client_id>_<YYYY-MM>.xlsx  (prior period)
         │
         ▼  close_automation._load_single_period()
    [Account_Number, Account_Name, Balance]  × 2 DataFrames
         │
         ▼  variance_calculator.calculate_variances()
    [Account_Number, Account_Name, Current_Balance, Prior_Balance,
     Variance_Amount, Variance_Pct, Flagged]   ← full_report DataFrame
         │
    ┌────┴─────────────────────────────────────┐
    ▼                                          ▼
variance_calculator.export_to_excel()    commentary_generator.generate_commentary()
    variance_report.xlsx                      [{"account_number", "account_name",
                                               "commentary"}, ...]
                                              │
                                    ┌─────────┴──────────┐
                                    ▼                    ▼
                          report_generator         je_generator
                          close_report.docx        je_template.xlsx
```

### Config flow

```
config/<client_id>.json
       │
       ▼  config_manager.load_client_config()
  raw dict (may be missing optional keys)
       │
       ▼  config_manager.merge_with_defaults()
  merged dict with injected aliases:
    variance_threshold_pct  ← variance_threshold
    variance_threshold_abs  ← materiality_amount
    account_groups          ← derived from account_mapping if not set
```

---

## Module Contracts

### `commentary_generator.py`

**Public API:**
- `generate_commentary(flagged, model, api_key, batch_mode, batch_save_path) → list[dict]`
  - Real-time: all flagged accounts in one API call; returns immediately
  - Batch: submits job, saves manifest, returns `[]`
- `submit_commentary_batch(flagged, model, api_key) → dict`
- `check_batch_status(batch_id, api_key) → dict`
- `retrieve_batch_results(batch_id, accounts, api_key) → list[dict]`
- `poll_and_retrieve(batch_id, accounts, ...) → list[dict]`
- `load_batch_job(json_path) → dict`

**Commentary dict format:** `{"account_number": str, "account_name": str, "commentary": str}`

**Model aliases:** `"haiku"` → `claude-haiku-4-5`, `"sonnet"` → `claude-sonnet-4-6`, `"opus"` → `claude-opus-4-7`

**Real-time:** sends all flagged accounts as a single JSON array, gets back a JSON array indexed by integer. Uses `cache_control: {"type": "ephemeral"}` on the system block.

**Batch:** one request per account using `_ACCT_USER_TMPL` plain text template; custom_id format `acct-{i:04d}-{acct_num}`.

### `variance_calculator.py`

**Public API:**
- `calculate_variances(current, prior, balance_col, account_col, name_col, threshold_pct) → DataFrame`
  - Both DFs need: account_col, name_col (current only), balance_col
- `calculate_variances_single(df, threshold_pct) → DataFrame`
  - Single DF with Current_Balance and Prior_Balance already present
- `export_to_excel(report, path) → None`

**Output columns:** `Account_Number, Account_Name, Current_Balance, Prior_Balance, Variance_Amount, Variance_Pct, Flagged`

**Flag logic:** `abs(Variance_Pct) > threshold_pct` — percentage only, no dollar floor in the calculator itself (materiality_amount is applied at the reporting layer).

### `config_manager.py`

**Public API:**
- `load_client_config(client_id, config_dir) → dict`
- `validate_config(config) → list[str]`  — empty list = valid
- `create_new_client(client_name, config_dir) → dict`
- `save_client_config(config, config_dir) → Path`
- `list_clients(config_dir) → list[str]`
- `merge_with_defaults(config) → dict`
- `get_account_info(config, account_number) → dict | None`
- `get_accounts_by_group(config, group_name) → list[dict]`

**Required fields:** `client_id` (str), `client_name` (str), `variance_threshold` (float), `materiality_amount` (float), `fiscal_year_end` (MM-DD str)

**`_meta` keys** (prefixed with `_`) in JSON files are stripped before validation.

### `report_generator.py`

**Public API:**
- `generate_report(full_report, commentary, config, output_path, period_label) → None`

**Sections:** Header (logo + metadata table), Executive Summary (KPI tiles), Variance Detail Table, AI Commentary, Appendix (all accounts).

**Colour palette key** (`_C` dict): `navy`, `light_blue`, `comm_bg` (F3F3F3), `flag_red` (FFC7CE), `flag_yellow` (FFEB9C).

**Flagging thresholds in Word report:** red fill for `abs(Variance_Pct) > 10`, yellow for 5–10%.

### `je_generator.py`

**Public API:**
- `create_je_template(flagged, config, period_label, output_dir, commentary, full_report) → Path`

**Sheets:** `Journal Entries` (main data), `Summary` (per-JE balance status), `Account_List` (hidden, feeds dropdown).

**Excel quirk:** `DataValidation(showDropDown=False)` = SHOW arrow (counterintuitive XML).

**Balance formula:** `AND($A3<>"",ROUND(SUMIF($A$3:$A$502,$A3,$F$3:$F$502)-SUMIF($A$3:$A$502,$A3,$G$3:$G$502),2)<>0)` — uses ROUND to avoid float precision false positives.

### `data_parser.py`

**Public API:**
- `load_trial_balance(file_path) → DataFrame`
  - Expects a single file with both Current_Balance and Prior_Balance columns
  - Required columns: `Account_Number, Account_Name, Current_Balance, Prior_Balance`

> Note: `close_automation.py` and `run_batch_close.py` do NOT use `load_trial_balance()` directly. They use their own `_load_single_period()` helper to load one-period-per-file format, then pass two DataFrames to `calculate_variances()`.

---

## Sample Data

Located at `data/ABC_Corp/`:
- `trial_balance_2026-04.xlsx` — April 2026 (current period)
- `trial_balance_2026-03.xlsx` — March 2026 (prior period)
- 50 accounts; 6 flagged at the 5% threshold

| Account | Variance | Story |
|---|---|---|
| 6300 Office Supplies | +500% | One-time bulk order |
| 6600 Marketing | −25% | Campaign ended |
| 1000 Cash | +17.5% | AR collections arrived |
| 1100 Accounts Receivable | +15% | Delayed collections |
| 5000 Raw Materials | +12% | Revenue-driven COGS increase |
| 4000 Product Sales | +8% | Business growth |

Generated by `generate_sample_data.py` (Anaconda openpyxl, not part of the close workflow).

---

## Key Conventions

- **Column names are normalized** before any lookup: lowercased, spaces → underscores. This is how alias matching works in `_load_single_period()` and `config_manager`.
- **Account numbers are always strings**, never ints. A TB file with account `1000` stored as a number in Excel may be read as `"1000.0"` by pandas without `dtype=str`. Always load with `pd.read_excel(..., dtype=str)`.
- **`merge_with_defaults()` must be called** after `load_client_config()`. It injects the aliases that downstream modules expect (`variance_threshold_pct`, etc.) and derives `account_groups` from `account_mapping` if not set.
- **Batch mode returns `[]`** from `generate_commentary()`. Callers must check the return value and handle the async case before attempting to use commentary in report generation.
- **tqdm and logging conflict** in the CLI. The `_TqdmHandler` routes all logging through `tqdm.write()` to avoid corrupting progress bars.

---

## Adding Features

- **New output format:** Add a new generator module (e.g., `pdf_generator.py`) and call it from `close_automation.py` in the step after `report_generator`.
- **New client:** Copy `config/client_template.json`, rename to `config/<client_id>.json`, fill in the fields.
- **New column alias:** Add to the `_ACCT_ALIASES`, `_NAME_ALIASES`, or `_BAL_ALIASES` lists in `close_automation._load_single_period()` and `run_batch_close._load_single_period()`.
- **New AI model:** Add to `_MODEL_ALIASES` in `commentary_generator.py` and update `_PRICING` in `close_automation.py`.

---

## Dependencies

```
pandas>=2.0.0        DataFrame operations
openpyxl>=3.1.0      Excel read/write
python-docx>=1.1.0   Word document generation
pyyaml>=6.0          YAML config support (legacy)
numpy>=1.24.0        Numeric operations
anthropic>=0.40.0    Claude API (real-time + batch)
tqdm>=4.66.0         Progress bars
```

Install: `pip install -r requirements.txt`
