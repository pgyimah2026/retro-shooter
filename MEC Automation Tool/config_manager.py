"""config_manager.py — Load, validate, and create client configuration files.

Client configs are JSON files stored in the config/ directory. The schema
extends the existing YAML format used by close_automation.py and adds a full
chart of accounts, materiality settings, and contact information.

After loading, configs are normalised so all downstream modules continue to
work with the same key names they already expect
(``variance_threshold_pct``, ``variance_threshold_abs``, ``account_groups``,
``preparer``, ``firm``, etc.).

Public API:
    from config_manager import load_client_config, validate_config, create_new_client

    # Load an existing client
    config = load_client_config("abc_corporation")

    # Validate a dict before using it
    errors = validate_config(config)

    # Scaffold a new client from the template
    path = create_new_client("Acme Corporation")
"""

import copy
import json
import logging
import re
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema definition
# ---------------------------------------------------------------------------

# Fields that must be present and non-empty; maps name → accepted Python type(s)
_REQUIRED: dict = {
    "client_id":          str,
    "client_name":        str,
    "variance_threshold": (int, float),
    "materiality_amount": (int, float),
    "fiscal_year_end":    str,
}

# Every key in _ACCOUNT_ENTRY_REQUIRED must exist in each account_mapping entry
_ACCOUNT_ENTRY_REQUIRED = ("name",)

# Regex for fiscal_year_end: MM-DD
_FYE_RE = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")

