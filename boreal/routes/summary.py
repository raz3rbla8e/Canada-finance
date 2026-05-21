from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from boreal.models.database import get_db, get_setting

summary_bp = Blueprint("summary", __name__)


def _currency_symbol():
    """Return the user's chosen currency symbol."""
    code = get_setting("currency", "CAD")
    return {"CAD": "$", "USD": "$", "EUR": "€", "GBP": "£"}.get(code, "$")


def _generate_insights(income, expenses, prev_exp, by_cat, budgets):
    """Generate smart insights for the dashboard."""
    insights = []
    net = income - expenses
    cs = _currency_symbol()
    # Savings rate insight
    if income > 0:
        rate = net / income * 100
        if rate >= 20:
            insights.append({"icon": "spark", "tone": "pos", "title": f"{rate:.0f}% savings rate", "detail": "You're saving well this month!"})
        elif rate < 0:
            insights.append({"icon": "alert", "tone": "warn", "title": "Spending exceeds income", "detail": f"You're {cs}{abs(net):,.0f} over budget this month."})
    # Month-over-month change
    if prev_exp and expenses:
        change = (expenses - prev_exp) / prev_exp * 100
        if change > 15:
            insights.append({"icon": "trending", "tone": "warn", "title": f"Spending up {change:.0f}%", "detail": "Compared to last month."})
        elif change < -10:
            insights.append({"icon": "trending", "tone": "pos", "title": f"Spending down {abs(change):.0f}%", "detail": "Nice — you cut spending vs last month."})
    # Over-budget categories
    for b in budgets:
        if b["limit"] and b["spent"] > b["limit"]:
            over = b["spent"] - b["limit"]
            insights.append({"icon": "alert", "tone": "warn", "title": f"{b['category']} over budget", "detail": f"{cs}{over:,.0f} over the {cs}{b['limit']:,.0f} limit."})
    # Top spending category spike
    for cat in by_cat[:1]:
        if cat.get("prev_total") and cat["total"] > 0:
            change = (cat["total"] - cat["prev_total"]) / cat["prev_total"] * 100 if cat["prev_total"] else 0
            if change > 30:
                insights.append({"icon": "trending", "tone": "accent", "title": f"{cat['category']} up {change:.0f}%", "detail": f"{cs}{cat['total']:,.0f} this month vs {cs}{cat['prev_total']:,.0f} last month."})
    return insights[:4]  # Cap at 4


@summary_bp.route("/api/months")
def api_months():
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT substr(date,1,7) as m FROM transactions WHERE hidden=0 ORDER BY m DESC"
    ).fetchall()
    return jsonify([r["m"] for r in rows])


