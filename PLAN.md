# Boreal — Master Roadmap

The goal: make Boreal the default personal finance app for Canadians. Minimal setup, maximum value, zero reason to leave.

Canada's open banking framework won't be live across banks until late 2026–2027. That's our window — CSV-based apps still have a real niche while the big US players (Monarch, YNAB, Copilot) can't auto-connect to Canadian banks.

---

## What's Already Done ✓

- [x] 11 Canadian bank CSV auto-detection (RBC, TD, Tangerine, CIBC, BMO, Scotiabank, Amex, National Bank, Wealthsimple)
- [x] OFX/QFX import for any bank
- [x] Unknown CSV wizard with saved YAML configs
- [x] 300+ merchant auto-categorization rules across 21 categories
- [x] Merchant name normalization (strips location codes, terminal IDs, SQ/SP/TST prefixes)
- [x] Learned merchants stored normalized + raw, two-pass matching
- [x] Confidence scores on categorization (high/medium/low)
- [x] Batch uncategorized review modal (card-stack UI)
- [x] Uncategorized banner + "Review now" in notifications
- [x] Retro-fix: recategorizing a merchant auto-applies to all matching uncategorized transactions
- [x] Dashboard with income/expenses/net/savings rate/month-over-month comparison
- [x] Smart insights (savings rate, spending spikes, over-budget alerts, MoM changes)
- [x] Real-time alerts (budget overages, due schedules, uncategorized count, subscription price changes)
- [x] Alert dismissal system
- [x] 6-month spending trends bar chart
- [x] Year-in-review (monthly bars + top 5 categories)
- [x] 3-month cash flow forecast (recurring patterns + historical averages)
- [x] Recurring/subscription detection (3+ months, price trail, next-date estimate)
- [x] Per-category budget targets with visual progress bars
- [x] 6-month rolling averages per category
- [x] Savings goals with contributions and progress tracking
- [x] Account registration (chequing, savings, credit, investment) with opening balances
- [x] Live computed balances from opening balance + transactions
- [x] Net worth chart (24-month history)
- [x] Inter-account transfers with 2-layer detection (regex + cross-account matching)
- [x] Account reconciliation with auto-adjustment transactions
- [x] Investment account balance snapshots
- [x] Scheduled transactions (weekly/biweekly/monthly/yearly) with auto-post on due date
- [x] Pause/resume schedules
- [x] Full-text search across name, category, account, notes, date
- [x] Account filter, bulk actions, manual entries, transaction splitting
- [x] Undo system (last 50 actions)
- [x] Import rules engine with priority ordering, 8 operators, 4 action types
- [x] 5 rule templates (Default, Freelancer, Student, Self-Employed, Carpool)
- [x] CSV export (monthly or all-time, re-importable)
- [x] PDF monthly report
- [x] SQLite database backup/restore
- [x] Multi-user auth with per-user isolated SQLite databases
- [x] Email verification + password reset
- [x] Admin panel with user management, system stats, demo seeding
- [x] Demo mode with hourly reset
- [x] CSRF protection, rate limiting, security headers, anti-enumeration
- [x] PWA with service worker (network-first, cache fallback)
- [x] Dark/light theme toggle
- [x] Responsive design (phone, tablet, desktop)
- [x] Currency setting (CAD/USD/EUR/GBP)
- [x] Performance indexes (migration v12)
- [x] SHA-256 deduplication on import
- [x] Category groups (Essentials, Lifestyle, Income)
- [x] Custom categories with emoji icons
- [x] Basic onboarding screen (renders when no transactions exist)

---

## Phase 1 — First Impressions (Convert Visitors → Users)

### 1.1 First-Run Wizard
**Priority: CRITICAL | Effort: 2–3 days**

Replace the basic onboarding screen with a guided 4-step wizard:

1. **Welcome** — "Track your spending in under 60 seconds. No bank login required."
2. **Pick your bank** — Show logos for RBC, TD, Tangerine, CIBC, BMO, Scotiabank, Amex, Wealthsimple. Selecting one shows a 3-step screenshot guide for downloading CSVs from that specific bank's website.
3. **Import** — Drag-and-drop zone. Auto-detect bank, show: "✓ 47 transactions found from RBC Chequing. 41 auto-categorized."
4. **Done** — Redirect to dashboard with data populated. Show a celebratory moment: "You spent $2,340 last month. Your top category was Groceries."

