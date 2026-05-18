import hashlib
import os
import re
import secrets
import threading
from datetime import timedelta

from flask import Flask, session, request, jsonify, g
from flask_compress import Compress
from flask_login import LoginManager, current_user
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from boreal.config import DB_PATH, PROJECT_ROOT, DEMO_MODE
from boreal.models.database import init_db, close_db, init_user_db
from boreal.models.users import (
    init_users_db, get_user_by_id, close_users_db, get_user_db_path, DATA_DIR,
)
from boreal.routes import register_blueprints


def _get_secret_key() -> str:
    """Return SECRET_KEY from env, or auto-generate and persist one."""
    env_key = os.environ.get("SECRET_KEY")
    if env_key:
        return env_key
    key_file = os.path.join(PROJECT_ROOT, ".secret_key")
    if os.path.exists(key_file):
        with open(key_file, "r") as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(key_file, "w") as f:
        f.write(key)
    return key


def _register_csrf(app):
    """Lightweight CSRF protection for all mutating API requests."""

    @app.before_request
    def csrf_protect():
        if app.config.get("TESTING"):
            return
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return
        if not request.path.startswith("/api/"):
            return
        # Skip CSRF for demo reset endpoint
        if request.path == "/api/demo/reset":
            return
        token = request.headers.get("X-CSRF-Token", "")
        if not token or token != session.get("csrf_token"):
            return jsonify({"error": "Invalid or missing CSRF token"}), 403

    @app.route("/api/csrf-token")
    def csrf_token():
        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_hex(32)
        return jsonify({"csrf_token": session["csrf_token"]})


# ── DEMO MODE GUARD ───────────────────────────────────────────────────────────

# Routes blocked in demo mode: (method, path_pattern)
# Path patterns use regex — anchored with ^ and $
_DEMO_BLOCKED = [
    ("POST",   r"^/api/import$"),
    ("POST",   r"^/api/restore$"),
    ("POST",   r"^/api/save-bank-config$"),
    ("POST",   r"^/api/add$"),
    ("DELETE", r"^/api/delete/\d+$"),
    ("POST",   r"^/api/bulk-delete$"),
    ("POST",   r"^/api/categories$"),
    ("DELETE", r"^/api/categories/\d+$"),
    ("PATCH",  r"^/api/categories/\d+$"),
    ("POST",   r"^/api/settings$"),
    ("POST",   r"^/api/rules$"),
    ("POST",   r"^/api/rules/bulk-create$"),
    ("PATCH",  r"^/api/rules/\d+$"),
    ("DELETE", r"^/api/rules/\d+$"),
    ("POST",   r"^/api/rules/reorder$"),
    ("POST",   r"^/api/rule-templates/load$"),
    ("POST",   r"^/api/budgets$"),
    ("DELETE", r"^/api/budgets/.+$"),
    ("DELETE", r"^/api/learned/.+$"),
    ("POST",   r"^/api/transactions/\d+/split$"),
    ("DELETE", r"^/api/transactions/\d+/unsplit$"),
    ("POST",   r"^/api/goals$"),
    ("PATCH",  r"^/api/goals/\d+$"),
    ("DELETE", r"^/api/goals/\d+$"),
    ("POST",   r"^/api/goals/\d+/contribute$"),
    ("POST",   r"^/api/category-groups$"),
    ("PATCH",  r"^/api/category-groups/\d+$"),
    ("DELETE", r"^/api/category-groups/\d+$"),
    ("POST",   r"^/api/accounts-list$"),
    ("PATCH",  r"^/api/accounts-list/\d+$"),
    ("DELETE", r"^/api/accounts-list/\d+$"),
    ("POST",   r"^/api/schedules$"),
    ("PATCH",  r"^/api/schedules/\d+$"),
    ("DELETE", r"^/api/schedules/\d+$"),
    ("POST",   r"^/api/schedules/post-due$"),
    ("POST",   r"^/api/transfers$"),
    ("POST",   r"^/api/undo$"),
    ("POST",   r"^/api/import-ofx$"),
]

_DEMO_BLOCKED_COMPILED = [(m, re.compile(p)) for m, p in _DEMO_BLOCKED]


def _register_demo_guard(app):
    """Block destructive routes when DEMO_MODE is active."""

    @app.before_request
    def demo_guard():
        if not app.config.get("DEMO_MODE"):
            return
        # Allow dashboard_layout saves in demo mode (display preference, not data)
        if request.method == "POST" and request.path == "/api/settings":
            d = request.get_json(silent=True) or {}
            if set(d.keys()) <= {"dashboard_layout"}:
                return
        for method, pattern in _DEMO_BLOCKED_COMPILED:
            if request.method == method and pattern.match(request.path):
                return jsonify({
                    "error": "This feature is disabled in demo mode"
                }), 403


def _start_demo_reset_timer(app):
    """Reset demo data every 60 minutes."""
    def _reset():
        with app.app_context():
            from boreal.routes.main import _seed_demo_data
            _seed_demo_data(wipe=True)
            print("🔄 Demo data auto-reset")
        # Schedule next reset
        timer = threading.Timer(3600, _reset)
        timer.daemon = True
        timer.start()

    timer = threading.Timer(3600, _reset)
    timer.daemon = True
    timer.start()


