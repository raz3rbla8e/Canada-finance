#!/usr/bin/env python3
"""
Boreal - Personal Finance Dashboard for Canadians

Entry point: python app.py
Or install with: pip install .
Then run: boreal

Migration: python app.py migrate --assign <email>
"""

import os
import sys
import secrets
import shutil

from boreal import create_app

app = create_app()


def _run_migrate():
    """CLI: python app.py migrate --assign <email>"""
    if "--assign" not in sys.argv:
        print("Usage: python app.py migrate --assign <email>")
        print("  Moves existing finance.db to the new per-user data directory.")
        sys.exit(1)

    idx = sys.argv.index("--assign")
    if idx + 1 >= len(sys.argv):
        print("Error: --assign requires an email argument")
        sys.exit(1)

    email = sys.argv[idx + 1]
    old_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finance.db")

    if not os.path.exists(old_db):
        print(f"Error: {old_db} not found. Nothing to migrate.")
        sys.exit(1)

    with app.app_context():
        from boreal.models.users import create_user, get_user_db_path

        password = secrets.token_urlsafe(12)
        try:
            user = create_user(email, email.split("@")[0], password)
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)

        dest = get_user_db_path(user.id)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.move(old_db, dest)

        print(f"Migrated finance.db -> data/{user.id}.db")
        print(f"   Email:    {email}")
        print(f"   Password: {password}")
        print(f"   (change this password after first login)")


def _run_make_admin():
    """CLI: python app.py make-admin <email>"""
    if len(sys.argv) < 3:
        print("Usage: python app.py make-admin <email>")
        sys.exit(1)

    email = sys.argv[2]
    with app.app_context():
        from boreal.models.users import get_user_by_email, set_admin
        user = get_user_by_email(email)
        if not user:
            print(f"Error: no user found with email '{email}'")
            sys.exit(1)
        set_admin(user.id, True)
        print(f"Granted admin to {user.display_name} ({user.email})")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "migrate":
        _run_migrate()
    elif len(sys.argv) > 1 and sys.argv[1] == "make-admin":
        _run_make_admin()
    else:
        port = int(os.environ.get("PORT", 5000))
        print("\nBoreal")
        print(f"   Open: http://localhost:{port}")
        print("   Stop: Ctrl+C\n")
        app.run(debug=False, host="0.0.0.0", port=port)
