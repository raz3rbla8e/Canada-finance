"""Authentication routes: login, signup, logout, email verification, password reset."""

import os

from flask import (
    Blueprint, render_template, redirect, url_for, request, flash, jsonify, current_app,
)
from flask_login import login_user, logout_user, login_required, current_user

from boreal.models.users import (
    create_user, verify_password, get_user_by_email, mark_verified, update_password, user_count,
    get_user_db_path, set_admin, update_display_name, delete_user,
)
from boreal.models.database import init_user_db
from boreal.services.email import (
    generate_verification_token, confirm_verification_token,
    generate_reset_token, confirm_reset_token,
    send_verification_email, send_reset_email,
)

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")

        if not email or not password:
            error = "Email and password are required."
        else:
            user = verify_password(email, password)
            if user:
                login_user(user, remember=True)
                # Ensure user's DB exists
                db_path = get_user_db_path(user.id)
                if not os.path.exists(db_path):
                    init_user_db(db_path)
                next_page = request.args.get("next")
                return redirect(next_page or url_for("main.index"))
            else:
                error = "Invalid email or password."

    return render_template("login.html", error=error)


@auth_bp.route("/signup", methods=["GET", "POST"])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    # Check if signups are open
    signups_open = os.environ.get("SIGNUPS_OPEN", "true").lower() == "true"
    if not signups_open:
        return render_template("signup.html", error="Registration is currently closed.", closed=True)

    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        display_name = request.form.get("display_name", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")

        if not email or not display_name or not password:
            error = "All fields are required."
        elif "@" not in email:
            error = "Please enter a valid email address."
        elif len(password) < 8:
            error = "Password must be at least 8 characters."
        elif password != confirm:
            error = "Passwords do not match."
        elif len(display_name) > 50:
            error = "Display name must be 50 characters or fewer."
        else:
            try:
                user = create_user(email, display_name, password)
                # First user ever → auto-promote to admin
                if user_count() == 1:
                    set_admin(user.id, True)
                # Initialize the user's database
                db_path = get_user_db_path(user.id)
                init_user_db(db_path)
                login_user(user, remember=True)

                # Send verification email (non-blocking — user can use app unverified)
                mail = current_app.extensions.get("mail")
                if mail:
                    token = generate_verification_token(user.email)
                    send_verification_email(mail, user, token)

                return redirect(url_for("main.index"))
            except ValueError as e:
                error = str(e)

    return render_template("signup.html", error=error, closed=False)


@auth_bp.route("/logout")
def logout():
    logout_user()
    return redirect(url_for("auth.login"))


@auth_bp.route("/verify-email/<token>")
def verify_email(token):
    email = confirm_verification_token(token)
    if email is None:
        return render_template("auth_message.html",
                               title="Invalid link",
                               message="This verification link is invalid or has expired.")
    user = get_user_by_email(email)
    if user:
        mark_verified(user.id)
    return render_template("auth_message.html",
                           title="Email verified",
                           message="Your email has been verified. You can close this page.")


@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    sent = False
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        # Always show success to prevent email enumeration
        sent = True
        user = get_user_by_email(email)
        if user:
            mail = current_app.extensions.get("mail")
            if mail:
                token = generate_reset_token(user.email)
                send_reset_email(mail, user, token)
    return render_template("forgot_password.html", sent=sent)


@auth_bp.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    email = confirm_reset_token(token)
    if email is None:
        return render_template("auth_message.html",
                               title="Invalid link",
                               message="This reset link is invalid or has expired.")

    error = None
    if request.method == "POST":
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        if len(password) < 8:
            error = "Password must be at least 8 characters."
        elif password != confirm:
            error = "Passwords do not match."
        else:
            user = get_user_by_email(email)
            if user:
                update_password(user.id, password)
            return render_template("auth_message.html",
                                   title="Password updated",
                                   message="Your password has been reset. You can now log in.")

    return render_template("reset_password.html", token=token, error=error)


@auth_bp.route("/api/me")
@login_required
def api_me():
    return jsonify({
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "verified": current_user.verified,
        "is_admin": current_user.is_admin,
        "created_at": current_user.created_at,
    })


@auth_bp.route("/api/me", methods=["PATCH"])
@login_required
def api_me_update():
    d = request.json
    if not d:
        return jsonify({"error": "Request body required"}), 400

    display_name = d.get("display_name")
    if display_name is not None:
        try:
            update_display_name(current_user.id, display_name)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    return jsonify({"ok": True})


@auth_bp.route("/api/me/password", methods=["POST"])
@login_required
def api_me_password():
    d = request.json
    if not d:
        return jsonify({"error": "Request body required"}), 400

    current_pw = d.get("current_password", "")
    new_pw = d.get("new_password", "")
    confirm_pw = d.get("confirm_password", "")

    if not current_pw or not new_pw:
        return jsonify({"error": "All fields are required"}), 400
    if new_pw != confirm_pw:
        return jsonify({"error": "New passwords do not match"}), 400
    if len(new_pw) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    # Verify current password
    user = verify_password(current_user.email, current_pw)
    if not user:
        return jsonify({"error": "Current password is incorrect"}), 403

    try:
        update_password(current_user.id, new_pw)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"ok": True})


@auth_bp.route("/api/me", methods=["DELETE"])
@login_required
def api_me_delete():
    d = request.json or {}
    password = d.get("password", "")

    if not password:
        return jsonify({"error": "Password is required to delete your account"}), 400

    # Verify password before deletion
    user = verify_password(current_user.email, password)
    if not user:
        return jsonify({"error": "Incorrect password"}), 403

    user_id = current_user.id
    logout_user()
    delete_user(user_id)
    return jsonify({"ok": True})
