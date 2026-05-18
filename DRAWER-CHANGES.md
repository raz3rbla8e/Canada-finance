# Boreal — Transaction edit drawer redesign

The transaction edit drawer was redesigned to be cleaner, more intuitive, and easier to manage. This document describes the change at three levels:

1. **UX intent** — what the redesign is and why
2. **Exact CSS** — drop into `boreal/static/css/style.css`
3. **Exact JS** — drop into `boreal/static/js/app.js`, replacing the existing `openTxDrawer` and `closeTxDrawer` functions

The drawer in the repo lives in `boreal/static/js/app.js` as vanilla JS rendering an HTML string into `#tx-drawer`. This is **not** a React component — keep the existing pattern.

---

## 1. UX intent — what changed and why

| Region | Before | After |
|---|---|---|
| **Header** | Small uppercase "DATE · ACCOUNT" line on top, merchant name plain below. Description was edited via a separate `<input>` deeper in the body. | Merchant glyph + the merchant name **as an inline-editable input** (hover shows the field, focus shows the focus ring), date · account underneath. The "Description" field is gone — you edit the name where you read it. |
| **Amount** | Big amount, then `Expense · Utilities` — restated category right below the amount. | Amount on the left, single uppercase **Income / Expense pill** on the right. Category lives in its own section and is not duplicated here. |
| **Category** | A horizontal wrap of **12 filter chips** under a "Category" header. No search, no grouping, no way to see categories past the first 12. | A single **category card** showing the current category's icon, color tint, group tag, and a "Change" affordance. Click it and the card morphs into a **searchable picker** with categories grouped by *Essentials / Lifestyle / Income*, a check mark on the current one, and a real text filter. Esc dismisses the picker. |
| **Apply to similar** | Buried at the bottom of the "Similar transactions" list as a button reading "Apply this category to all 3." | When the user actually changes the category, an **accent callout** appears right under the picker — *"Apply to 3 similar transactions · Boreal will remember `WALMART` → Groceries"* — checkbox-toggleable. Surfaces the retroactive-learning behavior at the moment it's relevant. On Save, calls `/api/bulk-categorize` on the matching ids. |
| **Notes** | Two redundant fields, "Description" and "Notes." | Just a Notes `<textarea>` with placeholder. Description editing moved to the inline header field. |
| **Date & account** | Not editable at all. | Collapsible **"Date & account"** section with a date input, account `<select>`, and the original CSV string ("From bank: `WALMART SUPERCENTER #1054`") if the backend provides it. The trigger row shows a compact summary even when collapsed. |
| **Advanced** | Hide toggle rendered in a heavy `settings-group` wrapper. Split section always took body space at the bottom. | Collapsible **"Advanced"** section containing the hide toggle and a "Split transaction" row. The collapsed trigger summarizes current state ("Visible" or "Hidden"). |
| **Similar transactions** | Card with row + CTA button. | Read-only reference list with category-color dots, less prominent — the primary action moved up into the Learn callout. |
| **Footer** | Red Delete on the left as a regular `btn`, Cancel + Save on the right. | **Ghost Delete on the left** (text + icon, hovers red), keyboard hint `⌘S save · esc close` in the middle, Cancel + Save changes on the right. |
| **Keyboard** | None. | `⌘S` / `Ctrl+S` saves and closes. `Esc` closes (or dismisses just the picker if it's open). |
| **Width** | 440px desktop, 100% on tablet (≤1100px). | **480px** desktop, 100% only on phone (≤720px). The existing `@media (max-width: 1100px) .drawer { width: 100% }` rule cascaded over a plain `.drawer-edit { width: 480px }`, so the new rule uses `.drawer.drawer-edit` for higher specificity. |

---

## 2. CSS — append to `boreal/static/css/style.css`

Insert this **before** the `/* RESPONSIVE */` (or `/* CSV WIZARD */`) block, after the existing `.split-row { … }` rule. All classes are scoped under `.drawer-edit` / `td-*` so nothing existing collides.

```css
/* ============================================================
   TRANSACTION EDIT DRAWER v2
   ============================================================ */
.drawer.drawer-edit {
  width: 480px;
  opacity: 1;
  transform: none;
  animation: none;
}

/* Header */
.td-head {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line-1);
}
.td-head-glyph {
  width: 40px; height: 40px; border-radius: 10px;
  border: 1px solid var(--line-2);
  display: grid; place-items: center;
  font-weight: 600; font-size: 15px;
  flex-shrink: 0;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
}
.td-head-text { flex: 1; min-width: 0; }
.td-head-name {
  width: 100%;
  font-size: 15.5px; font-weight: 500; color: var(--ink-1);
  background: transparent; border: 1px solid transparent;
  outline: none; padding: 3px 6px; margin-left: -6px;
  border-radius: 5px;
  font-family: inherit; letter-spacing: -0.005em;
}
.td-head-name:hover { border-color: var(--line-1); background: var(--bg-hover); }
.td-head-name:focus { border-color: var(--accent); background: var(--bg-surface); box-shadow: 0 0 0 3px var(--accent-soft); }
.td-head-sub { font-size: 12px; color: var(--ink-3); margin-top: 3px; }
.td-dot { margin: 0 6px; opacity: 0.5; }

/* Body */
.td-body { padding: 18px 20px 24px; }

/* Amount row */
.td-amt-row {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 22px;
}
.td-amt {
  font-size: 34px; font-weight: 500; letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.td-amt-type {
  font-size: 10.5px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  padding: 4px 9px; border-radius: 6px;
}

/* Section labels */
.td-label {
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--ink-3);
  margin: 18px 0 8px;
}
.td-label-row { display: flex; align-items: baseline; justify-content: space-between; }
.td-label-meta { font-weight: 400; font-size: 11px; color: var(--ink-4); text-transform: none; letter-spacing: 0; }

/* Category card (collapsed state) */
.td-cat-card {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px;
  border: 1px solid var(--line-2);
  background: var(--bg-surface);
  border-radius: 10px;
  font-family: inherit; cursor: pointer; text-align: left;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s;
}
.td-cat-card:hover { border-color: var(--line-strong); background: var(--bg-hover); }
.td-cat-card:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.td-cat-icon {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--line-1);
  display: grid; place-items: center;
  font-size: 16px;
  flex-shrink: 0;
}
.td-cat-name { font-size: 14px; font-weight: 500; color: var(--ink-1); flex: 1; }
.td-cat-group {
  font-size: 10px; color: var(--ink-3);
  padding: 2px 6px; border: 1px solid var(--line-1); border-radius: 4px;
  text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600;
  margin-right: 6px;
}
.td-cat-change {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 12px; color: var(--ink-3); font-weight: 500;
}

/* Category picker (expanded state) */
.td-cat-picker {
  border: 1px solid var(--accent);
  background: var(--bg-surface);
  border-radius: 10px;
  box-shadow: 0 0 0 3px var(--accent-soft);
  overflow: hidden;
}
.td-cat-search {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line-1);
  background: var(--bg-app);
  color: var(--ink-3);
}
.td-cat-search input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; color: var(--ink-1); padding: 0;
  font-family: inherit;
}
.td-cat-list {
  max-height: 300px; overflow-y: auto;
  padding: 4px 4px 8px;
}
.td-cat-group-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ink-4); font-weight: 600;
  padding: 10px 10px 4px;
}
.td-cat-opt {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 6px;
  border: none; background: none; cursor: pointer;
  font-family: inherit; text-align: left;
  color: var(--ink-1);
}
.td-cat-opt:hover { background: var(--bg-hover); }
.td-cat-opt.is-selected {
  background: var(--accent-soft); color: var(--accent-ink);
}
.td-cat-opt-icon {
  width: 24px; height: 24px; border-radius: 6px;
  display: grid; place-items: center;
  font-size: 13px;
  flex-shrink: 0;
}
.td-cat-opt-name { flex: 1; font-size: 13.5px; }
.td-cat-empty { padding: 18px 12px; text-align: center; color: var(--ink-3); font-size: 13px; }

/* Learn / apply-to-similar callout */
.td-learn {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 11px 13px;
  background: var(--accent-soft);
  border: 1px solid color-mix(in oklch, var(--accent) 25%, transparent);
  border-radius: 10px;
  margin-top: 10px;
  cursor: pointer;
}
.td-learn input { margin: 2px 0 0; accent-color: var(--accent); flex-shrink: 0; }
.td-learn-text { flex: 1; min-width: 0; }
.td-learn-title { font-size: 13px; font-weight: 500; color: var(--accent-ink); }
.td-learn-sub { font-size: 11.5px; color: var(--ink-2); margin-top: 2px; line-height: 1.4; }
.td-learn-sub .mono { font-size: 11px; padding: 0 4px; background: var(--bg-surface); border-radius: 3px; }

/* Notes textarea */
.td-notes {
  width: 100%;
  border: 1px solid var(--line-2);
  background: var(--bg-surface);
  border-radius: 8px; padding: 9px 11px;
  font-family: inherit; font-size: 13.5px; color: var(--ink-1);
  resize: vertical; min-height: 56px;
  outline: none;
  line-height: 1.45;
}
.td-notes:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.td-notes::placeholder { color: var(--ink-4); }

/* Expandable section trigger */
.td-expand {
  display: flex; align-items: center; gap: 8px;
  width: 100%;
  padding: 12px 0;
  margin-top: 16px;
  border: none; background: none;
  border-top: 1px solid var(--line-1);
  font-family: inherit;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--ink-3);
  cursor: pointer;
}
.td-expand:hover { color: var(--ink-1); }
.td-expand .icon { transition: transform 0.15s; }
.td-expand[aria-expanded="true"] .icon { transform: rotate(180deg); color: var(--ink-1); }
.td-expand-meta {
  margin-left: auto;
  font-size: 11.5px; font-weight: 400;
  text-transform: none; letter-spacing: 0;
  color: var(--ink-4);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 60%;
}
.td-expand-body { padding: 4px 0 6px; }

/* Toggle row inside Advanced */
.td-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line-1);
}
.td-toggle-row:last-child { border-bottom: none; }
.td-toggle-lbl { font-size: 13.5px; font-weight: 500; color: var(--ink-1); }
.td-toggle-desc { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }

/* Original CSV row */
.td-orig {
  display: flex; gap: 10px; align-items: baseline;
  padding: 8px 11px;
  background: var(--bg-sunken);
  border-radius: 6px;
  margin-top: 10px;
}
.td-orig-label {
  font-size: 10px; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
  flex-shrink: 0;
}
.td-orig-text {
  font-size: 11.5px;
  color: var(--ink-2);
  font-family: var(--font-mono);
  word-break: break-all;
}

/* Similar transactions list */
.td-sim-list {
  border: 1px solid var(--line-1);
  border-radius: 10px;
  background: var(--bg-surface);
  overflow: hidden;
}
.td-sim-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line-1);
  font-size: 13px;
}
.td-sim-row:last-child { border-bottom: none; }
.td-sim-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.td-sim-text { flex: 1; min-width: 0; }
.td-sim-name {
  font-weight: 450; color: var(--ink-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.td-sim-meta { font-size: 11px; color: var(--ink-3); margin-top: 1px; }
.td-sim-amt {
  font-variant-numeric: tabular-nums;
  color: var(--ink-1); font-weight: 500;
  flex-shrink: 0;
}

/* Footer */
.td-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--line-1);
  background: var(--bg-sunken);
}
.td-delete {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  border: none; background: none;
  color: var(--ink-3); font-family: inherit; font-size: 13px;
  cursor: pointer; border-radius: 6px;
  font-weight: 500;
}
.td-delete:hover { color: var(--danger); background: var(--bg-hover); }
.td-foot-right { display: flex; align-items: center; gap: 8px; }
.td-kbd-hint {
  font-size: 11px; color: var(--ink-3);
  margin-right: 4px;
}
.td-kbd-hint .kbd { font-size: 10px; padding: 1px 5px; }

@media (max-width: 720px) {
  .drawer.drawer-edit { width: 100%; }
  .td-foot { flex-direction: column-reverse; align-items: stretch; gap: 8px; }
  .td-foot-right { flex-direction: row; }
  .td-kbd-hint { display: none; }
  .td-amt { font-size: 28px; }
}
```

---

## 3. JS — replace `openTxDrawer` and `closeTxDrawer` in `boreal/static/js/app.js`

Find the existing `openTxDrawer` (starts around line 1039) and the existing `closeTxDrawer`, and replace **both** with the block below. Everything else in `app.js` stays the same — helpers (`api`, `esc`, `icon`, `catColor`, `fmtCurrency`, `fmtDate`, `fmtDateLong`, `appConfirm`, `appPrompt`, `showToast`, `refreshMonths`, `refreshCurrentView`) are already in the file.

```js
// ══════════════════════════════════════════════════════════════
// TRANSACTION EDIT DRAWER v2
// ══════════════════════════════════════════════════════════════
function openTxDrawer(tx, cats, onSave) {
  // Ensure overlay + drawer root exist
  let overlay = document.getElementById('drawer-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'drawer-overlay';
    overlay.className = 'drawer-overlay';
    document.body.appendChild(overlay);
  }
  let drawer = document.getElementById('tx-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'tx-drawer';
    document.body.appendChild(drawer);
  }
  drawer.className = 'drawer drawer-edit';

  // ── Static facts ─────────────────────────────────────────
  const amt = tx.amount || 0;
  const isInc = tx.type === 'Income';
  const initialCat = tx.category || 'Uncategorized';
  const initial = ((tx.name || '?').trim()[0] || '?').toUpperCase();

  // Category grouping. The repo's categories are strings; group them
  // heuristically. Adjust this map if you store group metadata.
  const ESSENTIAL = new Set([
    'Groceries', 'Transport', 'Transportation', 'Fuel',
    'Rent & Housing', 'Rent', 'Utilities', 'Phone & Internet', 'Health',
  ]);
  const INCOME = new Set(['Income', 'Salary', 'Paycheque', 'Freelance']);
  function groupFor(name) {
    if (ESSENTIAL.has(name)) return 'Essentials';
    if (INCOME.has(name))    return 'Income';
    if (name === 'Transfer') return 'Hidden';
    return 'Lifestyle';
  }
  const visibleCats = (cats || []).filter(c => groupFor(c) !== 'Hidden');

  // ── Editable state ───────────────────────────────────────
  const state = {
    cat: initialCat,
    name: tx.name || '',
    notes: tx.notes || '',
    account: tx.account || '',
    date: tx.date || '',
    hidden: !!tx.hidden,
    applyToSim: true,
    showPicker: false,
    catSearch: '',
    showDetails: false,
    showAdvanced: false,
  };
  let accountsList = [];
  let similarTxns = [];

  // ── Render ───────────────────────────────────────────────
  function render() {
    const catColorVal = catColor(state.cat);
    const catGroup = groupFor(state.cat);
    const catChanged = state.cat !== initialCat;
    const merchantFirst = (state.name || '').split(' ')[0];
    const simNeedingRecat = similarTxns.filter(t => t.category !== state.cat);

    // Filter + group for picker
    const filtered = state.catSearch
      ? visibleCats.filter(c => c.toLowerCase().includes(state.catSearch.toLowerCase()))
      : visibleCats;
    const grouped = {};
    filtered.forEach(c => { const g = groupFor(c); (grouped[g] = grouped[g] || []).push(c); });
    const groupOrder = ['Essentials', 'Lifestyle', 'Income'];

    drawer.innerHTML = `
      <div class="td-head">
        <div class="td-head-glyph" style="background:${catColorVal}1f;color:${catColorVal};border-color:${catColorVal}40">${esc(initial)}</div>
        <div class="td-head-text">
          <input class="td-head-name" id="dr-name" value="${esc(state.name)}" spellcheck="false" aria-label="Merchant name"/>
          <div class="td-head-sub">${esc(fmtDateLong(state.date))}<span class="td-dot">·</span>${esc(state.account || '—')}</div>
        </div>
        <button class="icon-btn" onclick="closeTxDrawer()" aria-label="Close">${icon('x', 14)}</button>
      </div>

      <div class="drawer-body td-body">
        <div class="td-amt-row">
          <div class="td-amt" style="color:${isInc ? 'var(--pos)' : 'var(--ink-1)'}">${isInc ? '+' : '−'}${fmtCurrency(Math.abs(amt))}</div>
          <div class="td-amt-type" style="background:${isInc ? 'var(--pos-soft)' : 'var(--bg-sunken)'};color:${isInc ? 'var(--pos)' : 'var(--ink-2)'}">${isInc ? 'Income' : 'Expense'}</div>
        </div>

        <div class="td-label">Category</div>
        ${state.showPicker ? `
          <div class="td-cat-picker">
            <div class="td-cat-search">
              ${icon('search', 14)}
              <input id="dr-cat-search" value="${esc(state.catSearch)}" placeholder="Search categories…" autofocus/>
              <button class="icon-btn" id="dr-cat-close">${icon('x', 12)}</button>
            </div>
            <div class="td-cat-list">
              ${groupOrder.map(g => grouped[g] ? `
                <div class="td-cat-group-label">${g}</div>
                ${grouped[g].map(c => `
                  <button class="td-cat-opt${c === state.cat ? ' is-selected' : ''}" data-cat="${esc(c)}">
                    <span class="td-cat-opt-icon" style="background:${catColor(c)}22;color:${catColor(c)}">${esc((c[0]||'?').toUpperCase())}</span>
                    <span class="td-cat-opt-name">${esc(c)}</span>
                    ${c === state.cat ? icon('check', 13) : ''}
                  </button>
                `).join('')}
              ` : '').join('')}
              ${Object.keys(grouped).length === 0 ? `<div class="td-cat-empty">No categories match "${esc(state.catSearch)}"</div>` : ''}
            </div>
          </div>
        ` : `
          <button class="td-cat-card" id="dr-cat-open">
            <span class="td-cat-icon" style="background:${catColorVal}24;color:${catColorVal};border-color:${catColorVal}40">${esc((state.cat[0]||'?').toUpperCase())}</span>
            <span class="td-cat-name">${esc(state.cat)}</span>
            <span class="td-cat-group">${catGroup}</span>
            <span class="td-cat-change">Change ${icon('chev_d', 11)}</span>
          </button>
        `}

        ${(catChanged && simNeedingRecat.length > 0) ? `
          <label class="td-learn">
            <input type="checkbox" id="dr-apply-sim" ${state.applyToSim ? 'checked' : ''}/>
            <div class="td-learn-text">
              <div class="td-learn-title">Apply to ${simNeedingRecat.length} similar transaction${simNeedingRecat.length === 1 ? '' : 's'}</div>
              <div class="td-learn-sub">Boreal will remember <span class="mono">"${esc(merchantFirst)}"</span> → ${esc(state.cat)}</div>
            </div>
          </label>
        ` : ''}

        <div class="td-label">Notes</div>
        <textarea class="td-notes" id="dr-notes" placeholder="Add a note (optional)…" rows="2">${esc(state.notes)}</textarea>

        <button class="td-expand" id="dr-toggle-details" aria-expanded="${state.showDetails}">
          ${icon('chev_d', 11)}
          <span>Date &amp; account</span>
          <span class="td-expand-meta">${esc(fmtDate(state.date))} · ${esc(state.account || '—')}</span>
        </button>
        ${state.showDetails ? `
          <div class="td-expand-body">
            <div class="row-2">
              <div class="field"><label>Date</label><input type="date" id="dr-date" value="${esc(state.date)}"/></div>
              <div class="field"><label>Account</label>
                <select id="dr-account">
                  ${accountsList.length
                    ? accountsList.map(a => `<option value="${esc(a.name)}" ${a.name === state.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')
                    : `<option value="${esc(state.account)}">${esc(state.account || '—')}</option>`}
                </select>
              </div>
            </div>
            ${(tx.original_name || tx.raw_description) ? `
              <div class="td-orig">
                <span class="td-orig-label">From bank</span>
                <span class="td-orig-text">${esc(tx.original_name || tx.raw_description)}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <button class="td-expand" id="dr-toggle-advanced" aria-expanded="${state.showAdvanced}">
          ${icon('chev_d', 11)}
          <span>Advanced</span>
          <span class="td-expand-meta">${state.hidden ? 'Hidden' : 'Visible'}</span>
        </button>
        ${state.showAdvanced ? `
          <div class="td-expand-body">
            <div class="td-toggle-row">
              <div>
                <div class="td-toggle-lbl">Hide from dashboard</div>
                <div class="td-toggle-desc">Removes from totals but keeps the record</div>
              </div>
              <label class="switch">
                <input type="checkbox" id="dr-hidden" ${state.hidden ? 'checked' : ''}/>
                <span class="slider"></span>
              </label>
            </div>
            <div class="td-toggle-row">
              <div>
                <div class="td-toggle-lbl">Split transaction</div>
                <div class="td-toggle-desc">Divide across multiple categories</div>
              </div>
              <button class="btn btn-sm" id="dr-split-btn">${icon('plus', 12)} Add split</button>
            </div>
          </div>
        ` : ''}

        ${similarTxns.length > 0 ? `
          <div class="td-label td-label-row">
            <span>Similar transactions</span>
            <span class="td-label-meta">${similarTxns.length} · total ${fmtCurrency(similarTxns.reduce((s, t) => s + Math.abs(t.amount || 0), 0))}</span>
          </div>
          <div class="td-sim-list">
            ${similarTxns.map(t => `
              <div class="td-sim-row">
                <span class="td-sim-dot" style="background:${catColor(t.category)}"></span>
                <div class="td-sim-text">
                  <div class="td-sim-name">${esc(t.name)}</div>
                  <div class="td-sim-meta">${esc(fmtDate(t.date))} · ${esc(t.category || 'Uncategorized')}</div>
                </div>
                <div class="td-sim-amt mono">${(t.amount || 0) > 0 ? '+' : '−'}${fmtCurrency(Math.abs(t.amount || 0))}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="td-foot">
        <button class="td-delete" id="dr-del">${icon('trash', 13)} Delete</button>
        <div class="td-foot-right">
          <span class="td-kbd-hint"><span class="kbd">⌘S</span> save · <span class="kbd">esc</span> close</span>
          <button class="btn" onclick="closeTxDrawer()">Cancel</button>
          <button class="btn btn-primary" id="dr-save">Save changes</button>
        </div>
      </div>
    `;

    wireEvents();
  }

  function wireEvents() {
    drawer.querySelector('#dr-name')?.addEventListener('input', e => { state.name = e.target.value; });
    drawer.querySelector('#dr-notes')?.addEventListener('input', e => { state.notes = e.target.value; });
    drawer.querySelector('#dr-date')?.addEventListener('input', e => { state.date = e.target.value; });
    drawer.querySelector('#dr-account')?.addEventListener('change', e => { state.account = e.target.value; });
    drawer.querySelector('#dr-hidden')?.addEventListener('change', e => { state.hidden = e.target.checked; });
    drawer.querySelector('#dr-apply-sim')?.addEventListener('change', e => { state.applyToSim = e.target.checked; });

    // Category picker
    drawer.querySelector('#dr-cat-open')?.addEventListener('click', () => { state.showPicker = true; render(); });
    drawer.querySelector('#dr-cat-close')?.addEventListener('click', () => { state.showPicker = false; state.catSearch = ''; render(); });

    const searchInput = drawer.querySelector('#dr-cat-search');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.catSearch = e.target.value;
        const cursor = e.target.selectionStart;
        render();
        const fresh = drawer.querySelector('#dr-cat-search');
        if (fresh) { fresh.focus(); fresh.setSelectionRange(cursor, cursor); }
      });
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') { state.showPicker = false; state.catSearch = ''; render(); }
      });
    }
    drawer.querySelectorAll('.td-cat-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cat = btn.dataset.cat;
        state.showPicker = false;
        state.catSearch = '';
        render();
      });
    });

    // Expandables
    drawer.querySelector('#dr-toggle-details')?.addEventListener('click', () => { state.showDetails = !state.showDetails; render(); });
    drawer.querySelector('#dr-toggle-advanced')?.addEventListener('click', () => { state.showAdvanced = !state.showAdvanced; render(); });

    drawer.querySelector('#dr-save')?.addEventListener('click', save);
    drawer.querySelector('#dr-del')?.addEventListener('click', del);
    drawer.querySelector('#dr-split-btn')?.addEventListener('click', split);
  }

  async function save() {
    const wasHidden = !!tx.hidden;
    await api(`/api/update/${tx.id}`, 'PATCH', {
      category: state.cat,
      name: state.name,
      notes: state.notes,
      account: state.account,
      date: state.date,
    });
    if (state.hidden !== wasHidden) {
      await api(`/api/transactions/${tx.id}/${state.hidden ? 'hide' : 'unhide'}`, 'PATCH');
    }
    // Retroactive learning: apply new category to similar transactions
    if (state.applyToSim && state.cat !== initialCat) {
      const ids = similarTxns.filter(t => t.category !== state.cat).map(t => t.id);
      if (ids.length) {
        await api('/api/bulk-categorize', 'POST', { ids, category: state.cat });
      }
    }
    closeTxDrawer();
    await refreshMonths();
    if (onSave) onSave();
    else refreshCurrentView();
  }

  async function del() {
    if (!await appConfirm('Delete this transaction permanently?', { title: 'Delete transaction', danger: true })) return;
    await api(`/api/delete/${tx.id}`, 'DELETE');
    closeTxDrawer();
    await refreshMonths();
    refreshCurrentView();
  }

  async function split() {
    const splitAmt = await appPrompt('Enter amount for the split:', {
      title: 'Split transaction',
      defaultVal: (Math.abs(amt) / 2).toFixed(2),
      placeholder: '0.00',
    });
    if (!splitAmt) return;
    await api(`/api/transactions/${tx.id}/split`, 'POST', { amount: parseFloat(splitAmt) });
    showToast('Transaction split');
    closeTxDrawer();
    refreshCurrentView();
  }

  // Mount
  render();
  overlay.classList.add('open');
  drawer.classList.add('open');
  overlay.onclick = () => closeTxDrawer();

  // Keyboard shortcuts (⌘/Ctrl + S to save, Esc to close / dismiss picker)
  const onKey = (e) => {
    if (e.key === 'Escape') {
      if (state.showPicker) { state.showPicker = false; state.catSearch = ''; render(); }
      else closeTxDrawer();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };
  window.addEventListener('keydown', onKey);
  drawer._removeKeys = () => window.removeEventListener('keydown', onKey);

  // Lazy-load accounts (only meaningful when Details is open, but cheap)
  api('/api/accounts-list').then(accts => {
    accountsList = accts || [];
    if (state.showDetails) render();
  });

  // Lazy-load similar transactions (same merchant first token, excluding self)
  const firstName = (tx.name || '').split(' ')[0].toLowerCase();
  if (firstName) {
    api('/api/transactions?limit=200').then(resp => {
      const txns = resp?.transactions || resp || [];
      similarTxns = txns
        .filter(t => t.id !== tx.id && (t.name || '').split(' ')[0].toLowerCase() === firstName)
        .slice(0, 6);
      render();
    });
  }
}

