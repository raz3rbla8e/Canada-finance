from boreal.routes.main import main_bp
from boreal.routes.auth import auth_bp
from boreal.routes.admin import admin_bp
from boreal.routes.transactions import transactions_bp
from boreal.routes.import_export import import_export_bp
from boreal.routes.summary import summary_bp
from boreal.routes.settings import settings_bp
from boreal.routes.rules import rules_bp
from boreal.routes.accounts import accounts_bp
from boreal.routes.plaid import plaid_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(import_export_bp)
    app.register_blueprint(summary_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(rules_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(plaid_bp)

    # Apply stricter rate limits to auth endpoints (brute-force protection)
    limiter = getattr(app, "limiter", None)
    if limiter:
        limiter.limit("5/minute")(app.view_functions["auth.login"])
        limiter.limit("5/minute")(app.view_functions["auth.signup"])
        limiter.limit("5/minute")(app.view_functions["auth.forgot_password"])
