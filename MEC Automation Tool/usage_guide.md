# MEC Automation Tool — Step-by-Step Usage Guide

This guide walks through the complete month-end close workflow from start to finish. No programming experience is required — just follow each step in order.

---

## Before You Begin

Make sure you have completed the one-time setup in the [README.md](README.md):
- Python installed ✓
- Dependencies installed (`pip install -r requirements.txt`) ✓
- Anthropic API key set ✓
- At least one client config file in `config/` ✓

---

## Part 1: Preparing the Trial Balance Files

### What file format does the tool accept?

The tool reads trial balance data from **Excel files** (`.xlsx`) or **CSV files** (`.csv`).

Your file must have three columns — the exact column names can vary (the tool recognises common alternatives):

| What it represents | Accepted column names |
|---|---|
| Account number | `Account_Number`, `Account`, `Acct_No`, `Account_No` |
| Account name / description | `Account_Name`, `Name`, `Description`, `Acct_Name` |
| Balance for this period | `Balance`, `Amount`, `Ending_Balance`, `Current_Balance` |

**You need one file per month.** Each file should contain only the balances for that one month — not a year-to-date total unless your practice uses YTD balances.

### Example of a correctly formatted trial balance

| Account_Number | Account_Name | Balance |
|---|---|---|
| 1000 | Cash and Cash Equivalents | 235000 |
| 1100 | Accounts Receivable | 387500 |
| 4000 | Product Sales | 342500 |
| 6600 | Marketing & Advertising | 18750 |

### Where to save the files

Place each file in the folder `data/<client_id>/` using this naming pattern:

```
data/abc_corporation/abc_corporation_2026-04.xlsx    ← April (current month)
data/abc_corporation/abc_corporation_2026-03.xlsx    ← March (prior month)
```

The `<client_id>` must match exactly what is in the client's config file. It is always **lowercase with underscores** (not the display name — see the `client_id` field in the config).

**Note on the sample data:** If you want to test the tool before using real data, sample files are already in `data/ABC_Corp/`. You can run the tool on those right now.

---

## Part 2: Running the Month-End Close

### Step 1 — Open a terminal in the tool folder

**Windows:** Right-click in the `MEC Automation Tool` folder → "Open in Terminal" (or open PowerShell and navigate there).

**macOS:** Right-click the folder in Finder → "New Terminal at Folder".

### Step 2 — Activate your Python environment

If you're using Anaconda (Windows):
```powershell
conda activate base
```

If you set up a virtual environment:
```bash
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\activate           # Windows
```

### Step 3 — Run a dry run first

A dry run shows you what the tool *would* do without actually calling the API or writing any files. It's a good sanity check before the real run.

```bash
python close_automation.py --client abc_corporation --month 2026-04 --dry-run
```

You'll see output like:
```
  MEC Automation Tool — ABC Corporation | April 2026
  ────────────────────────────────────────────────────────
  [1] Loading config          ✓
  [2] Loading trial balances  ✓ (current: 50 accounts | prior: 50 accounts)
  [3] Calculating variances   ✓ (6 flagged at 5.0% threshold)

  DRY RUN — no files written.

  Flagged accounts (6):
    6300  Office Supplies & Equipment     +500.0%   $5,200 → $31,200
    6600  Marketing & Advertising          -25.0%  $25,000 → $18,750
    1000  Cash and Cash Equivalents        +17.5%  $200,000 → $235,000
    1100  Accounts Receivable              +15.0%  $337,000 → $387,500
    5000  Raw Materials Used               +12.0%   $88,100 → $98,700
    4000  Product Sales — Domestic          +8.0%  $317,100 → $342,500

  Estimated cost if run in full mode: ~$0.008  (model: claude-sonnet-4-6)
```

### Step 4 — Run the full close

Once the dry run looks right, run the real thing:

```bash
python close_automation.py --client abc_corporation --month 2026-04
```

The tool will show a progress bar as it works through each step:

```
  MEC Automation Tool — ABC Corporation | April 2026
  ────────────────────────────────────────────────────────
  Loading config            ████████████████ 1/1  [0:00]
  Loading trial balances    ████████████████ 1/1  [0:01]
  Calculating variances     ████████████████ 1/1  [0:00]
  Exporting variance Excel  ████████████████ 1/1  [0:00]
  Generating AI commentary  ████████████████ 1/1  [0:04]
  Creating JE template      ████████████████ 1/1  [0:01]
  Generating Word report    ████████████████ 1/1  [0:02]

  ────────────────────────────────────────────────────────
  Run complete in 8.3 s
  Client:   ABC Corporation
  Period:   April 2026
  Flagged:  6 accounts  (threshold: 5.0%)
  API cost: ~$0.008 (actual usage: 847 input / 1,142 output tokens)

  Output → output/abc_corporation/2026-04/
    variance_report.xlsx
    close_report_abc_corporation_2026-04.docx
    journal_entries_template_ABC_Corp_April_2026.xlsx
```

The entire run typically takes **10–30 seconds** depending on how many accounts are flagged.

---

## Part 3: Reviewing the Outputs

All output files are saved to `output/<client_id>/<YYYY-MM>/`.

### File 1 — `variance_report.xlsx` (Excel)

Open this first. It contains every account from both periods side by side.

| What you'll see | What it means |
|---|---|
| **Red rows** | Account variance is greater than 10% — needs attention |
| **Yellow rows** | Account variance is 5–10% — review recommended |
| White rows | Variance is below the flag threshold — no action needed |
| Sorted by variance | Biggest changes are at the top |

Use this to do your initial review and confirm the variances make sense before opening the Word report.

### File 2 — `close_report_<client>_<period>.docx` (Word)

This is the client-ready deliverable. It contains:

1. **Header** — firm name, client name, preparer, period
2. **Executive Summary** — key metrics at a glance (total accounts, flagged count, largest variance, total change)
3. **Variance Detail Table** — all flagged accounts with dollar amounts and percentages
4. **AI Commentary** — 2–3 sentence professional explanation for each flagged account
5. **Appendix** — all accounts in summary format

**What to review before sending to the client:**
- Check that the AI commentary sounds accurate and matches what you know about the client's business
- Edit any commentary that doesn't fit (it's a Word document — click and type)
- Replace the header logo placeholder if you have a firm logo
- Verify the contact information in the header is correct

### File 3 — `journal_entries_template_<client>_<period>.xlsx` (Excel)

This is a pre-populated JE worksheet for any adjusting entries needed. For each flagged account, the tool adds two rows (one debit, one credit side).

**How to use it:**
1. Open the file. You'll see each flagged variance pre-populated with the account number and description.
2. Fill in the amounts for each entry.
3. Use the **dropdown arrow** in column A to select the account for the credit side.
4. The **Summary** tab turns green when a journal entry is balanced and red when it's not.
5. Delete any JE rows you don't need (select the rows → right-click → Delete).

---

## Part 4: The Overnight Batch Option (Save 50%)

If you don't need the report ready immediately, you can submit the AI commentary job overnight and collect it in the morning. The Anthropic Batch API costs 50% less than real-time calls.

### Evening — submit the batch

This takes about 10 seconds and costs nothing until the AI commentary is retrieved.

```bash
python run_batch_close.py submit --client abc_corporation --month 2026-04
```

You'll see:
```
  MEC Batch Close — SUBMIT
  ──────────────────────────────────────────────────────────────────────
  [1/5] Loading config: abc_corporation
  [2/5] Locating trial balance files
  [3/5] Calculating variances
        50 accounts | 6 flagged (>5.0% variance)
  [4/5] Exporting variance Excel
  [5/5] Submitting Anthropic Batch API job
        Batch ID:  msgbatch_abc123xyz
        Requests:  6
        Model:     claude-sonnet-4-6

  Manifest saved → output/abc_corporation/2026-04/batch_manifest.json

  Next step (tomorrow morning):
    python run_batch_close.py retrieve --manifest "output/abc_corporation/2026-04/batch_manifest.json"
```

Copy the `retrieve` command shown — you'll need it in the morning.

### Optional — check status anytime

```bash
python run_batch_close.py status \
  --manifest output/abc_corporation/2026-04/batch_manifest.json
```

### Morning — retrieve results

```bash
python run_batch_close.py retrieve \
  --manifest output/abc_corporation/2026-04/batch_manifest.json
```

This generates the Word report and JE template, exactly as if you had run the full close in real-time. The output files appear in the same `output/abc_corporation/2026-04/` folder.

---

## Part 5: Adding a New Client

### Step 1 — Create the config file

Copy the template and open the new file in any text editor (Notepad works fine):

```bash
cp config/client_template.json config/green_valley_llc.json
```

### Step 2 — Fill in the required fields