def _register_security_headers(app):
    """Add security headers and cache control to every response."""

    @app.after_request
    def security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data:; "
            "connect-src 'self'"
        )
        # Cache static assets aggressively (they have hash-based cache busters)
        if request.path.startswith("/static/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def _compute_asset_hash():
    """Compute a stable hash from static assets for cache-busting."""
    h = hashlib.md5()
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    for fname in ("js/app.js", "css/style.css"):
        fpath = os.path.join(static_dir, fname)
        if os.path.exists(fpath):
            h.update(str(os.path.getmtime(fpath)).encode())
    return h.hexdigest()[:10]


def create_app():
    app = Flask(__name__)
    app.config["DB_PATH"] = DB_PATH
    app.config["DEMO_MODE"] = DEMO_MODE
    app.secret_key = _get_secret_key()
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB

    # ── Compression (gzip/brotli) ─────────────────────────────────────────────
    app.config["COMPRESS_MIMETYPES"] = [
        "text/html", "text/css", "text/xml",
        "application/json", "application/javascript",
    ]
    app.config["COMPRESS_MIN_SIZE"] = 512
    app.config["COMPRESS_STREAMS"] = True
    Compress(app)

    # ── Asset cache-busting hash ──────────────────────────────────────────────
    app.config["ASSET_HASH"] = _compute_asset_hash()

    @app.context_processor
    def inject_asset_hash():
        return {"asset_v": app.config["ASSET_HASH"]}

    # ── Session cookie settings ───────────────────────────────────────────────
    app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=30)
    app.config["REMEMBER_COOKIE_HTTPONLY"] = True
    app.config["REMEMBER_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    if os.environ.get("SECURE_COOKIES", "").lower() == "true":
        app.config["REMEMBER_COOKIE_SECURE"] = True
        app.config["SESSION_COOKIE_SECURE"] = True

    # ── Flask-Mail ────────────────────────────────────────────────────────────
    app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "")
    app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", "587"))
    app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "")
    app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")
    app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
        "MAIL_DEFAULT_SENDER", os.environ.get("MAIL_USERNAME", "noreply@boreal.app")
    )
    mail = Mail(app)

    # ── Flask-Login ───────────────────────────────────────────────────────────
    login_manager = LoginManager(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return get_user_by_id(user_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith("/api/"):
            return jsonify({"error": "unauthorized"}), 401
        return redirect_to_login()

    def redirect_to_login():
        from flask import redirect, url_for
        return redirect(url_for("auth.login", next=request.path))

    # ── Flask-Limiter ─────────────────────────────────────────────────────────
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["120/minute"],
        storage_uri=os.environ.get("RATELIMIT_STORAGE", "memory://"),
    )
    app.limiter = limiter  # expose so auth blueprint can use decorators

    # ── Database setup ────────────────────────────────────────────────────────
    init_users_db()

    # Keep legacy init_db for backward compat (demo mode, migration CLI)
    if os.path.exists(app.config["DB_PATH"]):
        init_db(app)

    app.teardown_appcontext(close_db)
    app.teardown_appcontext(close_users_db)

    # ── Auth: set per-user DB path before each request ────────────────────────
    _PUBLIC_PREFIXES = ("/login", "/signup", "/logout", "/verify-email/",
                        "/forgot-password", "/reset-password/", "/static/")
    _PUBLIC_API = ("/api/health", "/api/csrf-token", "/api/demo", "/api/demo/reset")

    @app.before_request
    def set_user_db():
        """Enforce auth and point get_db() to the current user's database file."""
        path = request.path

        # Public routes: no auth needed
        if any(path.startswith(p) for p in _PUBLIC_PREFIXES):
            return
        if path in _PUBLIC_API:
            return

        # Everything else requires authentication
        if not current_user.is_authenticated:
            if path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect_to_login()

        # Authenticated: resolve per-user DB
        db_path = get_user_db_path(current_user.id)
        if not os.path.exists(db_path):
            init_user_db(db_path)
        g.db_path = db_path

    _register_csrf(app)
    _register_demo_guard(app)
    _register_security_headers(app)
    register_blueprints(app)

    # ── Demo mode auto-seed ───────────────────────────────────────────────────
    if DEMO_MODE:
        with app.app_context():
            from boreal.models.database import get_db
            db = get_db()
            count = db.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
            if count == 0:
                from boreal.routes.main import _seed_demo_data
                added = _seed_demo_data(wipe=False)
                print(f"🍁 Demo mode: seeded {added} sample transactions")
        _start_demo_reset_timer(app)

    return app


def main():
    import os
    port = int(os.environ.get("PORT", 5000))
    app = create_app()
    print("\n� Boreal")
    print(f"   Open: http://localhost:{port}")
    print("   Stop: Ctrl+C\n")
    app.run(debug=False, host="0.0.0.0", port=port)