@summary_bp.route("/api/summary")
def api_summary():
    month = request.args.get("month", "")
    db = get_db()
    like = f"{month}%"
    income = db.execute(
        "SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type='Income' AND hidden=0 AND date LIKE ?",
        (like,),
    ).fetchone()["t"]
    expenses = db.execute(
        "SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type='Expense' AND hidden=0 AND date LIKE ?",
        (like,),
    ).fetchone()["t"]
    by_cat = db.execute(
        """SELECT category, SUM(amount) as total FROM transactions
           WHERE type='Expense' AND hidden=0 AND date LIKE ? GROUP BY category ORDER BY total DESC""",
        (like,),
    ).fetchall()
    income_by_cat = db.execute(
        """SELECT category, SUM(amount) as total FROM transactions
           WHERE type='Income' AND hidden=0 AND date LIKE ? GROUP BY category ORDER BY total DESC""",
        (like,),
    ).fetchall()
    # Previous month for comparison
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
            pm = date(y, m, 1) - timedelta(days=1)
            prev_like = f"{pm.year}-{pm.month:02d}%"
            prev_exp = db.execute(
                "SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type='Expense' AND hidden=0 AND date LIKE ?",
                (prev_like,),
            ).fetchone()["t"]
            prev_inc = db.execute(
                "SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type='Income' AND hidden=0 AND date LIKE ?",
                (prev_like,),
            ).fetchone()["t"]
            prev_by_cat = db.execute(
                """SELECT category, SUM(amount) as total FROM transactions
                   WHERE type='Expense' AND hidden=0 AND date LIKE ? GROUP BY category""",
                (prev_like,),
            ).fetchall()
            prev_cat_map = {r["category"]: r["total"] for r in prev_by_cat}
            prev_month_label = f"{pm.year}-{pm.month:02d}"
        except (ValueError, IndexError):
            prev_exp = 0
            prev_inc = 0
            prev_cat_map = {}
            prev_month_label = ""
    else:
        prev_exp = 0
        prev_inc = 0
        prev_cat_map = {}
        prev_month_label = ""
    # Budgets
    budgets = {
        r["category"]: r["monthly_limit"]
        for r in db.execute("SELECT category, monthly_limit FROM budgets").fetchall()
    }
    by_cat_out = []
    for r in by_cat:
        cat = r["category"]
        by_cat_out.append({
            "category": cat,
            "total": r["total"],
            "prev_total": prev_cat_map.get(cat, 0),
            "budget": budgets.get(cat),
        })
    # Build budgets list with spent amounts
    cat_spent = {r["category"]: r["total"] for r in by_cat}
    budgets_out = [
        {"category": cat, "spent": cat_spent.get(cat, 0), "limit": limit}
        for cat, limit in budgets.items()
    ]
    # Generate insights
    insights = _generate_insights(income, expenses, prev_exp, by_cat_out, budgets_out)
    return jsonify({
        "income": income,
        "expenses": expenses,
        "net": income - expenses,
        "prev_expenses": prev_exp,
        "prev_income": prev_inc,
        "prev_month": prev_month_label,
        "savings_rate": round((income - expenses) / income * 100, 1) if income > 0 else 0,
        "by_category": by_cat_out,
        "income_by_category": [{"category": r["category"], "total": r["total"]} for r in income_by_cat],
        "budgets": budgets_out,
        "insights": insights,
    })


@summary_bp.route("/api/year/<int:year>")
def api_year(year):
    db = get_db()
    # Single query to get income/expenses by month for the entire year
    monthly = db.execute(
        """SELECT substr(date,1,7) as month, type, SUM(amount) as total
        FROM transactions WHERE hidden=0 AND date LIKE ? GROUP BY month, type""",
        (f"{year}%",),
    ).fetchall()
    month_map = {}
    for r in monthly:
        m = r["month"]
        if m not in month_map:
            month_map[m] = {"income": 0, "expenses": 0}
        if r["type"] == "Income":
            month_map[m]["income"] = r["total"]
        else:
            month_map[m]["expenses"] = r["total"]
    months_data = []
    for m in range(1, 13):
        key = f"{year}-{m:02d}"
        data = month_map.get(key, {"income": 0, "expenses": 0})
        months_data.append({
            "month": key, "income": data["income"],
            "expenses": data["expenses"], "net": data["income"] - data["expenses"],
        })
    top_cats = db.execute(
        """SELECT category, SUM(amount) as total FROM transactions
        WHERE type='Expense' AND hidden=0 AND date LIKE ? GROUP BY category ORDER BY total DESC LIMIT 5""",
        (f"{year}%",),
    ).fetchall()
    return jsonify({
        "months": months_data,
        "top_categories": [{"category": r["category"], "total": r["total"]} for r in top_cats],
        "total_income": sum(m["income"] for m in months_data),
        "total_expenses": sum(m["expenses"] for m in months_data),
    })