The minimum you need to change (look for `__REQUIRED__`):

```json
{
  "client_id":   "green_valley_llc",
  "client_name": "Green Valley LLC",
  "preparer":    "Jane Smith, CPA",
  "firm":        "Smith & Associates",

  "fiscal_year_end":    "12-31",
  "variance_threshold": 5.0,
  "materiality_amount": 1000.0
}
```

> **Important:** `client_id` must be lowercase with underscores and must exactly match:
> - The config filename: `config/green_valley_llc.json`
> - The data folder name: `data/green_valley_llc/`
> - The trial balance file name prefix: `green_valley_llc_2026-04.xlsx`

### Step 3 — Create the data folder

```bash
mkdir data/green_valley_llc
```

### Step 4 — Save your trial balance files there

```
data/green_valley_llc/green_valley_llc_2026-04.xlsx
data/green_valley_llc/green_valley_llc_2026-03.xlsx
```

### Step 5 — Run a dry run to confirm everything is wired up

```bash
python close_automation.py --client green_valley_llc --month 2026-04 --dry-run
```

---

## Part 6: Choosing the Right Mode for Each Situation

| Situation | Recommended command |
|---|---|
| First time with a new client | `--dry-run` to verify setup |
| Just want to check the numbers, no AI | `--mode quick` |
| Normal monthly close | `python close_automation.py --client X --month YYYY-MM` |
| Large client, routine variances, cost-conscious | Add `--model haiku` |
| Complex client with unusual changes | Add `--model opus` |
| Not in a rush, want to cut costs in half | Use `run_batch_close.py submit` tonight |
| Something looks wrong | Add `--verbose` to see detailed logs |

---

## Part 7: Common Questions

**Q: The commentary says something that's not accurate for this client. Can I edit it?**

Yes — the Word report is a standard `.docx` file. Open it in Word, click on the commentary text, and edit it like any other document. The AI commentary is a starting point, not a final answer.

**Q: How do I run the tool for a fiscal year end that isn't December?**

Set `fiscal_year_end` in the client's config to the correct month/day. For a June 30 fiscal year end, use `"06-30"`. The variance calculation itself is always month-over-month regardless of fiscal year.

**Q: What if the prior month file doesn't exist yet (first month of a new client)?**

You'll need a prior period file to calculate variances. For a brand new client, you can:
- Export the prior month from their accounting system
- Create a minimal file with the prior balances for the accounts you expect to have variances in

**Q: Can I run the tool for a quarter instead of a month?**

The tool is designed for month-over-month comparison. For quarterly analysis, provide the quarter-end balance as the "current" file and the prior quarter-end as the "prior" file, then set `--month` to the quarter-end month (e.g., `--month 2026-03` for Q1).

**Q: The numbers look right but the Word document formatting looks off.**

Make sure you're opening the `.docx` file in Microsoft Word, not LibreOffice or Google Docs. The report is optimised for Word and uses advanced formatting features that other applications may not render identically.

**Q: I got an error about a missing column in my Excel file. How do I fix it?**

Open your trial balance Excel file and rename the column headers to match exactly what the tool expects. The safest names to use are:
- `Account_Number` (column A)
- `Account_Name` (column B)
- `Balance` (column C)

Make sure row 1 contains the headers and data starts in row 2.

**Q: Can I use a CSV file instead of Excel?**

Yes. Save your trial balance as `.csv` (comma-separated) with the same column structure. Put the file in the same `data/<client_id>/` folder with the same naming convention, just using `.csv` instead of `.xlsx`.

---

## Quick Reference Card

```
Standard close (full):
  python close_automation.py --client <client_id> --month <YYYY-MM>

Quick mode (no AI, free):
  python close_automation.py --client <client_id> --month <YYYY-MM> --mode quick

Dry run (no files, no cost):
  python close_automation.py --client <client_id> --month <YYYY-MM> --dry-run

Cheap model (5x less than Sonnet):
  python close_automation.py --client <client_id> --month <YYYY-MM> --model haiku

Overnight batch — submit:
  python run_batch_close.py submit --client <client_id> --month <YYYY-MM>

Overnight batch — retrieve:
  python run_batch_close.py retrieve --manifest output/<client_id>/<YYYY-MM>/batch_manifest.json

Check batch status:
  python run_batch_close.py status --manifest output/<client_id>/<YYYY-MM>/batch_manifest.json
```
