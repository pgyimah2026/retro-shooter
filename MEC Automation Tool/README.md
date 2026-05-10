# MEC Automation Tool

AI-powered month-end close automation for accounting consulting practices. Loads two months of trial balance data, flags material variances, generates professional Word reports with AI narrative commentary, and creates Excel journal entry templates — all from a single command.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Installation](#installation)
3. [API Key Setup](#api-key-setup)
4. [Quick Start](#quick-start)
5. [Example Commands](#example-commands)
6. [Configuration Guide](#configuration-guide)
7. [Cost Estimation](#cost-estimation)
8. [Troubleshooting](#troubleshooting)

---

## Requirements

| Requirement | Version |
|---|---|
| Python | 3.10 or later |
| Anthropic API key | Required for AI commentary (free to create) |
| Microsoft Word | Recommended for viewing `.docx` reports |
| Microsoft Excel | Recommended for viewing `.xlsx` files |

---

## Installation

### Step 1 — Clone or download the project

```bash
git clone https://github.com/pgyimah2026/retro-shooter.git
cd "MEC Automation Tool"
```

### Step 2 — Create a virtual environment (recommended)

**Windows (Command Prompt or PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\activate
```

**Windows (Anaconda):**
```powershell
conda create -n mec python=3.11
conda activate mec
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Set your API key

Copy the example environment file and fill in your key:

```bash
cp .env.example .env
```

Then open `.env` and replace the placeholder with your actual Anthropic API key. See [API Key Setup](#api-key-setup) for details.

### Step 5 — Verify the installation

```bash
python commentary_generator.py --help
```

You should see the help text with no errors.

---

## API Key Setup

### Getting your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in (or create a free account).
2. Click **API Keys** in the left sidebar.
3. Click **Create Key**, give it a name (e.g., "MEC Tool"), and copy the key. It starts with `sk-ant-`.

> **Important:** The key is shown only once. Copy it immediately and store it somewhere safe.

### Setting the key on Windows

**Option A — `.env` file (recommended for development):**

Edit the `.env` file in this directory:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Then install python-dotenv so the tool loads it automatically:
```bash
pip install python-dotenv
```

**Option B — System environment variable (recommended for shared machines):**

```powershell
# Set permanently for your user account
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-your-key-here", "User")
```

**Option C — Per-session (disappears when you close the terminal):**
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-your-key-here"
```

### Setting the key on macOS / Linux

```bash
# Add to ~/.zshrc or ~/.bashrc for permanent effect
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
source ~/.zshrc
```

### Verifying the key is set

```bash
python -c "import os; print('Key set:', bool(os.getenv('ANTHROPIC_API_KEY')))"
```

---

## Quick Start

### 1. Run the included sample data

The repository includes two months of sample trial balance data for ABC Corporation:

```bash
python close_automation.py --client abc_corporation --month 2026-04
```

This runs the full workflow:
- Loads `data/ABC_Corp/trial_balance_2026-04.xlsx` (current) and `trial_balance_2026-03.xlsx` (prior)
- Flags 6 accounts with variances above the 5% threshold
- Calls the Anthropic API to generate commentary
- Writes three output files to `output/abc_corporation/2026-04/`

### 2. View the outputs

```
output/abc_corporation/2026-04/
  variance_report.xlsx                          ← colour-coded variance analysis
  close_report_abc_corporation_2026-04.docx     ← professional Word report
  journal_entries_template_ABC_Corp_Apr_2026.xlsx  ← JE template with dropdowns
```

### 3. Try a dry run first (no API calls, no files written)

```bash
python close_automation.py --client abc_corporation --month 2026-04 --dry-run
```

---

## Example Commands

### Standard full-close run

```bash
python close_automation.py --client abc_corporation --month 2026-04
```

### Quick mode — no AI, no API costs

Skips commentary generation. Fast and free. Good for reviewing variance numbers before deciding whether to run the full close.

```bash
python close_automation.py --client abc_corporation --month 2026-04 --mode quick
```

### Use a cheaper model for larger clients

```bash
# Haiku is 5x cheaper than Sonnet, fine for straightforward variances
python close_automation.py --client abc_corporation --month 2026-04 --model haiku

# Opus gives richer analysis for complex situations
python close_automation.py --client abc_corporation --month 2026-04 --model opus
```

### Override the variance threshold for this run

```bash
# Flag everything above 3.5% instead of the client's configured 5%
python close_automation.py --client abc_corporation --month 2026-04 --threshold 3.5
```

### Supply explicit file paths (bypass auto-detection)

```bash
python close_automation.py \
  --client abc_corporation \
  --month 2026-04 \
  --current path/to/apr_tb.xlsx \
  --prior   path/to/mar_tb.xlsx
```

### Dry run — preview without touching anything

```bash
python close_automation.py --client abc_corporation --month 2026-04 --dry-run
```

### Verbose logging for debugging

```bash
python close_automation.py --client abc_corporation --month 2026-04 --verbose
```

### Overnight batch run (50% cost discount)

Submit before you leave:
```bash
python run_batch_close.py submit --client abc_corporation --month 2026-04
```

Retrieve the next morning:
```bash
python run_batch_close.py retrieve \
  --manifest output/abc_corporation/2026-04/batch_manifest.json
```

Or wait synchronously (blocks until the batch finishes):
```bash
python run_batch_close.py retrieve \
  --manifest output/abc_corporation/2026-04/batch_manifest.json \
  --wait
```

Check status without retrieving:
```bash
python run_batch_close.py status \
  --manifest output/abc_corporation/2026-04/batch_manifest.json
```

---

## Configuration Guide

### File naming convention

Trial balance files must be named:
```
data/<client_id>/<client_id>_<YYYY-MM>.xlsx
```

Example for ABC Corporation, April 2026:
```
data/abc_corporation/abc_corporation_2026-04.xlsx
```

The tool also accepts `.csv` files and will fall back to a glob search if the exact name isn't found.

### Trial balance column names

Your Excel file must have three columns (exact names or common aliases are accepted):

| Required column | Accepted aliases |
|---|---|
| `Account_Number` | `account`, `acct_no`, `acct_num`, `account_no` |
| `Account_Name` | `name`, `description`, `acct_name`, `account_desc` |
| `Balance` | `amount`, `ending_balance`, `current_balance`, `period_balance` |

Put your column headers in row 1. The tool reads row 1 as headers automatically.

### Adding a new client

**Step 1 — Copy the template:**
```bash
cp config/client_template.json config/my_client.json
```

**Step 2 — Edit the JSON file** with the client's details:

```json
{
  "client_id":   "my_client",
  "client_name": "My Client LLC",
  "preparer":    "Jane Smith, CPA",
  "firm":        "Smith & Associates",

  "fiscal_year_end":    "12-31",
  "variance_threshold": 5.0,
  "materiality_amount": 2500.0,

  "contact_info": {
    "preparer_name":        "Jane Smith, CPA",
    "preparer_email":       "jsmith@smithcpa.com",
    "preparer_phone":       "(555) 123-4567",
    "client_contact_name":  "Bob Johnson",
    "client_contact_title": "Controller",
    "client_contact_email": "bjohnson@myclientllc.com"
  },

  "account_mapping": {
    "1000": { "name": "Cash", "type": "Asset", "group": "Current Assets",
              "normal_balance": "debit", "statement": "balance_sheet", "active": true },
    "4000": { "name": "Revenue", "type": "Revenue", "group": "Revenue",
              "normal_balance": "credit", "statement": "income_statement", "active": true }
  }
}
```

**Key fields:**

| Field | Description | Example |
|---|---|---|
| `client_id` | Must match the filename and data directory name | `"abc_corporation"` |
| `variance_threshold` | % above which an account is flagged | `5.0` (5%) |
| `materiality_amount` | Dollar floor for flagging | `2500.0` |
| `fiscal_year_end` | MM-DD format | `"12-31"` or `"06-30"` |

**Step 3 — Create the data directory:**
```bash
mkdir data/my_client
```

**Step 4 — Place trial balance files:**
```
data/my_client/my_client_2026-04.xlsx   ← current month
data/my_client/my_client_2026-03.xlsx   ← prior month
```

**Step 5 — Run:**
```bash
python close_automation.py --client my_client --month 2026-04
```

### Listing configured clients

```bash
python -c "from config_manager import list_clients; print(list_clients())"
```

---

## Cost Estimation

### How tokens are counted

Each flagged account in a real-time run uses approximately:

| Component | Tokens |
|---|---|
| System prompt (cached after first call) | ~75 |
| Per-account input (variance data) | ~130 |
| Per-account output (2–3 sentence commentary) | ~190 |

### Estimated cost per run

**Real-time mode (immediate results):**

| Model | 5 flagged accts | 10 flagged accts | 20 flagged accts |
|---|---|---|---|
| **Haiku** (`--model haiku`) | ~$0.003 | ~$0.005 | ~$0.009 |
| **Sonnet** (`--model sonnet`, default) | ~$0.008 | ~$0.014 | ~$0.026 |
| **Opus** (`--model opus`) | ~$0.013 | ~$0.024 | ~$0.046 |

**Batch mode — 50% cheaper (overnight, non-urgent):**

| Model | 5 flagged accts | 10 flagged accts | 20 flagged accts |
|---|---|---|---|
| **Haiku** | ~$0.002 | ~$0.003 | ~$0.005 |
| **Sonnet** (default) | ~$0.004 | ~$0.007 | ~$0.013 |
| **Opus** | ~$0.007 | ~$0.012 | ~$0.023 |

### Actual cost vs. estimate

The tool prints an estimated cost in the run summary. For actual costs, visit [console.anthropic.com/usage](https://console.anthropic.com/usage).

### Tips to reduce costs

- Use **`--mode quick`** when you only need the variance numbers (no AI, no cost).
- Use **`--model haiku`** for routine months with straightforward variances.
- Use **batch mode** (`run_batch_close.py submit`) for all non-urgent processing — it cuts every API call in half.
- Prompt caching is active in real-time mode: the system prompt is cached for 5 minutes, so repeated runs within the same session pay reduced rates.

---

## Troubleshooting

### `ANTHROPIC_API_KEY` not set

```
Error: ANTHROPIC_API_KEY environment variable is not set
```

**Fix:** Set the variable in your terminal session or `.env` file. See [API Key Setup](#api-key-setup).

---

### Trial balance file not found

```
FileNotFoundError: No trial balance file found for abc_corporation 2026-04 in data/abc_corporation
```

**Fix:** Check that the file exists and follows the naming convention:
```
data/<client_id>/<client_id>_<YYYY-MM>.xlsx
```
Note the client_id is lowercase with underscores (matches the config filename, not the display name).

Use `--current` and `--prior` to supply explicit paths and bypass auto-detection:
```bash
python close_automation.py --client abc_corporation --month 2026-04 \
  --current data/ABC_Corp/trial_balance_2026-04.xlsx \
  --prior   data/ABC_Corp/trial_balance_2026-03.xlsx
```

---

### Column not identified in trial balance

```
ValueError: Could not identify column(s): ['account number'] in trial_balance.xlsx
```

**Fix:** Rename the column in your Excel file to one of the accepted names. The most reliable names to use are `Account_Number`, `Account_Name`, and `Balance`.

---

### Config file not found

```
FileNotFoundError: config/my_client.json not found
```

**Fix:** Create the config file by copying the template:
```bash
cp config/client_template.json config/my_client.json
```
Then edit it with the client's details. The `client_id` field must match the filename.

---

### Rate limit error

```
anthropic.RateLimitError: Rate limit exceeded
```

**Fix:**
- Wait 60 seconds and retry.
- If it recurs, switch to `--model haiku` (lower token volume).
- For high-volume months, use batch mode (`run_batch_close.py submit`) — batch jobs bypass rate limits.

---

### `python` command not found on Windows

```
'python' is not recognized as an internal or external command
```

**Fix:** If you have Anaconda, use the full path or activate the conda environment first:
```powershell
# Activate the base conda environment
conda activate base

# Or use the full path
C:\Users\<you>\anaconda3\python.exe close_automation.py --client ...
```

---

### Word report opens with formatting issues

The `.docx` report is generated with python-docx. It displays best in Microsoft Word. LibreOffice Writer renders it but some formatting may differ (table borders, font sizes).

---

### Journal entry template dropdowns don't appear

Excel's data validation dropdowns require macros to be enabled in some security configurations. If the arrow doesn't appear:
1. Open the JE template in Excel.
2. Click **File → Options → Trust Center → Trust Center Settings**.
3. Ensure **Data** validation is not disabled.
4. Re-open the file.

---

### Batch job expired

```
Commentary unavailable — batch request expired.
```

Batch API jobs expire after 24 hours. If you submit at 5 PM and don't retrieve until the following evening (>24 hours), requests will expire.

**Fix:** Resubmit the job:
```bash
python run_batch_close.py submit --client abc_corporation --month 2026-04
```

---

## Project Structure

```
MEC Automation Tool/
  close_automation.py       Main CLI — orchestrates the full workflow
  run_batch_close.py        Overnight batch workflow (submit + retrieve)
  commentary_generator.py   Anthropic API integration (real-time + batch)
  variance_calculator.py    Computes flagged variances, exports Excel
  report_generator.py       Generates professional Word (.docx) reports
  je_generator.py           Creates Excel JE templates with dropdowns
  data_parser.py            Loads and validates trial balance files
  config_manager.py         Client configuration management
  generate_sample_data.py   Creates sample trial balance files for testing

  config/
    client_template.json    Copy this to add a new client
    abc_corporation.json    Sample client configuration

  data/
    <client_id>/
      <client_id>_<YYYY-MM>.xlsx   One file per period

  output/
    <client_id>/
      <YYYY-MM>/
        variance_report.xlsx
        close_report_<client>_<period>.docx
        journal_entries_template_<Client>_<Period>.xlsx
        batch_manifest.json   (batch mode only)
```