function closeTxDrawer() {
  const drawer = document.getElementById('tx-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) {
    drawer.classList.remove('open');
    drawer._removeKeys?.();
    drawer._removeKeys = null;
  }
  if (overlay) overlay.classList.remove('open');
}
```

---

## Notes for the repo agent

- **Categories without group metadata.** The repo currently passes categories as plain strings to `openTxDrawer`. The new code groups them with a small heuristic (`ESSENTIAL` / `INCOME` sets) — if you've added a `group` field to categories upstream, replace `groupFor()` with a lookup against the real metadata.
- **`/api/bulk-categorize` for retroactive learning.** Already exists in the repo (used by Transactions bulk actions). The drawer reuses it.
- **`tx.original_name` / `tx.raw_description`.** The "From bank" row only renders if one of these is on the transaction object. If neither is exposed by the API, the row is omitted — no error. If you want to surface it, plumb it from the CSV import to the transaction record.
- **Picker icon glyph.** Each category option shows the uppercase first letter of the category name as its glyph (since the repo's categories are strings without icons). If you've added an `icon` field (emoji) per category, swap the `<span class="td-cat-opt-icon">` content for that icon.
- **Animation removed deliberately.** The base `.drawer { animation: slidein 0.22s }` rule is overridden on `.drawer.drawer-edit` to `animation: none` so the drawer doesn't blink on each `render()` call (every state change re-mounts the innerHTML). If you want a one-time entrance animation, do it on the overlay opening, not on the drawer body.
- **Re-render strategy.** Every state change calls `render()`, which rewrites `drawer.innerHTML`. This destroys input focus, so the category search field manually restores its caret. If you find this too coarse, switch to targeted DOM updates — but the current approach is plenty fast for a single drawer.
- **`closeTxDrawer` must remove the keydown listener.** The new function does this via the `drawer._removeKeys` reference. If you ever close the drawer through some other path (e.g. on route change), call `closeTxDrawer()` instead of just hiding the element, or the global keydown listener will leak.
- **Width and breakpoint.** `.drawer.drawer-edit { width: 480px }` intentionally uses higher specificity than the existing `@media (max-width: 1100px) .drawer { width: 100% }` so the drawer stays a real side panel on tablet widths. Only at `≤720px` does it go full-screen.

---

## Files touched in this design pass

- `boreal/static/css/style.css` — append the CSS block above (no existing CSS modified)
- `boreal/static/js/app.js` — replace `openTxDrawer` and `closeTxDrawer` (everything else untouched)

That's it. No template, route, or backend changes required.