- Store `wizard_completed` in settings so it never shows again
- Add "Skip for now" link on every step (some users want to explore first)
- Mobile-optimized: each step is a full-screen card, swipe or tap to advance

### 1.2 Bank-Specific CSV Download Guides
**Priority: HIGH | Effort: 1–2 days**

Create a visual guide for each supported bank:
- 3 screenshots per bank showing exactly where to find CSV download
- Store as structured data (bank name, steps array with title + image URL)
- Accessible from: wizard step 2, import page, help/FAQ
- Include OFX/QFX download instructions where available
- **Key insight:** Every bank hides CSV export in a different place. This eliminates the #1 support question.

### 1.3 Landing Page Overhaul
**Priority: HIGH | Effort: 2–3 days**

The current landing page is the login screen. New users have no idea what the app does.

- **Hero section:** "The free personal finance app built for Canadians." + screenshot of dashboard with sample data
- **Feature highlights:** 4 cards — Auto-categorize, Budget tracking, Net worth, Privacy-first
- **Trust signals:** "Your data never leaves your device" / "No bank login required" / "Works with all 11 major Canadian banks"
- **CTA buttons:** "Try the demo" (no signup) + "Create free account"
- **Social proof:** When available, add user count or testimonials
- **Footer:** Privacy policy link, GitHub link, "Made in Canada 🍁"

### 1.4 Import from Competitors
**Priority: MEDIUM | Effort: 1–2 days**

Make switching cost zero:
- Add YAML configs for Mint, YNAB, Copilot Money, Wealthica export formats
- Map their category names to Boreal categories
- Show on wizard: "Switching from another app? Import your history"
- Preserve their categories where possible, map unknowns to UNCATEGORIZED

---

## Phase 2 — Retention (Keep Users Coming Back Monthly)

### 2.1 Email Auto-Import
**Priority: CRITICAL | Effort: 1–2 weeks**

The #1 retention feature. Without this, users churn after month 2.

- Each user gets a unique ingest address: `user-abc123@ingest.boreal.app`
- User sets up auto-forward from their bank's statement notification emails
- Boreal receives email → extracts CSV/PDF attachment → detects bank → parses with existing YAML configs → imports → auto-categorizes
- Send confirmation: "✓ 12 new transactions imported from RBC Chequing"
- **Implementation:**
  - Mailgun or SendGrid inbound routes (free tier = hundreds/month)
  - Parse MIME attachments, detect bank format, run through `csv_parser` + `categorize()` pipeline
  - Store per-user ingest email in `settings` table
  - Settings page: "Email Import" section with unique address + copy button + setup instructions per bank
- **Privacy:** Emails parsed in memory and discarded. Only transaction data stored.
- **Fallback:** If attachment parsing fails, queue it and email user: "We couldn't parse your attachment. Please import manually."

### 2.2 Weekly/Monthly Email Digest
**Priority: HIGH | Effort: 2–3 days**

Passive re-engagement — users don't need to remember to check.

- **Content:** "Last week: $487 spent. Top: Groceries ($142). Dining budget: 78% used. Emergency Fund: 64% complete."
- **Implementation:**
  - Setting: `email_digest: 'weekly' | 'monthly' | 'off'` (default: weekly)
  - APScheduler or cron job runs Sunday night
  - Queries: last 7 days spending, top 3 categories, budget status, goal progress, any alerts
  - Styled HTML email with Boreal branding
  - Unsubscribe link in every email (one-click, no login required)
  - Include "Open Boreal" deep link
- **Effort:** Low — all data queries already exist. Just compose the email.

### 2.3 Smart Alerts & Nudges (Enhanced)
**Priority: HIGH | Effort: 3–5 days**

Expand beyond current alerts to create "aha moments":

