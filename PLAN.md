# Boreal — Roadmap

Everything here is what's left to make Boreal a no-brainer for users. The only remaining friction is manual CSV imports — once that's solved, there's no reason to leave.

---

## 1. Automated Data Ingestion (Priority #1)

The monthly CSV ritual is the single biggest reason users would leave. Every approach below lets users set it up once and never think about it again.

### Option A — Email forwarding (recommended first)
- User gets a unique Boreal inbox: `user-abc123@ingest.boreal.app`
- User sets up auto-forward from their bank's statement emails
- Boreal receives the email, extracts CSV/PDF attachment, parses it with existing YAML bank configs, imports automatically
- **Implementation:**
  - Add inbound email via Mailgun/SendGrid inbound routes (free tier handles hundreds/month)
  - Parse MIME attachments → detect bank → run through existing `csv_parser` + `categorize()` pipeline
  - Store a per-user ingest email address in the `settings` table
  - Send confirmation email on successful import: "12 new transactions imported from RBC"
- **Privacy:** Emails are parsed and discarded, only transaction data is stored
- **Covers:** All banks that email monthly statements (most Canadian banks do)

### Option B — Folder watch (desktop PWA users)
- User configures a local folder (e.g., ~/Downloads)
- Boreal watches for new CSV/OFX files matching known bank patterns
- Auto-imports on detection, moves processed files to an archive subfolder
- **Implementation:**
  - Use File System Access API (Chrome/Edge) for folder watching
  - Add a "Watch folder" setting in the Import page
  - Poll the folder every 30 seconds for new files
- **Limitation:** Only works in Chromium PWA installs, not Safari/Firefox

### Option C — OFX Direct Connect
- OFX protocol lets apps connect directly to bank servers without Plaid
- TD, RBC, CIBC, Scotiabank all support OFX Direct Connect
- Boreal already parses OFX files — extend to fetch them over HTTPS
- **Implementation:**
  - User provides bank credentials (stored encrypted, never sent to Boreal servers)
  - App connects directly to bank's OFX server, downloads transactions
  - Schedule daily/weekly auto-fetch
- **Privacy:** Credentials stored locally, connection is user-to-bank direct
- **Risk:** Banks may block or change OFX endpoints without notice

### Option D — Browser extension
- Tiny Chrome extension detects when user is on their bank's CSV download page
- One-click "Send to Boreal" button appears
- Pushes the CSV to the Boreal app via local API or extension messaging
- **Implementation:**
  - Chrome extension with content scripts matching bank URLs
  - Intercepts download or reads the page's CSV data
  - Sends to `localhost:5000/api/import` or to the hosted Boreal instance
- **Effort:** High. Must maintain per-bank content scripts.

### Recommendation
Start with **Option A (email forwarding)** — it works for all banks, all devices, and preserves privacy. Follow up with **Option B (folder watch)** for power users who download CSVs to a specific folder.

---

## 2. Smarter Auto-Categorization

Current state: 300+ hardcoded keyword rules + learned merchants via exact substring match. Gets ~80% of transactions right, but every miss is friction.

### Phase 1 — Merchant name normalization
- **Problem:** "UBER EATS 4F2K TORONTO ON" and "UBER EATS 8J3P MISSISSAUGA ON" are treated as different merchants
- **Solution:** Strip trailing noise (location codes, reference numbers, terminal IDs) before matching
- **Implementation:**
  - Add a `normalize_merchant(name)` function in `categorization.py`
  - Apply regex patterns: strip trailing city/province (`\s+[A-Z]{2,}\s+(ON|BC|AB|QC|MB|SK|NS|NB|PE|NL|NT|YT|NU)\s*$`), strip terminal/reference codes (`\s+[A-Z0-9]{3,8}\s*$` after known merchant names)
  - Use normalized name for learned_merchants lookup AND storage
  - One correction for "UBER EATS" covers all UBER EATS variants
- **Impact:** Dramatically reduces uncategorized count for users with multiple transactions from the same merchant

### Phase 2 — Smarter learned merchants
- Learn the normalized merchant name, not the raw description
- After 1 correction, auto-apply to ALL past and future transactions from that normalized merchant
- Lower the learning threshold: if a user categorizes 2+ transactions with similar names identically, auto-learn without explicit teaching

### Phase 3 — Community-trained model (optional, privacy-preserving)
- Anonymously aggregate `normalized_merchant → category` mappings across all users
- If 90%+ of users categorize "NETFLIX" as Subscriptions, new users get that automatically
- **No personal data leaves** — only the mapping `(merchant_hash, category, count)`
- Ship as a static JSON file updated periodically, not a live service
- **Implementation:**
  - Opt-in: user must consent to contribute their anonymous mappings
  - Export endpoint: `GET /api/category-mappings` returns `{merchant_hash: category}` (no amounts, dates, or user info)
  - Aggregation server collects hashed mappings, computes consensus, publishes `community_categories.json`
  - Boreal downloads this file on startup and uses it as a fallback after user rules

