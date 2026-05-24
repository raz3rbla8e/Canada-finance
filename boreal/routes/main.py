import glob
import os
import sqlite3

from flask import Blueprint, render_template, jsonify, current_app, request
from flask_login import login_required, current_user

from boreal.config import DB_PATH, SAMPLE_DATA_DIR, BANKS_DIR

main_bp = Blueprint("main", __name__)


@main_bp.route("/")
def index():
    if not current_user.is_authenticated:
        return render_template("landing.html")
    return render_template("index.html")


@main_bp.route("/icon-compare")
def icon_compare():
    return render_template("icon_compare.html")


@main_bp.route("/api/health")
def health():
    from flask_login import current_user
    from boreal.models.users import get_user_db_path
    if current_user.is_authenticated:
        db_exists = os.path.isfile(get_user_db_path(current_user.id))
    else:
        db_exists = True  # doesn't matter — user will be redirected to login
    return jsonify({
        "status": "ok",
        "db_exists": db_exists,
    })


@main_bp.route("/api/demo")
def api_demo():
    return jsonify({"demo": current_app.config.get("DEMO_MODE", False)})


@main_bp.route("/api/admin-recover", methods=["POST"])
def api_admin_recover():
    """One-time admin recovery — requires ADMIN_RECOVER_KEY env var to match."""
    import os
    from boreal.models.users import get_user_by_email, set_admin
    key = os.environ.get("ADMIN_RECOVER_KEY", "")
    if not key:
        return jsonify({"error": "Not configured"}), 404
    d = request.json or {}
    if d.get("key") != key:
        return jsonify({"error": "Forbidden"}), 403
    email = d.get("email", "")
    user = get_user_by_email(email)
    if not user:
        return jsonify({"error": "User not found"}), 404
    set_admin(user.id, True)
    return jsonify({"ok": True, "email": user.email, "is_admin": True})


@main_bp.route("/api/demo/reset", methods=["POST"])
def api_demo_reset():
    if not current_app.config.get("DEMO_MODE"):
        return jsonify({"error": "Not in demo mode"}), 403
    _seed_demo_data()
    return jsonify({"ok": True, "message": "Demo data reset"})