- **Spending anomaly:** "You spent $340 on Dining this month — that's 2× your 6-month average"
- **Subscription price hike:** "Netflix charged $22.99, up from $16.99 last month" (already detected — needs better surfacing)
- **Forgotten subscription:** "You've been charged $9.99/mo by HEADSPACE for 6 months with no other activity. Still using it?"
- **Budget pacing:** "You've used 80% of your Groceries budget with 12 days left"
- **Savings milestone:** "Your Emergency Fund just passed $1,000! 🎉"
- **Category trend:** "Your Transport spending has increased 3 months in a row"
- **Net worth milestone:** "Your net worth just crossed $25,000"
- **No-spend streak:** "You had 0 discretionary spending yesterday — 3-day streak!"
- **Implementation:**
  - Add alert types to `/api/alerts` with severity levels (info, warning, celebration)
  - Celebration alerts use confetti/emoji — positive reinforcement keeps users engaged
  - All alerts dismissible with "Don't show this type again" option

### 2.4 Subscription Dashboard
**Priority: HIGH | Effort: 2–3 days**

Dedicated page for recurring charges (recurring detection already exists — needs its own UI):

- Card grid showing each subscription: logo/icon, name, amount, frequency, next charge date
- **Annual cost rollup:** "You spend $247/month ($2,964/year) on subscriptions"
- Price change history timeline per subscription
- "Cancel reminder" button → sets a calendar-style reminder alert
- Sort by: amount, category, next charge date
- Filter: active, price-changed, possible duplicates
- **This is a high-value, low-effort feature** — the data already exists in `/api/recurring`

### 2.5 Spending Challenges & Streaks
**Priority: MEDIUM | Effort: 3–4 days**

Gamification for engagement:

- **No-spend day counter:** Track consecutive days without discretionary spending
- **Category challenges:** "Can you spend under $200 on Dining this month?" (auto-suggested based on history)
- **Monthly savings challenge:** "Save 10% more than last month"
- **Streak badges:** 7-day, 30-day, 90-day streaks shown on dashboard
- **Implementation:**
  - New `challenges` table: `type`, `target`, `start_date`, `end_date`, `status`
  - Dashboard widget showing active challenges with progress
  - System-generated challenges based on spending patterns (opt-in)

### 2.6 Push Notifications (PWA)
**Priority: MEDIUM | Effort: 3–4 days**

The service worker already exists — add push notifications:

- Notify on: budget 90% used, new auto-import received, scheduled transaction posted, weekly summary ready
- Use Web Push API (VAPID keys, no third-party service needed)
- **Implementation:**
  - Generate VAPID keys, store in env
  - Add push subscription endpoint: `POST /api/push/subscribe`
  - Service worker handles `push` events
  - Settings: granular opt-in per notification type
- **Note:** Only works in Chromium + Firefox. Safari support is limited but growing.

---

## Phase 3 — Monetization (Justify $5–8/month)

### 3.1 Freemium Tier Structure
**Priority: CRITICAL | Effort: 3–5 days**

Free tier must be genuinely useful. Paid gate hits when users think "I need more."

| Feature | Free | Pro ($5–8/mo) |
|---------|------|----------------|
| CSV/OFX import + auto-categorize | ✓ | ✓ |
| Dashboard (current month) | ✓ | ✓ |
| Historical months | Last 3 | Unlimited |
| Budgets | 3 categories | Unlimited |
| Savings goals | 1 | Unlimited |
| Accounts | 2 | Unlimited |
| Email auto-import | ✗ | ✓ |
| Weekly/monthly email digest | ✗ | ✓ |
| Smart alerts & nudges | Basic | All types |
| Subscription dashboard | ✗ | ✓ |
| Net worth tracking | ✗ | ✓ |
| PDF export | ✗ | ✓ |
| Year-in-review report | ✗ | ✓ |
| Spending challenges | ✗ | ✓ |
| Shareable read-only link | ✗ | ✓ |
| Full data export (CSV/backup) | ✓ | ✓ |

- **Data export is always free** — builds trust. "Your data. Always yours."
- Free users see a soft paywall: blurred preview of locked features + "Unlock with Pro"
- **Implementation:**
  - Add `plan` field to user model: `'free' | 'pro'`
  - Middleware checks plan on gated endpoints, returns 403 with upgrade prompt
  - Frontend shows lock icon + "Pro" badge on gated features