# Default values for every optional field.  Used by merge_with_defaults().
_DEFAULTS: dict = {
    "preparer":             "",
    "firm":                 "",
    "fiscal_year_end":      "12-31",
    "variance_threshold":   5.0,
    "materiality_amount":   1000.0,
    "account_groups":       {},
    "account_mapping":      {},
    "contact_info": {
        "firm_name":            "",
        "preparer_name":        "",
        "preparer_email":       "",
        "preparer_phone":       "",
        "client_contact_name":  "",
        "client_contact_title": "",
        "client_contact_email": "",
    },
    "report_settings": {
        "logo_path":             "",
        "include_ai_commentary": True,
        "include_je_template":   True,
        "currency_symbol":       "$",
        "date_format":           "YYYY-MM-DD",
        "decimal_places":        2,
    },
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_client_config(
    client_id: str,
    config_dir: str = "config",
) -> dict:
    """Load, validate, and normalise a JSON client configuration file.

    Looks for ``config/<client_id>.json`` (the ``.json`` extension may be
    omitted from *client_id*). After passing validation, optional fields are
    back-filled with defaults and backward-compatibility aliases are injected
    so all existing modules work without changes.

    Args:
        client_id:  Client identifier — the filename stem, e.g.
                    ``"abc_corporation"`` (or ``"abc_corporation.json"``).
        config_dir: Directory containing client config files. Defaults to
                    ``"config"``.

    Returns:
        Fully merged and normalised config dict.

    Raises:
        FileNotFoundError: If no ``.json`` config exists for *client_id*.
        json.JSONDecodeError: If the file contains invalid JSON.
        ValueError: If required fields are missing, invalid, or still set to
                    the ``"__REQUIRED__"`` placeholder.
    """
    client_id = client_id.removesuffix(".json")
    config_path = Path(config_dir)

    # Normalize input for matching: lowercase, collapse non-alphanumeric to underscores
    def _norm(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

    def _compact(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", s.lower())

    norm_input    = _norm(client_id)
    compact_input = _compact(client_id)

    # 1. Exact match (normalized name == filename stem)
    path = config_path / f"{norm_input}.json"

    # 2. Case-insensitive filename scan
    if not path.exists():
        path = None
        candidates = [
            p for p in sorted(config_path.glob("*.json"))
            if p.stem not in ("client_template",)
        ]

        # Pass A — normalized stem equality
        for candidate in candidates:
            if _norm(candidate.stem) == norm_input:
                path = candidate
                break

        # Pass B — prefix/suffix containment (e.g. "abc_corp" ↔ "abc_corporation")
        if path is None:
            for candidate in candidates:
                stem_compact = _compact(candidate.stem)
                if (stem_compact.startswith(compact_input) or
                        compact_input.startswith(stem_compact)):
                    path = candidate
                    break

        # Pass C — search inside JSON for matching client_id field
        if path is None:
            for candidate in candidates:
                try:
                    with open(candidate, "r", encoding="utf-8") as _fh:
                        _data = json.load(_fh)
                    cid = _data.get("client_id", "")
                    if _norm(cid) == norm_input or _compact(cid) == compact_input:
                        path = candidate
                        break
                except (json.JSONDecodeError, OSError):
                    pass

        if path is None:
            available = list_clients(config_dir)
            raise FileNotFoundError(
                f"Client config not found: '{config_path / norm_input}.json'. "
                f" Available clients: {available}"
            )

    with open(path, "r", encoding="utf-8") as fh:
        raw = json.load(fh)

    # Strip meta/comment keys (prefixed with "_") before validation
    config = {k: v for k, v in raw.items() if not k.startswith("_")}

    errors = validate_config(config)
    if errors:
        raise ValueError(
            f"Config '{path.name}' has {len(errors)} validation error(s):\n"
            + "\n".join(f"  • {e}" for e in errors)
        )

    merged = merge_with_defaults(config)
    log.info(
        "Loaded config for '%s' from '%s' "
        "(threshold: %.1f%% / $%.0f, FYE: %s).",
        merged["client_name"],
        path,
        merged["variance_threshold"],
        merged["materiality_amount"],
        merged["fiscal_year_end"],
    )
    return merged


def validate_config(config: dict) -> list:
    """Check a config dict for required fields, types, and value constraints.

    Does not modify the input dict. Designed so callers can decide whether
    to raise, warn, or display the errors themselves.

    Args:
        config: Raw config dict (typically loaded from JSON).

    Returns:
        List of human-readable error strings. An empty list means the config
        is valid.
    """
    errors: list = []

    # ── Required fields: presence, placeholder, type ─────────────────────────
    for field, expected in _REQUIRED.items():
        value = config.get(field)
        if value is None:
            errors.append(f"Missing required field: '{field}'")
            continue
        if value == "__REQUIRED__":
            errors.append(
                f"Field '{field}' still contains the placeholder '__REQUIRED__'. "
                f"Replace it with actual data."
            )
            continue
        if isinstance(value, bool) or not isinstance(value, expected):
            type_name = (
                " or ".join(t.__name__ for t in expected)
                if isinstance(expected, tuple)
                else expected.__name__
            )
            errors.append(
                f"Field '{field}' must be {type_name}, "
                f"got {type(value).__name__} ({value!r})."
            )

    # ── Non-empty string fields ───────────────────────────────────────────────
    for field in ("client_id", "client_name"):
        if isinstance(config.get(field), str) and not config[field].strip():
            errors.append(f"Field '{field}' cannot be an empty string.")

    # ── Numeric range checks ──────────────────────────────────────────────────
    vt = config.get("variance_threshold")
    if isinstance(vt, (int, float)) and not isinstance(vt, bool):
        if not (0 < vt <= 100):
            errors.append(
                f"'variance_threshold' must be between 0 and 100 "
                f"(exclusive), got {vt}."
            )

    ma = config.get("materiality_amount")
    if isinstance(ma, (int, float)) and not isinstance(ma, bool):
        if ma < 0:
            errors.append(
                f"'materiality_amount' cannot be negative, got {ma}."
            )

    # ── fiscal_year_end format ────────────────────────────────────────────────
    fye = config.get("fiscal_year_end")
    if isinstance(fye, str) and fye and not _FYE_RE.match(fye):
        errors.append(
            f"'fiscal_year_end' must be in MM-DD format (e.g. '12-31'), "
            f"got '{fye}'."
        )

    # ── account_mapping sub-entry validation ──────────────────────────────────
    acct_map = config.get("account_mapping")
    if acct_map is not None:
        if not isinstance(acct_map, dict):
            errors.append(
                f"'account_mapping' must be a dict, got {type(acct_map).__name__}."
            )
        else:
            for acct_num, entry in acct_map.items():
                if not isinstance(entry, dict):
                    errors.append(
                        f"account_mapping['{acct_num}'] must be a dict, "
                        f"got {type(entry).__name__}."
                    )
                else:
                    for key in _ACCOUNT_ENTRY_REQUIRED:
                        if key not in entry:
                            errors.append(
                                f"account_mapping['{acct_num}'] is missing "
                                f"required key '{key}'."
                            )

    # ── contact_info type check ───────────────────────────────────────────────
    ci = config.get("contact_info")
    if ci is not None and not isinstance(ci, dict):
        errors.append(
            f"'contact_info' must be a dict, got {type(ci).__name__}."
        )

    # ── account_groups type check ─────────────────────────────────────────────
    ag = config.get("account_groups")
    if ag is not None and not isinstance(ag, dict):
        errors.append(
            f"'account_groups' must be a dict, got {type(ag).__name__}."
        )

    return errors


def create_new_client(
    client_name: str,
    config_dir: str = "config",
) -> Path:
    """Scaffold a new client config file from the template.

    The *client_id* is derived automatically from *client_name* by lowercasing
    and replacing non-alphanumeric characters with underscores.

    Args:
        client_name: Human-readable client name, e.g. ``"Acme Corporation"``.
        config_dir:  Directory to write the new config file into. Defaults to
                     ``"config"``.

    Returns:
        Path to the newly created ``.json`` file.

    Raises:
        FileExistsError:   If a config already exists for the derived client_id.
        FileNotFoundError: If the template file ``config/client_template.json``
                           cannot be found.
        ValueError:        If *client_name* is blank.
    """
    client_name = client_name.strip()
    if not client_name:
        raise ValueError("client_name cannot be blank.")

    client_id = _slugify(client_name)
    out_path  = Path(config_dir) / f"{client_id}.json"

    if out_path.exists():
        raise FileExistsError(
            f"A config already exists for client_id '{client_id}': '{out_path}'. "
            f"Use load_client_config('{client_id}') to load it, or delete the "
            f"file manually if you want to start over."
        )

    template_path = Path(config_dir) / "client_template.json"
    if not template_path.exists():
        raise FileNotFoundError(
            f"Template not found: '{template_path}'. "
            f"Ensure client_template.json exists in '{config_dir}'."
        )

    with open(template_path, "r", encoding="utf-8") as fh:
        config = json.load(fh)

    # Strip meta keys and fill in the generated identifiers
    config = {k: v for k, v in config.items() if not k.startswith("_")}
    config["client_id"]   = client_id
    config["client_name"] = client_name

    # Prefill contact_info.firm_name from top-level firm if present
    if config.get("firm") and not config.get("contact_info", {}).get("firm_name"):
        config.setdefault("contact_info", {})["firm_name"] = config["firm"]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(config, fh, indent=2)

    log.info(
        "Created new client config: '%s' (client_id='%s').",
        out_path,
        client_id,
    )
    return out_path


def save_client_config(config: dict, config_dir: str = "config") -> Path:
    """Validate and persist a config dict to ``config/<client_id>.json``.

    Args:
        config:     Config dict. Must contain a non-empty ``'client_id'`` key.
        config_dir: Target directory. Defaults to ``"config"``.

    Returns:
        Path to the saved file.

    Raises:
        ValueError: If *config* is invalid.
        OSError:    If the file cannot be written.
    """
    if not config.get("client_id"):
        raise ValueError("Config dict must contain a non-empty 'client_id'.")

    errors = validate_config(config)
    if errors:
        raise ValueError(
            f"Cannot save invalid config ({len(errors)} error(s)):\n"
            + "\n".join(f"  • {e}" for e in errors)
        )

    out_path = Path(config_dir) / f"{config['client_id']}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Save only the canonical keys (strip runtime-derived aliases)
    _ALIAS_KEYS = {"variance_threshold_pct", "variance_threshold_abs"}
    saveable = {k: v for k, v in config.items() if k not in _ALIAS_KEYS}

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(saveable, fh, indent=2)

    log.info("Saved config for '%s' to '%s'.", config.get("client_name", config["client_id"]), out_path)
    return out_path


def list_clients(config_dir: str = "config") -> list:
    """Return a sorted list of available client IDs (JSON files in *config_dir*).

    The template file is excluded from the results.

    Args:
        config_dir: Directory to scan. Defaults to ``"config"``.

    Returns:
        Sorted list of client_id strings (filename stems without ``.json``).
    """
    path = Path(config_dir)
    if not path.exists():
        return []
    return sorted(
        p.stem
        for p in path.glob("*.json")
        if p.stem != "client_template"
    )


def merge_with_defaults(config: dict) -> dict:
    """Back-fill missing optional fields and inject backward-compat aliases.

    Performs a deep merge so nested dicts like ``contact_info`` and
    ``report_settings`` are merged field-by-field rather than replaced.

    Aliases injected for existing module compatibility:
        - ``variance_threshold_pct``  ← ``variance_threshold``
        - ``variance_threshold_abs``  ← ``materiality_amount``

    When ``account_groups`` is empty but ``account_mapping`` is populated,
    ``account_groups`` is derived by grouping accounts on their ``"group"``
    field.  This lets existing modules (``close_automation.py``,
    ``je_generator.py``) work without any changes.

    Top-level ``preparer`` and ``firm`` are mirrored into ``contact_info``
    when the contact_info sub-fields are blank, keeping both styles in sync.

    Args:
        config: Validated config dict.

    Returns:
        New dict with all defaults applied (does not modify the input).
    """
    merged = copy.deepcopy(_DEFAULTS)
    _deep_update(merged, config)

    # ── Backward-compatibility aliases ────────────────────────────────────────
    merged.setdefault("variance_threshold_pct", merged["variance_threshold"])
    merged.setdefault("variance_threshold_abs", merged["materiality_amount"])

    # ── Derive account_groups from account_mapping when not set explicitly ─────
    if not merged.get("account_groups") and merged.get("account_mapping"):
        groups: dict = {}
        for acct_num, entry in merged["account_mapping"].items():
            grp = entry.get("group", "Other") if isinstance(entry, dict) else "Other"
            groups.setdefault(grp, []).append(acct_num)
        merged["account_groups"] = groups

    # ── Sync top-level preparer/firm → contact_info ───────────────────────────
    if merged.get("preparer") and not merged["contact_info"].get("preparer_name"):
        merged["contact_info"]["preparer_name"] = merged["preparer"]
    if merged.get("firm") and not merged["contact_info"].get("firm_name"):
        merged["contact_info"]["firm_name"] = merged["firm"]

    return merged


def get_account_info(config: dict, account_number: str) -> Optional[dict]:
    """Look up a single account's metadata from the chart of accounts.

    Args:
        config:         Loaded (merged) config dict.
        account_number: Account number string, e.g. ``"4000"``.

    Returns:
        Account metadata dict, or ``None`` if the account is not in the
        mapping.  Keys: name, type, group, normal_balance, statement, active.
    """
    return config.get("account_mapping", {}).get(str(account_number).strip())


def get_accounts_by_group(config: dict, group: str) -> list:
    """Return all active account numbers belonging to a named group.

    Args:
        config: Loaded (merged) config dict.
        group:  Group name matching the ``"group"`` field in account_mapping,
                e.g. ``"Revenue"`` or ``"Operating Expenses"``.

    Returns:
        List of account number strings for active accounts in the group,
        in ascending order.
    """
    return sorted(
        num
        for num, entry in config.get("account_mapping", {}).items()
        if isinstance(entry, dict)
        and entry.get("group") == group
        and entry.get("active", True)
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    """Convert a client name to a lowercase underscore-separated identifier.

    Args:
        name: Human-readable string, e.g. ``"ABC Corporation"``.

    Returns:
        Slug string, e.g. ``"abc_corporation"``.
    """
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name).strip("_").lower()
    return slug or "client"


def _deep_update(base: dict, override: dict) -> None:
    """Recursively merge *override* into *base* in-place.

    Nested dicts are merged field-by-field.  All other value types are
    replaced outright.

    Args:
        base:     Dict to update in place.
        override: Dict whose values take precedence.
    """
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_update(base[key], value)
        else:
            base[key] = value


# ---------------------------------------------------------------------------
# Standalone execution — quick sanity check
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(level=logging.DEBUG, format="%(levelname)-8s %(name)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="Config Manager — load, validate, or create client configs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List available clients
  python config_manager.py --list

  # Load and display a client config
  python config_manager.py --load abc_corporation

  # Validate without loading (exit 0 = valid, exit 1 = errors)
  python config_manager.py --validate abc_corporation

  # Scaffold a new client config from the template
  python config_manager.py --new "Contoso Ltd"
""",
    )
    parser.add_argument("--list",     action="store_true",      help="List all configured clients")
    parser.add_argument("--load",     metavar="CLIENT_ID",      help="Load and display a config")
    parser.add_argument("--validate", metavar="CLIENT_ID",      help="Validate a config file")
    parser.add_argument("--new",      metavar="CLIENT_NAME",    help="Create a new client config")
    parser.add_argument("--dir",      default="config",         help="Config directory (default: config)")
    args = parser.parse_args()

    if args.list:
        clients = list_clients(args.dir)
        if clients:
            print(f"Available clients in '{args.dir}':")
            for c in clients:
                print(f"  {c}")
        else:
            print(f"No client configs found in '{args.dir}'.")

    elif args.load:
        try:
            cfg = load_client_config(args.load, config_dir=args.dir)
        except (FileNotFoundError, ValueError) as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)
        print(f"\nClient:            {cfg['client_name']}")
        print(f"Client ID:         {cfg['client_id']}")
        print(f"Preparer:          {cfg.get('preparer', '—')}")
        print(f"Firm:              {cfg.get('firm', '—')}")
        print(f"Fiscal Year End:   {cfg['fiscal_year_end']}")
        print(f"Variance Threshold:{cfg['variance_threshold']:.1f}%")
        print(f"Materiality:       ${cfg['materiality_amount']:,.2f}")
        n_accts = len(cfg.get("account_mapping", {}))
        n_groups = len(cfg.get("account_groups", {}))
        print(f"Chart of Accounts: {n_accts} accounts across {n_groups} group(s)")

    elif args.validate:
        path = Path(args.dir) / f"{args.validate.removesuffix('.json')}.json"
        if not path.exists():
            print(f"File not found: '{path}'", file=sys.stderr)
            sys.exit(1)
        with open(path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        config = {k: v for k, v in raw.items() if not k.startswith("_")}
        errors = validate_config(config)
        if errors:
            print(f"INVALID — {len(errors)} error(s):")
            for e in errors:
                print(f"  • {e}")
            sys.exit(1)
        else:
            print(f"VALID — '{path.name}' passed all validation checks.")

    elif args.new:
        try:
            out = create_new_client(args.new, config_dir=args.dir)
            print(f"Created: '{out}'")
            print(f"Edit the file to fill in the required fields.")
        except (FileExistsError, FileNotFoundError, ValueError) as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)

    else:
        parser.print_help()