def _seed_demo_data(wipe=True):
    """Seed (or re-seed) the database with comprehensive demo data showcasing every feature."""
    from datetime import date, timedelta
    from boreal.models.database import get_db
    from boreal.services.categorization import load_learned_dict
    from boreal.services.csv_parser import load_bank_configs, detect_bank_config, parse_with_config
    from boreal.services.rules_engine import save_transactions

    db = get_db()
    if wipe:
        for table in ("transactions", "accounts", "savings_goals",
                       "scheduled_transactions", "budgets", "learned_merchants",
                       "import_rules", "rule_conditions", "undo_history"):
            db.execute(f"DELETE FROM {table}")
        db.commit()

    # ── 1. Import sample CSV transactions ──────────────────────────────────────
    learned = load_learned_dict(db)
    configs = load_bank_configs()
    total_added = 0

    csv_files = sorted(glob.glob(os.path.join(SAMPLE_DATA_DIR, "*.csv")))
    for csv_path in csv_files:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            text = f.read()
        first_line = text.splitlines()[0] if text.strip() else ""
        config, bank_name = detect_bank_config(first_line, configs)
        if config:
            txns = parse_with_config(text, config, learned)
            added, dupes, *_ = save_transactions(txns)
            total_added += added

    # ── 2. Accounts (4 types for Net Worth chart) ──────────────────────────────
    demo_accounts = [
        ("RBC Chequing", "chequing", 4250),
        ("Tangerine Chequing", "chequing", 2800),
        ("TD Savings", "savings", 12000),
        ("Tangerine Credit Card", "credit", 0),
        ("Wealthsimple TFSA", "investment", 8500),
    ]
    for name, acct_type, balance in demo_accounts:
        try:
            db.execute(
                "INSERT INTO accounts (name, account_type, opening_balance) VALUES (?,?,?)",
                (name, acct_type, balance),
            )
        except sqlite3.IntegrityError:
            pass

    # Back-fill account_id on transactions so balances compute correctly
    db.execute("""
        UPDATE transactions SET account_id = (
            SELECT id FROM accounts WHERE accounts.name = transactions.account
        ) WHERE account_id IS NULL AND account IS NOT NULL AND account != ''
    """)
    db.commit()

    # ── 3. Savings goals (varied progress levels) ──────────────────────────────
    demo_goals = [
        ("Vacation Fund", 3000, 1850, "✈️"),
        ("Emergency Fund", 10000, 4200, "🛡️"),
        ("New Laptop", 2000, 1600, "💻"),
        ("Wedding", 15000, 3200, "💍"),
        ("Car Down Payment", 8000, 950, "🚗"),
    ]
    for name, target, current, icon_emoji in demo_goals:
        try:
            db.execute(
                "INSERT INTO savings_goals (name, target_amount, current_amount, icon) VALUES (?,?,?,?)",
                (name, target, current, icon_emoji),
            )
        except sqlite3.IntegrityError:
            pass

    # ── 4. Scheduled transactions (all 4 frequencies + multiple accounts) ──────
    today = date.today()
    next_month = today.replace(day=1) + timedelta(days=32)
    next_month = next_month.replace(day=1)
    next_week = today + timedelta(days=7)
    demo_schedules = [
        ("Netflix", "Expense", "Subscriptions", 17.99, "RBC Chequing", "monthly", next_month.isoformat()),
        ("Spotify Premium", "Expense", "Subscriptions", 11.99, "RBC Chequing", "monthly", next_month.isoformat()),
        ("Claude Pro", "Expense", "Subscriptions", 26.00, "Tangerine Credit Card", "monthly", next_month.isoformat()),
        ("Rent", "Expense", "Rent", 2200.00, "RBC Chequing", "monthly", next_month.isoformat()),
        ("Paycheque — ACME Corp", "Income", "Job", 3250.00, "Tangerine Chequing", "biweekly", next_week.isoformat()),
        ("Gym Membership", "Expense", "Healthcare", 55.00, "RBC Chequing", "monthly", next_month.isoformat()),
        ("Rogers Wireless", "Expense", "Phone", 85.00, "RBC Chequing", "monthly", next_month.isoformat()),
        ("Enbridge Gas", "Expense", "Utilities", 120.00, "RBC Chequing", "monthly", next_month.isoformat()),
        ("Car Insurance", "Expense", "Insurance", 165.00, "RBC Chequing", "monthly", next_month.isoformat()),
        ("TFSA Contribution", "Expense", "Savings Transfer", 250.00, "TD Savings", "biweekly", next_week.isoformat()),
        ("Side Hustle — Freelance", "Income", "Freelance", 800.00, "Tangerine Chequing", "monthly", next_month.isoformat()),
        ("RRSP Contribution", "Expense", "Savings Transfer", 500.00, "TD Savings", "yearly", (today.replace(month=2, day=15) + timedelta(days=365)).isoformat()),
    ]
    for name, tx_type, cat, amount, acct, freq, due in demo_schedules:
        db.execute(
            "INSERT INTO scheduled_transactions (name, type, category, amount, account, frequency, next_due) VALUES (?,?,?,?,?,?,?)",
            (name, tx_type, cat, amount, acct, freq, due),
        )

    # ── 5. Budgets (aligned with actual transaction categories) ────────────────
    demo_budgets = [
        ("Eating Out", 200),
        ("Groceries", 500),
        ("Entertainment", 120),
        ("Subscriptions", 80),
        ("Fuel", 150),
        ("Clothing", 100),
        ("Shopping", 200),
        ("Transport", 180),
        ("Pharmacy", 50),
        ("Home", 100),
        ("Healthcare", 75),
    ]
    for cat, limit_val in demo_budgets:
        db.execute(
            "INSERT OR REPLACE INTO budgets (category, monthly_limit) VALUES (?,?)",
            (cat, limit_val),
        )

    # ── 6. Import rules (showcase multiple rule types) ─────────────────────────
    rules = [
        ("Auto-hide: CC Payment transfers", "hide", 1, [
            ("description", "contains", "PAYMENT - THANK YOU"),
        ]),
        ("Auto-hide: e-Transfer to self", "hide", 2, [
            ("description", "contains", "INTERAC e-Transfer TO VISA"),
        ]),
        ("Label: Large purchases over $500", "label", 3, [
            ("amount", "greater_than", "500"),
        ]),
        ("Categorize: Tim Hortons → Eating Out", "label", 4, [
            ("description", "contains", "TIM HORTONS"),
        ]),
        ("Pass: keep payroll visible", "pass", 5, [
            ("description", "contains", "PAYROLL"),
        ]),
    ]
    for name, action, priority, conditions in rules:
        action_value = ""
        if name.startswith("Label: Large"):
            import json
            action_value = json.dumps({"category": "Shopping"})
        elif name.startswith("Categorize: Tim"):
            import json
            action_value = json.dumps({"category": "Eating Out"})
        db.execute(
            "INSERT INTO import_rules (name, action, action_value, enabled, priority) VALUES (?,?,?,1,?)",
            (name, action, action_value, priority),
        )
        rule_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        for field, operator, value in conditions:
            db.execute(
                "INSERT INTO rule_conditions (rule_id, field, operator, value) VALUES (?,?,?,?)",
                (rule_id, field, operator, value),
            )

    # ── 7. Learned merchants (comprehensive) ──────────────────────────────────
    demo_learned = [
        ("tim hortons", "Eating Out"),
        ("costco wholesale", "Groceries"),
        ("shell", "Fuel"),
        ("amazon.ca", "Shopping"),
        ("canadian tire", "Home"),
        ("shoppers drug mart", "Pharmacy"),
        ("netflix.com", "Subscriptions"),
        ("spotify premium", "Subscriptions"),
        ("uber eats", "Eating Out"),
        ("loblaws", "Groceries"),
        ("no frills", "Groceries"),
        ("petro-canada", "Fuel"),
        ("presto transit", "Transport"),
        ("cineplex", "Entertainment"),
        ("lcbo", "Entertainment"),
        ("goodlife fitness", "Healthcare"),
        ("rogers wireless", "Phone"),
        ("enbridge gas", "Utilities"),
        ("dollarama", "Shopping"),
    ]
    for keyword, cat in demo_learned:
        db.execute(
            "INSERT OR REPLACE INTO learned_merchants (keyword, category) VALUES (?,?)",
            (keyword, cat),
        )

    # ── 8. Category groups (showcase grouping feature) ─────────────────────────
    # Ensure groups exist
    db.execute("INSERT OR IGNORE INTO category_groups (name, sort_order) VALUES ('Essentials', 0)")
    db.execute("INSERT OR IGNORE INTO category_groups (name, sort_order) VALUES ('Lifestyle', 1)")
    db.execute("INSERT OR IGNORE INTO category_groups (name, sort_order) VALUES ('Savings & Debt', 2)")
    # Assign categories to groups
    essentials = ('Rent', 'Groceries', 'Utilities', 'Insurance', 'Phone', 'Internet',
                  'Healthcare', 'Pharmacy', 'Fuel', 'Transport')
    for cat in essentials:
        db.execute("UPDATE categories SET group_id=(SELECT id FROM category_groups WHERE name='Essentials') WHERE name=? AND type='Expense'", (cat,))
    savings = ('Savings Transfer',)
    for cat in savings:
        db.execute("UPDATE categories SET group_id=(SELECT id FROM category_groups WHERE name='Savings & Debt') WHERE name=?", (cat,))
    db.execute("UPDATE categories SET group_id=(SELECT id FROM category_groups WHERE name='Lifestyle') WHERE type='Expense' AND group_id IS NULL")

    # ── 9. Settings (preferred currency, dashboard layout) ─────────────────────
    demo_settings = [
        ("currency", "CAD"),
        ("date_format", "YYYY-MM-DD"),
        ("dashboard_layout", "default"),
    ]
    for key, val in demo_settings:
        db.execute(
            "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, val),
        )

    db.commit()
    return total_added