### 3.2 Stripe Billing Integration
**Priority: HIGH | Effort: 3–5 days**

- Stripe Checkout for subscription signup (monthly + annual with 2 months free)
- Stripe Customer Portal for managing billing, cancellation, payment method updates
- Webhook handler for: `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
- **Implementation:**
  - `stripe_customer_id` and `stripe_subscription_id` fields in user model
  - `POST /api/billing/checkout` → creates Stripe Checkout session
  - `POST /api/billing/portal` → creates Stripe Customer Portal session
  - `POST /api/billing/webhook` → handles Stripe events, updates user plan
  - Pricing page accessible from settings + upgrade prompts
- **Grace period:** 7 days after failed payment before downgrading to free
- **Cancellation flow:** Survey asking why + offer to pause instead of cancel

### 3.3 Year-in-Review Report
**Priority: MEDIUM | Effort: 2–3 days**

Viral, shareable, drives paid conversion:

- Beautiful full-page annual summary generated in January
- Content: total income, total spent, savings rate, net worth change, top 10 merchants, top 5 categories, month-by-month spending trend, biggest single purchase, most consistent subscription
- Exportable as styled PDF or shareable image (social media ready)
- **Free users see a blurred preview** — "Unlock your Year in Review with Pro"
- Builds on existing `/api/year/<year>` endpoint

### 3.4 Shareable Read-Only Dashboard
**Priority: MEDIUM | Effort: 2–3 days**

For couples managing money together:

- Generate a time-limited, read-only link: `boreal.app/shared/abc123`
- Shows: monthly dashboard, spending breakdown, budget progress
- No login required, no editing
- Link expires after 30 days or on manual revocation
- **Implementation:**
  - `shared_links` table: `token`, `user_id`, `created_at`, `expires_at`
  - `GET /shared/<token>` renders stripped-down dashboard
  - Settings: "Share your summary" → generate link + copy button

---

## Phase 4 — Ease of Use & Polish

### 4.1 Smarter Auto-Categorization (Phase 2+)
**Priority: HIGH | Effort: 1 week**

Merchant normalization and confidence scores are done. Next steps:

- **Auto-learn threshold:** If a user categorizes 2+ transactions with similar normalized names identically, auto-learn that merchant without explicit "teach" action
- **Community model (privacy-preserving):**
  - Opt-in: users consent to contribute anonymous `merchant_hash → category` mappings
  - Aggregation server computes consensus, publishes `community_categories.json`
  - Boreal downloads on startup, uses as fallback after user rules + learned merchants
  - No personal data leaves — only `(merchant_hash, category, count)`
- **Review suggestions:** Medium-confidence items show "Suggested: Eating Out — Accept?" instead of full category picker
- **Bulk accept:** "Accept all 8 suggestions" button in the review modal

### 4.2 Keyboard Shortcuts & Power User Features
**Priority: MEDIUM | Effort: 1–2 days**

- `Ctrl+K` / `Cmd+K` — command palette (search transactions, navigate pages, run actions)
- `Ctrl+I` — quick import (opens file picker)
- `J/K` — navigate transaction list up/down
- `C` — categorize selected transaction
- `D` — delete selected transaction
- `?` — show keyboard shortcut cheat sheet
- Tab through transaction fields for rapid manual entry

### 4.3 Guided Tooltips & Contextual Help
**Priority: MEDIUM | Effort: 2–3 days**

- First-time tooltips on key features: "This is your savings rate — aim for 20%+", "Drag a CSV here to import"
- Pulsing dot indicators on features user hasn't tried yet
- "What's this?" icons on complex features (forecast, net worth, rules)
- Progressive disclosure: don't show advanced features until user has used basic ones
- Help/FAQ page with searchable articles

### 4.4 Quick Actions from Dashboard
**Priority: MEDIUM | Effort: 1–2 days**

- "Add expense" floating action button (mobile) or quick-entry bar (desktop)
- One-tap shortcuts: "Add coffee $5.50" → creates manual transaction with auto-category
- Recent merchants dropdown for fast re-entry
- "Import new statement" button always visible

### 4.5 Transaction Notes & Tags
**Priority: LOW | Effort: 1–2 days**

- Notes field already exists — add first-class UI for it
- Add tags/labels: `#reimbursable`, `#business`, `#vacation`
- Filter by tag across all transactions
- Useful for tax time: "Show me all #business expenses"

