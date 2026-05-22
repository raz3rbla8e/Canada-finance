"""Plaid integration routes — connect bank accounts and sync transactions."""

import sqlite3
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required

from boreal.models.database import get_db
from boreal.config import PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV

plaid_bp = Blueprint("plaid", __name__)

# ── Plaid → Boreal category mapping ────────────────────────────────────────────
# Detailed takes priority over primary when available.
_PLAID_DETAILED_MAP = {
    "FOOD_AND_DRINK_GROCERIES": "Groceries",
    "FOOD_AND_DRINK_SUPERMARKETS_AND_GROCERIES": "Groceries",
    "RENT_AND_UTILITIES_RENT": "Rent",
    "RENT_AND_UTILITIES_INTERNET_AND_CABLE": "Internet",
    "RENT_AND_UTILITIES_TELEPHONE": "Phone",
    "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY": "Utilities",
    "RENT_AND_UTILITIES_ELECTRIC": "Utilities",
    "RENT_AND_UTILITIES_WATER": "Utilities",
    "RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT": "Utilities",
    "INCOME_WAGES": "Job",
    "INCOME_DIVIDENDS": "Other Income",
    "INCOME_INTEREST_EARNED": "Other Income",
    "INCOME_RETIREMENT_PENSION": "Other Income",
    "MEDICAL_PHARMACIES_AND_SUPPLEMENTS": "Pharmacy",
    "TRANSPORTATION_GAS": "Fuel",
    "TRANSPORTATION_PARKING": "Transport",
    "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES": "Clothing",
    "GENERAL_MERCHANDISE_ELECTRONICS": "Shopping",
    "GENERAL_MERCHANDISE_DEPARTMENT_STORES": "Shopping",
    "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES": "Shopping",
    "ENTERTAINMENT_TV_AND_MOVIES": "Subscriptions",
    "ENTERTAINMENT_MUSIC_AND_AUDIO": "Subscriptions",
}

_PLAID_PRIMARY_MAP = {
    "FOOD_AND_DRINK": "Eating Out",
    "TRANSPORTATION": "Transport",
    "TRAVEL": "Travel",
    "ENTERTAINMENT": "Entertainment",
    "GENERAL_MERCHANDISE": "Shopping",
    "HOME_IMPROVEMENT": "Home",
    "MEDICAL": "Healthcare",
    "PERSONAL_CARE": "Shopping",
    "GENERAL_SERVICES": "Misc",
    "GOVERNMENT_AND_NON_PROFIT": "Misc",
    "INCOME": "Job",
    "TRANSFER_IN": "Other Income",
    "TRANSFER_OUT": "Savings Transfer",
    "LOAN_PAYMENTS": "Misc",
    "BANK_FEES": "Misc",
    "RENT_AND_UTILITIES": "Utilities",
}


def _map_plaid_category(plaid_tx):
    """Map Plaid personal_finance_category to the best Boreal category."""
    pfc = plaid_tx.get("personal_finance_category")
    if not pfc:
        return "UNCATEGORIZED"
    detailed = pfc.get("detailed", "")
    primary = pfc.get("primary", "")
    return _PLAID_DETAILED_MAP.get(detailed) or _PLAID_PRIMARY_MAP.get(primary) or "UNCATEGORIZED"


