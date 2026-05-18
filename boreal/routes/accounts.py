"""Routes for accounts, scheduled transactions, transfers, and undo."""
import json
import sqlite3
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from boreal.models.database import get_db, tx_hash

accounts_bp = Blueprint("accounts_extra", __name__)


# ── ACCOUNTS ──────────────────────────────────────────────────────────────────

@accounts_bp.route("/api/account-names")
def api_account_names():
    """Return distinct account names from transactions (what the user actually has).
    Also auto-creates accounts table entries for any missing names."""
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT account FROM transactions WHERE account IS NOT NULL AND account != '' ORDER BY account"
    ).fetchall()
    names = [r["account"] for r in rows]
    # Auto-register any missing accounts
    for name in names:
        try:
            db.execute(
                "INSERT OR IGNORE INTO accounts (name, account_type, opening_balance) VALUES (?, 'chequing', 0)",
                (name,)
            )
        except Exception:
            pass
    db.commit()
    return jsonify(names)


@accounts_bp.route("/api/accounts-list")
def api_accounts_list():
    """List all registered accounts with computed balances."""
    db = get_db()
    # Backfill: auto-register any transaction account names not yet in accounts table
    db.execute("""
        INSERT OR IGNORE INTO accounts (name, account_type, opening_balance)
        SELECT DISTINCT account, 'chequing', 0
        FROM transactions
        WHERE account IS NOT NULL AND account != ''
          AND account NOT IN (SELECT name FROM accounts)
    """)
    # Fix-up: auto-detect account type for accounts still defaulted to 'chequing'
    # whose name clearly indicates a different type
    for row in db.execute(
        "SELECT id, name FROM accounts WHERE account_type = 'chequing'"
    ).fetchall():
        lower = row["name"].lower()
        if any(kw in lower for kw in ("credit card", "visa", "mastercard", "amex", "mc ")):
            db.execute("UPDATE accounts SET account_type='credit' WHERE id=?", (row["id"],))
        elif any(kw in lower for kw in ("invest", "tfsa", "rrsp")):
            db.execute("UPDATE accounts SET account_type='investment' WHERE id=?", (row["id"],))
        elif "saving" in lower:
            db.execute("UPDATE accounts SET account_type='savings' WHERE id=?", (row["id"],))
    # Backfill account_id for any transactions missing it
    db.execute("""
        UPDATE transactions SET account_id = (
            SELECT id FROM accounts WHERE accounts.name = transactions.account
        ) WHERE account_id IS NULL AND account IS NOT NULL AND account != ''
    """)
    db.commit()
    accounts = db.execute("SELECT * FROM accounts ORDER BY name").fetchall()
    if not accounts:
        return jsonify([])
    # Compute income/expenses per account using account_id FK,
    # respecting balance_date (only count transactions on or after it)
    result = []
    for a in accounts:
        is_investment = a["account_type"] == "investment"
        if is_investment:
            # Investment accounts use latest snapshot, not transaction math
            snap = db.execute(
                "SELECT balance FROM balance_snapshots WHERE account_id=? ORDER BY snapshot_date DESC LIMIT 1",
                (a["id"],),
            ).fetchone()
            balance = snap["balance"] if snap else a["opening_balance"]
        else:
            date_filter = ""
            params = [a["id"]]
            if a["balance_date"]:
                date_filter = " AND date >= ?"
                params.append(a["balance_date"])
            row = db.execute(
                f"""SELECT
                    COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END), 0) as expenses
                FROM transactions
                WHERE account_id = ?{date_filter}""",
                params,
            ).fetchone()
            balance = a["opening_balance"] + row["income"] - row["expenses"]
        is_credit = a["account_type"] == "credit"
        result.append({
            "id": a["id"],
            "name": a["name"],
            "account_type": a["account_type"],
            "opening_balance": a["opening_balance"],
            "balance_date": a["balance_date"],
            "balance": round(balance, 2),
            "display_balance": round(-balance if is_credit else balance, 2),
            "is_debt": is_credit and balance < 0,
        })
    return jsonify(result)


