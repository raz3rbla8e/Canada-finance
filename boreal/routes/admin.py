"""Admin routes: user management, app health, system stats."""

import os
import platform
import sqlite3
import time
from datetime import datetime

from flask import Blueprint, render_template, jsonify, request, abort
from flask_login import current_user, login_required

from boreal.models.users import (
    list_all_users, user_count, get_user_db_path, set_admin,
    get_user_by_id, DATA_DIR, USERS_DB_PATH,
)
from boreal.config import PROJECT_ROOT, SAMPLE_DATA_DIR, BANKS_DIR

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

_start_time = time.time()


def _require_admin():
    """Abort 403 if current user is not admin."""
    if not current_user.is_authenticated or not current_user.is_admin:
        abort(403)


@admin_bp.before_request
def check_admin():
    _require_admin()


@admin_bp.route("/")
def dashboard():
    return render_template("admin.html")


@admin_bp.route("/api/stats")
def api_stats():
    """System stats for the admin dashboard."""
    users = list_all_users()

    # Per-user DB sizes + transaction counts
    user_details = []
    total_transactions = 0
    total_db_bytes = 0
    for u in users:
        db_path = get_user_db_path(u["id"])
        db_size = 0
        tx_count = 0
        if os.path.exists(db_path):
            db_size = os.path.getsize(db_path)
            try:
                conn = sqlite3.connect(db_path)
                tx_count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
                conn.close()
            except Exception:
                pass
        total_transactions += tx_count
        total_db_bytes += db_size
        user_details.append({
            "id": u["id"],
            "email": u["email"],
            "display_name": u["display_name"],
            "verified": u["verified"],
            "is_admin": u["is_admin"],
            "created_at": u["created_at"],
            "last_login": u["last_login"],
            "db_size_bytes": db_size,
            "transaction_count": tx_count,
        })

    # users.db size
    users_db_size = os.path.getsize(USERS_DB_PATH) if os.path.exists(USERS_DB_PATH) else 0

    # data/ total size
    data_total = 0
    if os.path.isdir(DATA_DIR):
        for f in os.listdir(DATA_DIR):
            fp = os.path.join(DATA_DIR, f)
            if os.path.isfile(fp):
                data_total += os.path.getsize(fp)

    uptime_seconds = int(time.time() - _start_time)

    return jsonify({
        "user_count": len(users),
        "total_transactions": total_transactions,
        "total_db_bytes": total_db_bytes,
        "users_db_bytes": users_db_size,
        "data_dir_bytes": data_total,
        "uptime_seconds": uptime_seconds,
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "users": user_details,
    })


@admin_bp.route("/api/users/<user_id>/toggle-admin", methods=["POST"])
def toggle_admin(user_id):
    """Grant or revoke admin status for a user."""
    if user_id == current_user.id:
        return jsonify({"error": "Cannot change your own admin status"}), 400
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    new_status = not user.is_admin
    set_admin(user_id, new_status)
    return jsonify({"ok": True, "is_admin": new_status})


@admin_bp.route("/api/seed-demo", methods=["POST"])
def seed_demo():
    """Import all sample CSVs into the current admin user's database."""
    from boreal.models.database import get_db
    from boreal.services.categorization import load_learned_dict
    from boreal.services.csv_parser import load_bank_configs, detect_bank_config, parse_with_config
    from boreal.services.rules_engine import save_transactions

    if not os.path.isdir(SAMPLE_DATA_DIR):
        return jsonify({"error": "No sample_data directory found"}), 404

    csvs = sorted(f for f in os.listdir(SAMPLE_DATA_DIR) if f.endswith(".csv"))
    if not csvs:
        return jsonify({"error": "No CSV files in sample_data/"}), 404

    db = get_db()
    learned = load_learned_dict(db)
    configs = load_bank_configs()
    results = []
    total_added = 0

    for fname in csvs:
        path = os.path.join(SAMPLE_DATA_DIR, fname)
        with open(path, "r", encoding="utf-8-sig") as f:
            text = f.read()
        first_line = text.splitlines()[0] if text.strip() else ""
        config, bank_name = detect_bank_config(first_line, configs)
        if config:
            txns = parse_with_config(text, config, learned)
            added, dupes, *_ = save_transactions(txns)
            total_added += added
            results.append({"file": fname, "bank": config.get("name", bank_name), "added": added, "dupes": dupes})
        else:
            results.append({"file": fname, "bank": "unknown", "added": 0, "dupes": 0})

    return jsonify({"total_added": total_added, "files": results})