def _get_plaid_client():
    """Create and return a Plaid API client."""
    import plaid
    from plaid.api import plaid_api

    host = {
        "sandbox": plaid.Environment.Sandbox,
        "production": plaid.Environment.Production,
    }.get(PLAID_ENV, plaid.Environment.Sandbox)

    configuration = plaid.Configuration(
        host=host,
        api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


def _plaid_configured():
    return bool(PLAID_CLIENT_ID and PLAID_SECRET)


# ── STATUS ─────────────────────────────────────────────────────────────────────

@plaid_bp.route("/api/plaid/status")
@login_required
def plaid_status():
    """Check if Plaid is configured and return linked items."""
    if not _plaid_configured():
        return jsonify({"configured": False, "items": []})
    db = get_db()
    items = db.execute(
        "SELECT id, item_id, institution_name, status, created_at FROM plaid_items ORDER BY created_at DESC"
    ).fetchall()
    result = []
    for item in items:
        accounts = db.execute(
            "SELECT account_id, name, official_name, type, subtype, mask, boreal_account FROM plaid_accounts WHERE plaid_item_id=?",
            (item["id"],),
        ).fetchall()
        result.append({
            "id": item["id"],
            "item_id": item["item_id"],
            "institution_name": item["institution_name"],
            "status": item["status"],
            "created_at": item["created_at"],
            "accounts": [dict(a) for a in accounts],
        })
    return jsonify({"configured": True, "items": result})


# ── LINK TOKEN ─────────────────────────────────────────────────────────────────

@plaid_bp.route("/api/plaid/create-link-token", methods=["POST"])
@login_required
def create_link_token():
    """Create a link_token for Plaid Link initialization."""
    if not _plaid_configured():
        return jsonify({"error": "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET."}), 400

    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.products import Products
    from plaid.model.country_code import CountryCode

    from flask_login import current_user

    client = _get_plaid_client()
    req = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Boreal",
        country_codes=[CountryCode("CA"), CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=str(current_user.id)),
    )
    try:
        response = client.link_token_create(req)
        return jsonify({"link_token": response["link_token"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── TOKEN EXCHANGE ─────────────────────────────────────────────────────────────

@plaid_bp.route("/api/plaid/exchange-token", methods=["POST"])
@login_required
def exchange_token():
    """Exchange a public_token from Link for an access_token, store the Item."""
    if not _plaid_configured():
        return jsonify({"error": "Plaid is not configured"}), 400

    d = request.get_json(silent=True) or {}
    public_token = d.get("public_token", "")
    institution_id = d.get("institution_id", "")
    institution_name = d.get("institution_name", "")
    if not public_token:
        return jsonify({"error": "public_token required"}), 400

    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

    client = _get_plaid_client()
    try:
        exchange = client.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=public_token)
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    access_token = exchange["access_token"]
    item_id = exchange["item_id"]

    db = get_db()
    try:
        db.execute(
            """INSERT INTO plaid_items (item_id, access_token, institution_id, institution_name)
               VALUES (?, ?, ?, ?)""",
            (item_id, access_token, institution_id, institution_name),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "This bank is already connected"}), 409

    # Fetch and store the accounts
    _sync_plaid_accounts(client, db, item_id, access_token)

    return jsonify({"ok": True, "item_id": item_id, "institution_name": institution_name})


def _sync_plaid_accounts(client, db, item_id, access_token):
    """Fetch accounts from Plaid and upsert into plaid_accounts."""
    from plaid.model.accounts_get_request import AccountsGetRequest

    try:
        resp = client.accounts_get(AccountsGetRequest(access_token=access_token))
    except Exception:
        return

    plaid_item_row = db.execute("SELECT id FROM plaid_items WHERE item_id=?", (item_id,)).fetchone()
    if not plaid_item_row:
        return
    plaid_item_pk = plaid_item_row["id"]

    for acct in resp["accounts"]:
        # Derive a human-readable Boreal account name
        name = acct.get("official_name") or acct.get("name") or "Unknown"
        mask = acct.get("mask") or ""
        institution_row = db.execute("SELECT institution_name FROM plaid_items WHERE id=?", (plaid_item_pk,)).fetchone()
        inst_name = institution_row["institution_name"] if institution_row else ""
        boreal_name = f"{inst_name} {name}".strip()
        if mask:
            boreal_name += f" ···{mask}"

        # Store Plaid balance for later reconciliation
        balances = acct.get("balances", {})
        plaid_current = balances.get("current") or 0

        db.execute(
            """INSERT INTO plaid_accounts (plaid_item_id, account_id, name, official_name, type, subtype, mask, boreal_account)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(account_id) DO UPDATE SET
                   name=excluded.name, official_name=excluded.official_name,
                   type=excluded.type, subtype=excluded.subtype, mask=excluded.mask""",
            (
                plaid_item_pk,
                acct["account_id"],
                acct.get("name", ""),
                acct.get("official_name", ""),
                str(acct.get("type", "")),
                str(acct.get("subtype", "")),
                mask,
                boreal_name,
            ),
        )

        # Map Plaid account type to Boreal account type
        acct_type_str = str(acct.get("type", ""))
        subtype_str = str(acct.get("subtype", ""))
        if acct_type_str in ("credit", "loan"):
            boreal_acct_type = "credit"
        elif acct_type_str == "investment":
            boreal_acct_type = "investment"
        elif subtype_str in ("savings", "cd", "money market", "hsa", "cash management"):
            boreal_acct_type = "savings"
        else:
            boreal_acct_type = "chequing"

        # Ensure the Boreal account exists with correct type and balance
        existing_acct = db.execute("SELECT id FROM accounts WHERE name=?", (boreal_name,)).fetchone()
        if not existing_acct:
            db.execute(
                "INSERT OR IGNORE INTO accounts (name, account_type, opening_balance) VALUES (?, ?, ?)",
                (boreal_name, boreal_acct_type, plaid_current if acct_type_str not in ("credit", "loan") else -plaid_current),
            )
        else:
            # Reconcile: set opening_balance so calculated balance matches Plaid
            # Also fix account_type in case it was auto-created with wrong type
            row = db.execute(
                """SELECT COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE 0 END), 0) AS income,
                          COALESCE(SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END), 0) AS expenses
                   FROM transactions WHERE account=? AND source='plaid'""",
                (boreal_name,),
            ).fetchone()
            income = row["income"]
            expenses = row["expenses"]
            # Boreal balance = opening_balance + income - expenses
            # For depository: target = plaid_current
            # For credit/loan: target = -plaid_current (debt is negative internally)
            if acct_type_str in ("credit", "loan"):
                target = -plaid_current
            else:
                target = plaid_current
            new_opening = target - income + expenses
            db.execute("UPDATE accounts SET opening_balance=?, account_type=? WHERE name=?",
                       (new_opening, boreal_acct_type, boreal_name))

    db.commit()


# ── SYNC TRANSACTIONS ─────────────────────────────────────────────────────────

@plaid_bp.route("/api/plaid/sync", methods=["POST"])
@login_required
def sync_transactions():
    """Sync transactions for all linked Plaid items (or a specific one)."""
    if not _plaid_configured():
        return jsonify({"error": "Plaid is not configured"}), 400

    d = request.get_json(silent=True) or {}
    target_item_id = d.get("item_id")  # optional: sync just one item

    db = get_db()
    if target_item_id:
        items = db.execute("SELECT * FROM plaid_items WHERE item_id=?", (target_item_id,)).fetchall()
    else:
        items = db.execute("SELECT * FROM plaid_items").fetchall()

    if not items:
        return jsonify({"error": "No linked bank accounts"}), 404

    client = _get_plaid_client()
    total_added = 0
    total_modified = 0
    total_removed = 0
    errors = []

    for item in items:
        try:
            added, modified, removed = _sync_item_transactions(client, db, item)
            total_added += added
            total_modified += modified
            total_removed += removed
            # Reconcile account balances after syncing transactions
            _sync_plaid_accounts(client, db, item["item_id"], item["access_token"])
        except Exception as e:
            import traceback
            traceback.print_exc()
            errors.append({"item_id": item["item_id"], "error": str(e)})
            # Mark item as errored
            db.execute("UPDATE plaid_items SET status='error', updated_at=datetime('now') WHERE id=?", (item["id"],))
            db.commit()

    return jsonify({
        "ok": True,
        "added": total_added,
        "modified": total_modified,
        "removed": total_removed,
        "errors": errors,
    })


def _sync_item_transactions(client, db, item):
    """Use /transactions/sync to incrementally fetch transactions for one Item."""
    from plaid.model.transactions_sync_request import TransactionsSyncRequest
    from boreal.services.categorization import categorize, load_learned_dict
    from boreal.models.database import tx_hash

    access_token = item["access_token"]
    cursor = item["cursor"] or ""
    learned = load_learned_dict(db)

    # Build account_id -> boreal_account_name map
    acct_map = {}
    acct_rows = db.execute(
        "SELECT account_id, boreal_account FROM plaid_accounts WHERE plaid_item_id=?",
        (item["id"],),
    ).fetchall()
    for r in acct_rows:
        acct_map[r["account_id"]] = r["boreal_account"]

    added_count = 0
    modified_count = 0
    removed_count = 0
    has_more = True

    while has_more:
        sync_kwargs = {"access_token": access_token}
        if cursor:
            sync_kwargs["cursor"] = cursor
        req = TransactionsSyncRequest(**sync_kwargs)
        response = client.transactions_sync(req)

        # Process added transactions
        for tx in response["added"]:
            if tx.get("pending"):
                continue  # skip pending transactions
            result = _upsert_plaid_transaction(db, tx, acct_map, learned)
            if result == "added":
                added_count += 1

        # Process modified transactions
        for tx in response["modified"]:
            if tx.get("pending"):
                continue
            result = _upsert_plaid_transaction(db, tx, acct_map, learned)
            if result in ("added", "modified"):
                modified_count += 1

        # Process removed transactions
        for tx in response["removed"]:
            plaid_tx_id = tx.get("transaction_id", "")
            if plaid_tx_id:
                # Find and delete by the plaid source marker in notes
                db.execute(
                    "DELETE FROM transactions WHERE source='plaid' AND notes LIKE ?",
                    (f"%plaid_tx:{plaid_tx_id}%",),
                )
                removed_count += 1

        has_more = response["has_more"]
        cursor = response["next_cursor"]

    # Save cursor and update status
    db.execute(
        "UPDATE plaid_items SET cursor=?, status='good', updated_at=datetime('now') WHERE id=?",
        (cursor, item["id"]),
    )
    db.commit()

    return added_count, modified_count, removed_count


def _upsert_plaid_transaction(db, plaid_tx, acct_map, learned):
    """Convert a Plaid transaction to Boreal format and insert/update."""
    from boreal.services.categorization import categorize
    from boreal.models.database import tx_hash

    plaid_tx_id = plaid_tx.get("transaction_id", "")
    account_id = plaid_tx.get("account_id", "")
    account_name = acct_map.get(account_id, "Plaid Import")

    # Plaid: positive amount = money out (expense), negative = money in (income)
    raw_amount = plaid_tx.get("amount", 0)
    if raw_amount >= 0:
        tx_type = "Expense"
        amount = abs(raw_amount)
    else:
        tx_type = "Income"
        amount = abs(raw_amount)

    if amount == 0:
        return "skipped"

    name = plaid_tx.get("merchant_name") or plaid_tx.get("name") or "Unknown"
    date = str(plaid_tx.get("date", ""))

    # Categorize: try Boreal's learned merchants first, then Plaid's category
    category = categorize(name, learned)
    if category == "UNCATEGORIZED":
        category = _map_plaid_category(plaid_tx)

    # Use plaid_tx_id as a dedup marker in notes
    notes = f"plaid_tx:{plaid_tx_id}"

    # Check if we already have this Plaid transaction
    existing = db.execute(
        "SELECT id, category FROM transactions WHERE source='plaid' AND notes LIKE ?",
        (f"%plaid_tx:{plaid_tx_id}%",),
    ).fetchone()

    if existing:
        # Update the transaction (amount, date, name may have changed)
        # but preserve user-set category
        user_cat = existing["category"]
        db.execute(
            """UPDATE transactions SET date=?, type=?, name=?, amount=?, account=?
               WHERE id=?""",
            (date, tx_type, name, amount, account_name, existing["id"]),
        )
        return "modified"

    # Insert new transaction
    h = tx_hash(date, name, amount, account_name)
    # Look up account_id FK
    acct_row = db.execute("SELECT id FROM accounts WHERE name=?", (account_name,)).fetchone()
    acct_pk = acct_row["id"] if acct_row else None

    # Auto-create account if needed (balance will be reconciled by _sync_plaid_accounts)
    if not acct_pk:
        try:
            db.execute(
                "INSERT OR IGNORE INTO accounts (name, account_type, opening_balance) VALUES (?, ?, 0)",
                (account_name, "chequing"),
            )
            db.commit()
            acct_row = db.execute("SELECT id FROM accounts WHERE name=?", (account_name,)).fetchone()
            acct_pk = acct_row["id"] if acct_row else None
        except Exception:
            pass

    try:
        db.execute(
            """INSERT INTO transactions
               (date, type, name, category, amount, account, account_id, notes, source, tx_hash, hidden)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'plaid', ?, 0)""",
            (date, tx_type, name, category, amount, account_name, acct_pk, notes, h),
        )
        return "added"
    except sqlite3.IntegrityError:
        # Duplicate hash — already exists via CSV import, skip
        return "dupe"


# ── DISCONNECT ─────────────────────────────────────────────────────────────────

@plaid_bp.route("/api/plaid/items/<int:pk>", methods=["DELETE"])
@login_required
def disconnect_item(pk):
    """Disconnect a linked bank (remove Item from Plaid and local DB)."""
    if not _plaid_configured():
        return jsonify({"error": "Plaid is not configured"}), 400

    db = get_db()
    item = db.execute("SELECT * FROM plaid_items WHERE id=?", (pk,)).fetchone()
    if not item:
        return jsonify({"error": "Item not found"}), 404

    # Remove from Plaid
    from plaid.model.item_remove_request import ItemRemoveRequest
    client = _get_plaid_client()
    try:
        client.item_remove(ItemRemoveRequest(access_token=item["access_token"]))
    except Exception:
        pass  # Still remove locally even if Plaid call fails

    # Remove local data
    db.execute("DELETE FROM plaid_accounts WHERE plaid_item_id=?", (pk,))
    db.execute("DELETE FROM plaid_items WHERE id=?", (pk,))
    db.commit()

    return jsonify({"ok": True})