@accounts_bp.route("/api/accounts-list", methods=["POST"])
def api_accounts_add():
    d = request.json
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Account name is required"}), 400
    account_type = d.get("account_type", "chequing")
    if account_type not in ("chequing", "savings", "credit", "investment", "other"):
        return jsonify({"error": "Invalid account type"}), 400
    try:
        opening_balance = float(d.get("opening_balance", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid opening balance"}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT INTO accounts (name, account_type, opening_balance) VALUES (?,?,?)",
            (name, account_type, opening_balance),
        )
        db.commit()
        return jsonify({"ok": True})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Account already exists"}), 409


@accounts_bp.route("/api/accounts-list/<int:aid>", methods=["PATCH"])
def api_accounts_update(aid):
    d = request.json
    db = get_db()
    acct = db.execute("SELECT * FROM accounts WHERE id=?", (aid,)).fetchone()
    if not acct:
        return jsonify({"error": "Account not found"}), 404
    name = (d.get("name") or acct["name"]).strip()
    account_type = d.get("account_type", acct["account_type"])
    balance_date = d.get("balance_date", acct["balance_date"])  # NULL = count all
    try:
        opening_balance = float(d.get("opening_balance", acct["opening_balance"]))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid opening balance"}), 400
    old_name = acct["name"]
    try:
        db.execute(
            "UPDATE accounts SET name=?, account_type=?, opening_balance=?, balance_date=? WHERE id=?",
            (name, account_type, opening_balance, balance_date, aid),
        )
        if name != old_name:
            # Update denormalized account TEXT on transactions for display
            db.execute("UPDATE transactions SET account=? WHERE account_id=?", (name, aid))
        db.commit()
        return jsonify({"ok": True})
    except sqlite3.IntegrityError:
        return jsonify({"error": "Account name already exists"}), 409


@accounts_bp.route("/api/accounts-list/<int:aid>", methods=["DELETE"])
def api_accounts_delete(aid):
    db = get_db()
    db.execute("DELETE FROM accounts WHERE id=?", (aid,))
    db.commit()
    return jsonify({"ok": True})


# ── NET WORTH ─────────────────────────────────────────────────────────────────

@accounts_bp.route("/api/net-worth")
def api_net_worth():
    """Compute net worth at each month-end from accounts."""
    db = get_db()
    # Ensure accounts and account_id FKs are populated (idempotent, cheap)
    db.execute("""
        INSERT OR IGNORE INTO accounts (name, account_type, opening_balance)
        SELECT DISTINCT account, 'chequing', 0
        FROM transactions
        WHERE account IS NOT NULL AND account != ''
          AND account NOT IN (SELECT name FROM accounts)
    """)
    db.execute("""
        UPDATE transactions SET account_id = (
            SELECT id FROM accounts WHERE accounts.name = transactions.account
        ) WHERE account_id IS NULL AND account IS NOT NULL AND account != ''
    """)
    db.commit()
    accounts = db.execute("SELECT * FROM accounts").fetchall()
    if not accounts:
        return jsonify([])
    months_rows = db.execute(
        "SELECT DISTINCT substr(date,1,7) as m FROM transactions ORDER BY m"
    ).fetchall()
    all_months = [r["m"] for r in months_rows]
    # Limit to last 24 months
    all_months = all_months[-24:]
    if not all_months:
        return jsonify([])

    # Single aggregated query: cumulative totals per account per month
    totals = db.execute(
        """SELECT account_id, substr(date,1,7) as month, type, SUM(amount) as total
           FROM transactions
           WHERE account_id IS NOT NULL
           GROUP BY account_id, month, type
           ORDER BY month"""
    ).fetchall()
    # Build {account_id: {month: net_delta}}
    monthly_delta = {}
    for r in totals:
        acct = r["account_id"]
        m = r["month"]
        if acct not in monthly_delta:
            monthly_delta[acct] = {}
        if m not in monthly_delta[acct]:
            monthly_delta[acct][m] = 0
        if r["type"] == "Income":
            monthly_delta[acct][m] += r["total"]
        else:
            monthly_delta[acct][m] -= r["total"]

    # Build balance_date cutoff lookup
    acct_balance_dates = {a["id"]: a["balance_date"] for a in accounts}
    investment_ids = {a["id"] for a in accounts if a["account_type"] == "investment"}

    # Load all snapshots for investment accounts
    inv_snapshots = {}  # {account_id: [(date, balance), ...]}
    if investment_ids:
        placeholders = ",".join("?" * len(investment_ids))
        snap_rows = db.execute(
            f"SELECT account_id, snapshot_date, balance FROM balance_snapshots WHERE account_id IN ({placeholders}) ORDER BY snapshot_date",
            list(investment_ids),
        ).fetchall()
        for sr in snap_rows:
            inv_snapshots.setdefault(sr["account_id"], []).append((sr["snapshot_date"], sr["balance"]))

    # Compute net worth at each target month
    result = []
    for m in all_months:
        month_end = m + "-31"  # works for comparison since dates are ISO strings
        total = 0
        for a in accounts:
            if a["id"] in investment_ids:
                # Use latest snapshot <= month-end
                snaps = inv_snapshots.get(a["id"], [])
                bal = a["opening_balance"]
                for sd, sb in snaps:
                    if sd <= month_end:
                        bal = sb
                total += bal
            else:
                balance = a["opening_balance"]
                acct_deltas = monthly_delta.get(a["id"], {})
                bd = acct_balance_dates.get(a["id"])
                bd_month = bd[:7] if bd else None
                for dm, delta in acct_deltas.items():
                    if dm <= m and (bd_month is None or dm >= bd_month):
                        balance += delta
                total += balance
        result.append({"month": m, "net_worth": round(total, 2)})
    return jsonify(result)


# ── SCHEDULED TRANSACTIONS ────────────────────────────────────────────────────

@accounts_bp.route("/api/schedules")
def api_schedules_list():
    db = get_db()
    rows = db.execute("SELECT * FROM scheduled_transactions ORDER BY next_due").fetchall()
    return jsonify([dict(r) for r in rows])


@accounts_bp.route("/api/schedules", methods=["POST"])
def api_schedules_add():
    d = request.json
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    tx_type = d.get("type", "Expense")
    if tx_type not in ("Income", "Expense"):
        return jsonify({"error": "Type must be Income or Expense"}), 400
    category = (d.get("category") or "").strip()
    if not category:
        return jsonify({"error": "Category is required"}), 400
    try:
        amount = float(d.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400
    account = (d.get("account") or "").strip()
    if not account:
        return jsonify({"error": "Account is required"}), 400
    frequency = d.get("frequency", "monthly")
    if frequency not in ("weekly", "biweekly", "monthly", "yearly"):
        return jsonify({"error": "Invalid frequency"}), 400
    next_due = d.get("next_due", "")
    if not next_due:
        return jsonify({"error": "Next due date is required"}), 400
    db = get_db()
    db.execute(
        "INSERT INTO scheduled_transactions (name, type, category, amount, account, frequency, next_due) VALUES (?,?,?,?,?,?,?)",
        (name, tx_type, category, amount, account, frequency, next_due),
    )
    db.commit()
    return jsonify({"ok": True})


@accounts_bp.route("/api/schedules/<int:sid>", methods=["PATCH"])
def api_schedules_update(sid):
    d = request.json
    db = get_db()
    sched = db.execute("SELECT * FROM scheduled_transactions WHERE id=?", (sid,)).fetchone()
    if not sched:
        return jsonify({"error": "Schedule not found"}), 404
    enabled = d.get("enabled", sched["enabled"])
    next_due = d.get("next_due", sched["next_due"])
    name = (d.get("name") or sched["name"]).strip()
    category = (d.get("category") or sched["category"]).strip()
    try:
        amount = float(d.get("amount", sched["amount"]))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400
    frequency = d.get("frequency", sched["frequency"])
    db.execute(
        "UPDATE scheduled_transactions SET name=?, category=?, amount=?, frequency=?, next_due=?, enabled=? WHERE id=?",
        (name, category, amount, frequency, next_due, enabled, sid),
    )
    db.commit()
    return jsonify({"ok": True})


@accounts_bp.route("/api/schedules/<int:sid>", methods=["DELETE"])
def api_schedules_delete(sid):
    db = get_db()
    db.execute("DELETE FROM scheduled_transactions WHERE id=?", (sid,))
    db.commit()
    return jsonify({"ok": True})


@accounts_bp.route("/api/schedules/post-due", methods=["POST"])
def api_schedules_post_due():
    """Post all enabled scheduled transactions that are due today or earlier."""
    db = get_db()
    today = date.today().isoformat()
    due = db.execute(
        "SELECT * FROM scheduled_transactions WHERE enabled=1 AND next_due <= ?",
        (today,),
    ).fetchall()
    posted = 0
    for s in due:
        h = tx_hash(s["next_due"], s["name"], s["amount"], s["account"])
        existing = db.execute("SELECT id FROM transactions WHERE tx_hash=?", (h,)).fetchone()
        if not existing:
            acct_row = db.execute("SELECT id FROM accounts WHERE name=?", (s["account"],)).fetchone()
            aid = acct_row["id"] if acct_row else None
            db.execute(
                "INSERT INTO transactions (date, type, name, category, amount, account, account_id, notes, source, tx_hash) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (s["next_due"], s["type"], s["name"], s["category"], s["amount"],
                 s["account"], aid, "Auto-posted from schedule", "scheduled", h),
            )
            posted += 1
        # Advance next_due
        d = date.fromisoformat(s["next_due"])
        if s["frequency"] == "weekly":
            d += timedelta(weeks=1)
        elif s["frequency"] == "biweekly":
            d += timedelta(weeks=2)
        elif s["frequency"] == "monthly":
            import calendar
            orig_day = d.day
            month = d.month + 1
            year = d.year
            if month > 12:
                month = 1
                year += 1
            max_day = calendar.monthrange(year, month)[1]
            d = date(year, month, min(orig_day, max_day))
        elif s["frequency"] == "yearly":
            import calendar
            next_year = d.year + 1
            max_day = calendar.monthrange(next_year, d.month)[1]
            d = date(next_year, d.month, min(d.day, max_day))
        db.execute("UPDATE scheduled_transactions SET next_due=? WHERE id=?", (d.isoformat(), s["id"]))
    db.commit()
    return jsonify({"ok": True, "posted": posted})


@accounts_bp.route("/api/schedules/<int:sid>/post", methods=["POST"])
def api_schedule_post_single(sid):
    """Post a single scheduled transaction now, regardless of due date."""
    db = get_db()
    s = db.execute("SELECT * FROM scheduled_transactions WHERE id=?", (sid,)).fetchone()
    if not s:
        return jsonify({"error": "Schedule not found"}), 404
    today = date.today().isoformat()
    post_date = s["next_due"] if s["next_due"] <= today else today
    h = tx_hash(post_date, s["name"], s["amount"], s["account"])
    existing = db.execute("SELECT id FROM transactions WHERE tx_hash=?", (h,)).fetchone()
    posted = 0
    if not existing:
        acct_row = db.execute("SELECT id FROM accounts WHERE name=?", (s["account"],)).fetchone()
        aid = acct_row["id"] if acct_row else None
        db.execute(
            "INSERT INTO transactions (date, type, name, category, amount, account, account_id, notes, source, tx_hash) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (post_date, s["type"], s["name"], s["category"], s["amount"],
             s["account"], aid, "Posted from schedule", "scheduled", h),
        )
        posted = 1
    # Always advance next_due
    d = date.fromisoformat(s["next_due"])
    if s["frequency"] == "weekly":
        d += timedelta(weeks=1)
    elif s["frequency"] == "biweekly":
        d += timedelta(weeks=2)
    elif s["frequency"] == "monthly":
        import calendar
        orig_day = d.day
        month = d.month + 1
        year = d.year
        if month > 12:
            month = 1
            year += 1
        max_day = calendar.monthrange(year, month)[1]
        d = date(year, month, min(orig_day, max_day))
    elif s["frequency"] == "yearly":
        import calendar
        next_year = d.year + 1
        max_day = calendar.monthrange(next_year, d.month)[1]
        d = date(next_year, d.month, min(d.day, max_day))
    db.execute("UPDATE scheduled_transactions SET next_due=? WHERE id=?", (d.isoformat(), sid))
    db.commit()
    return jsonify({"ok": True, "posted": posted})


