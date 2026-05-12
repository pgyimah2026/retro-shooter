"""generate_sample_bank_data.py -- Create sample bank rec test files.

Writes two Excel files to data/ABC_Corp/:
  bank_statement_2026-04.xlsx   -- 19 bank transactions (3 unmatched)
  gl_cash_subledger_2026-04.xlsx -- 19 GL entries (3 unmatched)

Reconciliation scenario:
  Bank ending balance:  $86,628.50
  GL ending balance:    $92,861.00

  Bank-only exceptions (not yet booked):
    NSF Fee - Returned Check    -$35.00
    Interest Income            +$127.50
    Bank Service Charge         -$25.00

  GL-only exceptions (not yet cleared):
    Client GHI Wire (Deposit in Transit)  +$11,000.00
    Consultant Fee - Outstanding Check     -$3,500.00
    IT Contractor - Outstanding Check      -$1,200.00

  Adjusted bank balance: $92,928.50
  Adjusted book balance: $92,928.50
  Difference:                  $0.00  (reconciled)
"""

from pathlib import Path

import pandas as pd


def main():
    out_dir = Path(__file__).parent / "data" / "ABC_Corp"
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- Bank Statement ------------------------------------------------
    bank_rows = [
        ("2026-04-01", "Opening Balance Transfer",            50000.00),
        ("2026-04-02", "Client Payment - Invoice 2026-031",   12500.00),
        ("2026-04-03", "Client Payment - Invoice 2026-028",    8750.00),
        ("2026-04-05", "ACH - Vendor XYZ Payment",            -3200.00),
        ("2026-04-07", "Client Payment - Invoice 2026-032",    5000.00),
        ("2026-04-08", "ACH - Payroll Direct Deposit",       -22000.00),
        ("2026-04-10", "Wire Transfer - Equipment Purchase",  -15000.00),
        ("2026-04-12", "NSF Fee - Returned Check",               -35.00),  # bank only
        ("2026-04-14", "ACH - Rent Payment",                  -4500.00),
        ("2026-04-15", "Client Payment - Invoice 2026-029",    9500.00),
        ("2026-04-16", "ACH - Insurance Premium",             -1850.00),
        ("2026-04-18", "Interest Income",                       127.50),  # bank only
        ("2026-04-20", "Wire Receipt - Client ABC",           25000.00),
        ("2026-04-22", "ACH - Utilities Payment",              -890.00),
        ("2026-04-24", "ACH - Software Subscription",          -299.00),
        ("2026-04-25", "Client Payment - Invoice 2026-033",    6000.00),
        ("2026-04-26", "ACH - Office Supplies",                -450.00),
        ("2026-04-28", "Wire Receipt - Client DEF",           18000.00),
        ("2026-04-29", "Bank Service Charge",                    -25.00),  # bank only
    ]
    bank_df = pd.DataFrame(bank_rows, columns=["Date", "Description", "Amount"])
    bank_df["Date"]    = pd.to_datetime(bank_df["Date"])
    bank_df["Balance"] = bank_df["Amount"].cumsum()

    bank_path = out_dir / "bank_statement_2026-04.xlsx"
    bank_df.to_excel(str(bank_path), index=False)

    # ---- GL Cash Subledger ----------------------------------------------
    gl_rows = [
        ("2026-04-01", "Transfer from Operating Reserve",       "DEP001",       0, 50000.00),
        ("2026-04-01", "Invoice 2026-031 - Client Payment",     "DEP002",       0, 12500.00),
        ("2026-04-03", "Invoice 2026-028 - Client Payment",     "DEP003",       0,  8750.00),
        ("2026-04-05", "Vendor XYZ - April Services",           "CHK1050", 3200.00,       0),
        ("2026-04-07", "Invoice 2026-032 - Client Payment",     "DEP004",       0,  5000.00),
        ("2026-04-08", "Payroll - Bi-weekly Pay Period",        "PAY001", 22000.00,       0),
        ("2026-04-10", "Equipment Purchase - Copier/Printer",   "CHK1051",15000.00,       0),
        ("2026-04-14", "Office Lease - April 2026",             "CHK1052", 4500.00,       0),
        ("2026-04-13", "Invoice 2026-029 - Client Payment",     "DEP005",       0,  9500.00),
        ("2026-04-16", "Business Insurance Premium",            "ACH001",  1850.00,       0),
        ("2026-04-20", "Client ABC - Project Completion Wire",  "WIRE001",      0, 25000.00),
        ("2026-04-22", "Electric/Gas Utilities",                "ACH002",   890.00,       0),
        ("2026-04-24", "Cloud Software - Monthly Plan",         "ACH003",   299.00,       0),
        ("2026-04-25", "Invoice 2026-033 - Client Payment",     "DEP006",       0,  6000.00),
        ("2026-04-26", "Office Supplies - Q2 Stationery",       "CHK1053",  450.00,       0),
        ("2026-04-28", "Client DEF - Milestone Payment Wire",   "WIRE002",      0, 18000.00),
        ("2026-04-30", "Client GHI - Final Invoice Wire",       "WIRE003",      0, 11000.00),  # deposit in transit
        ("2026-04-30", "Consultant Fee",                        "CHK1054", 3500.00,       0),  # outstanding check
        ("2026-04-30", "IT Contractor Payment",                 "CHK1055", 1200.00,       0),  # outstanding check
    ]
    gl_df = pd.DataFrame(gl_rows, columns=["Date", "Description", "Reference", "Debit", "Credit"])
    gl_df["Date"] = pd.to_datetime(gl_df["Date"])

    gl_path = out_dir / "gl_cash_subledger_2026-04.xlsx"
    gl_df.to_excel(str(gl_path), index=False)

    print(f"Created:  {bank_path.name}")
    print(f"Created:  {gl_path.name}")
    print()
    print("Expected reconciliation:")
    print("  Bank ending balance:   $86,628.50")
    print("  GL ending balance:     $92,861.00")
    print("  Adjusted both to:      $92,928.50")
    print("  Difference:                 $0.00  (reconciled)")


if __name__ == "__main__":
    main()
