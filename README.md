# Boreal

**Free, private, self-hosted personal finance dashboard for Canadians.**

Track your spending, budget by category, monitor net worth, and manage multiple bank accounts — all from a single app that runs on your own machine. Your bank data never leaves your computer.

**Live demo:** [boreal.up.railway.app](https://boreal.up.railway.app)

---

## Features

### Import & Detection
- **Drag-and-drop CSV import** — auto-detects 11 Canadian bank formats
- **OFX/QFX import** — works with any bank that offers Quicken/Money downloads
- **Unknown CSV wizard** — step-by-step column mapping for unrecognized formats; saves a YAML config for future imports
- **Re-import safe** — SHA-256 deduplication means you can import the same file multiple times without double-counting
- **Round-trip export** — export CSV from Boreal and re-import it (or share it); categories and accounts are preserved

### Auto-Categorization
- **300+ built-in merchant rules** — groceries, fuel, subscriptions, dining, and more
- **Edit & learn** — fix a category once and the app remembers that merchant forever
- **Retro-fix** — changing a category automatically re-categorizes matching uncategorized transactions
- **Custom categories** — add, rename, or delete categories with emoji icons
- **Category groups** — organize into logical groups (Essentials, Lifestyle, Income) for grouped spending views

### Dashboard & Reporting
- **Monthly dashboard** — income, expenses, net saved, savings rate, month-over-month comparison
- **Smart insights** — savings rate highlights, overspending warnings, budget alerts, spending spike detection
- **Spending trends** — 6-month bar chart showing your spending trajectory
- **Year in review** — annual breakdown with monthly bars and top 5 spending categories
- **Recurring/subscription detection** — auto-flags merchants that charge monthly; warns on price changes

### Budgets & Goals
- **Budget targets** — set spending limits per category with visual progress bars (green → amber → red)
- **Monthly averages** — rolling 6-month average spend per category
- **Savings goals** — named targets (e.g. "Vacation Fund $3,000") with manual contributions and progress tracking

### Accounts & Net Worth
- **Account registration** — chequing, savings, credit card, investment with opening balances
- **Live balances** — computed from opening balance + all imported transactions
- **Net worth chart** — line chart tracking total net worth month by month
- **Inter-account transfers** — move money between accounts without polluting spending data

### Scheduled Transactions
- **Recurring schedules** — weekly, biweekly, monthly, or yearly with name, category, amount, and account
- **Auto-post on due date** — due schedules are posted automatically when you open the app
- **Pause/resume** — disable temporarily without deleting (e.g. gym over summer)

### Transaction Management
- **Search** — full-text across name, category, account, notes, date
- **Account filter** — filter by bank account
- **Bulk actions** — select multiple transactions and delete, categorize, or hide at once
- **Manual entries** — cash, e-transfers, or anything not in a CSV
- **Transaction splitting** — split one transaction across multiple categories
- **Undo** — restore deleted or edited transactions instantly (last 50 actions)

### Import Rules
- **Rule engine** — auto-hide, label, or force-show transactions at import time based on conditions
- **Rule templates** — one-click presets: Default, Freelancer, Student, Self-Employed, Carpool
- **Test before saving** — preview rule matches against existing data

### Export & Backup
- **Export CSV** — any month or all time (re-importable)
- **Export PDF** — formatted monthly report
- **Backup/restore** — download or restore full database

### Multi-User & Auth
- **User accounts** — email signup with optional email verification
- **Per-user databases** — each user gets an isolated SQLite database
- **Admin panel** — user management, system stats, per-user DB sizes, demo data seeding
- **Demo mode** — read-only sandbox that resets hourly; no login required
- **Password reset** — secure token-based recovery flow

### UI & Experience
- **Dark/light theme** — toggle in the sidebar, persisted
- **PWA support** — install as a standalone app on desktop or mobile; offline-capable
- **Responsive design** — works on phone, tablet, and desktop
- **Keyboard shortcuts** — Ctrl+S to save, Esc to close drawers
- **Live nav counts** — transaction, schedule, and rule counts in the sidebar

### Privacy
- **Zero cost** — no subscriptions, no cloud, no ads, no tracking
- **Fully local** — data stays on your machine in SQLite
- **CSRF protection** — on all mutating endpoints
- **Rate limiting** — brute-force protection on auth endpoints

---

## Supported Banks

| Bank | Account Type | Format | Notes |
|------|-------------|--------|-------|
| **Tangerine** | Chequing | CSV | E-transfers, memo field included |
| **Tangerine** | Credit Card | CSV | All purchases and refunds |
| **Wealthsimple** | Chequing | CSV | Auto-detects account type from CSV |
| **RBC** | Chequing | CSV | Debit/Credit columns |
| **TD** | Chequing | CSV | EasyWeb → Download Transactions → CSV |
| **CIBC** | Chequing | CSV | Account Activity → Export |
| **Scotiabank** | Chequing | CSV | Single amount column |
| **BMO** | Chequing | CSV | Withdrawals/Deposits columns |
| **National Bank** | Chequing | CSV | Bilingual (EN/FR) supported |
| **American Express** | Credit Card | CSV | Amex online statement export |
| **Any bank** | Any | OFX/QFX | Standard bank download format — works with most Canadian banks |
| **Any other bank** | Any | CSV | Use the CSV wizard to map columns — config is saved automatically |

> **OFX/QFX support:** Most Canadian banks offer OFX or QFX downloads (sometimes called "Quicken" or "Money" format). Just drag the `.ofx` or `.qfx` file into the import area — the app parses it automatically, extracts the account name, and categorizes transactions.

> **Credit cards at most banks** (TD, RBC, CIBC, BMO) are only available as PDFs — not CSVs. Tangerine is the main exception. If your bank only gives you PDFs, try a free converter like [DocuClipper](https://docuclipper.com) to get a CSV first.

---

## Setup

```bash
git clone https://github.com/raz3rbla8e/Boreal
cd Boreal
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

Requires [Python 3.9+](https://www.python.org/downloads/).

### Production (Railway / Gunicorn)

The included `Procfile` runs Gunicorn:

```
web: gunicorn -w 2 -b 0.0.0.0:$PORT app:app
```

### Environment variables

All optional — see `.env.example`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | auto-generated | Session secret |
| `DB_PATH` | `finance.db` | Legacy single-user DB path |
| `DATA_DIR` | `data/` | Per-user database directory |
| `DEMO_MODE` | `false` | Enable read-only demo sandbox |
| `PROTECTED_ACCOUNTS` | *(empty)* | Comma-separated emails that can't change password or be deleted |
| `ADMIN_RECOVER_KEY` | *(empty)* | One-time admin recovery key |
| `MAIL_SERVER`, `MAIL_USERNAME`, etc. | *(empty)* | SMTP config for email verification and password reset |

### CLI commands

```bash
python app.py                          # Start the server
python app.py migrate --assign <email> # Migrate legacy finance.db to per-user storage
python app.py make-admin <email>       # Grant admin role to a user
```
---

## Usage

### Importing transactions

1. Log into your bank's online banking
2. Download your transactions as CSV or OFX/QFX (usually under "Account Activity" → "Export" or "Download")
3. Open **http://localhost:5000** → **Import CSV** tab
4. Drag and drop one or more CSV, OFX, or QFX files
5. Done — duplicates are automatically skipped

**You can import the same file multiple times safely.** The app uses a SHA-256 hash of date + name + amount + account to deduplicate — it will never double-count.

**Unknown banks?** If the CSV format isn't recognized, a wizard opens automatically. You map the date, description, and amount columns, name the bank, preview the parsed data, and save. A YAML config is created in `banks/` and future imports auto-detect.

**Re-importing your own exports?** If you export a CSV from Boreal and re-import it (or share it with a friend), the app recognizes its own format and preserves all categories, types, and account names.

### Monthly routine

```
1. Download CSVs from each bank
2. Drag into Import CSV tab
3. Check dashboard for the new month
4. Fix any UNCATEGORIZED transactions by clicking them
```

### Fixing categories

Click any transaction row → Edit modal → Change category → Save.

The merchant name is saved to your `learned_merchants` database. Next time that merchant appears in a CSV, it's auto-categorized correctly. The app also retro-fixes any other UNCATEGORIZED transactions that match.

You can manage or delete learned merchants in **Settings → Learned Merchants**.

### Bulk actions

In the **Transactions** tab, use the checkboxes to select multiple transactions, then:
- **Categorize** — assign the same category to all selected
- **Hide** — hide selected transactions from your dashboard
- **Delete** — remove selected transactions permanently

### Manual transactions

Click **Add Transaction** in the sidebar for:
- Cash purchases
- E-transfers (e.g. car payment to family)
- Any expense not captured by a bank CSV

### Setting budgets

Go to **Settings → Monthly Budgets** → pick a category and set your limit. Progress bars appear on the dashboard showing how close you are (green → amber → red).

### Recurring & subscriptions

The dashboard automatically detects merchants that charge you in 3 or more distinct months (Netflix, Spotify, gym membership, etc.) and shows:
- Average monthly amount
- Total monthly committed spend
- Price change warnings (e.g. Netflix went from $16.49 to $17.99)

### Import rules

Go to **Settings → Import Rules** to create rules that run automatically on every CSV import:

- **Hide** — suppress internal transfers, credit card payments, etc. from your dashboard
- **Label** — auto-tag matching transactions with a specific type/category (e.g. label all Interac e-transfers from a specific person as Income / Freelance)
- **Pass** — force-show transactions that would otherwise be hidden by another rule

Rules have conditions (description contains, amount greater than, etc.) and first match wins by priority. You can test rules against your existing data before saving.

**Templates:** One-click presets for common setups — Default, Freelancer, Student, Self-Employed, Carpool/Commuter. Load a template and customize.

### Hidden transactions

Transactions hidden by rules (or manually) don't affect your dashboard numbers. View them from the **Transactions** tab → **Hidden** toggle. You can unhide any transaction to restore it.

### Custom categories

In **Settings → Categories**, you can:
- Add new expense or income categories with emoji icons
- Rename existing categories (all transactions are updated automatically)
- Delete categories (with option to reassign transactions to another category)

### Year in review

Switch to the **Year Review** tab to see:
- Total income, expenses, and net saved for the year
- Monthly bar chart comparing income vs. expenses
- Top 5 spending categories for the year

### Backup & restore

- **Backup:** Settings → Download Backup (downloads your `finance.db` file with a timestamp)
- **Restore:** Settings → Restore from Backup (upload a `.db` file to overwrite your current data)
- **Export CSV:** Export tab → download all transactions as CSV (can be re-imported)

### Accounts & balances

The **Accounts** feature lets you register the actual bank accounts you use (chequing, savings, credit card, investment) and track their balances over time.

**How it works:**
1. Go to **Settings → Accounts**
2. Add each account with a name (e.g. "TD Chequing"), type, and opening balance (your balance before any imported transactions)
3. The app computes each account's live balance: `opening balance + all income − all expenses` for that account
4. The **Account Balances** panel on the dashboard shows each account's current balance and a total across all accounts

**Why it's useful:** Without accounts, Boreal just shows spending and income in aggregate. With accounts, you can see _where_ your money actually sits — how much is in chequing vs. savings vs. investments. It turns the app from a spending tracker into a full financial picture.

When you rename an account in Settings, all transactions linked to it are updated automatically.

### Net worth

The **Net Worth** panel on the dashboard shows a line chart of your total net worth over time.

**How it works:**
- Net worth = sum of all account balances at each month-end
- Each account's balance at a given month = `opening balance + income up to that month − expenses up to that month`
- The chart plots one data point per month, so you can see your net worth grow (or shrink) over time

**Why it's useful:** Month-to-month spending is important, but the bigger question is: _am I building wealth?_ The net worth chart answers that. If you're saving $500/month but your net worth is flat, something's off. If it's trending up, you're on track.

> You need at least one account set up (in Settings → Accounts) for net worth to appear.

### Scheduled transactions

**Scheduled transactions** let you pre-define recurring expenses or income that happen on a predictable schedule.

**How it works:**
1. Go to **Settings → Scheduled Transactions**
2. Add a schedule: name, type (Expense/Income), category, amount, account, frequency (weekly/biweekly/monthly/yearly), and next due date
3. When you open the app and a schedule is due, it's automatically posted as a real transaction and the next due date advances
4. You can also manually post all due schedules by clicking **⚡ Post due now**
5. Pause a schedule (⏸ button) to skip it temporarily — useful for seasonal expenses

**Why it's useful:** Rent, Netflix, gym membership, car payment — these happen every month like clockwork. Instead of waiting for them to appear in a CSV (which might be delayed), scheduled transactions let you:
- See upcoming expenses _before_ they hit your bank
- Keep your budget accurate even if you haven't imported this month's CSV yet
- Auto-categorize recurring expenses perfectly every time (no more UNCATEGORIZED rent)

### Transfers

Click **Transfer** in the sidebar to move money between accounts (e.g. chequing → savings).

**How it works:**
- A transfer creates two linked hidden transactions: an expense from the source account and income to the destination account
- Both are hidden from your dashboard so they don't inflate your spending or income numbers
- Account balances update correctly — the money moves from one account to the other
- The transactions are linked by a `transfer_id` so the app knows they're a pair

**Why it's useful:** When you move $500 from chequing to savings, that's not spending — it's just moving your own money. Without transfers, you'd either have to manually add two transactions and hide them, or your account balances would be wrong. Transfers handle this in one click.

### Undo

When you delete a transaction (single or bulk), an **Undo** button appears at the bottom-right of the screen. Click it to restore the deleted transaction(s) instantly.

Undo also works for edits — if you change a transaction's name or category, undo reverts it to the previous values.

The undo history keeps the last 50 actions and each undo is consumed after use (you can't undo the same action twice).

---

## Data & Privacy

- **Multi-user:** Each user's data is stored in `data/<user_id>.db` — an isolated SQLite file
- **Single-user:** Legacy mode uses `finance.db` in the project root
- Nothing is sent to any server, ever
- The only external requests are loading Google Fonts and Chart.js from CDNs (for the UI)
- Session tokens use SHA-256 and are auto-generated per install
- CSRF protection on all mutating API endpoints
- Rate limiting on authentication endpoints
- To back up your data: use the in-app backup, or copy your `.db` file somewhere safe
- To start fresh: delete your database and restart the app

---

## File Structure

```
Boreal/
├── app.py                          ← Entry point + CLI commands
├── requirements.txt                ← Pip dependencies
├── Procfile                        ← Gunicorn config for Railway/Heroku
├── .env.example                    ← Environment variable reference
├── banks/                          ← YAML bank configs (auto-detect CSV formats)
│   ├── amex.yaml
│   ├── bmo_chequing.yaml
│   ├── boreal_export.yaml          ← Recognizes re-imported exports
│   ├── cibc_chequing.yaml
│   ├── national_bank.yaml
│   ├── rbc_chequing.yaml
│   ├── scotiabank.yaml
│   ├── tangerine_credit.yaml
│   ├── tangerine_debit.yaml
│   ├── td_chequing.yaml
│   └── wealthsimple.yaml
├── rules/templates/                ← Import rule presets
│   ├── default.yaml
│   ├── freelancer.yaml
│   ├── student.yaml
│   ├── self_employed.yaml
│   └── carpool_commuter.yaml
├── sample_data/                    ← Example CSVs for testing
├── boreal/                         ← Application package
│   ├── __init__.py                 ← Flask app factory, CSRF middleware
│   ├── __main__.py                 ← python -m boreal
│   ├── config.py                   ← Paths, env vars, feature flags
│   ├── models/
│   │   ├── database.py             ← SQLite schema, migrations (v1–v11), tx_hash
│   │   └── users.py               ← User model, auth, admin roles
│   ├── routes/
│   │   ├── main.py                 ← Homepage, health check, admin recovery
│   │   ├── auth.py                 ← Login, signup, email verification, password reset
│   │   ├── admin.py                ← Admin panel, user management, demo seeding
│   │   ├── transactions.py         ← CRUD, search, pagination, bulk actions, splits
│   │   ├── import_export.py        ← CSV/OFX import, export, bank wizard, backup/restore
│   │   ├── summary.py             ← Dashboard, year review, averages, recurring detection
│   │   ├── settings.py             ← Budgets, categories, learned merchants, goals, groups
│   │   ├── rules.py                ← Import rules CRUD, templates, test/apply
│   │   └── accounts.py             ← Accounts, net worth, schedules, transfers, undo
│   ├── services/
│   │   ├── categorization.py       ← 300+ keyword → category rules
│   │   ├── csv_parser.py           ← YAML-driven CSV parsing engine
│   │   ├── email.py                ← Email verification and password reset emails
│   │   ├── helpers.py              ← Date parsing, number parsing
│   │   └── rules_engine.py         ← Rule evaluation and transaction processing
│   ├── templates/                  ← HTML templates (SPA shell + auth pages)
│   └── static/
│       ├── css/style.css           ← Full styling (dark/light themes, CSS variables)
│       ├── js/app.js               ← Frontend logic (vanilla JS SPA)
│       ├── manifest.json           ← PWA manifest
│       ├── sw.js                   ← Service worker for offline caching
│       └── icons/                  ← PWA icons + branding SVGs
├── data/                           ← Per-user SQLite databases (gitignored)
└── _archive/                       ← Old versions, dev docs, legacy configs (gitignored)
```

---

## Adding a new bank

### Option 1: Use the CSV wizard (no code needed)

Drop an unrecognized CSV into the import tab → the wizard opens → map columns → name the bank → save. A YAML config is created in `banks/` and future imports auto-detect.

### Option 2: Write a YAML config manually

Create a file in `banks/` following this pattern:

```yaml
name: "My Bank (Chequing)"
version: 1
last_verified: "2026-04"
account_label: "My Bank Chequing"
encoding: "utf-8-sig"

detection:
  header_contains:
    - "some_unique_header"

columns:
  date: "Date"
  description: "Description"
  debit: "Withdrawals"
  credit: "Deposits"

date_formats:
  - "%m/%d/%Y"
  - "%Y-%m-%d"
```

See existing configs in `banks/` for examples of single-amount vs. debit/credit, flexible column matching, memo fields, description fallbacks, etc.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/months` | List months with data |
| GET | `/api/summary?month=` | Monthly dashboard data |
| GET | `/api/year/<year>` | Year in review |
| GET | `/api/averages` | Monthly category averages |
| GET | `/api/recurring` | Recurring transaction detection |
| GET | `/api/transactions` | List/filter/search transactions |
| GET | `/api/accounts` | List distinct bank accounts |
| POST | `/api/add` | Add a manual transaction |
| PATCH | `/api/update/<id>` | Update a transaction |
| DELETE | `/api/delete/<id>` | Delete a transaction |
| PATCH | `/api/transactions/<id>/hide` | Hide a transaction |
| PATCH | `/api/transactions/<id>/unhide` | Unhide a transaction |
| POST | `/api/bulk-delete` | Delete multiple transactions |
| POST | `/api/bulk-categorize` | Categorize multiple transactions |
| POST | `/api/bulk-hide` | Hide multiple transactions |
| POST | `/api/import` | Import CSV files |
| POST | `/api/detect-csv` | Detect bank from CSV header |
| POST | `/api/save-bank-config` | Save custom bank config |
| POST | `/api/preview-parse` | Preview CSV parsing |
| GET | `/api/export` | Export transactions as CSV |
| GET | `/api/backup` | Download database backup |
| POST | `/api/restore` | Restore from backup |
| GET/POST | `/api/budgets` | Get/set budget limits |
| GET/POST | `/api/settings` | Get/set app settings |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Add category |
| PATCH | `/api/categories/<id>` | Rename category |
| DELETE | `/api/categories/<id>` | Delete category |
| GET | `/api/learned` | List learned merchants |
| DELETE | `/api/learned/<keyword>` | Delete learned merchant |
| GET/POST | `/api/rules` | Get/create import rules |
| PATCH | `/api/rules/<id>` | Update rule |
| DELETE | `/api/rules/<id>` | Delete rule |
| POST | `/api/rules/reorder` | Reorder rule priorities |
| POST | `/api/rules/test` | Test rule against existing data |
| POST | `/api/rules/apply-all` | Apply all rules retroactively |
| GET | `/api/rule-templates` | List rule templates |
| POST | `/api/rule-templates/load` | Load a rule template |
| GET | `/api/accounts-list` | List accounts with balances |
| POST | `/api/accounts-list` | Add an account |
| PATCH | `/api/accounts-list/<id>` | Update an account |
| DELETE | `/api/accounts-list/<id>` | Delete an account |
| GET | `/api/net-worth` | Net worth over time |
| GET | `/api/schedules` | List scheduled transactions |
| POST | `/api/schedules` | Add a scheduled transaction |
| PATCH | `/api/schedules/<id>` | Update a scheduled transaction |
| DELETE | `/api/schedules/<id>` | Delete a scheduled transaction |
| POST | `/api/schedules/post-due` | Post all due scheduled transactions |
| POST | `/api/transfers` | Create a transfer between accounts |
| POST | `/api/undo` | Undo the last delete/edit |
| GET | `/api/undo/status` | Check if undo is available |
| POST | `/api/import-ofx` | Import OFX/QFX files |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.9+ / Flask 3.0+ |
| **Database** | SQLite — per-user isolated databases + shared users.db |
| **Auth** | Flask-Login + Bcrypt |
| **Email** | Flask-Mail (optional — for verification and password reset) |
| **Rate limiting** | Flask-Limiter |
| **Compression** | Flask-Compress (gzip/brotli) |
| **Frontend** | Vanilla HTML/CSS/JS — no build step, no npm, no framework |
| **Charts** | Chart.js 4.x (CDN) — doughnut, bar, and line charts |
| **PDF** | fpdf2 |
| **Bank configs** | YAML (easy to add new banks) |
| **PWA** | Service worker + manifest for installability and offline support |
| **Security** | CSRF tokens, SHA-256 hashing, rate limiting, path traversal guards |
| **Deployment** | Gunicorn (Railway, Heroku, any Linux host) |

---

## Contributing

Issues and PRs welcome. Please don't commit any real transaction data.

---

## License

MIT