# ── TRANSFERS ─────────────────────────────────────────────────────────────────

@accounts_bp.route("/api/transfers", methods=["POST"])
def api_transfers_create():
    """Create a linked transfer between two accounts."""
    d = request.json
    from_account = (d.get("from_account") or "").strip()
    to_account = (d.get("to_account") or "").strip()
    if not from_account or not to_account:
        return jsonify({"error": "Both from_account and to_account are required"}), 400
    if from_account == to_account:
        return jsonify({"error": "Cannot transfer to same account"}), 400
    try:
        amount = float(d.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400
    tx_date = d.get("date", date.today().isoformat())
    notes = (d.get("notes") or "").strip()

    db = get_db()
    # Resolve account_ids
    from_row = db.execute("SELECT id FROM accounts WHERE name=?", (from_account,)).fetchone()
    to_row = db.execute("SELECT id FROM accounts WHERE name=?", (to_account,)).fetchone()
    from_aid = from_row["id"] if from_row else None
    to_aid = to_row["id"] if to_row else None

    h1 = tx_hash(tx_date, f"Transfer to {to_account}", amount, from_account)
    h2 = tx_hash(tx_date, f"Transfer from {from_account}", amount, to_account)

    # Outflow from source
    db.execute(
        "INSERT INTO transactions (date, type, name, category, amount, account, account_id, notes, source, tx_hash, hidden) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (tx_date, "Expense", f"Transfer to {to_account}", "Transfer", amount,
         from_account, from_aid, notes, "transfer", h1, 1),
    )
    out_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    # Inflow to destination
    db.execute(
        "INSERT INTO transactions (date, type, name, category, amount, account, account_id, notes, source, tx_hash, hidden, transfer_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (tx_date, "Income", f"Transfer from {from_account}", "Transfer", amount,
         to_account, to_aid, notes, "transfer", h2, 1, out_id),
    )
    in_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    # Link outflow to inflow
    db.execute("UPDATE transactions SET transfer_id=? WHERE id=?", (in_id, out_id))
    db.commit()
    return jsonify({"ok": True, "from_id": out_id, "to_id": in_id})