### Phase 4 — Confidence scores
- Instead of binary categorized/uncategorized, assign confidence levels:
  - **High** (keyword match + learned merchant) → auto-apply silently
  - **Medium** (partial match or community model) → auto-apply but flag for review
  - **Low** (no match) → leave as UNCATEGORIZED
- The review modal already exists — extend it to show "Suggested: Eating Out — Accept?" for medium-confidence items
- Users can accept with one tap instead of picking from the full category list

---

## 3. Start-of-Month Day (Setting Removed — Needs Backend Work)

The setting was removed from the UI because it didn't work. Here's what implementing it properly requires:

- **Backend:** Every `date LIKE 'YYYY-MM%'` query (~15 places across summary.py, transactions.py, accounts.py) must be replaced with `date >= ? AND date < ?` using computed start/end dates based on `month_start_day`
- **`/api/months` endpoint:** Instead of `SELECT DISTINCT substr(date,1,7)`, compute custom month boundaries: if `month_start_day=15`, then "May 2026" means May 15 → June 14
- **Frontend month navigation:** `STATE.months` must store date ranges, not just `YYYY-MM` strings
- **Trends, averages, recurring, forecast, year review:** All must use the same custom month boundaries
- **Effort:** Medium-high. Touching 15+ query sites is risky — needs comprehensive test coverage first.

---

## 4. Weekly Email Digest

Bring users back without them having to remember to check.

- **Content:** "Last week you spent $342. Your biggest category was Groceries ($128). You're 80% through your Dining budget. Your Emergency Fund goal is 64% complete."
- **Implementation:**
  - Flask-Mail is already configured
  - Add a `POST /api/settings` option: `email_digest: 'weekly' | 'monthly' | 'off'`
  - Background task (APScheduler or cron) runs Sunday night, queries last 7 days, sends summary
  - Include: total spent, top 3 categories, budget status, savings goal progress, any alerts
  - Unsubscribe link in every email
- **Effort:** Low — all the data queries already exist, just need to compose the email

---

## 5. Shareable Read-Only View

Cover 80% of the "couples managing money together" use case with 5% of the effort.

- Generate a time-limited, read-only link: `boreal.app/shared/abc123`
- Shows: monthly dashboard, spending breakdown, budget progress
- No login required, no editing capability
- Link expires after 30 days or on manual revocation
- **Implementation:**
  - `shared_links` table: `token`, `user_id`, `created_at`, `expires_at`
  - `GET /shared/<token>` renders a stripped-down dashboard (no sidebar, no edit buttons)
  - Settings page: "Share your summary" → generates link, shows copy button

---

## 6. Import from Competitors

Make the switching cost zero.

- **Mint:** CSV export format is well-documented — Date, Description, Original Description, Amount, Transaction Type, Category, Account Name, Labels, Notes
- **YNAB:** Export is CSV with Date, Payee, Category Group/Category, Memo, Outflow, Inflow
- **Copilot Money:** CSV export with similar fields
- **Implementation:**
  - Add YAML configs for each competitor's export format (same system as bank CSVs)
  - Map their category names to Boreal categories (e.g., Mint's "Fast Food" → Boreal's "Eating Out")
  - Show on onboarding: "Switching from another app? Import your data"

---

## 7. Security Fixes

### TEST-ACCOUNTS.md
- Contains production credentials (`tester@boreal.app / TestBoreal123`) and admin recovery key in plain text
- **Fix:** Add to `.gitignore`, remove from git history with `git filter-branch` or BFG Repo Cleaner, rotate all credentials

### Rate limiting
- Currently uses in-memory storage — resets on server restart, doesn't work across Gunicorn workers
- **Fix:** Switch to Redis backend for Flask-Limiter (or accept the limitation for single-worker deploys)

### Database restore
- `POST /api/restore` validates SQLite header but nothing else — could contain malicious triggers/views
- **Fix:** After restore, run `PRAGMA integrity_check`, drop any triggers/views that aren't in the expected schema

---

## 8. Performance (When User Count Grows)

### Transaction pagination
- Default path returns all rows per month — will degrade with heavy users (1000+ tx/month)
- **Fix:** Default to cursor-based pagination (50 rows), infinite scroll on frontend

### Retro-categorization
- `UPDATE ... WHERE INSTR(LOWER(name), keyword)` scans every transaction on every category edit
- **Fix:** Only scan UNCATEGORIZED transactions: add `AND (category = 'UNCATEGORIZED' OR category = '')` to the WHERE clause

### Net worth calculation
- Recomputes cumulative balance for every account for every month on every call
- **Fix:** Cache the result in a `net_worth_cache` setting key, invalidate on import/edit

---

## What's Already Done ✓

- [x] Currency formatting respects user setting (CAD/USD/EUR/GBP)
- [x] Removed broken start-of-month setting
- [x] Added performance indexes (migration v12)
- [x] Deduplicated accounts backfill (runs once per request)
- [x] Batch uncategorized review modal (card-stack UI)
- [x] Uncategorized banner on Transactions page
- [x] "Review now" button in notification dropdown
- [x] Backend insights/alerts use dynamic currency symbol
