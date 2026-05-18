"""User model and users.db helpers for authentication."""

import os
import re
import sqlite3
import uuid
from datetime import datetime

import bcrypt
from flask import g, current_app
from flask_login import UserMixin

from boreal.config import DATA_DIR

USERS_DB_PATH = os.path.join(DATA_DIR, "users.db")

# Strict hex-only pattern — prevents path traversal
_VALID_USER_ID = re.compile(r"^[0-9a-f]{32}$")


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def get_users_db():
    """Return a connection to the shared users.db (stored in g.users_db)."""
    if "users_db" not in g:
        g.users_db = sqlite3.connect(USERS_DB_PATH)
        g.users_db.row_factory = sqlite3.Row
        g.users_db.execute("PRAGMA journal_mode=WAL")
    return g.users_db


def close_users_db(e=None):
    db = g.pop("users_db", None)
    if db:
        db.close()


def init_users_db():
    """Create users.db and the users table if they don't exist."""
    _ensure_data_dir()
    db = sqlite3.connect(USERS_DB_PATH)
    try:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id              TEXT PRIMARY KEY,
                email           TEXT UNIQUE NOT NULL COLLATE NOCASE,
                display_name    TEXT NOT NULL,
                password_hash   TEXT NOT NULL,
                verified        INTEGER DEFAULT 0,
                is_admin        INTEGER DEFAULT 0,
                created_at      TEXT DEFAULT (datetime('now')),
                last_login      TEXT
            );
        """)
        db.commit()
        # Migrate: add is_admin column if missing (existing installs)
        cols = [r[1] for r in db.execute("PRAGMA table_info(users)").fetchall()]
        if "is_admin" not in cols:
            db.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
            db.commit()
    finally:
        db.close()


class User(UserMixin):
    """Flask-Login compatible user object."""

    def __init__(self, id, email, display_name, verified=False, is_admin=False, created_at=None, last_login=None):
        self.id = id
        self.email = email
        self.display_name = display_name
        self.verified = verified
        self.is_admin = is_admin
        self.created_at = created_at
        self.last_login = last_login

    def get_id(self):
        return self.id

    @staticmethod
    def from_row(row):
        if row is None:
            return None
        return User(
            id=row["id"],
            email=row["email"],
            display_name=row["display_name"],
            verified=bool(row["verified"]),
            is_admin=bool(row["is_admin"] if "is_admin" in row.keys() else 0),
            created_at=row["created_at"],
            last_login=row["last_login"],
        )


def get_user_by_id(user_id):
    """Load user by ID. Returns User or None."""
    if not _VALID_USER_ID.match(str(user_id)):
        return None
    db = get_users_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return User.from_row(row)


def get_user_by_email(email):
    """Load user by email. Returns User or None."""
    db = get_users_db()
    row = db.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    return User.from_row(row)


def create_user(email, display_name, password):
    """Create a new user. Returns User. Raises ValueError if email taken."""
    email = email.strip().lower()
    if not email or "@" not in email:
        raise ValueError("Invalid email address")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")

    user_id = uuid.uuid4().hex
    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    db = get_users_db()
    try:
        db.execute(
            "INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, email, display_name.strip(), pw_hash),
        )
        db.commit()
    except sqlite3.IntegrityError:
        raise ValueError("An account with that email already exists")

    return User(id=user_id, email=email, display_name=display_name.strip())


def verify_password(email, password):
    """Check credentials. Returns User on success, None on failure."""
    email = email.strip().lower()
    db = get_users_db()
    row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        # Constant-time: hash a dummy to prevent timing attacks
        bcrypt.hashpw(b"dummy", bcrypt.gensalt())
        return None
    if bcrypt.checkpw(password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        # Update last_login
        db.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), row["id"]),
        )
        db.commit()
        return User.from_row(row)
    return None


def mark_verified(user_id):
    """Mark a user's email as verified."""
    db = get_users_db()
    db.execute("UPDATE users SET verified = 1 WHERE id = ?", (user_id,))
    db.commit()


def update_password(user_id, new_password):
    """Set a new password for a user."""
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters")
    pw_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db = get_users_db()
    db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, user_id))
    db.commit()


def get_user_db_path(user_id):
    """Return the SQLite DB path for a specific user. Validates user_id format."""
    if not _VALID_USER_ID.match(str(user_id)):
        raise ValueError(f"Invalid user ID format: {user_id}")
    return os.path.join(DATA_DIR, f"{user_id}.db")


def user_count():
    """Return total number of registered users."""
    db = get_users_db()
    return db.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def list_all_users():
    """Return all users as a list of dicts (for admin)."""
    db = get_users_db()
    rows = db.execute(
        "SELECT id, email, display_name, verified, is_admin, created_at, last_login "
        "FROM users ORDER BY created_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]


def set_admin(user_id, is_admin=True):
    """Grant or revoke admin status."""
    db = get_users_db()
    db.execute("UPDATE users SET is_admin = ? WHERE id = ?", (int(is_admin), user_id))
    db.commit()


def update_display_name(user_id, new_name):
    """Update a user's display name."""
    new_name = new_name.strip()
    if not new_name:
        raise ValueError("Display name cannot be empty")
    if len(new_name) > 50:
        raise ValueError("Display name must be 50 characters or fewer")
    db = get_users_db()
    db.execute("UPDATE users SET display_name = ? WHERE id = ?", (new_name, user_id))
    db.commit()


def delete_user(user_id):
    """Delete a user account and their personal database file."""
    if not _VALID_USER_ID.match(str(user_id)):
        raise ValueError("Invalid user ID")
    db_path = get_user_db_path(user_id)
    # Remove user row from users.db
    db = get_users_db()
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    # Remove user's personal database file
    if os.path.exists(db_path):
        os.remove(db_path)
