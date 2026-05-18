import json
import re
import sqlite3

from boreal.models.database import get_db, get_db_path

# Patterns that indicate a credit card payment (Layer 1 transfer detection)
CC_PAYMENT_PATTERNS_CREDIT_SIDE = re.compile(
    r'payment\s*(thank\s*you|received|merci)|'
    r'online\s*payment|'
    r'\bpymt\b|'
    r'payment\s*-\s*merci|'
    r'credit\s*card\s*payment',
    re.IGNORECASE,
)
CC_PAYMENT_PATTERNS_CHEQUING_SIDE = re.compile(
    r'credit\s*card\s*payment|'
    r'visa\s*payment|'
    r'\bmc\s*payment\b|'
    r'mastercard\s*payment|'
    r'amex\s*payment|'
    r'payment\s*to\s*(visa|mastercard|amex|tangerine)',
    re.IGNORECASE,
)


def load_enabled_rules(db=None):
    """Load all enabled import rules with their conditions, ordered by priority.

    Accepts an optional db connection. Falls back to Flask's get_db() when
    called inside a request context, or opens a standalone connection otherwise.
    """
    if db is None:
        try:
            db = get_db()
        except RuntimeError:
            # Outside Flask request context (e.g. during import via save_transactions)
            db = sqlite3.connect(get_db_path())
            db.row_factory = sqlite3.Row
    rules = db.execute(
        "SELECT * FROM import_rules WHERE enabled=1 ORDER BY priority ASC, id ASC"
    ).fetchall()
    result = []
    for r in rules:
        conditions = db.execute(
            "SELECT field, operator, value FROM rule_conditions WHERE rule_id=?",
            (r["id"],)
        ).fetchall()
        result.append({
            "id": r["id"], "name": r["name"], "priority": r["priority"],
            "action": r["action"], "action_value": r["action_value"],
            "conditions": [dict(c) for c in conditions],
        })
    return result


def _condition_matches(condition, tx):
    """Check if a single condition matches a transaction dict."""
    field = condition["field"]
    op = condition["operator"]
    expected = condition["value"]
    # Map rule fields to transaction dict keys
    field_map = {"description": "name", "amount": "amount", "account": "account", "type": "type"}
    tx_key = field_map.get(field, field)
    actual = tx.get(tx_key, "")
    if op in ("greater_than", "less_than"):
        try:
            actual_num = float(actual) if not isinstance(actual, (int, float)) else actual
            expected_num = float(expected)
        except (ValueError, TypeError):
            return False
        return actual_num > expected_num if op == "greater_than" else actual_num < expected_num
    actual_str = str(actual).lower()
    expected_str = str(expected).lower()
    if op == "contains":
        return expected_str in actual_str
    if op == "not_contains":
        return expected_str not in actual_str
    if op == "equals":
        return actual_str == expected_str
    if op == "not_equals":
        return actual_str != expected_str
    if op == "contains_any":
        return any(v.strip() in actual_str for v in expected_str.split(",") if v.strip())
    if op == "starts_with":
        return actual_str.startswith(expected_str)
    if op == "ends_with":
        return actual_str.endswith(expected_str)
    return False


def evaluate_rules(tx, rules=None):
    """Run a transaction through all enabled rules. Returns matched rule or None.
    First match wins (lowest priority number). Within the same priority,
    rules with more conditions (more specific) are evaluated first."""
    if rules is None:
        rules = load_enabled_rules()
    # Sort by priority ASC, then condition count DESC (more specific first), then id ASC
    sorted_rules = sorted(rules, key=lambda r: (r["priority"], -len(r["conditions"]), r["id"]))
    for rule in sorted_rules:
        if not rule["conditions"]:
            continue  # skip rules with no conditions
        if all(_condition_matches(c, tx) for c in rule["conditions"]):
            return rule
    return None


def apply_rule_to_transaction(tx, rule):
    """Apply matched rule action to a transaction dict (mutates in place)."""
    action = rule["action"]
    if action == "hide":
        tx["hidden"] = 1
    elif action == "pass":
        tx["hidden"] = 0
    elif action == "transfer":
        tx["category"] = "Transfer"
        tx["hidden"] = 1
    elif action == "label":
        if rule["action_value"]:
            try:
                label = json.loads(rule["action_value"])
                if "type" in label:
                    tx["type"] = label["type"]
                if "category" in label:
                    tx["category"] = label["category"]
            except (json.JSONDecodeError, TypeError):
                pass
    return tx


def _guess_account_type(name: str) -> str:
    """Guess account type from account name. Returns 'credit' for credit cards."""
    lower = name.lower()
    if any(kw in lower for kw in ("credit card", "visa", "mastercard", "amex", "mc ")):
        return "credit"
    if "invest" in lower or "tfsa" in lower or "rrsp" in lower:
        return "investment"
    if "saving" in lower:
        return "savings"
    return "chequing"


def _is_cc_payment(tx: dict, account_type: str) -> bool:
    """Layer 1: Detect credit card payments by pattern + account type.

    Credit-card side: type='Income' on a credit account + matches payment patterns.
    Chequing side: type='Expense' on a non-credit account + matches CC payment patterns.
    """
    if account_type == "credit" and tx["type"] == "Income":
        if CC_PAYMENT_PATTERNS_CREDIT_SIDE.search(tx["name"]):
            return True
    elif account_type != "credit" and tx["type"] == "Expense":
        if CC_PAYMENT_PATTERNS_CHEQUING_SIDE.search(tx["name"]):
            return True
    return False