### 4.6 Multi-Currency Support
**Priority: LOW | Effort: 3–5 days**

- Support USD accounts alongside CAD (snowbirds, cross-border shoppers)
- Per-account currency setting
- Dashboard shows totals in primary currency with conversion
- Use Bank of Canada daily exchange rates (free API)
- Net worth converts all accounts to primary currency

---

## Phase 5 — Security Hardening

### 5.1 Credential Leak Remediation
**Priority: CRITICAL | Effort: 1 day**

- `TEST-ACCOUNTS.md` contains production credentials in plain text in the repo
- **Fix:**
  - Add `TEST-ACCOUNTS.md` to `.gitignore`
  - Remove from git history with `git filter-branch` or BFG Repo Cleaner
  - Rotate all credentials: admin password, recovery key, friends account password
  - Store sensitive info in Railway env vars only

### 5.2 Database Restore Hardening
**Priority: HIGH | Effort: 1 day**

- Current: `POST /api/restore` validates SQLite header but nothing else
- **Risk:** Malicious `.db` files with triggers, views, or corrupted data
- **Fix:**
  - After restore: `PRAGMA integrity_check`
  - Drop any triggers, views, or tables not in the expected schema
  - Validate schema version matches current migration version
  - Validate row counts are reasonable (< 1M transactions)
  - Run restore into a temp file first, swap only if validation passes

### 5.3 Rate Limiting Persistence
**Priority: MEDIUM | Effort: 1 day**

- Current: in-memory storage — resets on restart, doesn't work across Gunicorn workers
- **Fix:** Switch to Redis backend for Flask-Limiter (Railway has Redis add-on)
- **Fallback:** If Redis is unavailable, fall back to in-memory (single-worker deploys)

### 5.4 Content Security Policy Tightening
**Priority: MEDIUM | Effort: 1 day**

- Current CSP allows `unsafe-inline` for scripts and styles
- **Fix:**
  - Move all inline scripts to external files
  - Use nonce-based CSP for any remaining inline scripts
  - Remove `unsafe-inline` from `script-src`
  - Keep `unsafe-inline` for `style-src` only if CSS-in-JS is unavoidable

### 5.5 Session Security Enhancements
**Priority: MEDIUM | Effort: 1–2 days**

- Add session timeout: auto-logout after 30 days of inactivity (configurable)
- Add "Active sessions" view in settings showing login history (IP, device, time)
- Add "Log out everywhere" button
- Rotate session token on privilege changes (password change, plan upgrade)

### 5.6 Two-Factor Authentication (2FA)
**Priority: LOW | Effort: 3–5 days**

- TOTP-based 2FA via Google Authenticator / Authy
- **Implementation:**
  - `pyotp` library for TOTP generation/validation
  - QR code generation for setup
  - Backup codes (10 single-use codes) stored hashed
  - 2FA check after password validation on login
  - Settings: enable/disable with password confirmation
- Optional for free, encouraged for Pro users

### 5.7 Audit Logging
**Priority: LOW | Effort: 2–3 days**

- Log security-relevant events: login, failed login, password change, data export, database restore, admin actions
- Store in a separate `audit_log` table (not in per-user DB — in central DB)
- Admin panel: view audit log with filtering by user, event type, date
- Retention: 90 days, auto-purge older entries

---

## Phase 6 — Performance & Scalability

### 6.1 Transaction Pagination
**Priority: HIGH | Effort: 2–3 days**

- Current: returns all transactions per month — degrades with heavy users (1000+ tx/month)
- **Fix:**
  - Cursor-based pagination (50 rows per page)
  - Frontend infinite scroll with loading skeleton
  - Maintain scroll position on back-navigation
  - Search results also paginated

### 6.2 Retro-Categorization Optimization
**Priority: MEDIUM | Effort: 1 day**