# ── RECONCILIATION ────────────────────────────────────────────────────────────

@accounts_bp.route("/api/accounts/<int:aid>/reconcile", methods=["POST"])
def api_reconcile(aid):
    """Reconcile an account: compare calculated vs actual balance, create adjustment."""
    d = request.json or {}
    db = get_db()
    acct = db.execute("SELECT * FROM accounts WHERE id=?", (aid,)).fetchone()
    if not acct:
        return jsonify({"error": "Account not found"}), 404
    try:
        actual_balance = float(d.get("actual_balance", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid balance"}), 400
    recon_date = d.get("date", date.today().isoformat())

    # Calculate current balance
    date_filter = ""
    params = [aid]
    if acct["balance_date"]:
        date_filter = " AND date >= ?"
        params.append(acct["balance_date"])
    row = db.execute(
        f"""SELECT
            COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END), 0) as expenses
        FROM transactions WHERE account_id = ?{date_filter}""",
        params,
    ).fetchone()
    calculated = acct["opening_balance"] + row["income"] - row["expenses"]
    diff = round(actual_balance - calculated, 2)

    if abs(diff) < 0.01:
        return jsonify({"ok": True, "adjustment": 0, "message": "Already balanced"})

    # Create hidden adjustment transaction
    adj_type = "Income" if diff > 0 else "Expense"
    adj_amount = abs(diff)
    h = tx_hash(recon_date, "Reconciliation adjustment", adj_amount, acct["name"])
    try:
        db.execute(
            """INSERT INTO transactions
               (date, type, name, category, amount, account, account_id, notes, source, tx_hash, hidden)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (recon_date, adj_type, "Reconciliation adjustment", "Reconciliation",
             adj_amount, acct["name"], aid, f"Adjusted by {diff:+.2f}", "reconciliation", h, 1),
        )
    except sqlite3.IntegrityError:
        pass  # Already reconciled at this point

    # Update opening_balance and balance_date to lock in reconciled state
    db.execute(
        "UPDATE accounts SET opening_balance=?, balance_date=? WHERE id=?",
        (actual_balance, recon_date, aid),
    )
    db.commit()
    return jsonify({
        "ok": True,
        "calculated": round(calculated, 2),
        "actual": actual_balance,
        "adjustment": diff,
    })


# ── INVESTMENT SNAPSHOTS ──────────────────────────────────────────────────────

@accounts_bp.route("/api/accounts/<int:aid>/snapshots")
def api_snapshots_list(aid):
    """List balance snapshots for an investment account."""
    db = get_db()
    rows = db.execute(
        "SELECT * FROM balance_snapshots WHERE account_id=? ORDER BY snapshot_date DESC",
        (aid,),
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@accounts_bp.route("/api/accounts/<int:aid>/snapshots", methods=["POST"])
def api_snapshots_add(aid):
    """Add a balance snapshot for an investment account."""
    d = request.json or {}
    db = get_db()
    acct = db.execute("SELECT * FROM accounts WHERE id=?", (aid,)).fetchone()
    if not acct:
        return jsonify({"error": "Account not found"}), 404
    try:
        balance = float(d.get("balance", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid balance"}), 400
    snapshot_date = d.get("date", date.today().isoformat())
    db.execute(
        "INSERT INTO balance_snapshots (account_id, balance, snapshot_date) VALUES (?,?,?)",
        (aid, balance, snapshot_date),
    )
    db.commit()
    return jsonify({"ok": True})


@accounts_bp.route("/api/snapshots/<int:snap_id>", methods=["DELETE"])
def api_snapshots_delete(snap_id):
    db = get_db()
    db.execute("DELETE FROM balance_snapshots WHERE id=?", (snap_id,))
    db.commit()
    return jsonify({"ok": True})


# ── UNDO ──────────────────────────────────────────────────────────────────────

def save_undo(db, action, data):
    """Save an undo record. Keep only last 50 entries."""
    db.execute(
        "INSERT INTO undo_history (action, data) VALUES (?,?)",
        (action, json.dumps(data)),
    )
    db.execute("""
        DELETE FROM undo_history WHERE id NOT IN (
            SELECT id FROM undo_history ORDER BY id DESC LIMIT 50
        )
    """)


@accounts_bp.route("/api/undo", methods=["POST"])
def api_undo():
    """Undo the last action."""
    db = get_db()
    row = db.execute(
        "SELECT * FROM undo_history ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return jsonify({"error": "Nothing to undo"}), 404
    action = row["action"]
    data = json.loads(row["data"])

    if action == "delete":
        # Restore deleted transaction
        t = data
        db.execute(
            "INSERT INTO transactions (date, type, name, category, amount, account, notes, source, tx_hash, hidden) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (t["date"], t["type"], t["name"], t["category"], t["amount"],
             t["account"], t.get("notes", ""), t.get("source", "manual"),
             t.get("tx_hash"), t.get("hidden", 0)),
        )
    elif action == "update":
        # Restore previous version
        old = data["old"]
        tid = data["id"]
        db.execute(
            "UPDATE transactions SET date=?, type=?, name=?, category=?, amount=?, account=?, notes=? WHERE id=?",
            (old["date"], old["type"], old["name"], old["category"],
             old["amount"], old["account"], old.get("notes", ""), tid),
        )
    elif action == "bulk_delete":
        for t in data:
            db.execute(
                "INSERT INTO transactions (date, type, name, category, amount, account, notes, source, tx_hash, hidden) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (t["date"], t["type"], t["name"], t["category"], t["amount"],
                 t["account"], t.get("notes", ""), t.get("source", "manual"),
                 t.get("tx_hash"), t.get("hidden", 0)),
            )

    db.execute("DELETE FROM undo_history WHERE id=?", (row["id"],))
    db.commit()
    return jsonify({"ok": True, "action": action})


@accounts_bp.route("/api/undo/status")
def api_undo_status():
    """Check if there's something to undo."""
    db = get_db()
    row = db.execute(
        "SELECT action, created_at FROM undo_history ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if row:
        return jsonify({"available": True, "action": row["action"], "when": row["created_at"]})
    return jsonify({"available": False})