def save_transactions(txns: list) -> tuple:
    from boreal.models.database import tx_hash
    added = dupes = 0
    try:
        db = get_db()
    except RuntimeError:
        db = sqlite3.connect(get_db_path())
        db.row_factory = sqlite3.Row
    rules = load_enabled_rules(db)

    # Auto-create accounts first so we can look up account_type for CC detection
    account_names = set(t["account"] for t in txns if t.get("account"))
    for name in account_names:
        guessed = _guess_account_type(name)
        try:
            db.execute(
                "INSERT OR IGNORE INTO accounts (name, account_type, opening_balance) VALUES (?, ?, 0)",
                (name, guessed),
            )
        except Exception:
            pass
    db.commit()

    # Build account_type lookup
    account_types = {}
    for name in account_names:
        row = db.execute("SELECT account_type FROM accounts WHERE name=?", (name,)).fetchone()
        if row:
            account_types[name] = row["account_type"]

    transfer_detected = []

    for t in txns:
        # Apply import rules before saving
        if "hidden" not in t:
            t["hidden"] = 0
        matched_rule = evaluate_rules(t, rules)
        if matched_rule:
            apply_rule_to_transaction(t, matched_rule)

        # Layer 1: Auto-detect CC payments as transfers
        # type stays Income/Expense (keeps balance math correct), but
        # category='Transfer' and hidden=1 excludes from P&L
        acct_type = account_types.get(t.get("account", ""), "chequing")
        if _is_cc_payment(t, acct_type):
            t["category"] = "Transfer"
            t["hidden"] = 1
            transfer_detected.append(t)

        h = tx_hash(t["date"], t["name"], t["amount"], t["account"])
        try:
            db.execute("""INSERT INTO transactions
                (date,type,name,category,amount,account,notes,source,tx_hash,hidden)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (t["date"], t["type"], t["name"], t["category"],
                 t["amount"], t["account"], t.get("notes", ""), t.get("source", "csv"), h,
                 t.get("hidden", 0)))
            added += 1
        except sqlite3.IntegrityError:
            dupes += 1
    db.commit()

    return added, dupes, transfer_detected


def detect_transfer_pairs(db=None):
    """Layer 2: Find unlinked transfer candidates across accounts.

    GUARD: At least one side must have a transfer signal before matching:
    - category='Transfer' (from Layer 1 or manual), OR
    - Is Income on a credit card account, OR
    - Was flagged by a transfer rule (hidden=1 + category='Transfer')

    Only THEN search for matching amount (±$0.01) within ±3 days in a
    different account. Does NOT match purely on amount+date.

    Returns list of suggested pairs: [{"source": tx_dict, "match": tx_dict}, ...]
    """
    if db is None:
        try:
            db = get_db()
        except RuntimeError:
            db = sqlite3.connect(get_db_path())
            db.row_factory = sqlite3.Row

    # Build account_type lookup
    acct_rows = db.execute("SELECT name, account_type FROM accounts").fetchall()
    account_types = {r["name"]: r["account_type"] for r in acct_rows}

    # Find transactions with transfer signals that are NOT yet linked
    candidates = db.execute("""
        SELECT * FROM transactions
        WHERE transfer_id IS NULL
          AND (
            category = 'Transfer'
            OR (type = 'Income' AND account IN (
                SELECT name FROM accounts WHERE account_type = 'credit'
            ))
          )
        ORDER BY date
    """).fetchall()

    if not candidates:
        return []

    pairs = []
    matched_ids = set()

    for c in candidates:
        if c["id"] in matched_ids:
            continue

        amt = abs(c["amount"])
        # Look for counterpart in a DIFFERENT account, matching amount ±$0.01, date ±3 days
        matches = db.execute("""
            SELECT * FROM transactions
            WHERE id != ?
              AND transfer_id IS NULL
              AND account != ?
              AND ABS(ABS(amount) - ?) <= 0.01
              AND ABS(JULIANDAY(date) - JULIANDAY(?)) <= 3
            ORDER BY ABS(JULIANDAY(date) - JULIANDAY(?)) ASC
            LIMIT 1
        """, (c["id"], c["account"], amt, c["date"], c["date"])).fetchone()

        if matches and matches["id"] not in matched_ids:
            matched_ids.add(c["id"])
            matched_ids.add(matches["id"])
            pairs.append({
                "source": dict(c),
                "match": dict(matches),
            })

    return pairs


def link_transfer_pair(tx_id_a: int, tx_id_b: int, db=None):
    """Link two transactions as a transfer pair.
    Sets transfer_id on both, marks both hidden=1 and category='Transfer'.
    """
    if db is None:
        try:
            db = get_db()
        except RuntimeError:
            db = sqlite3.connect(get_db_path())
            db.row_factory = sqlite3.Row

    # Use the smaller id as the shared transfer_id
    tid = min(tx_id_a, tx_id_b)
    db.execute(
        "UPDATE transactions SET transfer_id=?, hidden=1, category='Transfer' WHERE id IN (?,?)",
        (tid, tx_id_a, tx_id_b),
    )
    db.commit()
    return tid