@summary_bp.route("/api/averages")
def api_averages():
    """Monthly average spend per category based on last 6 months."""
    db = get_db()
    months_with_data = db.execute("""
        SELECT DISTINCT substr(date,1,7) as m FROM transactions
        WHERE type='Expense' AND hidden=0 ORDER BY m DESC LIMIT 6
    """).fetchall()
    n = len(months_with_data)
    if n == 0:
        return jsonify([])
    placeholders = ",".join("?" * n)
    rows = db.execute(
        f"""SELECT category,
               ROUND(SUM(amount)/{n}, 2) as avg_monthly,
               COUNT(DISTINCT substr(date,1,7)) as months_seen
        FROM transactions WHERE type='Expense' AND hidden=0
        AND substr(date,1,7) IN ({placeholders})
        GROUP BY category ORDER BY avg_monthly DESC""",
        [r["m"] for r in months_with_data],
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@summary_bp.route("/api/recurring")
def api_recurring():
    """Detect recurring transactions — same merchant appearing in 3+ distinct months."""
    db = get_db()
    min_months = request.args.get("min_months", 3, type=int)
    rows = db.execute("""
        SELECT MAX(name) as name,
               MAX(category) as category,
               MAX(type) as type,
               COUNT(DISTINCT substr(date,1,7)) as months_seen,
               ROUND(AVG(amount), 2) as avg_amount,
               ROUND(MIN(amount), 2) as min_amount,
               ROUND(MAX(amount), 2) as max_amount,
               COUNT(*) as total_charges,
               MAX(date) as last_seen,
               MIN(date) as first_seen
        FROM transactions
        WHERE hidden=0 AND type='Expense'
              AND LOWER(name) NOT LIKE '%%interac%%'
              AND LOWER(name) NOT LIKE '%%e-transfer%%'
              AND LOWER(category) NOT IN ('groceries', 'dining & coffee', 'eating out')
        GROUP BY LOWER(TRIM(name))
        HAVING months_seen >= ?
               AND MIN(amount) > 0
               AND MAX(amount) <= MIN(amount) * 1.5
        ORDER BY months_seen DESC, avg_amount DESC
    """, (min_months,)).fetchall()
    recurring = []
    for r in rows:
        entry = dict(r)
        entry["price_changed"] = round(r["max_amount"] - r["min_amount"], 2) > 0.01
        # Fetch last 6 charges for price trail (Case 05)
        history_rows = db.execute("""
            SELECT date, amount FROM transactions
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND hidden=0
            ORDER BY date DESC LIMIT 6
        """, (r["name"],)).fetchall()
        entry["history"] = [{"date": h["date"], "amount": float(h["amount"])} for h in reversed(history_rows)]
        # Estimate next charge date based on frequency
        if r["last_seen"]:
            from datetime import date as dt_date, timedelta
            try:
                last = dt_date.fromisoformat(r["last_seen"])
                avg_gap = 30  # default monthly
                if r["months_seen"] and r["total_charges"] > 1:
                    first = dt_date.fromisoformat(r["first_seen"])
                    total_days = (last - first).days
                    avg_gap = max(total_days // (r["total_charges"] - 1), 7)
                entry["next_date"] = (last + timedelta(days=avg_gap)).isoformat()
            except (ValueError, TypeError):
                entry["next_date"] = None
        else:
            entry["next_date"] = None
        recurring.append(entry)
    total_monthly = sum(
        r["avg_amount"] for r in recurring if r["type"] == "Expense"
    )
    return jsonify({
        "recurring": recurring,
        "total_monthly_committed": round(total_monthly, 2),
        "count": len(recurring),
    })


@summary_bp.route("/api/trends")
def api_trends():
    """Monthly income/expense totals for the last N months."""
    n = request.args.get("months", 6, type=int)
    n = max(1, min(n, 24))
    db = get_db()
    rows = db.execute(
        """SELECT substr(date,1,7) as m, type, SUM(amount) as total
        FROM transactions WHERE hidden=0
        GROUP BY m, type ORDER BY m DESC""",
    ).fetchall()
    month_map = {}
    for r in rows:
        m = r["m"]
        if m not in month_map:
            month_map[m] = {"income": 0, "expenses": 0}
        if r["type"] == "Income":
            month_map[m]["income"] = r["total"]
        else:
            month_map[m]["expenses"] = r["total"]
    sorted_months = sorted(month_map.keys(), reverse=True)[:n]
    result = []
    for m in reversed(sorted_months):
        d = month_map[m]
        result.append({"month": m, "income": d["income"], "expenses": d["expenses"], "net": d["income"] - d["expenses"]})
    return jsonify(result)


@summary_bp.route("/api/alerts")
def api_alerts():
    """Real-time alerts: budget overages, due schedules, uncategorized, price changes."""
    import json as _json
    db = get_db()
    today = date.today()
    month = today.strftime("%Y-%m")
    alerts = []
    cs = _currency_symbol()

    # Load dismissed alert IDs
    row = db.execute("SELECT value FROM settings WHERE key='dismissed_alerts'").fetchone()
    dismissed = set(_json.loads(row["value"]) if row else [])

    # 1. Budget overages this month
    budgets = db.execute(
        """SELECT b.category, b.monthly_limit,
                  COALESCE(SUM(t.amount), 0) as spent
           FROM budgets b
           LEFT JOIN transactions t ON t.category = b.category
                AND t.type = 'Expense' AND t.hidden = 0
                AND t.date LIKE ?
           GROUP BY b.category, b.monthly_limit
           HAVING spent > b.monthly_limit""",
        (f"{month}%",),
    ).fetchall()
    for b in budgets:
        over = b["spent"] - b["monthly_limit"]
        alerts.append({
            "id": f"budget:{month}:{b['category']}",
            "type": "budget",
            "icon": "alert",
            "tone": "warn",
            "title": f"{b['category']} over budget",
            "detail": f"{cs}{over:,.0f} over the {cs}{b['monthly_limit']:,.0f} limit",
        })

    # 2. Scheduled transactions due within 7 days
    due_cutoff = (today + timedelta(days=7)).isoformat()
    due = db.execute(
        "SELECT name, next_due, amount FROM scheduled_transactions WHERE enabled=1 AND next_due <= ?",
        (due_cutoff,),
    ).fetchall()
    for s in due:
        is_overdue = s["next_due"] <= today.isoformat()
        alerts.append({
            "id": f"schedule:{s['name']}:{s['next_due']}",
            "type": "schedule",
            "icon": "calendar" if not is_overdue else "alert",
            "tone": "warn" if is_overdue else "accent",
            "title": f"{s['name']} {'overdue' if is_overdue else 'due soon'}",
            "detail": f"{cs}{s['amount']:,.2f} · due {s['next_due']}",
        })

    # 3. Uncategorized transactions
    uncat = db.execute(
        "SELECT COUNT(*) as c FROM transactions WHERE hidden=0 AND (category='UNCATEGORIZED' OR category='')",
    ).fetchone()["c"]
    if uncat > 0:
        alerts.append({
            "id": f"uncategorized:{month}",
            "type": "uncategorized",
            "icon": "tag",
            "tone": "accent",
            "title": f"{uncat} uncategorized transaction{'s' if uncat != 1 else ''}",
            "detail": "Review and assign categories",
        })

    # 4. Subscription price changes (recurring with variance)
    price_changes = db.execute(
        """SELECT MAX(name) as name,
                  ROUND(MIN(amount), 2) as min_amount,
                  ROUND(MAX(amount), 2) as max_amount,
                  COUNT(DISTINCT substr(date,1,7)) as months_seen
           FROM transactions
           WHERE hidden=0 AND type='Expense'
           GROUP BY LOWER(TRIM(name))
           HAVING months_seen >= 3
                  AND ROUND(max_amount - min_amount, 2) > 0.01""",
    ).fetchall()
    for p in price_changes:
        alerts.append({
            "id": f"price:{p['name'].lower().strip()}",
            "type": "price_change",
            "icon": "trending",
            "tone": "accent",
            "title": f"{p['name']} price changed",
            "detail": f"{cs}{p['min_amount']:,.2f} → {cs}{p['max_amount']:,.2f}",
        })

    # Filter out dismissed alerts
    alerts = [a for a in alerts if a["id"] not in dismissed]

    return jsonify({"alerts": alerts, "count": len(alerts)})


@summary_bp.route("/api/alerts/dismiss", methods=["POST"])
def api_dismiss_alert():
    """Dismiss one or all alerts so they don't reappear."""
    import json as _json
    data = request.get_json(force=True) or {}
    alert_id = data.get("id", "")
    clear_all = data.get("all", False)
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key='dismissed_alerts'").fetchone()
    dismissed = _json.loads(row["value"]) if row else []
    if clear_all:
        # Caller passes current alert IDs to dismiss them all
        ids = data.get("ids", [])
        for aid in ids:
            if aid not in dismissed:
                dismissed.append(aid)
    elif alert_id and alert_id not in dismissed:
        dismissed.append(alert_id)
    if row:
        db.execute("UPDATE settings SET value=? WHERE key='dismissed_alerts'", (_json.dumps(dismissed),))
    else:
        db.execute("INSERT INTO settings (key, value) VALUES ('dismissed_alerts', ?)", (_json.dumps(dismissed),))
    db.commit()
    return jsonify({"ok": True})


@summary_bp.route("/api/forecast")
def api_forecast():
    """Project cash flow for next 3 months using recurring transactions and historical averages."""
    db = get_db()
    today = date.today()
    months_ahead = request.args.get("months", 3, type=int)
    months_ahead = max(1, min(months_ahead, 6))

    # Get recurring expense/income patterns
    recurring = db.execute(
        """SELECT MAX(type) as type,
                  ROUND(AVG(amount), 2) as avg_amount,
                  COUNT(DISTINCT substr(date,1,7)) as months_seen
           FROM transactions WHERE hidden=0
           GROUP BY LOWER(TRIM(name))
           HAVING months_seen >= 3""",
    ).fetchall()
    recurring_expense = sum(r["avg_amount"] for r in recurring if r["type"] == "Expense")
    recurring_income = sum(r["avg_amount"] for r in recurring if r["type"] == "Income")

    # Get historical averages for non-recurring (last 6 months)
    hist = db.execute(
        """SELECT substr(date,1,7) as m, type, SUM(amount) as total
           FROM transactions WHERE hidden=0
           GROUP BY m, type ORDER BY m DESC""",
    ).fetchall()
    month_totals = {}
    for r in hist:
        if r["m"] not in month_totals:
            month_totals[r["m"]] = {"income": 0, "expenses": 0}
        if r["type"] == "Income":
            month_totals[r["m"]]["income"] = r["total"]
        else:
            month_totals[r["m"]]["expenses"] = r["total"]

    recent_months = sorted(month_totals.keys(), reverse=True)[:6]
    if recent_months:
        avg_income = sum(month_totals[m]["income"] for m in recent_months) / len(recent_months)
        avg_expenses = sum(month_totals[m]["expenses"] for m in recent_months) / len(recent_months)
    else:
        avg_income = recurring_income
        avg_expenses = recurring_expense

    # Blend: use max of recurring baseline and historical average
    proj_income = max(recurring_income, avg_income)
    proj_expenses = max(recurring_expense, avg_expenses)

    # Build historical data points
    historical = []
    for m in sorted(month_totals.keys())[-6:]:
        d = month_totals[m]
        historical.append({"month": m, "income": d["income"], "expenses": d["expenses"], "net": d["income"] - d["expenses"]})

    # Build forecast data points
    forecast = []
    for i in range(1, months_ahead + 1):
        fm = date(today.year, today.month, 1)
        # Add months
        month_num = fm.month + i
        year_num = fm.year + (month_num - 1) // 12
        month_num = ((month_num - 1) % 12) + 1
        fm = date(year_num, month_num, 1)
        forecast.append({
            "month": fm.strftime("%Y-%m"),
            "income": round(proj_income, 2),
            "expenses": round(proj_expenses, 2),
            "net": round(proj_income - proj_expenses, 2),
            "projected": True,
        })

    # Current net worth for projection
    nw = db.execute(
        """SELECT COALESCE(
             (SELECT SUM(CASE WHEN type='Income' THEN amount ELSE -amount END) FROM transactions WHERE hidden=0),
           0) as nw""",
    ).fetchone()["nw"]

    return jsonify({
        "historical": historical,
        "forecast": forecast,
        "projected_monthly_net": round(proj_income - proj_expenses, 2),
        "recurring_expense": round(recurring_expense, 2),
        "recurring_income": round(recurring_income, 2),
        "current_net_worth": round(nw, 2),
    })


@summary_bp.route("/api/counts")
def api_counts():
    """Lightweight endpoint returning nav badge counts (replaces 3 separate fetches)."""
    db = get_db()
    tx_count = db.execute(
        "SELECT COUNT(*) as c FROM transactions WHERE hidden=0"
    ).fetchone()["c"]
    sched_count = db.execute(
        "SELECT COUNT(*) as c FROM scheduled_transactions"
    ).fetchone()["c"]
    rules_count = db.execute(
        "SELECT COUNT(*) as c FROM import_rules"
    ).fetchone()["c"]
    return jsonify({
        "transactions": tx_count,
        "schedules": sched_count,
        "rules": rules_count,
    })


@summary_bp.route("/api/bootstrap")
def api_bootstrap():
    """Single endpoint returning all data needed for initial app load.
    Replaces 6 separate init() calls: /me, /categories, /settings, /months, /demo, /health.
    """
    from flask import current_app
    from flask_login import current_user
    from boreal.models.users import get_user_db_path
    import os

    # User info
    me = {
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "verified": current_user.verified,
        "is_admin": current_user.is_admin,
    }

    db = get_db()

    # Categories
    cats = [dict(r) for r in db.execute(
        "SELECT id, name, type, icon, user_created, sort_order, group_id FROM categories ORDER BY type, sort_order"
    ).fetchall()]

    # Settings
    settings = {r["key"]: r["value"] for r in db.execute(
        "SELECT key, value FROM settings"
    ).fetchall()}

    # Months
    months = [r["m"] for r in db.execute(
        "SELECT DISTINCT substr(date,1,7) as m FROM transactions WHERE hidden=0 ORDER BY m DESC"
    ).fetchall()]

    # Demo
    demo = current_app.config.get("DEMO_MODE", False)

    # Health (DB exists check)
    db_exists = os.path.isfile(get_user_db_path(current_user.id))

    # Nav counts
    tx_count = db.execute("SELECT COUNT(*) as c FROM transactions WHERE hidden=0").fetchone()["c"]
    sched_count = db.execute("SELECT COUNT(*) as c FROM scheduled_transactions").fetchone()["c"]
    rules_count = db.execute("SELECT COUNT(*) as c FROM import_rules").fetchone()["c"]

    return jsonify({
        "me": me,
        "categories": cats,
        "settings": settings,
        "months": months,
        "demo": demo,
        "db_exists": db_exists,
        "counts": {
            "transactions": tx_count,
            "schedules": sched_count,
            "rules": rules_count,
        },
    })


@summary_bp.route("/api/insights/dismiss", methods=["POST"])
def api_dismiss_insight():
    """Persist dismissed insight IDs so they don't reappear."""
    import json
    data = request.get_json(force=True) or {}
    insight_id = data.get("id", "")
    if not insight_id:
        return jsonify({"ok": True})
    db = get_db()
    # Store dismissed IDs in user settings JSON
    row = db.execute("SELECT value FROM settings WHERE key='dismissed_insights'").fetchone()
    dismissed = json.loads(row["value"]) if row else []
    if insight_id not in dismissed:
        dismissed.append(insight_id)
    if row:
        db.execute("UPDATE settings SET value=? WHERE key='dismissed_insights'", (json.dumps(dismissed),))
    else:
        db.execute("INSERT INTO settings (key, value) VALUES ('dismissed_insights', ?)", (json.dumps(dismissed),))
    db.commit()
    return jsonify({"ok": True})
