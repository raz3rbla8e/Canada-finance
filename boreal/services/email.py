"""Email helpers for verification and password reset."""

from flask import current_app, url_for
from flask_mail import Message
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature


def _get_serializer():
    return URLSafeTimedSerializer(current_app.secret_key)


def generate_verification_token(email):
    return _get_serializer().dumps(email, salt="email-verify")


def confirm_verification_token(token, max_age=86400):
    """Validate email verification token. Default expiry: 24 hours."""
    try:
        email = _get_serializer().loads(token, salt="email-verify", max_age=max_age)
        return email
    except (SignatureExpired, BadSignature):
        return None


def generate_reset_token(email):
    return _get_serializer().dumps(email, salt="password-reset")


def confirm_reset_token(token, max_age=3600):
    """Validate password reset token. Default expiry: 1 hour."""
    try:
        email = _get_serializer().loads(token, salt="password-reset", max_age=max_age)
        return email
    except (SignatureExpired, BadSignature):
        return None


def send_verification_email(mail, user, token):
    """Send email verification link."""
    if not current_app.config.get("MAIL_SERVER"):
        current_app.logger.warning("MAIL_SERVER not configured — skipping verification email")
        return False
    link = url_for("auth.verify_email", token=token, _external=True)
    msg = Message(
        subject="Boreal — Verify your email",
        recipients=[user.email],
        body=(
            f"Hi {user.display_name},\n\n"
            f"Welcome to Boreal! Please verify your email by clicking this link:\n\n"
            f"{link}\n\n"
            f"This link expires in 24 hours.\n\n"
            f"If you didn't sign up for Boreal, you can ignore this email.\n"
        ),
    )
    try:
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send verification email: {e}")
        return False


def send_reset_email(mail, user, token):
    """Send password reset link."""
    if not current_app.config.get("MAIL_SERVER"):
        current_app.logger.warning("MAIL_SERVER not configured — skipping reset email")
        return False
    link = url_for("auth.reset_password", token=token, _external=True)
    msg = Message(
        subject="Boreal — Reset your password",
        recipients=[user.email],
        body=(
            f"Hi {user.display_name},\n\n"
            f"Someone requested a password reset for your Boreal account.\n\n"
            f"Click here to set a new password:\n\n"
            f"{link}\n\n"
            f"This link expires in 1 hour.\n\n"
            f"If you didn't request this, you can safely ignore this email.\n"
        ),
    )
    try:
        mail.send(msg)
        return True
    except Exception as e:
        current_app.logger.error(f"Failed to send reset email: {e}")
        return False