- Current: `UPDATE ... WHERE INSTR(LOWER(name), keyword)` scans every transaction
- **Fix:** Add `AND (category = 'UNCATEGORIZED' OR category = '')` — only scan uncategorized rows
- **Impact:** 10× faster for users with large transaction history

### 6.3 Net Worth Caching
**Priority: MEDIUM | Effort: 1 day**

- Current: recomputes cumulative balance for every account for every month on every call
- **Fix:**
  - Cache result in `net_worth_cache` setting key with timestamp
  - Invalidate on: import, transaction edit/delete, account change
  - Return cached value if < 1 hour old

### 6.4 Frontend Bundle Optimization
**Priority: MEDIUM | Effort: 2–3 days**

- Current: single `app.js` file (entire SPA in one file)
- **Fix:**
  - Code-split by route: dashboard, transactions, settings load on demand
  - Lazy-load chart libraries (only load Chart.js when dashboard/trends are viewed)
  - Minify CSS and JS in production
  - Add `Cache-Control` headers with content hashing for aggressive caching
  - Target: < 200KB initial load (gzipped)

### 6.5 Database Migration Safety
**Priority: MEDIUM | Effort: 1–2 days**

- Current: 12 migrations run inline on first request per user
- **Fix:**
  - Add migration versioning check on app startup (not per-request)
  - Add migration dry-run mode for testing
  - Add rollback support for failed migrations (backup before, restore on failure)
  - Log migration execution time per user

### 6.6 Background Task Queue
**Priority: LOW | Effort: 3–5 days**

As user count grows, move heavy operations off the request thread:

- Email sending (digest, import confirmations)
- Large CSV imports (100+ transactions)
- Retro-categorization after rule changes
- Net worth recalculation
- **Implementation:** Celery + Redis or simpler `rq` (Redis Queue)
- Show progress bar for long-running operations

---

## Phase 7 — Growth & Distribution

### 7.1 App Store Presence
**Priority: HIGH | Effort: 2–3 days**

- **Android:** Trusted Web Activity (TWA) wrapper — packages PWA as Play Store app. Minimal effort, full PWA functionality.
- **iOS:** Submit PWA to App Store via PWABuilder or Capacitor wrapper. Limited but functional.
- **Why it matters:** Canadians look for apps in the App Store, not on the web. Being listed = discoverability.

### 7.2 SEO & Content Marketing
**Priority: HIGH | Effort: Ongoing**

- Landing page optimized for: "Canadian budget app", "personal finance Canada", "track spending Canada", "free budgeting app Canada"
- Blog posts: "How to download your RBC statement as CSV", "Best budgeting apps for Canadians 2026", "RRSP vs TFSA calculator"
- Each blog post funnels to Boreal signup
- Structured data (JSON-LD) for rich search results

### 7.3 Referral Program
**Priority: MEDIUM | Effort: 2–3 days**

- "Give 1 month free, get 1 month free" referral system
- Unique referral link per user
- Track referrals in user settings
- Auto-apply credit on referee's first Pro subscription
- **Implementation:**
  - `referral_code` field in user model (auto-generated)
  - `referred_by` field tracking who referred whom
  - Stripe coupon applied on checkout if referral is valid

### 7.4 Social Sharing Features
**Priority: LOW | Effort: 1–2 days**

- "Share your savings rate" — generates a branded image card (no amounts, just percentage)
- "Share your Year in Review" — styled summary image
- Monthly challenge completion badges shareable to Twitter/Instagram
- All sharing is opt-in, no financial data exposed

### 7.5 r/PersonalFinanceCanada Launch Strategy
**Priority: HIGH | Effort: 1 day**

- Post format: "I built a free budgeting app for Canadians because Mint died and YNAB is $15/mo"
- Demo link prominently featured
- Address privacy concerns upfront: "Your data stays on your device / your own server"
- Follow up with bank-specific CSV guides as separate useful posts
- Cross-post to r/CanadianInvestor, r/frugal, Canadian tech Twitter

---

## Phase 8 — Advanced Features (Post-Launch)

### 8.1 Custom Month Start Day
**Priority: MEDIUM | Effort: 3–5 days**

Setting was removed because it didn't work. Proper implementation:

- Replace all `date LIKE 'YYYY-MM%'` queries (~15 places) with `date >= ? AND date < ?`
- `/api/months` computes custom boundaries: if `month_start_day=15`, "May 2026" = May 15 → June 14
- Frontend month navigation stores date ranges, not `YYYY-MM` strings
- Trends, averages, recurring, forecast, year review all use custom boundaries
- **Prerequisite:** Comprehensive test coverage for date boundary queries

### 8.2 Folder Watch Auto-Import
**Priority: MEDIUM | Effort: 2–3 days**

For power users who download CSVs to a specific folder:

- Configure a local folder (e.g., ~/Downloads) via File System Access API
- Poll every 30 seconds for new CSV/OFX files matching known bank patterns
- Auto-import on detection, move processed files to archive subfolder
- **Limitation:** Only Chromium PWA installs (Chrome/Edge), not Safari/Firefox

### 8.3 OFX Direct Connect
**Priority: LOW | Effort: 1 week**

Direct connection to bank OFX servers (no Plaid):

- TD, RBC, CIBC, Scotiabank support OFX Direct Connect
- User provides bank credentials (stored encrypted locally, never sent to Boreal servers)
- Schedule daily/weekly auto-fetch
- **Risk:** Banks may block or change OFX endpoints without notice
- **Privacy:** User-to-bank direct connection

### 8.4 Browser Extension
**Priority: LOW | Effort: 1–2 weeks**

Chrome extension for one-click CSV capture:

- Detects when user is on their bank's CSV download page
- "Send to Boreal" button appears
- Pushes CSV to Boreal instance via extension messaging
- **High maintenance:** Must update content scripts when banks change their UI

### 8.5 Receipt Scanning (OCR)
**Priority: LOW | Effort: 1–2 weeks**

- Snap a photo of a receipt → OCR extracts merchant, amount, date, HST/GST
- Creates a manual transaction with extracted data
- Attach receipt image to transaction for record-keeping
- **Implementation:** Tesseract.js (client-side OCR) or Google Vision API
- Useful for cash transactions not in bank statements

### 8.6 Bill Splitting
**Priority: LOW | Effort: 2–3 days**

- Mark a transaction as "split with [person]"
- Track who owes whom across multiple splits
- Settlement summary: "Sarah owes you $47.50 across 3 expenses"
- No payment integration — just tracking (like Splitwise lite)

### 8.7 Tax Season Helper
**Priority: LOW | Effort: 3–5 days**

- Tag transactions as tax-relevant: `#medical`, `#charitable`, `#business`, `#childcare`
- End-of-year summary grouped by CRA deduction categories
- Export tax-tagged transactions as CSV for accountant
- Reminder alerts in February: "Have you tagged your medical expenses for 2026?"

### 8.8 Household / Couples Mode
**Priority: LOW | Effort: 1–2 weeks**

Full shared finance tracking (beyond read-only sharing):

- Invite a partner to your household
- Each person has their own accounts but sees combined dashboard
- "Mine / Theirs / Shared" transaction tagging
- Combined net worth, shared budgets, individual + joint spending views
- **Complexity:** Requires rethinking per-user DB isolation. Consider a shared DB with user-scoped views.

---

## Priority Summary

| Phase | Timeline | Key Deliverables |
|-------|----------|------------------|
| **Phase 1** — First Impressions | Week 1–2 | First-run wizard, bank guides, landing page |
| **Phase 2** — Retention | Week 2–4 | Email auto-import, weekly digest, smart alerts, subscription dashboard |
| **Phase 3** — Monetization | Week 4–6 | Freemium gate, Stripe billing, year-in-review |
| **Phase 4** — Polish | Week 6–8 | Smarter categorization, keyboard shortcuts, contextual help |
| **Phase 5** — Security | Ongoing | Credential rotation, restore hardening, CSP, 2FA |
| **Phase 6** — Performance | As needed | Pagination, caching, bundle optimization |
| **Phase 7** — Growth | Post-launch | App stores, SEO, referral program, Reddit launch |
| **Phase 8** — Advanced | Post-traction | Custom month start, OFX direct, receipt OCR, couples mode |
