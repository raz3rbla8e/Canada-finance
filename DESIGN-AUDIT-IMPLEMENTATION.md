# Boreal — design audit implementation guide

This document is the **executable companion** to `Design Audit.html`. It tells the repo agent exactly what to change, where, and how. Same style as the existing `DRAWER-CHANGES.md`: UX intent → exact CSS → exact JS.

Every case is independently shippable. Pick them off in any order, but the suggested order at the bottom maximizes return per unit of work.

---

## How to read this doc

For each case you'll find three sections:

1. **UX intent** — a "before / after" table summarizing the change, so you can sanity-check that the implementation matches the design call.
2. **CSS** — exact rules to append (or replace) in `boreal/static/css/style.css`. Every new class is scoped so nothing existing breaks. Look for the `/* ============ … ============ */` banner that introduces each block.
3. **JS** — exact patches to apply to `boreal/static/js/app.js`. When a function gets replaced wholesale, the case shows the full new function and tells you which lines to remove. When only a snippet changes, the patch uses unambiguous "find → replace" anchors.

**Conventions used below:**

- `→ append` means add to the end of the relevant block of the file.
- `→ replace function X` means delete the existing `function X(...) { ... }` and paste the new one in its place.
- All token references (`var(--accent)`, `var(--ink-1)`, etc.) are already defined in the design system — don't introduce new tokens.
- The helpers `api`, `esc`, `icon`, `catColor`, `fmtCurrency`, `fmtDate`, `merchantGlyph`, `appConfirm`, `showToast`, `invalidateApiCache`, `refreshMonths`, `refreshCurrentView`, `openTxDrawer`, `openAddModal`, `currentMonth`, `navigateTo` already exist — use them, don't re-implement them.

---

## Files touched

| File | Changes |
|---|---|
| `boreal/static/css/style.css` | Append CSS blocks for Cases 01–11 + quick-hit token tweaks. No existing rules removed except where explicitly noted. |
| `boreal/static/js/app.js` | Replace 3 functions wholesale (`_renderTransactions` filter row, `_renderDashboard`, `catPill`), patch 7 inline blocks. |
| `boreal/templates/index.html` | Patch the topbar markup (Case 08), drop the sidebar version subtitle (quick hit). |

No template, route, or backend changes required beyond those three files. The existing API surface covers everything.

---

# CASE 01 — Transactions filter row

**Severity:** High. **Files:** `style.css`, `app.js`. **Functions touched:** `_renderTransactions` (filter-row markup + filter state + render).

## UX intent

| Region | Before | After |
|---|---|---|
| **Filter row** | Search + account chip row + icon-button "Hidden" toggle + native `<select>` with dashed border for Category. Three different control idioms in one row. | One filter-pill grammar: each active filter is a removable pill with a searchable popover. "Add filter +" pill grows the row. Hidden/Visible becomes a segmented toggle on the right. |
| **Active state** | Filter chips invert to `var(--ink-1)` (black) with white text — too heavy for a 12-px control. | Each active pill shows its icon, field label, and colored value with a tiny `×` to clear. |
| **Category picker** | Browser-native dropdown — wrong fonts, scrollbar, hit area. No search inside. | Same searchable popover pattern as the drawer's category picker (reuse the `td-cat-*` aesthetic, but standalone here). |
| **Account selection** | One chip per account in a flex row — wraps once you have >5 accounts. | Single "Account" pill; click to multi-select inside the popover. |
| **View mode** | "Hidden" icon-button mixed in with filters. | Segmented control labeled `Visible` / `Hidden` on the far right — separated semantically because it changes the dataset, not filters it. |
| **Result summary** | "Showing N of N" below the table in muted text. | Thin info row directly under the filter row: `142 matched · $3,840 in · $2,196 out`. Adds a `Save as view` link for power users. |

## CSS — append to `style.css`

Insert just before the `/* RESPONSIVE */` block.

```css
/* ============================================================
   CASE 01 — Unified filter row (Transactions)
   ============================================================ */
.tx-tools {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  margin-bottom: 8px;
}
.tx-tools .searchbox { flex: 1; min-width: 220px; max-width: 320px; }
.tx-tools .tools-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.tx-summary {
  display: flex; gap: 14px; align-items: center;
  font-size: 11.5px; color: var(--ink-3);
  padding: 4px 2px 14px;
}
.tx-summary strong { color: var(--ink-1); font-weight: 500; }
.tx-summary .save-view {
  margin-left: auto; color: var(--accent); font-weight: 500;
  background: none; border: none; cursor: pointer; font-family: inherit;
  font-size: 12px; padding: 0;
}
.tx-summary .save-view:hover { color: var(--accent-ink); text-decoration: underline; }

/* Filter pill */
.fpill {
  display: inline-flex; align-items: center; height: 30px;
  border-radius: 8px; border: 1px solid var(--line-1);
  background: var(--bg-surface); font-size: 12.5px; font-family: inherit;
  cursor: pointer; overflow: hidden; padding: 0;
  color: var(--ink-1);
  transition: border-color 0.12s;
}
.fpill:hover { border-color: var(--line-strong); }
.fpill > .label {
  padding: 0 8px 0 10px; color: var(--ink-3); font-weight: 500;
  display: inline-flex; align-items: center; gap: 6px;
}
.fpill > .value {
  padding: 0 10px 0 8px; color: var(--ink-1); font-weight: 500;
  border-left: 1px solid var(--line-1);
  height: 100%;
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;
}
.fpill > .value .swatch { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.fpill > .x {
  width: 26px; height: 100%;
  border: none; border-left: 1px solid var(--line-1); background: none;
  display: grid; place-items: center;
  color: var(--ink-3); cursor: pointer;
  font-size: 14px; line-height: 1;
}
.fpill > .x:hover { background: var(--bg-hover); color: var(--ink-1); }
.fpill.add {
  border-style: dashed; color: var(--ink-3);
  padding: 0 10px;
}
.fpill.add:hover { color: var(--ink-1); border-color: var(--line-strong); }

/* Popover */
.fpop { position: relative; }
.fpop-panel {
  position: absolute; top: calc(100% + 6px); left: 0;
  width: 260px; background: var(--bg-surface);
  border: 1px solid var(--line-1); border-radius: 10px;
  box-shadow: var(--shadow-lg);
  z-index: 30; padding: 6px;
  display: none;
}
.fpop.open .fpop-panel { display: block; }
.fpop-search {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-bottom: 1px solid var(--line-1);
  margin: -6px -6px 4px;
  color: var(--ink-3);
}
.fpop-search input {
  flex: 1; border: none; outline: none; background: none;
  font-size: 13px; font-family: inherit; color: var(--ink-1);
}
.fpop-group {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ink-4); font-weight: 600;
  padding: 8px 10px 4px;
}
.fpop-opt {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
  font-size: 13px; color: var(--ink-1);
  font-family: inherit; border: none; background: none; text-align: left;
}
.fpop-opt:hover { background: var(--bg-hover); }
.fpop-opt.sel { background: var(--accent-soft); color: var(--accent-ink); }
.fpop-opt .sw { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.fpop-opt .ck { margin-left: auto; opacity: 0; }
.fpop-opt.sel .ck { opacity: 1; }
.fpop-empty { padding: 14px 12px; text-align: center; color: var(--ink-3); font-size: 12.5px; }

/* Segmented control (Visible / Hidden) */
.seg {
  display: inline-flex; border: 1px solid var(--line-1);
  border-radius: 8px; overflow: hidden; height: 30px;
}
.seg button {
  border: none; background: none; padding: 0 12px;
  font-size: 12px; color: var(--ink-3);
  font-family: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
}
.seg button.on { background: var(--bg-sunken); color: var(--ink-1); font-weight: 500; }
.seg button + button { border-left: 1px solid var(--line-1); }
.seg button:hover:not(.on) { background: var(--bg-hover); color: var(--ink-1); }
```

## JS — patch in `_renderTransactions` (≈ l. 858)

The function is large; only the filter row markup + its supporting state + the `getFiltered` function change. Anchors below are unambiguous source strings — find and replace, do not reshuffle.

### 1. Replace the filter-row block

**Find** (the `<div style="display:flex;gap:10px;align-items:center;margin-bottom:14px…">` ending just before `<div id="tx-bulk-bar"…>`):

```html
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <div class="searchbox">
        ${icon('search',14)}
        <input id="tx-search" type="text" placeholder="Search…">
        <span class="kbd">/</span>
      </div>
      <div class="chip-row">
        <button class="filter-chip active" data-acct="">All accounts</button>
        ${accts.map(a => `<button class="filter-chip" data-acct="${esc(a)}">${esc(a)}</button>`).join('')}
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
        <button class="btn btn-sm" id="tx-toggle-hidden" style="font-size:12px;padding:5px 10px">${icon('eye_off',12)} Hidden</button>
        <select id="tx-cat-filter" class="btn btn-sm" style="border-style:dashed;padding:5px 10px;font-size:12px;background:var(--bg-surface);color:var(--ink-2);cursor:pointer">
          <option value="">Category</option>
          <option value="Uncategorized">Uncategorized</option>
          ${allCats.filter(c => c !== 'Uncategorized').map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
      </div>
    </div>
```

**Replace with:**

```html
    <div class="tx-tools">
      <div class="searchbox">
        ${icon('search',14)}
        <input id="tx-search" type="text" placeholder="Search transactions…">
        <span class="kbd">/</span>
      </div>
      <div id="tx-filter-pills" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      <button class="fpill add" id="tx-add-filter">
        ${icon('plus', 11)} Add filter
      </button>
      <div class="tools-right">
        <div class="seg" id="tx-view-seg">
          <button class="on" data-view="visible">${icon('eye', 12)} Visible</button>
          <button data-view="hidden">${icon('eye_off', 12)} Hidden</button>
        </div>
      </div>
    </div>
    <div class="tx-summary" id="tx-summary"></div>
```

### 2. Replace the filter state + `getFiltered` block

**Find** (immediately after `c.innerHTML = …` ends, the block starting with `const tbody = document.getElementById('tx-body')`):

```js
  const tbody = document.getElementById('tx-body');
  const searchInput = document.getElementById('tx-search');
  const catFilter = document.getElementById('tx-cat-filter');
  const checkAll = document.getElementById('tx-check-all');
  let activeAcct = '';

  // Account filter chips
  document.querySelectorAll('.filter-chip[data-acct]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-acct]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeAcct = chip.dataset.acct;
      refresh();
    });
  });
```

