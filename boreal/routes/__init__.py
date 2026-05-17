from boreal.routes.main import main_bp
from boreal.routes.transactions import transactions_bp
from boreal.routes.import_export import import_export_bp
from boreal.routes.summary import summary_bp
from boreal.routes.settings import settings_bp
from boreal.routes.rules import rules_bp
from boreal.routes.accounts import accounts_bp


def register_blueprints(app):
    app.register_blueprint(main_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(import_export_bp)
    app.register_blueprint(summary_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(rules_bp)
    app.register_blueprint(accounts_bp)
