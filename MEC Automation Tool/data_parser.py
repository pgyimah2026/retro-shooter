"""data_parser.py — Trial balance loader and validator.

Typical usage:
    from data_parser import load_trial_balance

    df = load_trial_balance("trial_balance.xlsx")
"""

import logging
from pathlib import Path

import pandas as pd

# Module-level logger — callers configure handlers/level in their own code.
log = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"Account_Number", "Account_Name", "Current_Balance", "Prior_Balance"}
BALANCE_COLUMNS = ("Current_Balance", "Prior_Balance")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_trial_balance(file_path: str) -> pd.DataFrame:
    """Load, validate, and clean a trial balance from an Excel file.

    Expects columns: Account_Number, Account_Name, Current_Balance, Prior_Balance.
    Missing or non-numeric balance values are coerced to 0.0 with a warning logged
    for each affected row. Rows with a missing Account_Number are dropped after
    logging a warning.

    Args:
        file_path: Path to the .xlsx trial balance file.

    Returns:
        A clean DataFrame with dtypes:
            Account_Number  – str
            Account_Name    – str
            Current_Balance – float64
            Prior_Balance   – float64

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If required columns are absent from the file.
        RuntimeError: If the file cannot be parsed as Excel.
    """
    path = _resolve_path(file_path)
    raw = _read_excel(path)
    _check_required_columns(raw, path)
    df = _clean(raw)
    log.info("Loaded %d accounts from '%s'.", len(df), path)
    return df


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_path(file_path: str) -> Path:
    """Return a resolved Path and raise FileNotFoundError if it does not exist.

    Args:
        file_path: Raw path string provided by the caller.

    Returns:
        Resolved Path object.

    Raises:
        FileNotFoundError: If the path does not point to an existing file.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        raise FileNotFoundError(f"Trial balance file not found: '{path}'")
    if not path.is_file():
        raise FileNotFoundError(f"Path is not a file: '{path}'")
    return path


def _read_excel(path: Path) -> pd.DataFrame:
    """Read an Excel workbook into a raw DataFrame.

    Strips leading/trailing whitespace from all column headers so that
    minor formatting inconsistencies in client-supplied files are tolerated.

    Args:
        path: Resolved Path to the .xlsx file.

    Returns:
        Raw DataFrame with original values intact.

    Raises:
        RuntimeError: If pandas/openpyxl cannot parse the file.
    """
    try:
        df = pd.read_excel(path, dtype=str)  # read everything as str initially
    except Exception as exc:
        raise RuntimeError(f"Could not parse '{path}' as Excel: {exc}") from exc

    df.columns = df.columns.str.strip()
    log.debug("Read %d rows and %d columns from '%s'.", len(df), len(df.columns), path)
    return df


def _check_required_columns(df: pd.DataFrame, path: Path) -> None:
    """Verify that all required columns are present in the DataFrame.

    Comparison is case-sensitive to catch common header casing mistakes early.

    Args:
        df:   Raw DataFrame from _read_excel.
        path: File path, used only to produce a helpful error message.

    Raises:
        ValueError: Lists every missing column in a single message so the caller
                    can fix them all at once rather than one at a time.
    """
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"'{path.name}' is missing required column(s): {sorted(missing)}. "
            f"Found: {list(df.columns)}"
        )


def _clean(raw: pd.DataFrame) -> pd.DataFrame:
    """Normalise types, handle missing values, and drop invalid rows.

    Steps applied in order:
        1. Drop fully blank rows.
        2. Warn and drop rows where Account_Number is blank.
        3. Coerce balance columns to float; warn per-cell on failure.
        4. Fill any remaining NaN balances with 0.0.
        5. Cast Account_Number and Account_Name to str and strip whitespace.

    Args:
        raw: DataFrame produced by _read_excel after column validation.

    Returns:
        Cleaned DataFrame ready for downstream processing.
    """
    df = raw.copy()

    # 1. Drop fully blank rows silently.
    df = df.dropna(how="all").reset_index(drop=True)

    # 2. Flag and drop rows with no account number.
    df = _drop_missing_account_numbers(df)

    # 3. Coerce balance columns; warn on non-numeric cells.
    for col in BALANCE_COLUMNS:
        df[col] = _coerce_balance_column(df, col)

    # 4. Fill any remaining NaN with 0.0 (covers originally blank cells).
    before_fill = df[list(BALANCE_COLUMNS)].isna().sum().sum()
    df[list(BALANCE_COLUMNS)] = df[list(BALANCE_COLUMNS)].fillna(0.0)
    if before_fill:
        log.warning(
            "%d balance cell(s) were blank and have been set to 0.0.", before_fill
        )

    # 5. Normalise string columns.
    df["Account_Number"] = df["Account_Number"].astype(str).str.strip()
    df["Account_Name"] = df["Account_Name"].fillna("").astype(str).str.strip()

    return df[["Account_Number", "Account_Name", "Current_Balance", "Prior_Balance"]]


def _drop_missing_account_numbers(df: pd.DataFrame) -> pd.DataFrame:
    """Remove rows where Account_Number is null or blank, logging each one.

    Args:
        df: DataFrame after fully-blank rows have been removed.

    Returns:
        DataFrame with invalid account-number rows removed.
    """
    mask_null = df["Account_Number"].isna()
    mask_blank = df["Account_Number"].astype(str).str.strip().eq("")
    bad = df[mask_null | mask_blank]

    for idx in bad.index:
        name = df.at[idx, "Account_Name"] if pd.notna(df.at[idx, "Account_Name"]) else "(unknown)"
        log.warning(
            "Row %d is missing an Account_Number (Account_Name='%s'). Row dropped.",
            idx + 2,  # +2: 1 for 0-index, 1 for header row in Excel
            name,
        )

    return df[~(mask_null | mask_blank)].reset_index(drop=True)


def _coerce_balance_column(df: pd.DataFrame, col: str) -> pd.Series:
    """Coerce a balance column to float64, logging a warning for each bad cell.

    pandas' errors='coerce' silently turns unparseable values into NaN. This
    function makes those failures visible by comparing the result against the
    original values and logging each one individually.

    Args:
        df:  DataFrame containing the column to coerce.
        col: Name of the balance column (e.g. 'Current_Balance').

    Returns:
        pd.Series of float64 with NaN where coercion failed.
    """
    original = df[col]
    coerced = pd.to_numeric(original, errors="coerce")

    failed_mask = coerced.isna() & original.notna() & (original.astype(str).str.strip() != "")
    for idx in df.index[failed_mask]:
        log.warning(
            "Row %d, column '%s': non-numeric value '%s' replaced with 0.0.",
            idx + 2,
            col,
            original.at[idx],
        )

    return coerced


# ---------------------------------------------------------------------------
# Standalone execution — quick sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(levelname)-8s %(name)s: %(message)s",
    )

    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "trial_balance.xlsx"
    try:
        result = load_trial_balance(target)
        print(f"\nLoaded {len(result)} account(s):\n")
        print(result.to_string(index=False))
        print(f"\nDtypes:\n{result.dtypes}")
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        log.error("%s", e)
        sys.exit(1)
