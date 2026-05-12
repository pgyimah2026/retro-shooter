"""generate_sample_aging_data.py -- Create sample AR and AP aging test files.

Writes to data/ABC_Corp/:
  ar_aging_2026-04.xlsx   -- 10 customers, $164,200 total AR (40% overdue)
  ap_aging_2026-04.xlsx   -- 8 vendors,    $32,190 total AP (54% overdue)
"""

from pathlib import Path
import pandas as pd


def main():
    out_dir = Path(__file__).parent / "data" / "ABC_Corp"
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- AR Aging -------------------------------------------------------
    ar_rows = [
        ("Acme Industries",   15000,     0,    0,    0,    0),
        ("BuildRight Corp",    8500,  3200,    0,    0,    0),
        ("Coastal Services",      0,  5500, 2800,    0,    0),
        ("Delta Tech",        22000,     0, 4500,    0,    0),
        ("Eagle Enterprises",     0,     0,    0, 7200, 3500),
        ("First National",    12000,  6800,    0,    0,    0),
        ("Granite Partners",      0,  4100,    0, 2900,    0),
        ("Harbor Solutions",   9500,     0, 3600,    0, 1800),
        ("Ironclad Group",    31000,     0,    0,    0,    0),
        ("Junction LLC",          0,  8800, 4200, 1100, 6200),
    ]
    ar_df = pd.DataFrame(
        ar_rows,
        columns=["Customer", "Current", "1-30", "31-60", "61-90", ">90"]
    )
    ar_df["Total"] = ar_df[["Current", "1-30", "31-60", "61-90", ">90"]].sum(axis=1)

    ar_path = out_dir / "ar_aging_2026-04.xlsx"
    ar_df.to_excel(str(ar_path), index=False)

    # ---- AP Aging -------------------------------------------------------
    ap_rows = [
        ("ABC Supplies",     4500,    0,    0,    0,    0),
        ("Beta Logistics",      0, 2800, 1200,    0,    0),
        ("Compute Corp",     1500,    0,    0,    0,    0),
        ("Dataflow Inc",        0,    0, 3500, 2100,    0),
        ("Energy Co",         890,    0,    0,    0,    0),
        ("Facilities Group", 4500, 4500,    0,    0,    0),
        ("Global Tech",         0, 1200,    0,  800, 1500),
        ("Horizon Services", 3200,    0,    0,    0,    0),
    ]
    ap_df = pd.DataFrame(
        ap_rows,
        columns=["Vendor", "Current", "1-30", "31-60", "61-90", ">90"]
    )
    ap_df["Total"] = ap_df[["Current", "1-30", "31-60", "61-90", ">90"]].sum(axis=1)

    ap_path = out_dir / "ap_aging_2026-04.xlsx"
    ap_df.to_excel(str(ap_path), index=False)

    print(f"Created: {ar_path.name}  (AR: $164,200 total, 10 customers)")
    print(f"Created: {ap_path.name}  (AP:  $32,190 total,  8 vendors)")


if __name__ == "__main__":
    main()