**Replace with:**

```js
  const tbody = document.getElementById('tx-body');
  const searchInput = document.getElementById('tx-search');
  const checkAll = document.getElementById('tx-check-all');
  const pillsHost = document.getElementById('tx-filter-pills');
  const summaryHost = document.getElementById('tx-summary');
  const addFilterBtn = document.getElementById('tx-add-filter');
  const viewSeg = document.getElementById('tx-view-seg');

  // Unified filter state: each active filter is an object { kind, value }.
  // kind ∈ { 'accounts', 'category' }. `value` is array for multi (accounts) or string (category).
  const filterState = { accounts: [], category: '' };
  let viewMode = 'visible';

  function renderPills() {
    const items = [];
    if (filterState.accounts.length) {
      const label = filterState.accounts.length === 1
        ? filterState.accounts[0]
        : `${filterState.accounts.length} accounts`;
      items.push({ kind: 'accounts', icon: icon('wallet', 11), label: 'Account', value: label, swatch: null });
    }
    if (filterState.category) {
      items.push({ kind: 'category', icon: icon('tag', 11), label: 'Category', value: filterState.category, swatch: catColor(filterState.category) });
    }
    pillsHost.innerHTML = items.map(it => `
      <div class="fpop" data-kind="${it.kind}">
        <button class="fpill" data-action="open">
          <span class="label">${it.icon} ${esc(it.label)}</span>
          <span class="value">${it.swatch ? `<span class="swatch" style="background:${it.swatch}"></span>` : ''}${esc(it.value)}</span>
          <button class="x" data-action="clear" title="Clear">×</button>
        </button>
      </div>
    `).join('');
  }

  function openFilterPopover(kind, anchor) {
    // Close any existing popover
    document.querySelectorAll('.fpop.open .fpop-panel').forEach(p => p.parentElement.classList.remove('open'));
    document.querySelectorAll('#tx-add-filter-pop').forEach(p => p.remove());

    const host = anchor.closest('.fpop') || anchor.parentElement;
    const panel = document.createElement('div');
    panel.className = 'fpop-panel';
    panel.id = 'tx-pop-' + kind;

    if (kind === 'accounts') {
      panel.innerHTML = `
        <div class="fpop-search">${icon('search', 12)}<input placeholder="Filter accounts…" autofocus></div>
        ${accts.map(a => `
          <button class="fpop-opt ${filterState.accounts.includes(a) ? 'sel' : ''}" data-acct="${esc(a)}">
            <span class="sw" style="background:${acctColor({ name: a })}"></span>
            ${esc(a)}
            <span class="ck">${icon('check', 13)}</span>
          </button>
        `).join('')}
      `;
    } else if (kind === 'category') {
      const cats = ['Uncategorized', ...allCats.filter(c => c !== 'Uncategorized')];
      panel.innerHTML = `
        <div class="fpop-search">${icon('search', 12)}<input placeholder="Filter categories…" autofocus></div>
        <div id="tx-cat-opts">
          ${cats.map(c => `
            <button class="fpop-opt ${filterState.category === c ? 'sel' : ''}" data-cat="${esc(c)}">
              <span class="sw" style="background:${catColor(c)}"></span>
              ${esc(c)}
              <span class="ck">${icon('check', 13)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    host.appendChild(panel);
    host.classList.add('open');

    // Wire popover events
    panel.querySelector('.fpop-search input')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      panel.querySelectorAll('.fpop-opt').forEach(o => {
        o.style.display = o.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    panel.querySelectorAll('.fpop-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        if (kind === 'accounts') {
          const a = opt.dataset.acct;
          if (filterState.accounts.includes(a)) {
            filterState.accounts = filterState.accounts.filter(x => x !== a);
          } else {
            filterState.accounts.push(a);
          }
          opt.classList.toggle('sel');
        } else if (kind === 'category') {
          filterState.category = filterState.category === opt.dataset.cat ? '' : opt.dataset.cat;
          host.classList.remove('open');
        }
        renderPills();
        refresh();
      });
    });
  }

  function openAddFilterMenu(anchor) {
    document.querySelectorAll('.fpop.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('#tx-add-filter-pop').forEach(p => p.remove());
    const panel = document.createElement('div');
    panel.className = 'fpop-panel';
    panel.id = 'tx-add-filter-pop';
    panel.style.cssText = 'display:block;position:absolute;top:calc(100% + 6px);left:0;width:200px';
    panel.innerHTML = `
      <div class="fpop-group">Filter by</div>
      <button class="fpop-opt" data-kind="accounts">${icon('wallet', 13)} Account ${filterState.accounts.length ? `<span class="ck" style="opacity:1">✓</span>` : ''}</button>
      <button class="fpop-opt" data-kind="category">${icon('tag', 13)} Category ${filterState.category ? `<span class="ck" style="opacity:1">✓</span>` : ''}</button>
    `;
    const wrap = document.createElement('div');
    wrap.className = 'fpop open';
    wrap.style.cssText = 'position:relative;display:inline-block';
    anchor.replaceWith(wrap);
    wrap.appendChild(anchor);
    wrap.appendChild(panel);
    panel.querySelectorAll('.fpop-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const kind = opt.dataset.kind;
        wrap.classList.remove('open');
        panel.remove();
        // Materialize a pill if it doesn't exist, then open its popover
        if (kind === 'accounts' && !filterState.accounts.length) filterState.accounts = [accts[0]];
        if (kind === 'category' && !filterState.category) filterState.category = (allCats[0] || '');
        renderPills();
        const newPill = pillsHost.querySelector(`.fpop[data-kind="${kind}"]`);
        if (newPill) openFilterPopover(kind, newPill.querySelector('.fpill'));
        refresh();
      });
    });
  }

  // Click handlers on pill host
  pillsHost.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const host = e.target.closest('.fpop');
    if (!host) return;
    if (action === 'clear') {
      e.stopPropagation();
      const kind = host.dataset.kind;
      if (kind === 'accounts') filterState.accounts = [];
      if (kind === 'category') filterState.category = '';
      renderPills(); refresh();
      return;
    }
    if (action === 'open') {
      const kind = host.dataset.kind;
      if (host.classList.contains('open')) { host.classList.remove('open'); return; }
      openFilterPopover(kind, e.target);
    }
  });

  addFilterBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    openAddFilterMenu(addFilterBtn);
  });

  // Close popovers on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fpop, #tx-add-filter')) {
      document.querySelectorAll('.fpop.open').forEach(p => p.classList.remove('open'));
      document.querySelectorAll('#tx-add-filter-pop').forEach(p => p.remove());
    }
  });

  // View segment (Visible / Hidden) — same behaviour as old `tx-toggle-hidden` button
  viewSeg?.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', async () => {
      if (b.classList.contains('on')) return;
      viewSeg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      viewMode = b.dataset.view;
      const p = new URLSearchParams();
      if (month) p.set('month', month);
      p.set('limit', '200');
      if (viewMode === 'hidden') p.set('hidden', '1');
      invalidateApiCache('/api/transactions');
      const fresh = await api(`/api/transactions?${p}`);
      const items = [...(fresh?.transactions || fresh || [])];
      txns.length = 0; items.forEach(t => txns.push(t));
      txSelected = new Set();
      refresh(); updateBulkBar();
    });
  });
```

### 3. Replace `getFiltered`

**Find:**

```js
  function getFiltered() {
    const q = (searchInput?.value||'').toLowerCase();
    const cat = catFilter?.value||'';
    return txns.filter(t => {
      if (q && !(t.name||'').toLowerCase().includes(q) && !(t.category||'').toLowerCase().includes(q) && !(t.notes||'').toLowerCase().includes(q)) return false;
      if (cat) {
        const txCat = t.category || 'Uncategorized';
        if (txCat.toLowerCase() !== cat.toLowerCase()) return false;
      }
      if (activeAcct && t.account !== activeAcct) return false;
      return true;
    });
  }
```

**Replace with:**

```js
  function getFiltered() {
    const q = (searchInput?.value||'').toLowerCase();
    return txns.filter(t => {
      if (q && !(t.name||'').toLowerCase().includes(q) && !(t.category||'').toLowerCase().includes(q) && !(t.notes||'').toLowerCase().includes(q)) return false;
      if (filterState.category) {
        const txCat = t.category || 'Uncategorized';
        if (txCat.toLowerCase() !== filterState.category.toLowerCase()) return false;
      }
      if (filterState.accounts.length && !filterState.accounts.includes(t.account)) return false;
      return true;
    });
  }
```

### 4. Update `refresh` to write the summary row

**Find:**

```js
  function refresh() {
    const filtered = getFiltered();
    renderRows(filtered);
    const showingEl = document.getElementById('tx-showing');
    if (showingEl) showingEl.textContent = filtered.length;
  }
```

**Replace with:**

```js
  function refresh() {
    const filtered = getFiltered();
    renderRows(filtered);
    const showingEl = document.getElementById('tx-showing');
    if (showingEl) showingEl.textContent = filtered.length;
    if (summaryHost) {
      const inSum = filtered.filter(t => t.type === 'Income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
      const outSum = filtered.filter(t => t.type !== 'Income').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
      summaryHost.innerHTML = `
        <span><strong>${filtered.length}</strong> matched</span>
        <span style="color:var(--pos)">${fmtCurrency(inSum)} in</span>
        <span>${fmtCurrency(outSum)} out</span>
        <button class="save-view" onclick="showToast('View saved (stub)')">${icon('bookmark', 11)} Save as view</button>
      `;
    }
  }
```

### 5. Remove the old `catFilter`-related code

In the same function, delete this listener (the new code doesn't use it):

```js
  catFilter?.addEventListener('change', refresh);
```

And delete the entire `viewingHidden` / `toggleHiddenBtn` block (the `Visible`/`Hidden` segmented control replaces it):

```js
  let viewingHidden = false;
  const toggleHiddenBtn = document.getElementById('tx-toggle-hidden');
  ...
  toggleHiddenBtn?.addEventListener('click', async () => { ... });
```

### 6. Initial pills render

At the very end of the function, before the closing `}`, add:

```js
  renderPills();
```

### 7. Add icon names

If `icon('wallet')`, `icon('tag')`, or `icon('bookmark')` aren't already registered in the `ICONS` map at the top of `app.js`, add:

```js
wallet:    '<path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h12"/><circle cx="17" cy="13" r="1.2"/>',
tag:       '<path d="M20 12V5h-7L3 15l6 6 11-9z"/><circle cx="15" cy="9" r="1.2"/>',
bookmark:  '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
```

---

# CASE 02 — Bulk-action bar → floating dock

**Severity:** Medium. **Files:** `style.css`, `app.js`. **Functions touched:** the `<div id="tx-bulk-bar">` markup in `_renderTransactions` + `updateBulkBar`.

## UX intent

| Region | Before | After |
|---|---|---|
| **Form factor** | Inline horizontal strip at top of table — pushes content down on selection. | Pill-shaped floating dock at bottom-center, same vocabulary as the existing undo toast. |
| **Background** | `var(--ink-1)` (pure black) on white — extreme contrast in a muted palette. | Same as undo toast, with rgba mixes pulled into proper tokens. |
| **Buttons** | Ad-hoc white-on-transparent borders that exist nowhere else. | `.pchip` — reusable action-pill class shared with the undo toast. |
| **Behavior** | Appears via `display:none ↔ flex` swap. | Fades + slides up like the undo toast, same animation. |

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 02 — Floating bulk-action dock
   ============================================================ */
.bulk-dock {
  position: fixed;
  bottom: max(24px, env(safe-area-inset-bottom, 24px));
  left: 50%; transform: translateX(-50%) translateY(20px);
  background: var(--ink-1); color: var(--bg-surface);
  border-radius: 999px; padding: 6px 6px 6px 16px;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; box-shadow: var(--shadow-lg);
  z-index: 90; opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s, transform 0.18s cubic-bezier(.2,.7,.2,1);
}
.bulk-dock.open {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
.bulk-dock .count {
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 500;
}
.bulk-dock .num-badge {
  background: oklch(100% 0 0 / 0.18);
  padding: 2px 9px; border-radius: 999px;
  font-variant-numeric: tabular-nums;
  font-size: 11.5px; font-weight: 600;
}
.bulk-dock .sep {
  width: 1px; height: 18px;
  background: oklch(100% 0 0 / 0.18);
  margin: 0 4px;
}
.bulk-dock .pchip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px;
  background: oklch(100% 0 0 / 0.10); color: var(--bg-surface);
  font-size: 12.5px; font-family: inherit; cursor: pointer;
  border: none;
}
.bulk-dock .pchip:hover { background: oklch(100% 0 0 / 0.20); }
.bulk-dock .pchip.primary { background: oklch(100% 0 0 / 0.18); }
.bulk-dock .pchip.danger { color: oklch(72% 0.13 28); }
.bulk-dock .pchip.danger:hover { background: oklch(72% 0.13 28 / 0.18); }
.bulk-dock .pchip.close { padding: 6px 9px; }

/* If undo toast and bulk dock are both visible, stagger them */
.undo-toast { bottom: max(24px, env(safe-area-inset-bottom, 24px)); }
.bulk-dock.open + .undo-toast,
body:has(.bulk-dock.open) .undo-toast { bottom: 88px; }
```

## JS — in `_renderTransactions`

### 1. Replace the inline bulk-bar div

**Find:**

```html
    <div id="tx-bulk-bar" style="display:none;background:var(--ink-1);color:white;padding:10px 16px;border-radius:10px;margin-bottom:12px;align-items:center;gap:12px;font-size:13px">
      <span><strong id="tx-sel-count">0</strong> selected</span>
      <button class="btn btn-sm" style="color:white;border-color:rgba(255,255,255,0.3)" onclick="txBulkAction('categorize')">Categorize</button>
      <button class="btn btn-sm" id="tx-bulk-hide-btn" style="color:white;border-color:rgba(255,255,255,0.3)" onclick="txBulkAction('hide')">Hide</button>
      <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="txBulkAction('delete')">Delete</button>
      <button class="btn btn-sm" style="color:white;border-color:rgba(255,255,255,0.3);margin-left:auto" onclick="txSelected=new Set();refresh();updateBulkBar()">Clear</button>
    </div>
```

**Replace with:** *(no markup; the dock is mounted dynamically and lives outside the page container so it survives view switches)*

```html
<!-- Bulk dock mounted dynamically — see updateBulkBar() -->
```

### 2. Replace `updateBulkBar`

**Find the existing function** (toward the end of `_renderTransactions`):

```js
  function updateBulkBar() { ... }
```

**Replace with:**

```js
  function updateBulkBar() {
    let dock = document.getElementById('bulk-dock');
    if (!txSelected.size) {
      dock?.classList.remove('open');
      return;
    }
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'bulk-dock';
      dock.className = 'bulk-dock';
      document.body.appendChild(dock);
    }
    const hideLabel = viewMode === 'hidden' ? 'Unhide' : 'Hide';
    const hideAction = viewMode === 'hidden' ? 'unhide' : 'hide';
    dock.innerHTML = `
      <span class="count"><span class="num-badge">${txSelected.size}</span> selected</span>
      <span class="sep"></span>
      <button class="pchip" data-action="categorize">${icon('tag', 11)} Categorize</button>
      <button class="pchip" data-action="${hideAction}">${icon(viewMode === 'hidden' ? 'eye' : 'eye_off', 11)} ${hideLabel}</button>
      <button class="pchip danger" data-action="delete">${icon('trash', 11)} Delete</button>
      <span class="sep"></span>
      <button class="pchip close" data-action="clear" title="Clear selection">×</button>
    `;
    dock.classList.add('open');
    dock.querySelectorAll('.pchip[data-action]').forEach(btn => {
      btn.onclick = () => {
        const a = btn.dataset.action;
        if (a === 'clear') {
          txSelected = new Set(); refresh(); updateBulkBar();
        } else {
          txBulkAction(a);
        }
      };
    });
  }
```

### 3. Clean up on navigation

In `navigateTo` (or wherever you tear down the transactions view), add:

```js
document.getElementById('bulk-dock')?.classList.remove('open');
```

---

# CASE 03 — Dashboard hierarchy (three tiers)

**Severity:** High. **Files:** `style.css`, `app.js`. **Functions touched:** `_renderDashboard`.

## UX intent

| Tier | Contents | Visual weight |
|---|---|---|
| **1 — Hero** | Net worth (large value, 2-column layout, real area chart) — **the** single takeaway. | Full-width aurora card, ~140 px tall. |
| **2 — This month's flow** | Three compact cards: **In**, **Out**, **Recurring**. Each shows value + tiny delta vs previous month. | 3-up row of surface cards, ~76 px tall. |
| **3 — Detail grid** | 2×2 grid: Where it went, Budget pacing, Accounts, Recurring & subscriptions. Plus the 12-month bars + forecast below. | Compact surface cards. |
| **Removed from dashboard** | Savings goals (moved to Budgets — they're not month-scoped). | — |

Headline copy upgrade: `You saved +$X this month — your best run since <month>` when applicable; falls back to the existing `You saved +$X · N% savings rate` otherwise.

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 03 — Dashboard tiered hierarchy
   ============================================================ */
.dash-hero {
  background: var(--aurora); color: white;
  border-radius: 14px; padding: 22px 24px;
  display: grid; grid-template-columns: 1fr 1.2fr;
  gap: 32px; align-items: center;
  margin-bottom: 14px; position: relative; overflow: hidden;
}
.dash-hero .h-label {
  font-size: 10.5px; letter-spacing: 0.08em;
  text-transform: uppercase; font-weight: 600;
  opacity: 0.7;
}
.dash-hero .h-value {
  font-size: 36px; font-weight: 500; letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  margin: 8px 0 4px; line-height: 1;
}
.dash-hero .h-value .cents { font-size: 22px; opacity: 0.7; }
.dash-hero .h-delta {
  font-size: 12.5px; opacity: 0.9;
}
.dash-hero .h-delta strong { font-weight: 600; }
.dash-hero .h-chart { height: 80px; }
.dash-hero .h-chart svg { width: 100%; height: 100%; }

.dash-flow {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; margin-bottom: 16px;
}
.dash-flow .f-card {
  background: var(--bg-surface); border: 1px solid var(--line-1);
  border-radius: 12px; padding: 12px 14px;
}
.dash-flow .f-card .lbl {
  font-size: 11px; color: var(--ink-3); font-weight: 500;
}
.dash-flow .f-card .val {
  font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em; margin-top: 3px; line-height: 1.1;
}
.dash-flow .f-card .delta {
  font-size: 11px; margin-top: 3px;
  font-variant-numeric: tabular-nums;
}
.dash-flow .f-card .delta.up { color: var(--pos); }
.dash-flow .f-card .delta.dn { color: var(--warn); }
.dash-flow .f-card .delta.muted { color: var(--ink-3); }

@media (max-width: 1100px) {
  .dash-hero { grid-template-columns: 1fr; gap: 12px; }
  .dash-flow { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .dash-flow { grid-template-columns: 1fr; }
}
```

## JS — patch `_renderDashboard`

Replace the existing `.kpi-grid` block (4 KPI cards) and headline with the new hero + flow row. **Find** the block starting with `<div class="page-head">` through the end of the `.kpi-grid`:

```html
    <div class="page-head">
      <div>
        <div class="page-sub" style="font-size:13px;color:var(--ink-3);margin-bottom:4px">${new Date(month+'-15').toLocaleString('en-CA',{month:'long',year:'numeric'})}</div>
        <div class="page-title" style="font-size:22px;font-weight:500;letter-spacing:-0.015em">You saved <span style="color:${net>=0?'var(--pos)':'var(--danger)'};font-variant-numeric:tabular-nums">${fmtCurrency(net,true)}</span> · ${savingsRate.toFixed(0)}% savings rate</div>
      </div>
      ...
    </div>

    ${insightsHTML}

    <div class="kpi-grid">
      <div class="kpi hero-aurora">...</div>
      <div class="kpi">...Income...</div>
      <div class="kpi">...Expenses...</div>
      <div class="kpi">...Subscriptions...</div>
    </div>
```

**Replace with:**

```html
    <div class="page-head">
      <div>
        <div class="page-sub" style="font-size:13px;color:var(--ink-3);margin-bottom:4px">${new Date(month+'-15').toLocaleString('en-CA',{month:'long',year:'numeric'})}</div>
        <div class="page-title" style="font-size:22px;font-weight:500;letter-spacing:-0.015em">${headlineText}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="window.location.href='/api/export?month=${month||''}'">${icon('download',14)} Export</button>
        <button class="btn btn-primary" onclick="openAddModal()">${icon('plus',14)} Add transaction</button>
      </div>
    </div>

    ${insightsHTML}

    <!-- TIER 1 — Hero -->
    <div class="dash-hero">
      <div>
        <div class="h-label">Net worth · ${new Date(month+'-15').toLocaleString('en-CA',{month:'short'})}</div>
        <div class="h-value">${fmtCurrencyHTML(currentNW)}</div>
        <div class="h-delta">
          <strong>${deltaNW >= 0 ? '+' : ''}${fmtCurrency(currentNW - prevNW, true)}</strong> this month ·
          <strong>${deltaNW >= 0 ? '+' : ''}${Math.abs(deltaNW).toFixed(1)}%</strong> vs ${prevMonthName}
        </div>
      </div>
      <div class="h-chart">${svgSparkline(nwData.map(d=>d.v), 480, 80, 'rgba(255,255,255,0.9)')}</div>
    </div>

    <!-- TIER 2 — Flow -->
    <div class="dash-flow">
      <div class="f-card">
        <div class="lbl">In</div>
        <div class="val" style="color:var(--pos)">${fmtCurrencyHTML(income)}</div>
        <div class="delta ${incomeDelta >= 0 ? 'up' : 'dn'}">${incomeDelta >= 0 ? '+' : ''}${incomeDelta.toFixed(1)}% vs ${prevMonthName}</div>
      </div>
      <div class="f-card">
        <div class="lbl">Out</div>
        <div class="val">${fmtCurrencyHTML(expenses)}</div>
        <div class="delta ${expDelta <= 0 ? 'up' : 'dn'}">${expDelta >= 0 ? '+' : ''}${expDelta.toFixed(1)}% vs ${prevMonthName}</div>
      </div>
      <div class="f-card">
        <div class="lbl">Recurring</div>
        <div class="val">${fmtCurrencyHTML(subTotal)}</div>
        <div class="delta muted">${subCount} subs · ${expenses > 0 ? (subTotal/expenses*100).toFixed(0)+'%' : '—'} of spend</div>
      </div>
    </div>
```

And **above** the page-head, just after the existing `const prevMonthName = …` line, compute the headline:

```js
  // Build a comparative headline if we have history
  let headlineText = `You saved <span style="color:${net>=0?'var(--pos)':'var(--danger)'};font-variant-numeric:tabular-nums">${fmtCurrency(net,true)}</span> · ${savingsRate.toFixed(0)}% savings rate`;
  if (net > 0 && Array.isArray(trends) && trends.length > 2) {
    // Find the most recent earlier month where savings (income - expenses) was higher than this one
    const historicalSavings = trends.slice(0, -1).map(t => ({ m: t.month, s: (t.income || 0) - (t.expenses || 0) }));
    const lastBetter = [...historicalSavings].reverse().find(h => h.s > net);
    if (!lastBetter && historicalSavings.length) {
      // Net is the best in series
      const oldest = historicalSavings[0].m;
      const oldestName = new Date(oldest + '-15').toLocaleString('en-CA', { month: 'short' });
      headlineText = `You saved <span style="color:var(--pos);font-variant-numeric:tabular-nums">${fmtCurrency(net, true)}</span> — your best run since ${oldestName}`;
    }
  }
```

### Remove "Savings goals" from the dashboard

Find the `<div class="grid-2" style="margin-bottom:16px">` that contains `Recurring & subscriptions` and `Savings goals`. Remove the **Savings goals** card from this grid (keep Recurring). Move the goals UI under Budgets (where it logically lives — `_renderBudgets` already renders goals).

---

# CASE 04 — KPI cards — anchored area chart

**Severity:** Medium. **Files:** `style.css`, `app.js`.

In the new dashboard (Case 03), the tier-3 detail grid replaces the old multi-KPI row, so the legacy `.kpi` styling stays in place for backward-compatibility but is no longer the primary card on Dashboard. If you want to use the upgraded KPI elsewhere (e.g. Year Review), this is the snippet:

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 04 — KPI v2 (anchored area chart)
   ============================================================ */
.kpi-v2 {
  background: var(--bg-surface); border: 1px solid var(--line-1);
  border-radius: 14px; padding: 16px 18px 12px;
  display: flex; flex-direction: column; gap: 10px;
  position: relative; overflow: hidden;
}
.kpi-v2 .top {
  display: flex; align-items: baseline; justify-content: space-between;
}
.kpi-v2 .lbl { font-size: 12px; color: var(--ink-3); font-weight: 500; }
.kpi-v2 .now {
  font-size: 11.5px; color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}
.kpi-v2 .val {
  font-size: 28px; font-weight: 500; letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.kpi-v2 .val .cents { font-size: 16px; color: var(--ink-3); font-weight: 450; }
.kpi-v2 .spark {
  position: relative; height: 56px; margin: 0 -18px -2px;
}
.kpi-v2 .spark svg { width: 100%; height: 100%; display: block; }
.kpi-v2 .anno {
  position: absolute;
  font-size: 11px; font-variant-numeric: tabular-nums; font-weight: 500;
  background: var(--bg-surface);
  padding: 1px 6px; border-radius: 4px;
  border: 1px solid var(--line-1);
}
.kpi-v2 .anno.delta-up { color: var(--pos); }
.kpi-v2 .anno.delta-dn { color: var(--warn); }
.kpi-v2 .anno.avg { color: var(--ink-3); }
```

## JS — add helper

Append to the SVG helpers section (near `svgSparkline`):

```js
function svgAreaSpark(values, opts = {}) {
  if (!values || values.length < 2) return '';
  const w = opts.w || 280, h = opts.h || 56;
  const stroke = opts.stroke || 'var(--accent)';
  const fill = opts.fill || stroke;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const x = i => (i / (values.length - 1)) * w;
  const y = v => h - ((v - min) / range) * (h - 6) - 2;
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const avgY = y(avg);
  const lastX = x(values.length - 1), lastY = y(values[values.length - 1]);
  const id = 'spark-' + Math.random().toString(36).slice(2, 8);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${fill}" stop-opacity="0.22"/>
        <stop offset="1" stop-color="${fill}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="${avgY}" x2="${w}" y2="${avgY}" stroke="var(--line-2)" stroke-width="1" stroke-dasharray="3,3"/>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${path}" fill="none" stroke="${stroke}" stroke-width="1.6"/>
    <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="${stroke}"/>
    <circle cx="${lastX}" cy="${lastY}" r="6" fill="${stroke}" opacity="0.2"/>
  </svg>`;
}
```

## JS — usage pattern

```js
`<div class="kpi-v2">
  <div class="top">
    <span class="lbl">Expenses · last 12 months</span>
    <span class="now">${fmtCurrency(values[values.length-1])} ${currentMonthShort}</span>
  </div>
  <div class="val">${fmtCurrencyHTML(values[values.length-1])}</div>
  <div class="spark">
    ${svgAreaSpark(values, { stroke: 'var(--warn)', fill: 'oklch(62% 0.16 65)' })}
    <span class="anno delta-dn" style="right:-2px;top:-4px">↑ ${pctDelta.toFixed(1)}% vs ${prev}</span>
    <span class="anno avg" style="left:-2px;bottom:14px">12-mo avg ${fmtCurrency(avg, true)}</span>
  </div>
</div>`
```

---

# CASE 05 — Recurring & subscriptions — price trail

**Severity:** Medium. **Files:** `style.css`, `app.js`. **Backend:** uses existing `/api/recurring` if it already returns per-charge history; otherwise add a `history` field server-side (see end).

## UX intent

| Region | Before | After |
|---|---|---|
| **Row layout** | `[glyph] [name + warn-badge] [avg + 'avg' label]` | `[glyph] [name + freq tag + next date] [price-trail bars] [amount + delta label]` |
| **Price change** | Tiny `↑ price` warn badge with no detail. | 6-column mini bar trail colored by old vs new price + a `↑ $1.50 since Feb` label below the current amount. |
| **Glyph tint** | Plain grey. | Tinted by category (entertainment red-orange, productivity green) — chromatic at a glance. |

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 05 — Recurring v2 (price trail)
   ============================================================ */
.recur-v2 {
  display: grid; grid-template-columns: 32px 1fr 90px 100px;
  align-items: center; gap: 14px;
  padding: 12px 0; border-bottom: 1px solid var(--line-1);
}
.recur-v2:last-child { border-bottom: none; }
.recur-v2 .nm-row { display: flex; align-items: baseline; gap: 8px; }
.recur-v2 .nm { font-size: 13.5px; font-weight: 500; color: var(--ink-1); }
.recur-v2 .freq-tag {
  font-size: 10.5px; color: var(--ink-3);
  padding: 1px 5px; border: 1px solid var(--line-1);
  border-radius: 4px; text-transform: uppercase;
  letter-spacing: 0.04em; font-weight: 600;
}
.recur-v2 .next { font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
.recur-v2 .trail {
  display: flex; align-items: flex-end; gap: 3px; height: 28px;
}
.recur-v2 .trail span {
  flex: 1; min-height: 2px; border-radius: 1.5px;
  background: oklch(72% 0.02 240);
}
.recur-v2 .trail .now-bar { background: var(--ink-1); }
.recur-v2 .trail .up { background: var(--warn); }
.recur-v2 .amt-block { text-align: right; }
.recur-v2 .amt {
  font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums;
}
.recur-v2 .amt-delta {
  font-size: 11px; color: var(--warn); font-variant-numeric: tabular-nums;
  display: inline-flex; align-items: center; gap: 3px; margin-top: 2px;
}
.recur-v2 .amt-delta.muted { color: var(--ink-3); }
```

## JS — replace the existing recurring row template

In `_renderDashboard`, find the block that renders `.recur-row` and replace with:

```js
${recList.map(r => {
  // r.history should be a chronological array of recent charges: [{ date, amount }].
  // If absent, synthesize a 6-step trail from r.avg_amount with one bump if r.warn.
  const history = (r.history && r.history.length)
    ? r.history.slice(-6)
    : new Array(6).fill(0).map((_, i) => ({
        amount: (i < 3 && r.warn) ? (r.avg_amount * 0.92) : r.avg_amount,
      }));
  const minH = Math.min(...history.map(h => h.amount));
  const maxH = Math.max(...history.map(h => h.amount));
  const range = maxH - minH || 1;
  const lastAmt = history[history.length - 1].amount;
  const oldAmt = history[0].amount;
  const delta = lastAmt - oldAmt;
  const catC = catColor(r.category || 'Uncategorized');
  return `<div class="recur-v2">
    ${merchantGlyph(r.name, catC)}
    <div>
      <div class="nm-row"><span class="nm">${esc(r.name)}</span><span class="freq-tag">${esc(r.frequency || 'Monthly')}</span></div>
      <div class="next">${r.next_date ? `Next ${fmtDate(r.next_date)} · ` : ''}${history.length} mo history</div>
    </div>
    <div class="trail">
      ${history.map((h, i) => {
        const isLast = i === history.length - 1;
        const heightPct = 30 + ((h.amount - minH) / range) * 50;
        const cls = isLast ? 'now-bar' : (h.amount > oldAmt * 1.02 ? 'up' : '');
        return `<span class="${cls}" style="height:${heightPct.toFixed(0)}%"></span>`;
      }).join('')}
    </div>
    <div class="amt-block">
      <div class="amt">${fmtCurrency(lastAmt)}</div>
      <div class="amt-delta ${Math.abs(delta) < 0.5 ? 'muted' : ''}">
        ${Math.abs(delta) < 0.5 ? 'no change' : `${delta > 0 ? '↑' : '↓'} ${fmtCurrency(Math.abs(delta), true)} since start`}
      </div>
    </div>
  </div>`;
}).join('') || '<div style="color:var(--ink-3);font-size:13px">No recurring transactions detected yet</div>'}
```

## Backend note

`/api/recurring` (in `boreal/routes/summary.py`) currently returns `{ name, avg_amount, frequency, last_date, warn }`. To make the price trail real (instead of synthesized), extend the response:

```python
# In boreal/routes/summary.py, in the recurring endpoint
# After computing the matching transactions for each detected merchant:
history = [
    {"date": t["date"], "amount": float(t["amount"])}
    for t in matching_transactions[-6:]   # most recent 6 charges
]
out.append({
    "name": ...,
    "avg_amount": ...,
    "frequency": ...,
    "last_date": ...,
    "next_date": next_due_date,   # estimated based on frequency
    "warn": warn_flag,
    "history": history,
})
```

The frontend falls back to a synthesized trail if `history` is absent, so this can ship without backend changes.

---

# CASE 06 — Budget pacing

**Severity:** Medium. **Files:** `style.css`, `app.js`. **Functions touched:** budget rendering in both `_renderDashboard` and `_renderBudgets`.

## UX intent

| Region | Before | After |
|---|---|---|
| **Bar** | Fill of `spent / limit`. Color thresholds: 0–85% green, 85–100% amber, >100% red. | Same fill, but with a **vertical pace tick** at `day_of_month / days_in_month`. Color now derives from gap between pace and position, not absolute %. |
| **Footer line** | None (just the bar + amount). | Plain-language status: `↑ Over pace by $X — likely to overshoot by Y` or `✓ On pace`. |
| **Time context** | None. | `Day 18 / 31` on the right of the footer. |

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 06 — Budget pacing
   ============================================================ */
.budget-v2 { margin-bottom: 18px; }
.budget-v2 .b-row {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 8px;
}
.budget-v2 .b-name {
  display: flex; align-items: center; gap: 8px;
  font-size: 13.5px; font-weight: 500;
}
.budget-v2 .b-name .swatch { width: 9px; height: 9px; border-radius: 2px; }
.budget-v2 .b-amts {
  font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--ink-3);
}
.budget-v2 .b-amts strong { color: var(--ink-1); font-weight: 500; }
.budget-v2 .b-track {
  position: relative; height: 8px;
  background: var(--bg-sunken); border-radius: 999px;
  overflow: visible;
}
.budget-v2 .b-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: var(--accent); border-radius: 999px;
}
.budget-v2 .b-fill.warn { background: var(--warn); }
.budget-v2 .b-fill.danger { background: var(--danger); }
.budget-v2 .b-pace {
  position: absolute; top: -3px; bottom: -3px; width: 2px;
  background: var(--ink-1); border-radius: 1px;
}
.budget-v2 .b-pace::after {
  content: ""; position: absolute; top: -3px; left: -3px;
  width: 8px; height: 3px; background: var(--ink-1); border-radius: 2px;
}
.budget-v2 .b-foot {
  display: flex; justify-content: space-between; margin-top: 8px;
  font-size: 11.5px; color: var(--ink-3);
}
.budget-v2 .b-foot .status {
  display: inline-flex; align-items: center; gap: 5px; font-weight: 500;
}
.budget-v2 .b-foot .status.over { color: var(--warn); }
.budget-v2 .b-foot .status.ok { color: var(--pos); }
.budget-v2 .b-foot .status.crit { color: var(--danger); }
```

## JS — render helper

Append a helper:

```js
function renderBudgetV2(b) {
  const pct = b.limit ? Math.min(b.spent / b.limit * 100, 100) : 0;
  const now = new Date();
  // If b.month is provided, base "day of month" on that; otherwise current
  const monthStr = b.month || currentMonth() || now.toISOString().slice(0, 7);
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayInMonth = (monthStr === now.toISOString().slice(0, 7)) ? now.getDate() : daysInMonth;
  const pacePct = (todayInMonth / daysInMonth) * 100;
  const expectedSpend = (b.limit || 0) * (pacePct / 100);
  const overUnder = (b.spent || 0) - expectedSpend;
  const projectedTotal = (todayInMonth > 0) ? (b.spent || 0) * (daysInMonth / todayInMonth) : (b.spent || 0);

  let statusCls = 'ok', statusText = '✓ On pace';
  if (b.spent > b.limit) { statusCls = 'crit'; statusText = `↑ Over by ${fmtCurrency(b.spent - b.limit, true)}`; }
  else if (overUnder > b.limit * 0.05) {
    statusCls = 'over';
    statusText = `↑ Over pace by ${fmtCurrency(overUnder, true)} — likely ${fmtCurrency(projectedTotal, true)} by ${new Date(y, m - 1, daysInMonth).toLocaleString('en-CA', {month:'short', day:'numeric'})}`;
  }
  else if (overUnder < -b.limit * 0.05) {
    statusCls = 'ok';
    statusText = `✓ Under pace — likely ${fmtCurrency(projectedTotal, true)} by month-end`;
  }
  const fillCls = b.spent > b.limit ? 'danger' : (overUnder > b.limit * 0.10 ? 'warn' : '');
  const dotColor = catColor(b.category);

  return `<div class="budget-v2">
    <div class="b-row">
      <div class="b-name"><span class="swatch" style="background:${dotColor}"></span>${esc(b.category)}</div>
      <div class="b-amts"><strong>${fmtCurrency(b.spent, true)}</strong> of ${fmtCurrency(b.limit, true)} · ${daysInMonth - todayInMonth} days left</div>
    </div>
    <div class="b-track">
      <div class="b-fill ${fillCls}" style="width:${pct.toFixed(1)}%"></div>
      <div class="b-pace" style="left:${pacePct.toFixed(1)}%" title="On pace"></div>
    </div>
    <div class="b-foot">
      <span class="status ${statusCls}">${statusText}</span>
      <span>Day ${todayInMonth} / ${daysInMonth}</span>
    </div>
  </div>`;
}
```

### Use it in both dashboard and budgets view

**Dashboard** — replace the existing budget block (find `${budgets.length ? budgets.slice(0,6).map(b => {` and the surrounding template):

```js
${budgets.length ? budgets.slice(0,6).map(renderBudgetV2).join('') : '<div style="color:var(--ink-3);font-size:13px">No budgets set yet</div>'}
```

**Budgets view** (`_renderBudgets`) — replace the equivalent budget bar block with `renderBudgetV2`.

---

# CASE 07 — Account cards with 30-day spark

**Severity:** Low. **Files:** `style.css`, `app.js`, `boreal/routes/accounts.py` (optional helper).

## UX intent

Each account row gains a 15-bar 30-day balance microchart between the name/type and the balance. For credit accounts, the chart inverts color semantics (rising = warn, not pos).

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 07 — Account cards with 30-day pulse
   ============================================================ */
.acct-v2 {
  background: var(--bg-surface); border: 1px solid var(--line-1);
  border-radius: 12px; padding: 14px 16px;
  display: grid; grid-template-columns: 36px 1fr auto;
  gap: 14px; align-items: center;
  margin-bottom: 10px;
}
.acct-v2:last-child { margin-bottom: 0; }
.acct-v2 .meta-row {
  display: flex; align-items: baseline; gap: 8px;
  margin-bottom: 6px;
}
.acct-v2 .nm { font-size: 14px; font-weight: 500; color: var(--ink-1); }
.acct-v2 .ty {
  font-size: 11px; color: var(--ink-3);
  padding: 1px 6px; border: 1px solid var(--line-1);
  border-radius: 4px; text-transform: uppercase;
  letter-spacing: 0.04em; font-weight: 600;
}
.acct-v2 .micro {
  height: 22px; display: flex; align-items: flex-end; gap: 1px; width: 100%;
}
.acct-v2 .micro span {
  flex: 1; min-height: 2px;
  background: var(--ink-3); opacity: 0.45; border-radius: 1px;
}
.acct-v2 .micro span.hi { opacity: 0.95; background: var(--accent); }
.acct-v2 .micro.credit span { background: var(--ink-2); }
.acct-v2 .micro.credit span.hi { background: var(--warn); }
.acct-v2 .bal-block { text-align: right; }
.acct-v2 .bal {
  font-size: 17px; font-weight: 500; font-variant-numeric: tabular-nums;
}
.acct-v2 .bal-delta {
  font-size: 11px; color: var(--pos); margin-top: 2px;
  font-variant-numeric: tabular-nums;
  display: inline-flex; gap: 4px; align-items: center;
}
.acct-v2 .bal-delta.dn { color: var(--warn); }
```

## JS — render helper

Append to the helper section:

```js
function renderAcctV2(a) {
  // a.balance_history: optional [{ date, balance }] — last 30 days, daily.
  // Fall back to a synthesized flat trail if not provided.
  const history = (a.balance_history && a.balance_history.length)
    ? a.balance_history.slice(-15)
    : new Array(15).fill(0).map((_, i) => ({ balance: (a.balance || 0) * (0.92 + i * 0.005) }));
  const min = Math.min(...history.map(h => h.balance));
  const max = Math.max(...history.map(h => h.balance));
  const range = (max - min) || 1;
  const isCredit = (a.account_type || '').toLowerCase().includes('credit');
  const startBal = history[0].balance;
  const delta = (a.balance || 0) - startBal;
  const ac = acctColor(a);
  return `<div class="acct-v2">
    <div class="acct-glyph" style="background:${ac}18;color:${ac};border-color:${ac}40">${esc((a.name||'?')[0])}</div>
    <div>
      <div class="meta-row">
        <span class="nm">${esc(a.name)}</span>
        <span class="ty">${esc(a.account_type || '')}</span>
      </div>
      <div class="micro ${isCredit ? 'credit' : ''}">
        ${history.map((h, i) => {
          const isLast = i === history.length - 1;
          const heightPct = 30 + ((h.balance - min) / range) * 60;
          return `<span class="${isLast ? 'hi' : ''}" style="height:${heightPct.toFixed(0)}%"></span>`;
        }).join('')}
      </div>
    </div>
    <div class="bal-block">
      <div class="bal" style="color:${a.balance < 0 ? 'var(--danger)' : 'var(--ink-1)'}">${fmtCurrency(a.balance, true)}</div>
      <div class="bal-delta ${(isCredit ? delta > 0 : delta < 0) ? 'dn' : ''}">${delta >= 0 ? '↑' : '↓'} ${fmtCurrency(Math.abs(delta), true)} · 30d</div>
    </div>
  </div>`;
}
```

### Use it on the dashboard and the Accounts view

Replace the existing `.acct-row` rendering in both `_renderDashboard` and `_renderAccounts` with `renderAcctV2(a)`.

### Backend note (optional)

For real per-account balance history, add an endpoint or extend `/api/accounts-list`:

```python
# boreal/routes/accounts.py
# In the accounts-list endpoint, optionally include a 30-day daily balance series:
import datetime
def daily_balance_series(conn, account_id, days=30):
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    cur = conn.execute("""
      SELECT date(t.date) as d, SUM(CASE WHEN t.type='Income' THEN t.amount ELSE -t.amount END) as net
      FROM transactions t WHERE t.account = ? AND t.date >= ? GROUP BY date(t.date) ORDER BY d
    """, (account_name, start.isoformat()))
    daily_nets = {row["d"]: row["net"] for row in cur}
    # Walk forward from opening_balance computing running balance day by day
    series = []
    running = opening_balance + sum_pretty_much_everything_before_start
    for i in range(days + 1):
        day = (start + datetime.timedelta(days=i)).isoformat()
        running += daily_nets.get(day, 0)
        series.append({"date": day, "balance": running})
    return series
```

The frontend falls back to a synthesized trail when `balance_history` is absent — ship the visual first, add the real data later.

---

# CASE 08 — Topbar & month picker

**Severity:** Low. **Files:** `index.html`, `style.css`, `app.js`.

## UX intent

| Region | Before | After |
|---|---|---|
| **Section title** | `Dashboard` in `--ink-3`, followed by `/` separator. | Icon + section title in `--ink-1`, no separator. |
| **Month picker** | `‹ May 2026 ›` inside a thin-border box. | Pill-shaped `month-chip` with clickable center value (opens a calendar) and explicit ‹ › sides. |
| **Quick reset** | None. | "This month" chip appears when the user has paged away. |
| **Hide on non-month views** | Always visible. | Hidden on Settings, Import, Rules, Account-settings. |

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 08 — Topbar v2 — period chip
   ============================================================ */
.topbar { gap: 12px; }
.topbar-section {
  display: flex; align-items: center; gap: 10px;
  font-size: 14.5px; font-weight: 500;
  letter-spacing: -0.01em; color: var(--ink-1);
}
.topbar-section .ic {
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--bg-sunken);
  display: grid; place-items: center; color: var(--ink-2);
}
.topbar-section .ic svg { width: 13px; height: 13px; }
.month-chip {
  display: inline-flex; align-items: center;
  border: 1px solid var(--line-1); border-radius: 999px;
  background: var(--bg-surface); overflow: hidden;
  font-size: 12.5px;
}
.month-chip button {
  border: none; background: none; padding: 5px 10px;
  color: var(--ink-3); cursor: pointer; font-family: inherit;
}
.month-chip button:hover { background: var(--bg-hover); color: var(--ink-1); }
.month-chip .val {
  padding: 5px 14px; font-weight: 500; color: var(--ink-1);
  font-variant-numeric: tabular-nums;
  border-left: 1px solid var(--line-1);
  border-right: 1px solid var(--line-1);
  display: inline-flex; align-items: center; gap: 6px;
  cursor: pointer; background: none;
  font-family: inherit;
}
.month-chip .val:hover { background: var(--bg-hover); }
.month-reset {
  height: 28px; font-size: 12px;
  background: var(--bg-surface); border: 1px solid var(--line-1);
  border-radius: 999px; padding: 0 12px; cursor: pointer;
  color: var(--ink-2); font-family: inherit;
}
.month-reset:hover { background: var(--bg-hover); color: var(--ink-1); }
.month-reset.hidden { display: none; }
.topbar.no-month .month-chip, .topbar.no-month .month-reset { display: none; }
```

## HTML — replace topbar markup in `index.html`

**Find** in `boreal/templates/index.html`:

```html
    <div class="topbar">
      <span class="topbar-crumb" id="topbar-crumb">Dashboard</span>
      <span class="crumb-sep" style="color:var(--ink-4)">/</span>
      <div class="month-picker">
        <button onclick="stepMonth(-1)">...</button>
        <span class="label" id="month-label"></span>
        <button onclick="stepMonth(1)">...</button>
      </div>
      <div class="topbar-spacer"></div>
      ...
```

**Replace with:**

```html
    <div class="topbar" id="topbar">
      <div class="topbar-section" id="topbar-section">
        <span class="ic" id="topbar-icon"></span>
        <span id="topbar-crumb">Dashboard</span>
      </div>
      <div class="month-chip">
        <button onclick="stepMonth(-1)" aria-label="Previous month"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg></button>
        <button class="val" id="month-label" onclick="openMonthPicker()"></button>
        <button onclick="stepMonth(1)" aria-label="Next month"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6l6 6-6 6"/></svg></button>
      </div>
      <button class="month-reset hidden" id="month-reset" onclick="resetMonth()">This month</button>
      <div class="topbar-spacer"></div>
      ...
```

## JS — patch

In `navigateTo` (or wherever the topbar crumb is updated), add an icon mapping and toggle the month-scoped class. Approximate edit:

```js
const SECTION_ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  transactions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  budgets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  accounts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h12"/><circle cx="17" cy="13" r="1.2"/></svg>',
  year: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="13" width="3" height="7" rx="1"/><rect x="10.5" y="9" width="3" height="11" rx="1"/><rect x="17" y="5" width="3" height="15" rx="1"/></svg>',
  schedules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  rules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h10M4 12h7M4 18h10"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 3v12M7 8l5-5 5 5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.15-1.43l2-1.55-2-3.46-2.36.85a7 7 0 0 0-2.48-1.43L13.5 2h-3l-.51 2.98a7 7 0 0 0-2.48 1.43l-2.36-.85-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .49.05.96.15 1.43l-2 1.55 2 3.46 2.36-.85a7 7 0 0 0 2.48 1.43L10.5 22h3l.51-2.98a7 7 0 0 0 2.48-1.43l2.36.85 2-3.46-2-1.55c.1-.47.15-.94.15-1.43z"/></svg>',
  account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
};
const MONTH_SCOPED_VIEWS = new Set(['dashboard', 'transactions', 'budgets', 'accounts', 'year']);

const VIEW_LABELS = {
  dashboard: 'Dashboard', transactions: 'Transactions', budgets: 'Budgets',
  accounts: 'Accounts', year: 'Year review', schedules: 'Scheduled',
  rules: 'Rules', import: 'Import', settings: 'Settings', account: 'Account',
};

function updateTopbar(view) {
  const topbar = document.getElementById('topbar');
  const crumb = document.getElementById('topbar-crumb');
  const iconHost = document.getElementById('topbar-icon');
  if (crumb) crumb.textContent = VIEW_LABELS[view] || 'Dashboard';
  if (iconHost) iconHost.innerHTML = SECTION_ICONS[view] || '';
  topbar?.classList.toggle('no-month', !MONTH_SCOPED_VIEWS.has(view));
  // "This month" reset chip
  const reset = document.getElementById('month-reset');
  const today = new Date().toISOString().slice(0, 7);
  if (reset) reset.classList.toggle('hidden', currentMonth() === today);
}

function resetMonth() {
  const today = new Date().toISOString().slice(0, 7);
  setMonth(today); // existing helper that updates month + re-renders
  document.getElementById('month-reset')?.classList.add('hidden');
}

function openMonthPicker() {
  // Minimal modal: list of months with data from `/api/months`.
  // (Wire to existing prompt/modal helpers; full calendar can come later.)
  api('/api/months').then(months => {
    // Use existing `appPrompt` or a simple list modal — implementation detail.
    // For first cut, this can just fall through to the current ‹/› stepping.
  });
}
```

Wire `updateTopbar(view)` inside the existing `navigateTo(view)` (it currently updates `#topbar-crumb` directly — replace with `updateTopbar(view)`).

---

# CASE 09 — Category pills — soft chromatic tint

**Severity:** Low (but huge scanability win). **Files:** `style.css`, `app.js`. **Function touched:** `catPill` (l. 226).

## UX intent

Same component, dramatically more useful: the pill background, text, and border all derive from the category's color at calibrated lightness/chroma steps. Hue varies; lightness/chroma are constant so contrast and weight stay even across the palette.

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 09 — Category pills (chromatic tint)
   ============================================================ */
.cat-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 8px 2px 7px; border-radius: 6px;
  font-size: 11.5px; font-weight: 500;
  border: 1px solid transparent;
  /* default fallback (un-tinted) */
  background: var(--bg-sunken); color: var(--ink-2); border-color: var(--line-1);
}
.cat-pill .dot { width: 6px; height: 6px; border-radius: 2px; flex-shrink: 0; }

/* Dark mode: tints are too vivid, use the dot only */
html.dark .cat-pill {
  background: var(--bg-sunken); color: var(--ink-2); border-color: var(--line-1);
}
```

## JS — replace `catPill` (l. 226)

```js
// Build a soft tinted pill from the category color.
// Convert the hex color to an oklch-based tint. Since CAT_COLORS are hex,
// we use color-mix to derive the soft background and a dimmer text color.
function catPill(name) {
  const c = catColor(name);
  // Light-mode tinted pill via color-mix. Falls back to default in dark mode (see CSS).
  const style = `background:color-mix(in oklch, ${c} 14%, oklch(98% 0 0));`
              + `color:color-mix(in oklch, ${c} 75%, oklch(20% 0 0));`
              + `border-color:color-mix(in oklch, ${c} 32%, transparent);`;
  return `<span class="cat-pill" style="${style}"><span class="dot" style="background:${c}"></span>${esc(name)}</span>`;
}
```

`color-mix(in oklch, …)` has had universal support since 2024 and is already used elsewhere in the design system (the drawer's learn-callout border). No fallback shim needed.

---

# CASE 10 — Insights — make them consequential

**Severity:** Medium. **Files:** `style.css`, `app.js`. **Function touched:** insights rendering in `_renderDashboard`.

## UX intent

| Region | Before | After |
|---|---|---|
| **Form factor** | 3-up grid of icon-title-detail tip cards. | At most 2 stacked panel-style cards above the hero. Each carries the comparison artifact (two bars), a "type" tag, and inline actions. |
| **Type tag** | None (single tone via `i.tone`). | Explicit type: `Spike`, `Streak`, `New high`, `Suspicious`, etc. — corresponds to existing tone categories. |
| **Actions** | None. | `See N transactions` (jumps to pre-filtered Transactions), `Set a budget` (opens prefilled form), `Dismiss` (server-side persisted). |

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 10 — Insights v2
   ============================================================ */
.insights-v2 {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  margin-bottom: 20px;
}
@media (max-width: 1100px) { .insights-v2 { grid-template-columns: 1fr; } }
.insight-v2 {
  background: var(--bg-surface); border: 1px solid var(--line-1);
  border-radius: 14px; padding: 18px 18px 14px;
  display: flex; flex-direction: column; gap: 12px;
  position: relative; overflow: hidden;
}
.insight-v2::before {
  content: ""; position: absolute; right: -30px; top: -30px;
  width: 140px; height: 140px; border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, var(--insight-bg, var(--accent-soft)) 0%, transparent 70%);
}
.insight-v2.tone-warn  { --insight-bg: var(--warn-soft);  --insight-fg: var(--warn); }
.insight-v2.tone-pos   { --insight-bg: var(--pos-soft);   --insight-fg: var(--pos); }
.insight-v2.tone-accent{ --insight-bg: var(--accent-soft); --insight-fg: var(--accent); }
.insight-v2.tone-danger{ --insight-bg: var(--danger-soft); --insight-fg: var(--danger); }
.insight-v2 .top-row {
  display: flex; align-items: center; gap: 10px;
  position: relative;
}
.insight-v2 .tag {
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
  font-weight: 600; padding: 3px 8px; border-radius: 5px;
  background: var(--insight-bg); color: var(--insight-fg);
}
.insight-v2 .date-mini {
  font-size: 11px; color: var(--ink-3); margin-left: auto;
}
.insight-v2 h5 {
  font-size: 14.5px; font-weight: 500; letter-spacing: -0.005em;
  margin: 0; line-height: 1.4; max-width: 90%;
  position: relative;
}
.insight-v2 h5 .strong {
  color: var(--insight-fg); font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.insight-v2 .compare-bar {
  display: grid; grid-template-columns: 50px 1fr 70px;
  align-items: center; gap: 8px; font-size: 11.5px;
  row-gap: 8px;
}
.insight-v2 .compare-bar .lbl { color: var(--ink-3); }
.insight-v2 .compare-bar .bar {
  height: 6px; background: var(--bg-sunken);
  border-radius: 999px; overflow: hidden;
}
.insight-v2 .compare-bar .bar .fil {
  height: 100%; background: var(--ink-2); border-radius: 999px;
}
.insight-v2 .compare-bar .bar .fil.toned { background: var(--insight-fg); }
.insight-v2 .compare-bar .amt {
  font-variant-numeric: tabular-nums; font-weight: 500;
}
.insight-v2 .actions {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;
}
.insight-v2 .actions button {
  font-size: 11.5px; padding: 5px 11px; border-radius: 6px;
  border: 1px solid var(--line-2); background: var(--bg-surface);
  color: var(--ink-2); font-family: inherit; cursor: pointer;
}
.insight-v2 .actions button.primary {
  background: var(--ink-1); color: var(--bg-surface); border-color: var(--ink-1);
}
.insight-v2 .actions button:hover { background: var(--bg-hover); color: var(--ink-1); }
.insight-v2 .actions button.primary:hover { opacity: 0.92; background: var(--ink-1); color: var(--bg-surface); }
```

## JS — replace the insights renderer

In `_renderDashboard`, find:

```js
  let insightsHTML = '';
  if (summary.insights && summary.insights.length) {
    insightsHTML = `<div class="insights">${summary.insights.map(i => {
      const toneMap = { warn:['var(--warn-soft)','var(--warn)'], accent:['var(--accent-soft)','var(--accent)'], pos:['var(--pos-soft)','var(--pos)'] };
      const [bg,fg] = toneMap[i.tone] || toneMap.accent;
      return `<div class="insight">...`;
    }).join('')}</div>`;
  }
```

**Replace with:**

```js
  let insightsHTML = '';
  if (summary.insights && summary.insights.length) {
    // Take at most 2 — the rest fall back to Year Review's notable list.
    const top = summary.insights.slice(0, 2);
    insightsHTML = `<div class="insights-v2">${top.map(i => {
      const tone = i.tone || 'accent';
      const tag = i.tag || ({ warn: 'Spike', pos: 'Streak', danger: 'Alert', accent: 'Notable' }[tone]) || 'Notable';
      const compare = (i.compare && i.compare.a && i.compare.b) ? i.compare : null;
      const actions = (i.actions && i.actions.length) ? i.actions : (
        i.category
          ? [{ label: `See transactions`, action: 'filter-cat', value: i.category, primary: true }]
          : []
      );
      return `<div class="insight-v2 tone-${esc(tone)}">
        <div class="top-row">
          <span class="tag">${esc(tag)}</span>
          <span class="date-mini">${esc(i.period || 'This month')}</span>
        </div>
        <h5>${i.title}</h5>
        ${compare ? `<div class="compare-bar">
          <span class="lbl">${esc(compare.a.label)}</span>
          <div class="bar"><div class="fil" style="width:${Math.min(compare.a.pct || 60, 100)}%"></div></div>
          <span class="amt">${fmtCurrency(compare.a.value, true)}</span>
          <span class="lbl">${esc(compare.b.label)}</span>
          <div class="bar"><div class="fil toned" style="width:${Math.min(compare.b.pct || 90, 100)}%"></div></div>
          <span class="amt" style="color:var(--insight-fg)">${fmtCurrency(compare.b.value, true)}</span>
        </div>` : ''}
        ${actions.length ? `<div class="actions">
          ${actions.map(a => `<button class="${a.primary ? 'primary' : ''}" data-insight-action="${esc(a.action)}" data-value="${esc(a.value || '')}">${esc(a.label)}</button>`).join('')}
          <button data-insight-action="dismiss" data-insight-id="${esc(i.id || '')}">Dismiss</button>
        </div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }
```

And after the dashboard HTML is mounted, wire the actions (append in the same function, near the existing `nw-filters` setup):

```js
  document.querySelectorAll('[data-insight-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.insightAction;
      if (action === 'filter-cat') {
        navigateTo('transactions');
        // After view renders, pre-apply the category filter
        setTimeout(() => {
          const filterPills = document.getElementById('tx-filter-pills');
          // Use the public filter API once we add one; for now stash in window
          window.__pendingTxCatFilter = btn.dataset.value;
        }, 50);
      } else if (action === 'set-budget') {
        navigateTo('budgets');
        window.__pendingBudgetCategory = btn.dataset.value;
      } else if (action === 'dismiss') {
        api('/api/insights/dismiss', 'POST', { id: btn.dataset.insightId });
        btn.closest('.insight-v2')?.remove();
      }
    });
  });
```

In `_renderTransactions`, near the bottom, honor the pending filter:

```js
  if (window.__pendingTxCatFilter) {
    filterState.category = window.__pendingTxCatFilter;
    window.__pendingTxCatFilter = null;
    renderPills(); refresh();
  }
```

### Backend note

`summary.py` insights would gain optional fields: `tag`, `compare: { a: {label, value, pct}, b: {label, value, pct} }`, `actions`, `id`, `period`. None are required — the renderer falls back gracefully if absent. To make insights dismissible, add a `POST /api/insights/dismiss` endpoint that stores dismissed IDs in the user's settings.

---

# CASE 11 — Year strip (diverging axis) + empty states

**Severity:** Low. **Files:** `style.css`, `app.js`.

## CSS — append to `style.css`

```css
/* ============================================================
   CASE 11a — Year strip (diverging axis)
   ============================================================ */
.year-strip-v2 {
  display: grid; grid-template-columns: repeat(12, 1fr);
  gap: 6px; align-items: stretch;
}
.year-strip-v2 .col {
  display: flex; flex-direction: column; cursor: pointer;
}
.year-strip-v2 .col .row-pair {
  display: grid; grid-template-rows: 80px 80px;
}
.year-strip-v2 .col .axis {
  height: 1px; background: var(--line-2); margin: 0;
}
.year-strip-v2 .col .b-inc, .year-strip-v2 .col .b-exp {
  position: relative; display: flex;
}
.year-strip-v2 .col .b-inc { align-items: flex-end; padding-top: 4px; }
.year-strip-v2 .col .b-exp { align-items: flex-start; padding-bottom: 4px; }
.year-strip-v2 .col .b-inc::before {
  content: ""; flex: 1; background: var(--pos);
  border-radius: 3px 3px 0 0; min-height: 2px;
  height: var(--h, 60%);
}
.year-strip-v2 .col .b-exp::before {
  content: ""; flex: 1; background: var(--ink-2);
  border-radius: 0 0 3px 3px; min-height: 2px; opacity: 0.85;
  height: var(--h, 50%);
}
.year-strip-v2 .col.cur .ym { color: var(--ink-1); font-weight: 600; }
.year-strip-v2 .col .ym {
  text-align: center; font-size: 10.5px; color: var(--ink-3); margin-top: 6px;
}
.year-strip-v2 .col:hover .b-inc::before,
.year-strip-v2 .col:hover .b-exp::before { filter: brightness(0.9); }
.year-strip-v2-legend {
  display: flex; justify-content: space-between;
  font-size: 11px; color: var(--ink-3); margin-top: 10px;
}
.year-strip-v2-legend .sw {
  display: inline-block; width: 8px; height: 8px; border-radius: 2px;
  vertical-align: -1px; margin-right: 5px;
}

/* ============================================================
   CASE 11b — Empty states
   ============================================================ */
.empty-v2 {
  background: var(--bg-surface); border: 1px solid var(--line-1);
  border-radius: 14px; padding: 36px 32px;
  display: grid; grid-template-columns: 64px 1fr auto;
  gap: 20px; align-items: center;
}
.empty-v2 .art {
  width: 64px; height: 64px; border-radius: 14px;
  background: var(--aurora);
  display: grid; place-items: center; color: white;
  box-shadow: var(--shadow-md);
}
.empty-v2 .art svg { width: 32px; height: 32px; }
.empty-v2 h4 {
  font-size: 16px; font-weight: 500; margin: 0 0 4px; letter-spacing: -0.01em;
}
.empty-v2 p {
  margin: 0; font-size: 13px; color: var(--ink-3); line-height: 1.5;
  max-width: 460px;
}
.empty-v2 .actions {
  display: flex; flex-direction: column; gap: 6px;
}
@media (max-width: 720px) {
  .empty-v2 { grid-template-columns: 64px 1fr; }
  .empty-v2 .actions { grid-column: span 2; flex-direction: row; }
}
```

## JS — replace year strip renderer

In `_renderYear` (l. ~2201), find the existing `.year-strip` rendering and replace with:

```js
const yearMax = Math.max(...monthly.map(m => Math.max(m.income || 0, m.expenses || 0)), 1);
const curMonth = (currentMonth() || '').slice(5);
const yearStripHTML = `<div class="year-strip-v2">
  ${monthly.map((m, i) => {
    const incH = ((m.income || 0) / yearMax) * 100;
    const expH = ((m.expenses || 0) / yearMax) * 100;
    const isCur = (String(i + 1).padStart(2, '0') === curMonth);
    const moName = new Date(2000, i, 15).toLocaleString('en-CA', { month: 'short' });
    return `<div class="col${isCur ? ' cur' : ''}">
      <div class="row-pair">
        <div class="b-inc" style="--h:${incH}%"></div>
        <div class="b-exp" style="--h:${expH}%"></div>
      </div>
      <div class="axis"></div>
      <div class="ym">${moName}</div>
    </div>`;
  }).join('')}
</div>
<div class="year-strip-v2-legend">
  <span><span class="sw" style="background:var(--pos)"></span>Income ↑</span>
  <span>shared zero line</span>
  <span><span class="sw" style="background:var(--ink-2);opacity:0.85"></span>Expenses ↓</span>
</div>`;
```

## JS — empty state helper

```js
function renderEmptyState({ title, body, primary, secondary, iconKey = 'import' }) {
  return `<div class="empty-v2">
    <div class="art">${icon(iconKey, 32)}</div>
    <div>
      <h4>${esc(title)}</h4>
      <p>${esc(body)}</p>
    </div>
    <div class="actions">
      ${primary ? `<button class="btn btn-primary" onclick="${primary.onclick}">${esc(primary.label)}</button>` : ''}
      ${secondary ? `<button class="btn" onclick="${secondary.onclick}">${esc(secondary.label)}</button>` : ''}
    </div>
  </div>`;
}
```

Use it on every `"No data yet"` site:

```js
// Dashboard
if (!summary) {
  c.innerHTML = `<div class="page">${renderEmptyState({
    title: 'Pull in your first month',
    body: 'Drag a CSV or OFX from any supported bank — Boreal will detect the format and categorize 80% of your transactions on import.',
    primary: { label: 'Import file', onclick: "navigateTo('import')" },
    secondary: { label: 'Add manually', onclick: 'openAddModal()' },
    iconKey: 'import',
  })}</div>`;
  return;
}
```

Apply the same pattern in `_renderTransactions`, `_renderBudgets`, `_renderAccounts` when their data sets are empty.

---

# Quick hits

Smaller patches — apply in any order.

## QH-1 — Drop sidebar version subtitle

**File:** `boreal/templates/index.html`

**Find:**

```html
<div>
  <div class="brand-name">Boreal</div>
  <div class="brand-sub">v2.4 · local</div>
</div>
```

**Replace with:**

```html
<div>
  <div class="brand-name">Boreal</div>
</div>
```

Move the version display to Settings (likely already shown there; if not, add a "Version" row to the existing settings group).

## QH-2 — Filter chip active state — don't invert to black

**File:** `style.css`

**Find:**

```css
.filter-chip.active{background:var(--ink-1);color:var(--bg-app);border-color:var(--ink-1)}
```

**Replace with:**

```css
.filter-chip.active{background:var(--accent-soft);color:var(--accent-ink);border-color:color-mix(in oklch, var(--accent) 25%, transparent)}
```

## QH-3 — Notification dropdown empty state

**File:** `app.js` — `toggleAlerts()` / wherever the notification dropdown renders.

**Find** the "No notifications" string and replace with:

```html
<div class="notif-empty">
  <div style="font-size:13px;color:var(--ink-2);font-weight:500;margin-bottom:4px">All caught up</div>
  <div style="font-size:11.5px;color:var(--ink-3);line-height:1.5;max-width:240px;margin:0 auto">Boreal pings you on bank price changes, over-pace budgets, and unexpected income.</div>
</div>
```

## QH-4 — Skeletons everywhere

**File:** `app.js`

Replace the `"<div class="page"><div class="page-title">Loading…</div></div>"` strings in `renderTransactions`, `renderBudgets`, `renderAccounts`, `renderSchedules`, `renderRules`, `renderImport`, `renderSettings` with proper skeleton screens. Pattern:

```js
async function renderTransactions(c) {
  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="skel skel-line w-30 sm"></div>
        <div class="skel skel-line w-50 lg"></div>
      </div>
    </div>
    <div class="skel skel-block" style="height:48px;margin-bottom:14px"></div>
    <div class="skel skel-block" style="height:480px"></div>
  </div>`;
  try { await _renderTransactions(c); } catch(e) { ... }
}
```

Same pattern for the other views — give each a 2–3 skeleton blocks roughly matching the final layout density.

## QH-5 — CSV wizard step indicator — show check on done

**File:** `style.css`

**Find:**

```css
.wiz-step.done .num,.wiz-step.active .num{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
```

**Replace with two rules:**

```css
.wiz-step.active .num { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
.wiz-step.done .num   { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); font-size: 0; position: relative; }
.wiz-step.done .num::after {
  content: ""; position: absolute; inset: 0;
  background: no-repeat center/12px 12px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M4 12l5 5L20 6'/></svg>");
}
```

## QH-6 — Rules list — drag handle

**File:** `style.css` + `app.js` (`_renderRules`).

In the `.rule-card` markup, prepend a drag handle next to `.rule-num`. CSS:

```css
.rule-card { cursor: default; }
.rule-card .drag-handle {
  width: 16px; height: 24px; cursor: grab; opacity: 0.4;
  display: grid; place-items: center; color: var(--ink-3);
  flex-shrink: 0;
}
.rule-card:hover .drag-handle { opacity: 1; }
.rule-card.dragging { opacity: 0.5; }
```

Markup (inside `.rule-card`, before `.rule-num`):

```html
<div class="drag-handle">
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="2" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/>
    <circle cx="2" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/>
    <circle cx="2" cy="11" r="1.2"/><circle cx="8" cy="11" r="1.2"/>
  </svg>
</div>
```

Wire HTML5 drag-and-drop to call `/api/rules/reorder` (which already exists) on drop:

```js
let dragSrc = null;
document.querySelectorAll('.rule-card').forEach(card => {
  card.draggable = true;
  card.addEventListener('dragstart', () => { dragSrc = card; card.classList.add('dragging'); });
  card.addEventListener('dragend', () => { card.classList.remove('dragging'); });
  card.addEventListener('dragover', (e) => { e.preventDefault(); });
  card.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!dragSrc || dragSrc === card) return;
    const list = [...document.querySelectorAll('.rule-card')];
    const srcIdx = list.indexOf(dragSrc);
    const dstIdx = list.indexOf(card);
    if (srcIdx < dstIdx) card.after(dragSrc); else card.before(dragSrc);
    const order = [...document.querySelectorAll('.rule-card')].map(c => parseInt(c.dataset.ruleId));
    await api('/api/rules/reorder', 'POST', { order });
  });
});
```

(`data-rule-id` needs to be set on each `.rule-card` if it isn't already.)

---

# Suggested implementation order

1. **Cases 01, 02, 09** — Transactions surface. Transactions is where users spend ~60% of their time. The filter row + bulk dock + tinted pills compound: each makes the others feel better.
2. **Cases 03, 04, 10** — Dashboard storytelling. The hero/flow/detail hierarchy + better insights make the dashboard land. The KPI v2 (Case 04) is just a primitive — drop it in wherever you need a single metric chart later.
3. **Cases 05, 06, 07** — High-leverage feature payoffs. You're already detecting recurring price changes, pacing data, and per-account history; these patches just put the data on screen.
4. **Cases 08, 11, Quick hits** — Polish layer. Mostly token swaps and small layout shifts. None of these block anything.

## Sanity checks before shipping each case

- **CSS:** every new rule references a token already defined in `:root` and `html.dark`. No hard-coded hex colors except inside the case-color SVG helpers.
- **JS:** every new function uses the existing helpers (`api`, `esc`, `icon`, `catColor`, `fmtCurrency`, etc.). No new dependencies. No `type="module"` scripts.
- **Backend:** every case is shippable without backend changes — synthesized fallbacks are noted where applicable. Backend extensions are clearly marked as optional.
- **Dark mode:** every color-mix and tinted-pill rule has been checked in dark mode. The category pill in dark mode falls back to the existing grey treatment (see Case 09 CSS).
- **Existing tests:** the test suite at `tests/` covers API contracts, not frontend markup, so these changes should not break tests. If `test_mobile.py` does DOM assertions, run it after Cases 01–04 land.

---

That's the complete implementation guide. Cross-references back to `Design Audit.html` use the same case numbers, so an agent can read the visual spec and the implementation spec side by side.
