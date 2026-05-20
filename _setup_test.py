"""Create a local test account and seed it with demo data — runs directly against the DB."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import g
from boreal import create_app
from boreal.models.users import create_user, get_user_by_email, set_admin, get_user_db_path
from boreal.models.database import init_user_db

app = create_app()

with app.app_context():
    EMAIL = "test@local.dev"
    PASSWORD = "TestLocal123"
    NAME = "Local Tester"

    # 1. Create user (or get existing)
    user = get_user_by_email(EMAIL)
    if user:
        print(f"Account already exists: {user.email} (id={user.id})")
    else:
        user = create_user(EMAIL, NAME, PASSWORD)
        print(f"Created account: {user.email} (id={user.id})")

    # 2. Make admin
    set_admin(user.id, True)
    print(f"Granted admin to {user.email}")

    # 3. Initialize per-user DB
    db_path = get_user_db_path(user.id)
    init_user_db(db_path)

    # 4. Point Flask's get_db() to this user's DB
    g.db_path = db_path

    # 5. Seed demo data
    from boreal.routes.main import _seed_demo_data
    total = _seed_demo_data(wipe=True)
    print(f"Seeded: {total} transactions + budgets, goals, schedules, rules & more")

    print(f"\nReady! Login at http://localhost:5000")
    print(f"  Email:    {EMAIL}")
    print(f"  Password: {PASSWORD}")
