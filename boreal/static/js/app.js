// ══════════════════════════════════════════════════════════════
// BOREAL — app.js  (Part 1: Core infrastructure)
// ══════════════════════════════════════════════════════════════

// ── HTML ESCAPING ─────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── IN-APP CONFIRM / PROMPT MODALS ───────────────────────────
function appConfirm(msg, { title = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const id = 'app-confirm-' + Date.now();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="${id}">
      <div class="modal" onclick="event.stopPropagation()" style="max-width:380px">
        <div class="modal-h"><h3>${esc(title)}</h3></div>
        <div class="modal-body" style="font-size:14px;color:var(--ink-2)">${esc(msg)}</div>
        <div class="modal-foot">
          <button class="btn" id="${id}-no">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="${id}-yes">${danger ? 'Delete' : 'Confirm'}</button>
        </div>
      </div>
    </div>`);
    const close = (v) => { document.getElementById(id)?.remove(); resolve(v); };
    document.getElementById(id).addEventListener('click', () => close(false));
    document.getElementById(`${id}-no`).addEventListener('click', () => close(false));
    document.getElementById(`${id}-yes`).addEventListener('click', () => close(true));
  });
}

function appPrompt(msg, { title = 'Input', defaultVal = '', placeholder = '' } = {}) {
  return new Promise(resolve => {
    const id = 'app-prompt-' + Date.now();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="${id}">
      <div class="modal" onclick="event.stopPropagation()" style="max-width:380px">
        <div class="modal-h"><h3>${esc(title)}</h3></div>
        <div class="modal-body">
          <div style="font-size:14px;color:var(--ink-2);margin-bottom:12px">${esc(msg)}</div>
          <div class="field"><input id="${id}-input" value="${esc(defaultVal)}" placeholder="${esc(placeholder)}" inputmode="decimal"></div>
        </div>
        <div class="modal-foot">
          <button class="btn" id="${id}-cancel">Cancel</button>
          <button class="btn btn-primary" id="${id}-ok">OK</button>
        </div>
      </div>
    </div>`);
    const close = (v) => { document.getElementById(id)?.remove(); resolve(v); };
    document.getElementById(id).addEventListener('click', () => close(null));
    document.getElementById(`${id}-cancel`).addEventListener('click', () => close(null));
    document.getElementById(`${id}-ok`).addEventListener('click', () => close(document.getElementById(`${id}-input`).value));
    document.getElementById(`${id}-input`).addEventListener('keydown', (e) => { if (e.key === 'Enter') close(document.getElementById(`${id}-input`).value); });
    setTimeout(() => document.getElementById(`${id}-input`)?.focus(), 50);
  });
}

// ── CSRF + API ────────────────────────────────────────────────
let _csrfToken = null;
async function _ensureCsrf() {
  if (_csrfToken) return _csrfToken;
  try { const r = await fetch('/api/csrf-token'); const d = await r.json(); _csrfToken = d.csrf_token; } catch(e) { _csrfToken = ''; }
  return _csrfToken;
}
// ── API RESPONSE CACHE ────────────────────────────────────────
const _apiCache = {};       // { url: { data, ts } }
const _apiInflight = {};    // { url: Promise } — dedup concurrent GETs
const API_CACHE_TTL = 15000; // 15 seconds

function invalidateApiCache(urlPrefix) {
  // Clear cache entries matching a prefix (or all if no arg)
  if (!urlPrefix) { Object.keys(_apiCache).forEach(k => delete _apiCache[k]); return; }
  Object.keys(_apiCache).forEach(k => { if (k.startsWith(urlPrefix)) delete _apiCache[k]; });
}

async function api(url, methodOrOpts, body) {
  try {
    let opts = {};
    if (typeof methodOrOpts === 'string') {
      opts.method = methodOrOpts;
      if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    } else if (methodOrOpts) {
      opts = methodOrOpts;
    }
    const method = (opts.method || 'GET').toUpperCase();

    // Cache GET responses
    if (method === 'GET') {
      const cached = _apiCache[url];
      if (cached && (Date.now() - cached.ts) < API_CACHE_TTL) return cached.data;
      // Dedup: if same GET is already in flight, await it
      if (_apiInflight[url]) return _apiInflight[url];
      const p = _apiFetch(url, opts, method);
      _apiInflight[url] = p;
      const data = await p;
      delete _apiInflight[url];
      if (data !== null) _apiCache[url] = { data, ts: Date.now() };
      return data;
    }

    // Mutating requests: clear cache after success
    const data = await _apiFetch(url, opts, method);
    if (data !== null) invalidateApiCache();
    return data;
  } catch(e) { console.error('API error:', e); showToast('Network error — is the server running?'); return null; }
}

async function _apiFetch(url, opts, method) {
  if (method !== 'GET' && method !== 'HEAD') {
    const token = await _ensureCsrf();
    opts.headers = opts.headers || {};
    opts.headers['X-CSRF-Token'] = token;
    if (!opts.headers['Content-Type'] && opts.body && typeof opts.body === 'string') opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  if (!res.ok) {
    let msg = `Server error (${res.status})`;
    try { const b = await res.json(); if (b.error) msg = b.error; } catch(e) {}
    showToast(msg); return null;
  }
  return await res.json();
}

// ── AUTH-AWARE FETCH (for file uploads that bypass api()) ─────
async function authFetch(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res;
}

// ── ICON SVG SYSTEM ───────────────────────────────────────────
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  wallet: '<path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h12"/><circle cx="17" cy="13" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  upload: '<path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 3v12M7 8l5-5 5 5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.15-1.43l2-1.55-2-3.46-2.36.85a7 7 0 0 0-2.48-1.43L13.5 2h-3l-.51 2.98a7 7 0 0 0-2.48 1.43l-2.36-.85-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .49.05.96.15 1.43l-2 1.55 2 3.46 2.36-.85a7 7 0 0 0 2.48 1.43L10.5 22h3l.51-2.98a7 7 0 0 0 2.48-1.43l2.36.85 2-3.46-2-1.55c.1-.47.15-.94.15-1.43z"/>',
  chev_l: '<path d="M14 6l-6 6 6 6"/>',
  chev_r: '<path d="M10 6l6 6-6 6"/>',
  chev_d: '<path d="M6 9l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  download: '<path d="M12 3v12M7 11l5 4 5-4M4 21h16"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  arrow_up: '<path d="M7 17L17 7M9 7h8v8"/>',
  arrow_dn: '<path d="M7 7l10 10M9 17h8V9"/>',
  arrow_r: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrow_lr: '<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  x: '<path d="M5 5l14 14M19 5L5 19"/>',
  pause: '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  edit: '<path d="M16 3l5 5L8 21H3v-5z"/>',
  trash: '<path d="M4 6h16M9 6V4h6v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>',
  rules: '<path d="M4 6h10M4 12h7M4 18h10"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eye_off: '<path d="M3 3l18 18M10.7 5.1A11 11 0 0 1 22 12s-1 2-2.5 3.5M6.7 6.7C4 8.5 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 1 0 4.2 4.2"/>',
  bars: '<rect x="4" y="13" width="3" height="7" rx="1"/><rect x="10.5" y="9" width="3" height="11" rx="1"/><rect x="17" y="5" width="3" height="15" rx="1"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M12 3v9h9a9 9 0 0 0-9-9z"/>',
  spark: '<path d="M3 17l4-6 4 3 5-8 5 6"/>',
  alert: '<path d="M12 2L2 22h20L12 2z"/><path d="M12 10v4"/><circle cx="12" cy="18" r="0.5"/>',
  trending: '<path d="M3 17l4-6 4 3 5-8 5 6"/>',
  funnel: '<path d="M3 5h18l-7 9v6l-4-2v-4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  sliders: '<path d="M4 6h12M4 12h7M4 18h16"/><circle cx="19" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
};
function icon(name, size=16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="icon">${ICONS[name]||''}</svg>`;
}

// ── FORMAT HELPERS ────────────────────────────────────────────
function fmtParts(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const [d, c] = abs.toFixed(2).split('.');
  return { sign, dollars: d.replace(/\B(?=(\d{3})+(?!\d))/g, ','), cents: c };
}
function fmtCurrency(n, hideCents) {
  const { sign, dollars, cents } = fmtParts(n);
  return hideCents ? `${sign}$${dollars}` : `${sign}$${dollars}.${cents}`;
}
function fmtCurrencyHTML(n) {
  const { sign, dollars, cents } = fmtParts(n);
  return `${sign}$${dollars}<span class="cents">.${cents}</span>`;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
function fmtDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── CATEGORY HELPERS ──────────────────────────────────────────
const CAT_COLORS = {
  'Groceries': '#5b9c6e', 'Dining & Coffee': '#c08a4e', 'Eating Out': '#c08a4e',
  'Transport': '#6b8eb5', 'Transportation': '#6b8eb5', 'Fuel': '#a47c5b',
  'Subscriptions': '#9b6fb7', 'Shopping': '#c7798d', 'Rent & Housing': '#4a7a8f', 'Rent': '#4a7a8f',
  'Utilities': '#8a96a3', 'Phone & Internet': '#7c8aab', 'Health': '#76a89c',
  'Fitness': '#7ba072', 'Entertainment': '#b08bbf', 'Alcohol': '#9c5a5a',
  'Income': '#3f7f5c', 'Salary': '#3f7f5c', 'Freelance': '#5a8db5',
  'Transfer': '#9aa5b3', 'Uncategorized': '#b8b0a3',
};
function catColor(name) { return CAT_COLORS[name] || '#b8b0a3'; }

// Account-glyph color: prefer account_type, else hash by name. Fixes the
// bug where catColor(a.name) fell through to beige for every account.
function acctColor(acct) {
  const type = ((acct && acct.account_type) || '').toLowerCase();
  if (type.includes('cred'))            return '#c7798d';
  if (type.includes('sav'))             return '#5b9c6e';
  if (type.includes('inv'))             return '#9b6fb7';
  if (type.includes('cheq') || type.includes('check')) return '#6b8eb5';
  const palette = ['#5b9c6e','#6b8eb5','#c08a4e','#9b6fb7','#c7798d','#4a7a8f','#76a89c','#7ba072'];
  const name = (acct && acct.name) || '';
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffff;
  return palette[h % palette.length];
}
function catPill(name) {
  const c = catColor(name);
  return `<span class="cat-pill"><span class="dot" style="background:${c}"></span>${esc(name)}</span>`;
}
function merchantGlyph(name, color) {
  const ch = (name || '?').replace(/^(THE |INTERAC )/i, '').trim()[0]?.toUpperCase() || '?';
  const style = color ? `color:${color};background:${color}12;border-color:${color}30` : '';
  return `<div class="merchant-glyph" style="${style}">${ch}</div>`;
}

// ── STATE ─────────────────────────────────────────────────────
let STATE = {
  view: 'dashboard',
  months: [],
  monthIdx: 0,
  categories: [],
  expenseCats: [],
  incomeCats: [],
  settings: {},
  isDemo: false,
};

function currentMonth() {
  return STATE.months[STATE.monthIdx] || null;
}

// ── TOAST SYSTEM ──────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('undo-toast');
  const msgEl = document.getElementById('toast-msg');
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none'; el.offsetHeight; el.style.animation = '';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(dismissToast, 7000);
}
function dismissToast() {
  const el = document.getElementById('undo-toast');
  if (el) el.classList.add('hidden');
  clearTimeout(_toastTimer);
}
async function doUndo() {
  dismissToast();
  const r = await api('/api/undo', { method: 'POST' });
  if (r) { showToast('Undone'); refreshCurrentView(); }
}

// ── ALERTS / NOTIFICATIONS ────────────────────────────────────
let _alertsOpen = false;
async function toggleAlerts() {
  const dd = document.getElementById('notif-dropdown');
  if (!dd) return;
  _alertsOpen = !_alertsOpen;
  if (!_alertsOpen) { dd.classList.add('hidden'); return; }
  dd.innerHTML = '<div class="notif-header">Notifications</div><div class="notif-empty">Loading…</div>';
  dd.classList.remove('hidden');
  const data = await api('/api/alerts');
  if (!data || !data.alerts.length) {
    dd.innerHTML = '<div class="notif-header">Notifications</div><div class="notif-empty">No alerts right now</div>';
    return;
  }
  const toneMap = { warn:['var(--warn-soft)','var(--warn)'], accent:['var(--accent-soft)','var(--accent)'], pos:['var(--pos-soft)','var(--pos)'] };
  dd.innerHTML = `<div class="notif-header">Notifications · ${data.count}</div>` + data.alerts.map(a => {
    const [bg,fg] = toneMap[a.tone] || toneMap.accent;
    return `<div class="notif-item"><div class="icon-circle" style="background:${bg};color:${fg}">${icon(a.icon||'alert',13)}</div><div><div class="notif-ttl">${esc(a.title)}</div><div class="notif-dt">${esc(a.detail)}</div></div></div>`;
  }).join('');
}
async function refreshAlertsBadge() {
  const data = await api('/api/alerts');
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (data && data.count > 0) { badge.textContent = data.count; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }
}
// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notif-wrap');
  if (wrap && !wrap.contains(e.target) && _alertsOpen) { _alertsOpen = false; document.getElementById('notif-dropdown')?.classList.add('hidden'); }
});

// ── NAVIGATION ────────────────────────────────────────────────
const MONTH_AWARE_VIEWS = new Set(['dashboard','transactions','budgets']);
function setMonthPickerVisibility(view) {
  const mp = document.querySelector('.topbar .month-picker');
  const sep = document.querySelector('.topbar .crumb-sep');
  if (!mp) return;
  const show = MONTH_AWARE_VIEWS.has(view);
  mp.classList.toggle('is-hidden', !show);
  if (sep) sep.classList.toggle('is-hidden', !show);
}
function navigateTo(view) {
  STATE.view = view;
  // Update sidebar active state
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  // Update topbar crumb
  const labels = { dashboard:'Dashboard', transactions:'Transactions', budgets:'Budgets', accounts:'Accounts', year:'Year review', import:'Import', schedules:'Scheduled', rules:'Rules', settings:'Settings', account:'Account' };
  document.getElementById('topbar-crumb').textContent = labels[view] || view;
  // Hide month picker on views that don't consume the month
  setMonthPickerVisibility(view);
  // Render view
  renderView(view);
}
async function updateNavCounts() {
  const [txRes, schedRes, rulesRes] = await Promise.all([
    api('/api/transactions?limit=1'),
    api('/api/schedules'),
    api('/api/rules'),
  ]);
  const txEl = document.getElementById('nav-txn-count');
  const schedEl = document.getElementById('nav-sched-count');
  const rulesEl = document.getElementById('nav-rules-count');
  if (txEl && txRes) txEl.textContent = txRes.total || '';
  if (schedEl && schedRes) schedEl.textContent = (schedRes.length || '') ;
  if (rulesEl && rulesRes) rulesEl.textContent = (rulesRes.length || '');
}

function renderView(view) {
  const c = document.getElementById('view-container');
  switch(view) {
    case 'dashboard': renderDashboard(c); break;
    case 'transactions': renderTransactions(c); break;
    case 'budgets': renderBudgets(c); break;
    case 'accounts': renderAccounts(c); break;
    case 'year': renderYear(c); break;
    case 'import': renderImport(c); break;
    case 'schedules': renderSchedules(c); break;
    case 'rules': renderRules(c); break;
    case 'settings': renderSettings(c); break;
    case 'account': renderMyAccount(c); break;
    default: renderDashboard(c);
  }
}

function refreshCurrentView() { invalidateApiCache(); renderView(STATE.view); }

async function refreshMonths() {
  const months = await api('/api/months');
  if (months && months.length) {
    STATE.months = months;
    if (STATE.monthIdx >= months.length) STATE.monthIdx = 0;
    updateMonthLabel();
  }
}

// ── MONTH PICKER ──────────────────────────────────────────────
function updateMonthLabel() {
  const m = currentMonth();
  const el = document.getElementById('month-label');
  if (!el) return;
  if (!m) { el.textContent = 'No data'; return; }
  const [y, mo] = m.split('-');
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  el.textContent = d.toLocaleString('en-CA', { month: 'long', year: 'numeric' });
}
function stepMonth(delta) {
  // months array is DESC (newest first), so stepping forward in time = decreasing index
  const newIdx = STATE.monthIdx - delta;
  if (newIdx >= 0 && newIdx < STATE.months.length) {
    STATE.monthIdx = newIdx;
    updateMonthLabel();
    refreshCurrentView();
  }
}

// ── THEME ─────────────────────────────────────────────────────
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.getElementById('theme-label').textContent = 'Light mode';
    document.getElementById('theme-icon').innerHTML = ICONS.sun;
  } else {
    document.documentElement.classList.remove('dark');
    document.getElementById('theme-label').textContent = 'Dark mode';
    document.getElementById('theme-icon').innerHTML = ICONS.moon;
  }
  try { localStorage.setItem('boreal-theme', theme); } catch(e) {}
}
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  STATE.settings.theme = newTheme;
  api('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: newTheme }) });
}


// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); openCommandPalette();
  }
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault(); openCommandPalette();
  }
  if (e.key === 'Escape') {
    closeOverlays();
  }
});

function closeOverlays() {
  document.getElementById('overlays').innerHTML = '';
}

// ── SVG CHARTS ────────────────────────────────────────────────
function svgSparkline(values, w=80, h=24, stroke='var(--accent)') {
  if (!values || !values.length) return '';
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v,i) => `${(i*step).toFixed(1)},${(h-((v-min)/range)*h).toFixed(1)}`).join(' ');
  return `<svg class="kpi-spark" width="${w}" height="${h}" fill="none"><polyline points="${pts}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function svgNetWorthChart(data) {
  if (!data || !data.length) return '<div class="chart-wrap"></div>';
  const w=760, h=220, pad=28;
  const vals = data.map(d => d.v || d.net_worth || 0);
  const labels = data.map(d => d.m || d.month || '');
  const min = Math.min(...vals), max = Math.max(...vals), range = max-min||1;
  const step = (w-pad*2)/(vals.length-1);
  const pts = vals.map((v,i) => [pad+i*step, h-pad-((v-min)/range)*(h-pad*2)]);
  const path = pts.map(([x,y],i) => (i===0?`M${x},${y}`:`L${x},${y}`)).join(' ');
  const area = `${path} L${pts[pts.length-1][0]},${h-pad} L${pts[0][0]},${h-pad} Z`;
  const gridLines = [0.25,0.5,0.75].map(p =>
    `<line x1="${pad}" x2="${w-pad}" y1="${pad+p*(h-pad*2)}" y2="${pad+p*(h-pad*2)}" stroke="var(--line-1)" stroke-width="1" stroke-dasharray="2 4"/>`
  ).join('');
  const dots = pts.map(([x,y],i) => i===pts.length-1 ? `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/>` : '').join('');
  const lbls = labels.map((l,i) => `<text x="${pad+i*step}" y="${h-6}" text-anchor="middle" font-size="10" fill="var(--ink-3)" font-family="var(--font-sans)">${esc(String(l).split(' ')[0])}</text>`).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${gridLines}<path d="${area}" fill="url(#nw-grad)"/><path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}${lbls}
  </svg></div>`;
}

function svgDoughnut(slices, size=140) {
  const total = slices.reduce((s,x) => s+x.value, 0) || 1;
  const r = size/2-14, c = size/2;
  let a = -Math.PI/2;
  const arcs = slices.map(s => {
    const frac = s.value/total;
    const a1 = a + frac*Math.PI*2;
    const large = frac > 0.5 ? 1 : 0;
    const x0=c+r*Math.cos(a), y0=c+r*Math.sin(a);
    const x1=c+r*Math.cos(a1), y1=c+r*Math.sin(a1);
    const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
    a = a1;
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="22" stroke-linecap="butt"/>`;
  }).join('');
  return `<svg width="${size}" height="${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--line-1)" stroke-width="22"/>${arcs}</svg>`;
}

function svgSpendBars(history) {
  if (!history || !history.length) return '';
  const max = Math.max(...history.map(h => Math.max(h.income||0, h.expenses||0)));
  return `<div class="bars">${history.map((h,i) => {
    const iPct = max ? (h.income/max)*100 : 0;
    const ePct = max ? (h.expenses/max)*100 : 0;
    const isCurrent = i === history.length - 1;
    return `<div style="flex:1;display:flex;flex-direction:column">
      <div style="display:flex;align-items:flex-end;gap:3px;height:160px;justify-content:center">
        <div class="bar-pos" style="width:12px;height:${iPct}%;min-height:2px" title="Income ${fmtCurrency(h.income)}"></div>
        <div class="bar-neg" style="width:12px;height:${ePct}%;min-height:2px" title="Expenses ${fmtCurrency(h.expenses)}"></div>
      </div>
      <div class="bar-label" style="${isCurrent?'color:var(--ink-1);font-weight:600':''}">${esc(h.m||h.month||'')}</div>
    </div>`;
  }).join('')}</div>`;
}

// ══════════════════════════════════════════════════════════════
// COMMAND PALETTE
// ══════════════════════════════════════════════════════════════
function openCommandPalette() {
  const navCmds = [
    { title:'Go to Dashboard', group:'Navigate', icon:'dashboard', action:()=>navigateTo('dashboard') },
    { title:'Go to Transactions', group:'Navigate', icon:'list', action:()=>navigateTo('transactions') },
    { title:'Go to Budgets', group:'Navigate', icon:'target', action:()=>navigateTo('budgets') },
    { title:'Go to Accounts', group:'Navigate', icon:'wallet', action:()=>navigateTo('accounts') },
    { title:'Go to Year review', group:'Navigate', icon:'bars', action:()=>navigateTo('year') },
    { title:'Go to Import', group:'Navigate', icon:'upload', action:()=>navigateTo('import') },
    { title:'Go to Scheduled', group:'Navigate', icon:'clock', action:()=>navigateTo('schedules') },
    { title:'Go to Rules', group:'Navigate', icon:'rules', action:()=>navigateTo('rules') },
    { title:'Go to Settings', group:'Navigate', icon:'cog', action:()=>navigateTo('settings') },
  ];
  const actionCmds = [
    { title:'Add transaction', group:'Action', icon:'plus', action:()=>openAddModal() },
    { title:'Import CSV / OFX file', group:'Action', icon:'upload', action:()=>navigateTo('import') },
    { title:'Toggle dark mode', group:'Action', icon:'moon', action:()=>toggleTheme() },
    { title:'Export transactions to CSV', group:'Action', icon:'download', action:()=>{ window.location.href='/api/export?month='+(currentMonth()||''); } },
    { title:'Download backup of your data', group:'Action', icon:'download', action:()=>{ window.location.href='/api/backup'; } },
  ];
  const all = [...navCmds, ...actionCmds];
  let active = 0, filtered = all;

  function render(q) {
    filtered = q ? all.filter(c => c.title.toLowerCase().includes(q.toLowerCase())) : all;
    active = 0;
    const groups = {};
    filtered.forEach(c => { groups[c.group] = groups[c.group] || []; groups[c.group].push(c); });
    let idx = -1;
    let listHTML = '';
    if (!filtered.length) {
      listHTML = `<div style="padding:24px 12px;text-align:center;color:var(--ink-3);font-size:13px">No matches for "${esc(q)}"</div>`;
    } else {
      for (const [group, items] of Object.entries(groups)) {
        listHTML += `<div class="cmd-group">${esc(group)}</div>`;
        items.forEach(c => {
          idx++;
          listHTML += `<div class="cmd-item ${idx===active?'active':''}" data-idx="${idx}" onmouseenter="this.parentElement.parentElement.querySelectorAll('.cmd-item').forEach(x=>x.classList.remove('active'));this.classList.add('active')" onclick="cmdExec(${idx})">${icon(c.icon,15)}<span>${esc(c.title)}</span></div>`;
        });
      }
    }
    document.getElementById('cmd-list').innerHTML = listHTML;
  }

  window._cmdFiltered = () => filtered;
  window.cmdExec = (i) => { if (filtered[i]) { closeOverlays(); filtered[i].action(); } };

  const ol = document.getElementById('overlays');
  ol.innerHTML = `<div class="cmd-back" onclick="closeOverlays()">
    <div class="cmd" onclick="event.stopPropagation()">
      <div class="cmd-input">${icon('search',16)}<input id="cmd-input" placeholder="Type a command, navigate, or search…"><span class="kbd">esc</span></div>
      <div class="cmd-list" id="cmd-list"></div>
      <div class="cmd-foot"><span><span class="kbd">↑↓</span> navigate</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">esc</span> close</span></div>
    </div>
  </div>`;

  render('');
  const inp = document.getElementById('cmd-input');
  setTimeout(() => inp?.focus(), 30);
  inp.addEventListener('input', () => render(inp.value));
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active+1, filtered.length-1); render(inp.value); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active-1, 0); render(inp.value); }
    if (e.key === 'Enter') { e.preventDefault(); window.cmdExec(active); }
    if (e.key === 'Escape') { e.preventDefault(); closeOverlays(); }
  });
}

// ══════════════════════════════════════════════════════════════
// ADD TRANSACTION MODAL
// ══════════════════════════════════════════════════════════════
function openAddModal() {
  closeOverlays();
  const today = new Date().toISOString().slice(0,10);
  const catOpts = STATE.expenseCats.map(c => `<option value="${esc(c.name)}">${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');
  const incOpts = STATE.incomeCats.map(c => `<option value="${esc(c.name)}">${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');
  // Fetch accounts for dropdown
  api('/api/accounts-list').then(accts => {
    const acctOpts = (accts||[]).map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join('');
    const el = document.getElementById('add-account');
    if (el) el.innerHTML = acctOpts + '<option value="">Other…</option>';
  });
  const ol = document.getElementById('overlays');
  ol.innerHTML = `<div class="modal-back" onclick="closeOverlays()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>Add transaction</h3><button class="icon-btn" onclick="closeOverlays()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field"><label>Date</label><input type="date" id="add-date" value="${today}"></div>
          <div class="field"><label>Type</label><select id="add-type" onchange="updateAddCats()"><option value="Expense">Expense</option><option value="Income">Income</option></select></div>
        </div>
        <div class="field"><label>Description</label><input id="add-name" placeholder="e.g. Loblaws #1042"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field"><label>Category</label><select id="add-cat">${catOpts}</select></div>
          <div class="field"><label>Amount</label><input id="add-amount" placeholder="25.00" inputmode="decimal"></div>
        </div>
        <div class="field"><label>Account</label><select id="add-account"><option value="">Loading…</option></select></div>
        <div class="field"><label>Notes (optional)</label><input id="add-notes" placeholder=""></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeOverlays()">Cancel</button>
        <button class="btn btn-primary" onclick="submitAdd()">Add transaction</button>
      </div>
    </div>
  </div>`;
}
window.updateAddCats = function() {
  const type = document.getElementById('add-type').value;
  const cats = type === 'Income' ? STATE.incomeCats : STATE.expenseCats;
  document.getElementById('add-cat').innerHTML = cats.map(c => `<option value="${esc(c.name)}">${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');
};
async function submitAdd() {
  const date = document.getElementById('add-date').value;
  const type = document.getElementById('add-type').value;
  const name = document.getElementById('add-name').value.trim();
  const category = document.getElementById('add-cat').value;
  const amount = parseFloat(document.getElementById('add-amount').value);
  const account = document.getElementById('add-account').value.trim();
  const notes = document.getElementById('add-notes').value.trim();
  if (!name || isNaN(amount) || !account) { showToast('Please fill in description, amount, and account'); return; }
  const r = await api('/api/add', 'POST', { date, type, name, category, amount, account, notes });
  if (r) { closeOverlays(); showToast(`Transaction added · ${type==='Income'?'+':'−'}$${amount.toFixed(2)} ${category}`); await refreshMonths(); refreshCurrentView(); }
}

// ══════════════════════════════════════════════════════════════
// PLACEHOLDER VIEW RENDERERS (will be filled in next chunks)
// ══════════════════════════════════════════════════════════════
// Skeleton placeholder for the dashboard while data loads.
function dashboardSkeleton() {
  const kpi = `<div class="kpi"><div class="skel skel-line sm w-50"></div><div class="skel skel-line lg w-70" style="margin-top:10px"></div><div class="skel skel-line sm w-30" style="margin-top:14px"></div></div>`;
  const card = `<div class="card"><div class="skel skel-line w-30"></div><div class="skel skel-block" style="margin-top:14px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div class="kpi-grid">${kpi}${kpi}${kpi}${kpi}</div>
    <div class="grid-2" style="margin-bottom:16px">${card}${card}</div>
    <div class="grid-2" style="margin-bottom:16px">${card}${card}</div>
  </div>`;
}

function transactionsSkeleton() {
  const row = `<tr><td style="width:32px"><div class="skel skel-circle" style="width:16px;height:16px"></div></td><td><div class="skel skel-line sm w-30"></div></td><td><div class="skel skel-line sm w-70"></div></td><td><div class="skel skel-line sm w-50"></div></td><td><div class="skel skel-line sm w-30"></div></td><td style="text-align:right"><div class="skel skel-line sm w-50" style="margin-left:auto"></div></td><td></td></tr>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-70" style="margin-top:10px"></div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:14px"><div class="skel skel-line w-30" style="height:32px;border-radius:8px;width:200px"></div><div class="skel skel-line" style="height:32px;border-radius:8px;flex:1"></div></div>
    <div class="card" style="padding:0;overflow:hidden"><table class="txn-table" style="width:100%"><tbody>${row.repeat(10)}</tbody></table></div>
  </div>`;
}

function budgetsSkeleton() {
  const kpi = `<div class="kpi"><div class="skel skel-line sm w-50"></div><div class="skel skel-line lg w-70" style="margin-top:10px"></div></div>`;
  const brow = `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)"><div class="skel skel-circle" style="width:32px;height:32px"></div><div style="flex:1"><div class="skel skel-line w-50"></div><div class="skel skel-line sm w-30" style="margin-top:8px"></div></div><div class="skel skel-line sm w-30" style="width:60px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div class="kpi-grid">${kpi}${kpi}${kpi}</div>
    <div class="card" style="margin-top:16px">${brow.repeat(5)}</div>
  </div>`;
}

function accountsSkeleton() {
  const kpi = `<div class="kpi"><div class="skel skel-line sm w-50"></div><div class="skel skel-line lg w-70" style="margin-top:10px"></div></div>`;
  const acct = `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)"><div class="skel skel-circle" style="width:36px;height:36px"></div><div style="flex:1"><div class="skel skel-line w-50"></div><div class="skel skel-line sm w-30" style="margin-top:8px"></div></div><div class="skel skel-line sm w-30" style="width:80px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div class="kpi-grid">${kpi}${kpi}${kpi}</div>
    <div class="card" style="margin-top:16px">${acct.repeat(4)}</div>
  </div>`;
}

function yearSkeleton() {
  const kpi = `<div class="kpi"><div class="skel skel-line sm w-50"></div><div class="skel skel-line lg w-70" style="margin-top:10px"></div></div>`;
  const card = `<div class="card"><div class="skel skel-line w-30"></div><div class="skel skel-block" style="margin-top:14px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div class="kpi-grid">${kpi}${kpi}${kpi}${kpi}</div>
    <div class="grid-2" style="margin-bottom:16px">${card}${card}</div>
  </div>`;
}

function importSkeleton() {
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-70" style="margin-top:10px"></div></div></div>
    <div class="card" style="padding:48px;text-align:center">
      <div class="skel skel-circle" style="width:48px;height:48px;margin:0 auto"></div>
      <div class="skel skel-line lg w-30" style="margin:16px auto 0"></div>
      <div class="skel skel-line sm w-50" style="margin:10px auto 0"></div>
    </div>
  </div>`;
}

function schedulesSkeleton() {
  const kpi = `<div class="kpi"><div class="skel skel-line sm w-50"></div><div class="skel skel-line lg w-70" style="margin-top:10px"></div></div>`;
  const row = `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)"><div class="skel skel-circle" style="width:32px;height:32px"></div><div style="flex:1"><div class="skel skel-line w-50"></div><div class="skel skel-line sm w-30" style="margin-top:8px"></div></div><div class="skel skel-line sm" style="width:60px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div class="kpi-grid">${kpi}${kpi}${kpi}</div>
    <div class="card" style="margin-top:16px">${row.repeat(5)}</div>
  </div>`;
}

function rulesSkeleton() {
  const tab = `<div class="skel skel-line" style="height:32px;border-radius:8px;width:100px"></div>`;
  const row = `<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border)"><div style="flex:1"><div class="skel skel-line w-70"></div><div class="skel skel-line sm w-50" style="margin-top:8px"></div></div><div class="skel skel-line sm" style="width:40px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:16px">${tab}${tab}${tab}</div>
    <div class="card">${row.repeat(5)}</div>
  </div>`;
}

function settingsSkeleton() {
  const row = `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)"><div><div class="skel skel-line w-50"></div><div class="skel skel-line sm w-70" style="margin-top:6px"></div></div><div class="skel skel-line" style="width:60px;height:28px;border-radius:6px"></div></div>`;
  return `<div class="page">
    <div class="page-head"><div><div class="skel skel-line lg w-30"></div><div class="skel skel-line sm w-50" style="margin-top:10px"></div></div></div>
    <div class="grid-2">
      <div class="card"><div class="skel skel-line w-30" style="margin-bottom:16px"></div>${row.repeat(4)}</div>
      <div class="card"><div class="skel skel-line w-30" style="margin-bottom:16px"></div>${row.repeat(3)}</div>
    </div>
  </div>`;
}

async function renderDashboard(c) { c.innerHTML = dashboardSkeleton(); try { await refreshMonths(); await _renderDashboard(c); } catch(e) { console.error('Dashboard error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderTransactions(c) { c.innerHTML = transactionsSkeleton(); try { await _renderTransactions(c); } catch(e) { console.error('Transactions error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderBudgets(c) { c.innerHTML = budgetsSkeleton(); try { await _renderBudgets(c); } catch(e) { console.error('Budgets error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderAccounts(c) { c.innerHTML = accountsSkeleton(); try { await _renderAccounts(c); } catch(e) { console.error('Accounts error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderYear(c) { c.innerHTML = yearSkeleton(); try { await _renderYear(c); } catch(e) { console.error('Year error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderImport(c) { c.innerHTML = importSkeleton(); try { await _renderImport(c); } catch(e) { console.error('Import error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderSchedules(c) { c.innerHTML = schedulesSkeleton(); try { await _renderSchedules(c); } catch(e) { console.error('Schedules error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderRules(c) { c.innerHTML = rulesSkeleton(); try { await _renderRules(c); } catch(e) { console.error('Rules error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderSettings(c) { c.innerHTML = settingsSkeleton(); try { await _renderSettings(c); } catch(e) { console.error('Settings error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }
async function renderMyAccount(c) { c.innerHTML = settingsSkeleton(); try { await _renderMyAccount(c); } catch(e) { console.error('Account error:', e); c.innerHTML = `<div class="page"><div class="page-title">Error</div><pre style="color:var(--danger);font-size:12px">${esc(e.message)}</pre></div>`; } }

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
async function init() {
  // Load all initial data in parallel
  const [me, cats, settings, months, demo, health] = await Promise.all([
    api('/api/me'),
    api('/api/categories'),
    api('/api/settings'),
    api('/api/months'),
    api('/api/demo'),
    api('/api/health'),
  ]);
  // Apply user info
  if (me) {
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-display-name');
    const mailEl = document.getElementById('user-db-info');
    if (avatarEl) avatarEl.textContent = (me.display_name || 'B')[0].toUpperCase();
    if (nameEl) nameEl.textContent = me.display_name || 'User';
    if (mailEl) mailEl.textContent = me.email || '';
    // Show admin link for admin users
    if (me.is_admin) {
      const logoutLink = document.querySelector('.user-row a[href="/logout"]');
      if (logoutLink) {
        const adminLink = document.createElement('a');
        adminLink.href = '/admin/';
        adminLink.title = 'Admin';
        adminLink.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
        adminLink.style.cssText = 'color:var(--ink-3);display:flex;align-items:center;transition:color .15s';
        logoutLink.parentNode.insertBefore(adminLink, logoutLink);
      }
    }
  }
  // Apply categories
  if (cats) {
    STATE.categories = cats;
    STATE.expenseCats = cats.filter(c => c.type === 'Expense');
    STATE.incomeCats = cats.filter(c => c.type === 'Income');
  }
  // Apply settings
  if (settings) {
    STATE.settings = settings;
    if (settings.theme) applyTheme(settings.theme);
  }
  // Apply months
  if (months && months.length) {
    STATE.months = months;
    STATE.monthIdx = 0;
    updateMonthLabel();
  }
  // Check demo
  if (demo) STATE.isDemo = demo.demo;
  // Check if DB exists
  if (health && !health.db_exists) {
    STATE.view = 'onboarding';
    renderOnboarding(document.getElementById('view-container'));
    return;
  }
  // Render initial view
  navigateTo('dashboard');
  // Load alert badge
  refreshAlertsBadge();
}

function renderOnboarding(c) {
  c.innerHTML = `<div class="page"><div class="onboarding">
    <div class="brand-mark-lg"><svg viewBox="0 0 512 512" width="32" height="32" fill="none"><polygon points="256,80 196,180 316,180" fill="currentColor"/><polygon points="256,140 176,260 336,260" fill="currentColor"/><polygon points="256,210 156,340 356,340" fill="currentColor"/><rect x="240" y="340" width="32" height="52" rx="4" fill="currentColor" opacity="0.7"/></svg></div>
    <h1>Welcome to Boreal.</h1>
    <p class="lede">A personal finance dashboard for Canadians. Drop in a bank export, and you'll see your money in 30 seconds — private, simple, no tracking.</p>
    <div class="onb-cards">
      <div class="onb-card" onclick="navigateTo('import')">
        <div class="ic">${icon('upload',18)}</div>
        <h3>Import a CSV</h3>
        <p>Drop a file from your bank — Boreal recognizes 10+ Canadian banks and walks you through unknown ones.</p>
      </div>
      <div class="onb-card" onclick="loadSampleData()">
        <div class="ic">${icon('spark',18)}</div>
        <h3>Try sample data</h3>
        <p>Explore the app with a fully-populated demo — transactions, accounts, budgets, goals.</p>
      </div>
      <div class="onb-card" onclick="navigateTo('dashboard')">
        <div class="ic">${icon('edit',18)}</div>
        <h3>Start blank</h3>
        <p>Add transactions manually, set up accounts and budgets as you go.</p>
      </div>
    </div>
    <div style="margin-top:32px;font-size:12px;color:var(--ink-3)">Your data is stored securely in your personal database</div>
  </div></div>`;
}

async function loadSampleData() {
  const r = await api('/api/demo/reset', { method: 'POST' });
  if (r) { showToast('Sample data loaded'); location.reload(); }
}

document.addEventListener('DOMContentLoaded', init);

// ══════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════════════════

function svgForecastChart(historical, forecast, width=760, height=200) {
  const all = [...historical, ...forecast];
  if (all.length < 2) return '';
  const pad = { t: 20, b: 30, l: 50, r: 16 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxVal = Math.max(...all.map(d => Math.max(d.income, d.expenses))) * 1.1 || 1;
  const n = all.length;
  const xStep = w / (n - 1);
  const y = v => pad.t + h - (v / maxVal * h);
  const x = i => pad.l + i * xStep;
  const histLen = historical.length;
  const splitX = x(histLen - 1);

  // Grid lines
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const gy = pad.t + (h / 4) * i;
    const val = maxVal - (maxVal / 4) * i;
    grid += `<line x1="${pad.l}" y1="${gy}" x2="${width-pad.r}" y2="${gy}" stroke="var(--line-1)" stroke-width="0.5"/>`;
    grid += `<text x="${pad.l-6}" y="${gy+4}" fill="var(--ink-4)" font-size="10" text-anchor="end">$${(val/1000).toFixed(1)}k</text>`;
  }

  // Month labels
  let labels = '';
  all.forEach((d, i) => {
    const [yr, mo] = d.month.split('-').map(Number);
    const label = new Date(yr, mo-1, 15).toLocaleString('en-CA', {month: 'short'});
    if (i % Math.ceil(n / 8) === 0 || i === n - 1) {
      labels += `<text x="${x(i)}" y="${height-4}" fill="var(--ink-4)" font-size="10" text-anchor="middle">${label}</text>`;
    }
  });

  // Income line
  const incPts = all.map((d, i) => `${x(i)},${y(d.income)}`).join(' ');
  // Expense line
  const expPts = all.map((d, i) => `${x(i)},${y(d.expenses)}`).join(' ');

  // Projected zone shading
  const projShade = histLen < n ? `<rect x="${splitX}" y="${pad.t}" width="${width-pad.r-splitX}" height="${h}" fill="var(--accent)" opacity="0.04" rx="4"/>` : '';

  // Dashed projection lines (from split point onward)
  let dashInc = '', dashExp = '';
  if (histLen < n) {
    const dashIncPts = all.slice(histLen - 1).map((d, i) => `${x(histLen - 1 + i)},${y(d.income)}`).join(' ');
    const dashExpPts = all.slice(histLen - 1).map((d, i) => `${x(histLen - 1 + i)},${y(d.expenses)}`).join(' ');
    dashInc = `<polyline points="${dashIncPts}" fill="none" stroke="var(--pos)" stroke-width="2" stroke-dasharray="6,4" opacity="0.7"/>`;
    dashExp = `<polyline points="${dashExpPts}" fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="6,4" opacity="0.7"/>`;
  }

  // Solid historical lines
  const solidIncPts = all.slice(0, histLen).map((d, i) => `${x(i)},${y(d.income)}`).join(' ');
  const solidExpPts = all.slice(0, histLen).map((d, i) => `${x(i)},${y(d.expenses)}`).join(' ');

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;margin-top:12px">
    ${grid}${labels}${projShade}
    <polyline points="${solidIncPts}" fill="none" stroke="var(--pos)" stroke-width="2"/>
    <polyline points="${solidExpPts}" fill="none" stroke="var(--ink-2)" stroke-width="2"/>
    ${dashInc}${dashExp}
    ${histLen < n ? `<line x1="${splitX}" y1="${pad.t}" x2="${splitX}" y2="${pad.t+h}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>
    <text x="${splitX+6}" y="${pad.t+12}" fill="var(--accent)" font-size="10">Forecast →</text>` : ''}
  </svg>`;
}

async function loadForecastCard() {
  const card = document.getElementById('forecast-card');
  if (!card) return;
  const data = await api('/api/forecast');
  if (!data || (!data.historical.length && !data.forecast.length)) {
    card.innerHTML = `<div class="card-h"><h3>Cash-flow forecast</h3></div><div style="color:var(--ink-3);font-size:13px;padding:8px 0">Not enough data yet — need at least 1 month of transactions.</div>`;
    return;
  }
  const netPerMonth = data.projected_monthly_net;
  const chart = svgForecastChart(data.historical, data.forecast);
  card.innerHTML = `
    <div class="card-h">
      <h3>Cash-flow forecast</h3>
      <div style="display:flex;gap:12px;font-size:12px;color:var(--ink-3)">
        <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:2px;background:var(--pos)"></span>Income</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:2px;background:var(--ink-2)"></span>Expenses</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:2px;background:var(--pos);border:1px dashed var(--pos)"></span>Projected</span>
      </div>
    </div>
    <div style="display:flex;gap:16px;font-size:13px;margin-top:4px">
      <span>Projected monthly net: <strong style="color:${netPerMonth >= 0 ? 'var(--pos)' : 'var(--danger)'}">${netPerMonth >= 0 ? '+' : ''}${fmtCurrency(netPerMonth, true)}</strong></span>
      <span style="color:var(--ink-3)">Recurring: ${fmtCurrency(data.recurring_income, true)} in · ${fmtCurrency(data.recurring_expense, true)} out</span>
    </div>
    ${chart}`;
}

async function _renderDashboard(c) {
  const month = currentMonth();
  const [summary, trends, recurring, goals, accounts, netWorth] = await Promise.all([
    month ? api(`/api/summary?month=${month}`) : null,
    api('/api/trends?months=12'),
    api('/api/recurring'),
    api('/api/goals'),
    api('/api/accounts-list'),
    api('/api/net-worth'),
  ]);
  if (!summary) { c.innerHTML = '<div class="page"><div class="page-title">No data yet</div><div class="page-sub">Import a bank CSV or add transactions manually to get started.</div></div>'; return; }

  const income = summary.income || 0;
  const expenses = summary.expenses || 0;
  const net = income - expenses;
  const savingsRate = income > 0 ? (net / income * 100) : 0;
  const totalBalance = (accounts || []).reduce((s,a) => s + (a.balance||0), 0);
  const nwData = (netWorth || []).map(d => ({ m: d.month, v: d.net_worth }));
  // Find net worth for selected month and its predecessor
  const nwIdx = month ? nwData.findIndex(d => d.m === month) : nwData.length - 1;
  const currentNW = nwIdx >= 0 ? nwData[nwIdx].v : totalBalance;
  const prevNW = nwIdx >= 1 ? nwData[nwIdx - 1].v : (nwData.length >= 2 ? nwData[nwData.length - 2].v : totalBalance);
  const deltaNW = prevNW ? ((currentNW - prevNW) / Math.abs(prevNW) * 100) : 0;
  const byCat = summary.by_category || [];
  const topCats = byCat.filter(x => x.total > 0).sort((a,b) => b.total - a.total).slice(0, 6);
  const totalExp = topCats.reduce((s,x) => s + x.total, 0);
  const budgets = summary.budgets || [];
  const recList = recurring?.recurring || (Array.isArray(recurring) ? recurring : []);
  const subTotal = recList.reduce((s, r) => s + (r.avg_amount || 0), 0);
  const subCount = recList.length;
  const trendHistory = (trends || []).map(t => { const [y,mo] = (t.month||'').split('-').map(Number); return { m: mo ? new Date(y,mo-1,15).toLocaleString('en-CA',{month:'short'}) : t.month, income: t.income, expenses: t.expenses }; });
  // Calculate deltas vs previous month (from summary API, relative to selected month)
  const prevIncome = summary.prev_income || 0;
  const prevExpenses = summary.prev_expenses || 0;
  const incomeDelta = prevIncome ? ((income - prevIncome) / prevIncome * 100) : 0;
  const expDelta = prevExpenses ? ((expenses - prevExpenses) / prevExpenses * 100) : 0;
  const prevMonthName = summary.prev_month ? new Date(summary.prev_month + '-15').toLocaleString('en-CA', {month: 'short'}) : 'last month';

  // Insights
  let insightsHTML = '';
  if (summary.insights && summary.insights.length) {
    insightsHTML = `<div class="insights">${summary.insights.map(i => {
      const toneMap = { warn:['var(--warn-soft)','var(--warn)'], accent:['var(--accent-soft)','var(--accent)'], pos:['var(--pos-soft)','var(--pos)'] };
      const [bg,fg] = toneMap[i.tone] || toneMap.accent;
      return `<div class="insight"><div class="icon-circle" style="background:${bg};color:${fg}">${icon(i.icon||'spark',15)}</div><div><div class="ttl">${esc(i.title)}</div><div class="dt">${esc(i.detail)}</div></div></div>`;
    }).join('')}</div>`;
  }

  // Build page
  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-sub" style="font-size:13px;color:var(--ink-3);margin-bottom:4px">${new Date(month+'-15').toLocaleString('en-CA',{month:'long',year:'numeric'})}</div>
        <div class="page-title" style="font-size:22px;font-weight:500;letter-spacing:-0.015em">You saved <span style="color:${net>=0?'var(--pos)':'var(--danger)'};font-variant-numeric:tabular-nums">${fmtCurrency(net,true)}</span> · ${savingsRate.toFixed(0)}% savings rate</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="window.location.href='/api/export?month=${month||''}'">${icon('download',14)} Export</button>
        <button class="btn btn-primary" onclick="openAddModal()">${icon('plus',14)} Add transaction</button>
      </div>
    </div>

    ${insightsHTML}

    <div class="kpi-grid">
      <div class="kpi hero-aurora">
        <div class="kpi-label">Net worth</div>
        <div class="kpi-value">${fmtCurrencyHTML(currentNW)}</div>
        <div class="kpi-delta">
          <span class="chip ${deltaNW >= 0 ? 'chip-up' : 'chip-dn'}">${icon(deltaNW >= 0 ? 'arrow_up' : 'arrow_dn', 11)} ${Math.abs(deltaNW).toFixed(1)}%</span>
          <span>vs ${prevMonthName}</span>
        </div>
        ${svgSparkline(nwData.map(d=>d.v), 200, 24, 'rgba(255,255,255,0.7)')}
      </div>
      <div class="kpi">
        <div class="kpi-label">Income</div>
        <div class="kpi-value" style="color:var(--pos)">${fmtCurrencyHTML(income)}</div>
        <div class="kpi-delta">
          <span class="chip ${incomeDelta >= 0 ? 'chip-up' : 'chip-dn'}">${icon(incomeDelta >= 0 ? 'arrow_up' : 'arrow_dn', 11)} ${Math.abs(incomeDelta).toFixed(1)}%</span>
          <span>vs ${prevMonthName}</span>
        </div>
        ${svgSparkline(trendHistory.map(h=>h.income), 200, 24, 'var(--pos)')}
      </div>
      <div class="kpi">
        <div class="kpi-label">Expenses</div>
        <div class="kpi-value">${fmtCurrencyHTML(expenses)}</div>
        <div class="kpi-delta">
          <span class="chip ${expDelta <= 0 ? 'chip-up' : 'chip-dn'}">${icon(expDelta <= 0 ? 'arrow_dn' : 'arrow_up', 11)} ${Math.abs(expDelta).toFixed(1)}%</span>
          <span>vs ${prevMonthName}</span>
        </div>
        ${svgSparkline(trendHistory.map(h=>h.expenses), 200, 24, 'var(--ink-3)')}
      </div>
      <div class="kpi">
        <div class="kpi-label">Subscriptions</div>
        <div class="kpi-value">${fmtCurrencyHTML(subTotal)}</div>
        <div class="kpi-delta">
          <span class="chip" style="background:var(--accent-soft);color:var(--accent-ink)">${subCount} active</span>
          <span>${expenses > 0 ? (subTotal/expenses*100).toFixed(0)+'% of spend' : 'monthly committed'}</span>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-h">
          <h3>Net worth trend</h3>
          <div style="display:flex;gap:4px" id="nw-filters">
            <button class="filter-chip" data-months="1">1M</button>
            <button class="filter-chip" data-months="6">6M</button>
            <button class="filter-chip active" data-months="12">1Y</button>
            <button class="filter-chip" data-months="0">All</button>
          </div>
        </div>
        ${nwData.length >= 2 ? `<div style="font-size:12px;color:var(--ink-3);margin-bottom:6px">
          <span style="color:${totalBalance - nwData[0].v >= 0 ? 'var(--pos)' : 'var(--danger)'};font-weight:500">${totalBalance - nwData[0].v >= 0 ? '+' : ''}${fmtCurrency(totalBalance - nwData[0].v, true)}</span> this period
        </div>` : ''}
        <div id="nw-chart-container">${svgNetWorthChart(nwData)}</div>
      </div>
      <div class="card">
        <div class="card-h"><h3>Where it went</h3><button class="muted-link" onclick="navigateTo('budgets')">See all →</button></div>
        <div style="display:flex;align-items:center;gap:18px">
          ${svgDoughnut(topCats.map(x => ({ value: x.total, color: catColor(x.category) })), 140)}
          <div style="flex:1">${topCats.slice(0,5).map(x => {
            const pct = totalExp ? (x.total/totalExp*100) : 0;
            return `<div class="cat-row"><span class="label"><span class="dot" style="background:${catColor(x.category)}"></span>${esc(x.category)}</span><span><span class="amt">${fmtCurrency(x.total,true)}</span><span class="pct">${pct.toFixed(0)}%</span></span></div>`;
          }).join('')}</div>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>Budgets</h3><button class="muted-link" onclick="navigateTo('budgets')">Manage →</button></div>
        ${budgets.length ? budgets.slice(0,6).map(b => {
          const pct = b.limit ? (b.spent/b.limit*100) : 0;
          const cls = pct >= 100 ? 'danger' : pct >= 85 ? 'warn' : '';
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
              <span style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:2px;background:${catColor(b.category)}"></span><span style="font-weight:500">${esc(b.category)}</span></span>
              <span style="font-variant-numeric:tabular-nums;color:var(--ink-2)"><span style="color:${pct>=100?'var(--danger)':'var(--ink-1)'};font-weight:500">${fmtCurrency(b.spent,true)}</span><span style="color:var(--ink-3)"> / ${fmtCurrency(b.limit,true)}</span></span>
            </div>
            <div class="progress ${cls}"><div class="fill" style="width:${Math.min(pct,100)}%"></div></div>
          </div>`;
        }).join('') : '<div style="color:var(--ink-3);font-size:13px">No budgets set yet</div>'}
      </div>
      <div class="card">
        <div class="card-h"><h3>Accounts</h3><button class="muted-link" onclick="navigateTo('accounts')">Manage →</button></div>
        ${(accounts||[]).map(a => { const ac = acctColor(a); return `<div class="acct-row">
          <div class="left">
            <div class="acct-glyph" style="background:${ac}18;color:${ac};border-color:${ac}40">${esc((a.name||'?')[0])}</div>
            <div><div class="name">${esc(a.name)}</div><div class="type">${esc(a.account_type||'')}</div></div>
          </div>
          <div class="bal" style="color:${a.balance<0?'var(--danger)':'var(--ink-1)'}">${fmtCurrency(a.balance)}</div>
        </div>`; }).join('')}
        <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid var(--line-1);margin-top:4px">
          <span style="color:var(--ink-3);font-size:12px">Total</span>
          <span style="font-weight:600;font-size:15px;font-variant-numeric:tabular-nums">${fmtCurrency(totalBalance)}</span>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-h"><h3>Recurring & subscriptions</h3><span style="font-size:12px;color:var(--ink-3)">${recList.length} detected</span></div>
        ${recList.map(r => `<div class="recur-row">
          ${merchantGlyph(r.name)}
          <div><div class="nm">${esc(r.name)}${r.warn?'<span class="warn-badge">↑ price</span>':''}</div><div class="when">${esc(r.frequency||'Monthly')} · last ${fmtDate(r.last_date)}</div></div>
          <div style="text-align:right"><div class="avg">${fmtCurrency(r.avg_amount)}</div><div class="freq">avg</div></div>
        </div>`).join('') || '<div style="color:var(--ink-3);font-size:13px">No recurring transactions detected yet</div>'}
      </div>
      <div class="card">
        <div class="card-h"><h3>Savings goals</h3><button class="muted-link" onclick="navigateTo('budgets')">+ New</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${(goals||[]).map(g => {
            const pct = g.target_amount ? (g.current_amount/g.target_amount*100) : 0;
            return `<div class="goal"><div class="goal-h"><div class="goal-n">${esc(g.name)}</div><div class="goal-amt">${fmtCurrency(g.current_amount,true)} / ${fmtCurrency(g.target_amount,true)}</div></div>
              <div class="progress"><div class="fill" style="width:${pct}%;background:var(--accent)"></div></div>
              <div class="goal-pct"><span>${pct.toFixed(0)}% complete</span><span>${fmtCurrency(g.target_amount-g.current_amount,true)} to go</span></div></div>`;
          }).join('') || '<div style="color:var(--ink-3);font-size:13px;grid-column:span 2">No goals yet</div>'}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">
        <h3>Income vs expenses, last 12 months</h3>
        <div style="display:flex;gap:12px;font-size:12px;color:var(--ink-3)">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:var(--pos)"></span>Income</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:var(--ink-2)"></span>Expenses</span>
        </div>
      </div>
      ${svgSpendBars(trendHistory)}
    </div>

    <div class="card" id="forecast-card">
      <div class="card-h"><h3>Cash-flow forecast</h3><span style="font-size:12px;color:var(--ink-3)">Loading…</span></div>
    </div>
  </div>`;

  // Load forecast async (non-blocking)
  loadForecastCard();

  // Net worth time range filter
  document.querySelectorAll('#nw-filters .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#nw-filters .filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const months = parseInt(btn.dataset.months);
      const filtered = months === 0 ? nwData : nwData.slice(-months);
      const container = document.getElementById('nw-chart-container');
      if (container) container.innerHTML = svgNetWorthChart(filtered);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS VIEW
// ══════════════════════════════════════════════════════════════
let txPage = 1;
let txSelected = new Set();

async function _renderTransactions(c) {
  const month = currentMonth();
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  params.set('limit', '200');

  const [data, cats, accountsList] = await Promise.all([
    api(`/api/transactions?${params}`),
    api('/api/categories'),
    api('/api/accounts-list'),
  ]);
  const txns = data.transactions || data || [];
  const allCats = (cats || []).map(c => c.name || c);
  const acctNames = new Set((accountsList || []).map(a => a.name));
  txns.forEach(t => { if (t.account) acctNames.add(t.account); });
  const accts = [...acctNames];

  txSelected = new Set();

  const totalIn = txns.filter(t=>t.type==='Income').reduce((s,t)=>s+(t.amount||0),0);
  const totalOut = txns.filter(t=>t.type==='Expense').reduce((s,t)=>s+(t.amount||0),0);

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Transactions</div>
        <div class="page-sub">${txns.length} transactions${month ? ' in ' + new Date(month+'-15').toLocaleString('en-CA',{month:'long',year:'numeric'}) : ''} · <span style="color:var(--pos)">${fmtCurrency(totalIn)} in</span>, <span>${fmtCurrency(totalOut)} out</span></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="window.location.href='/api/export?month=${month||''}'">${icon('download',14)} Export CSV</button>
        <button class="btn btn-primary" onclick="openAddModal()">${icon('plus',14)} Add transaction</button>
      </div>
    </div>

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
      <div style="margin-left:auto;display:flex;gap:6px">
        <select id="tx-cat-filter" class="btn btn-sm" style="border-style:dashed;padding:5px 10px;font-size:12px;background:transparent;color:var(--ink-2);cursor:pointer">
          <option value="">Category</option>
          ${allCats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="tx-bulk-bar" style="display:none;background:var(--ink-1);color:white;padding:10px 16px;border-radius:10px;margin-bottom:12px;align-items:center;gap:12px;font-size:13px">
      <span><strong id="tx-sel-count">0</strong> selected</span>
      <button class="btn btn-sm" style="color:white;border-color:rgba(255,255,255,0.3)" onclick="txBulkAction('categorize')">Categorize</button>
      <button class="btn btn-sm" style="color:white;border-color:rgba(255,255,255,0.3)" onclick="txBulkAction('hide')">Hide</button>
      <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="txBulkAction('delete')">Delete</button>
      <button class="btn btn-sm" style="color:white;border-color:rgba(255,255,255,0.3);margin-left:auto" onclick="txSelected=new Set();refresh();updateBulkBar()">Clear</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl" id="tx-table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" id="tx-check-all"></th>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Account</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody id="tx-body"></tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:12px;color:var(--ink-3)">
      <span>Showing <span id="tx-showing">${txns.length}</span> of ${txns.length}</span>
    </div>
  </div>`;

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

  function renderRows(list) {
    tbody.innerHTML = list.map(t => {
      const amt = t.amount || 0;
      const isInc = t.type === 'Income';
      const displayAmt = isInc ? `+${fmtCurrency(Math.abs(amt))}` : `−${fmtCurrency(Math.abs(amt))}`;
      return `<tr data-id="${t.id}" class="${txSelected.has(t.id)?'selected':''}${t.is_hidden?' hidden-row':''}" style="cursor:pointer">
        <td><input type="checkbox" class="tx-check" data-id="${t.id}" ${txSelected.has(t.id)?'checked':''}></td>
        <td style="color:var(--ink-3);font-size:12.5px;white-space:nowrap">${fmtDate(t.date)}</td>
        <td><div class="name-cell">${merchantGlyph(t.name)}<div><div style="font-weight:500">${esc(t.name)}</div>${t.notes?`<div style="font-size:11.5px;color:var(--ink-3)">${esc(t.notes)}</div>`:''}</div></div></td>
        <td>${catPill(t.category)}</td>
        <td><span class="acct-tag">${esc(t.account || '')}</span></td>
        <td class="amt ${isInc?'amount-pos':'amount-neg'}" style="text-align:right;font-variant-numeric:tabular-nums">${displayAmt}</td>
      </tr>`;
    }).join('');
  }

  function getFiltered() {
    const q = (searchInput?.value||'').toLowerCase();
    const cat = catFilter?.value||'';
    return txns.filter(t => {
      if (q && !(t.name||'').toLowerCase().includes(q) && !(t.category||'').toLowerCase().includes(q) && !(t.notes||'').toLowerCase().includes(q)) return false;
      if (cat && t.category !== cat) return false;
      if (activeAcct && t.account !== activeAcct) return false;
      return true;
    });
  }

  function refresh() {
    const filtered = getFiltered();
    renderRows(filtered);
    const showingEl = document.getElementById('tx-showing');
    if (showingEl) showingEl.textContent = filtered.length;
  }
  refresh();

  searchInput?.addEventListener('input', refresh);
  catFilter?.addEventListener('change', refresh);

  checkAll?.addEventListener('change', () => {
    const checked = checkAll.checked;
    txSelected = checked ? new Set(getFiltered().map(t=>t.id)) : new Set();
    refresh(); updateBulkBar();
  });

  tbody.addEventListener('change', (e) => {
    if (!e.target.classList.contains('tx-check')) return;
    const id = parseInt(e.target.dataset.id);
    e.target.checked ? txSelected.add(id) : txSelected.delete(id);
    e.target.closest('tr').classList.toggle('selected', e.target.checked);
    updateBulkBar();
  });

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row || e.target.tagName === 'INPUT') return;
    const id = parseInt(row.dataset.id);
    const tx = txns.find(t => t.id === id);
    if (tx) openTxDrawer(tx, allCats, refresh);
  });

  function updateBulkBar() {
    const bar = document.getElementById('tx-bulk-bar');
    const cnt = document.getElementById('tx-sel-count');
    if (bar) bar.style.display = txSelected.size ? 'flex' : 'none';
    if (cnt) cnt.textContent = txSelected.size;
  }
}

window.txBulkAction = async function(action) {
  const ids = [...txSelected];
  if (!ids.length) return;
  if (action === 'delete') {
    if (!await appConfirm(`Delete ${ids.length} transactions?`, { title: 'Bulk delete', danger: true })) return;
    await api('/api/bulk-delete', 'POST', { ids });
  } else if (action === 'hide') {
    await api('/api/bulk-hide', 'POST', { ids });
  } else if (action === 'categorize') {
    const cat = await appPrompt('Enter category name:', { title: 'Bulk categorize', placeholder: 'e.g. Groceries' });
    if (!cat) return;
    await api('/api/bulk-categorize', 'POST', { ids, category: cat });
  }
  txSelected = new Set();
  refreshCurrentView();
};

function openTxDrawer(tx, cats, onSave) {
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
    drawer.className = 'drawer';
    document.body.appendChild(drawer);
  }

  const amt = tx.amount || 0;
  const isInc = tx.type === 'Income';
  const expenseCats = (cats||[]).filter(c => c !== 'Income' && c !== 'Paycheque' && c !== 'Salary');
  const quickCats = (cats||[]).slice(0, 12);

  drawer.innerHTML = `
    <div class="drawer-head">
      <div>
        <div style="font-size:11.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.04em;font-weight:500">${fmtDateLong(tx.date)} · ${esc(tx.account||'')}</div>
        <div style="font-size:16px;font-weight:500;margin-top:3px">${esc(tx.name)}</div>
      </div>
      <button class="btn-icon" onclick="closeTxDrawer()">${icon('x',14)}</button>
    </div>
    <div class="drawer-body">
      <div class="amt-big" style="color:${isInc ? 'var(--pos)' : 'var(--ink-1)'}">${isInc ? '+' : '−'}${fmtCurrency(Math.abs(amt))}</div>
      <div class="meta">${isInc ? 'Income' : 'Expense'} · ${esc(tx.category||'Uncategorized')}</div>

      <div class="section-h" style="margin-top:24px"><h2 style="font-size:13px">Category</h2></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="dr-chips">
        ${quickCats.map(c => `<button class="filter-chip${c===tx.category?' active':''}" data-cat="${esc(c)}" style="${c===tx.category ? 'background:'+catColor(c)+'22;border-color:'+catColor(c)+';color:'+catColor(c)+';font-weight:500' : ''}">${esc(c)}</button>`).join('')}
      </div>

      <div class="section-h"><h2 style="font-size:13px">Details</h2></div>
      <div class="field">
        <label>Description</label>
        <input id="dr-name" value="${esc(tx.name)}"/>
      </div>
      <div class="field">
        <label>Notes</label>
        <input id="dr-notes" value="${esc(tx.notes||'')}"/>
      </div>
      <div class="field">
        <label>Account</label>
        <select id="dr-account"><option value="${esc(tx.account||'')}">${esc(tx.account||'—')}</option></select>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;margin-top:8px">
        <div>
          <div style="font-size:13px;font-weight:500">Hide from dashboard</div>
          <div style="font-size:11.5px;color:var(--ink-3);margin-top:1px">Removes from totals but keeps the record</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="dr-hidden" ${tx.hidden ? 'checked' : ''}/>
          <span class="slider"></span>
        </label>
      </div>

      <div class="section-h">
        <h2 style="font-size:13px">Split transaction</h2>
        <button class="muted-link" id="dr-split-btn">+ Add split</button>
      </div>
      <div id="dr-splits"></div>

      <div id="dr-similar"></div>
    </div>
    <div class="drawer-foot">
      <button class="btn" style="color:var(--danger);border-color:transparent" id="dr-del">${icon('trash',13)} Delete</button>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="closeTxDrawer()">Cancel</button>
        <button class="btn btn-primary" id="dr-save">Save changes</button>
      </div>
    </div>`;

  overlay.classList.add('open');
  drawer.classList.add('open');
  overlay.onclick = () => closeTxDrawer();

  // Populate account dropdown
  api('/api/accounts-list').then(accts => {
    const el = document.getElementById('dr-account');
    if (el && accts) {
      el.innerHTML = (accts||[]).map(a => `<option value="${esc(a.name)}" ${a.name===tx.account?'selected':''}>${esc(a.name)}</option>`).join('');
    }
  });

  // Category chip selection
  let selectedCat = tx.category;
  document.querySelectorAll('#dr-chips .filter-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('#dr-chips .filter-chip').forEach(c => {
        c.classList.remove('active');
        c.style.cssText = '';
      });
      chip.classList.add('active');
      selectedCat = chip.dataset.cat;
      const clr = catColor(selectedCat);
      chip.style.cssText = `background:${clr}22;border-color:${clr};color:${clr};font-weight:500`;
    };
  });

  document.getElementById('dr-save').onclick = async () => {
    const isHidden = document.getElementById('dr-hidden').checked;
    await api(`/api/update/${tx.id}`, 'PATCH', {
      category: selectedCat,
      name: document.getElementById('dr-name').value,
      notes: document.getElementById('dr-notes').value,
      account: document.getElementById('dr-account').value,
    });
    if (isHidden !== !!tx.hidden) {
      await api(`/api/transactions/${tx.id}/${isHidden ? 'hide' : 'unhide'}`, 'PATCH');
    }
    closeTxDrawer();
    await refreshMonths();
    if (onSave) onSave();
    else refreshCurrentView();
  };

  document.getElementById('dr-del').onclick = async () => {
    if (!await appConfirm('Delete this transaction permanently?', { title: 'Delete transaction', danger: true })) return;
    await api(`/api/delete/${tx.id}`, 'DELETE');
    closeTxDrawer();
    await refreshMonths();
    refreshCurrentView();
  };

  document.getElementById('dr-split-btn').onclick = async () => {
    const splitAmt = await appPrompt('Enter amount for the split:', { title: 'Split transaction', defaultVal: (Math.abs(amt)/2).toFixed(2), placeholder: '0.00' });
    if (!splitAmt) return;
    await api(`/api/transactions/${tx.id}/split`, 'POST', { amount: parseFloat(splitAmt) });
    showToast('Transaction split');
    closeTxDrawer();
    refreshCurrentView();
  };

  // Load existing splits
  api(`/api/transactions/${tx.id}/splits`).then(splits => {
    const el = document.getElementById('dr-splits');
    if (!el || !splits || !splits.length) return;
    el.innerHTML = `<div class="card" style="padding:0">${splits.map(s =>
      `<div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--line-1);font-size:13px;align-items:center">
        <div><div style="font-weight:450">${esc(s.name||tx.name)}</div></div>
        <div class="mono" style="font-variant-numeric:tabular-nums">${fmtCurrency(Math.abs(s.amount))}</div>
      </div>`
    ).join('')}</div>`;
  });

  // Load similar transactions
  api(`/api/transactions?month=${tx.date?.slice(0,7)||''}`).then(resp => {
    const txns = resp?.transactions || resp || [];
    const firstName = (tx.name||'').split(' ')[0].toLowerCase();
    const sim = txns.filter(t => t.id !== tx.id && (t.name||'').split(' ')[0].toLowerCase() === firstName).slice(0, 5);
    if (!sim.length) return;
    const el = document.getElementById('dr-similar');
    if (!el) return;
    el.innerHTML = `
      <div class="section-h"><h2 style="font-size:13px">Similar transactions</h2><p>${sim.length} found</p></div>
      <div class="card" style="padding:0">
        ${sim.map(t => {
          const tInc = t.type === 'Income';
          return `<div style="display:flex;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--line-1);font-size:13px;align-items:center">
            <div>
              <div style="font-weight:450">${esc(t.name)}</div>
              <div style="font-size:11px;color:var(--ink-3);margin-top:1px">${fmtDate(t.date)} · ${esc(t.category||'')}</div>
            </div>
            <div class="mono" style="font-variant-numeric:tabular-nums">${tInc?'+':'−'}$${Math.abs(t.amount).toFixed(2)}</div>
          </div>`;
        }).join('')}
      </div>`;
  });
}

window.closeTxDrawer = function() {
  document.getElementById('drawer-overlay')?.classList.remove('open');
  document.getElementById('tx-drawer')?.classList.remove('open');
};

// ══════════════════════════════════════════════════════════════
// BUDGETS VIEW
// ══════════════════════════════════════════════════════════════
async function _renderBudgets(c) {
  const month = currentMonth();
  const [summary, budgets, goals, groups] = await Promise.all([
    month ? api(`/api/summary?month=${month}`) : null,
    api('/api/budgets'),
    api('/api/goals'),
    api('/api/category-groups'),
  ]);
  const bList = summary?.budgets || budgets || [];
  const cats = (summary?.by_category || []).filter(x => x.total > 0).sort((a,b) => b.total - a.total);
  const totalSpent = bList.reduce((s,b) => s + (b.spent||0), 0);
  const totalBudget = bList.reduce((s,b) => s + (b.limit||0), 0);
  const remaining = totalBudget - totalSpent;
  const pctAll = totalBudget ? (totalSpent/totalBudget*100) : 0;

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Budgets & goals</div>
        <div class="page-sub">${fmtCurrency(totalSpent,true)} of ${fmtCurrency(totalBudget,true)} spent · ${pctAll.toFixed(0)}% of budgets used</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="add-budget-btn">${icon('plus',14)} New budget</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi">
        <div class="kpi-label">Budgeted</div>
        <div class="kpi-value">${fmtCurrencyHTML(totalBudget)}</div>
        <div class="kpi-delta"><span>across ${bList.length} categories</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Spent</div>
        <div class="kpi-value">${fmtCurrencyHTML(totalSpent)}</div>
        <div class="kpi-delta"><span class="chip chip-up">${pctAll < 100 ? icon('check',11)+' on track' : 'over budget'}</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Remaining</div>
        <div class="kpi-value" style="color:${remaining>=0?'var(--pos)':'var(--danger)'}">${fmtCurrencyHTML(Math.abs(remaining))}</div>
        <div class="kpi-delta"><span>${remaining>=0?'left to spend':'over budget'}</span></div>
      </div>
    </div>

    <div class="section-h">
      <h2>Monthly budgets</h2>
      <p>Track spending against limits — set per category</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
      ${bList.map(b => {
        const pct = b.limit ? (b.spent/b.limit*100) : 0;
        const cls = pct >= 100 ? 'danger' : pct >= 85 ? 'warn' : '';
        const status = pct >= 100 ? 'Over' : pct >= 85 ? 'Close' : 'OK';
        const statusColor = pct >= 100 ? 'var(--danger)' : pct >= 85 ? 'var(--warn)' : 'var(--pos)';
        const statusBg = pct >= 100 ? 'var(--danger-soft)' : pct >= 85 ? 'var(--warn-soft)' : 'var(--pos-soft)';
        const cc = catColor(b.category);
        return `<div class="card" style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:36px;height:36px;border-radius:10px;background:${cc}18;color:${cc};display:grid;place-items:center;font-size:16px;font-weight:600">${(b.category||'?')[0]}</div>
              <div>
                <div style="font-size:14px;font-weight:500">${esc(b.category)}</div>
              </div>
            </div>
            <span style="font-size:11px;padding:2px 7px;border-radius:5px;color:${statusColor};background:${statusBg};font-weight:500">${status}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;font-variant-numeric:tabular-nums">
            <span style="font-weight:500">${fmtCurrency(b.spent||0)}</span>
            <span style="color:var(--ink-3)">of ${fmtCurrency(b.limit,true)}</span>
          </div>
          <div class="progress ${cls}"><div class="fill" style="width:${Math.min(pct,100)}%"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--ink-3)">
            <span>${pct.toFixed(0)}% used</span>
            <div style="display:flex;gap:4px;align-items:center">
              <button class="icon-btn" style="width:20px;height:20px" onclick="editBudget('${esc(b.category)}',${b.limit||0})">${icon('edit',11)}</button>
              <button class="icon-btn" style="width:20px;height:20px" onclick="deleteBudget('${esc(b.category)}')">${icon('trash',11)}</button>
            </div>
          </div>
        </div>`;
      }).join('') || '<div style="color:var(--ink-3);font-size:13px;grid-column:span 2">No budgets set yet. Click "New budget" to add one.</div>'}
    </div>

    <div class="section-h">
      <h2>Savings goals</h2>
      <p>Stash money toward specific targets</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
      ${(goals||[]).map(g => {
        const pct = g.target_amount ? (g.current_amount/g.target_amount*100) : 0;
        const gc = '#5b9c6e';
        return `<div class="card" style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div>
              <div style="font-size:11.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.04em;font-weight:500">Goal</div>
              <div style="font-size:16px;font-weight:500;margin-top:2px">${esc(g.icon||'')} ${esc(g.name)}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm" onclick="contributeGoal(${g.id})">Contribute</button>
              <button class="btn btn-sm btn-ghost" onclick="editGoal(${g.id})">${icon('edit',12)}</button>
              <button class="btn btn-sm btn-ghost" onclick="deleteGoal(${g.id})">${icon('trash',12)}</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;align-items:baseline">
            <span style="font-size:22px;font-weight:500;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">${fmtCurrency(g.current_amount,true)}</span>
            <span style="font-size:13px;color:var(--ink-3);font-variant-numeric:tabular-nums">of ${fmtCurrency(g.target_amount,true)}</span>
          </div>
          <div class="progress"><div class="fill" style="width:${pct}%;background:${gc}"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--ink-3)">
            <span style="color:${gc};font-weight:500">${pct.toFixed(0)}% complete</span>
            <span>${fmtCurrency(Math.max(g.target_amount-g.current_amount,0),true)} to go</span>
          </div>
        </div>`;
      }).join('') || '<div style="color:var(--ink-3);font-size:13px;grid-column:span 2">No goals yet</div>'}
      <div class="card" style="padding:16px;display:grid;place-items:center;border-style:dashed;cursor:pointer" id="add-goal-card">
        <div style="text-align:center;color:var(--ink-3)">
          ${icon('plus',20)}
          <div style="font-size:13px;margin-top:6px">Add a goal</div>
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('add-budget-btn')?.addEventListener('click', () => openBudgetModal());
  document.getElementById('add-goal-card')?.addEventListener('click', () => openGoalModal());
}

function openBudgetModal() {
  const catOptions = STATE.expenseCats.map(c => `<option value="${esc(c.name)}">${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="budget-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>New budget</h3><button class="icon-btn" onclick="closeBudgetModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div class="field">
          <label>Category</label>
          <select id="budget-cat">${catOptions}<option value="">Other…</option></select>
        </div>
        <div class="field" id="budget-custom-field" style="display:none;margin-top:12px">
          <label>Category name</label>
          <input id="budget-custom-cat" placeholder="e.g. Groceries">
        </div>
        <div class="field" style="margin-top:12px">
          <label>Monthly limit</label>
          <input id="budget-limit" placeholder="e.g. 500" inputmode="decimal">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeBudgetModal()">Cancel</button>
        <button class="btn btn-primary" id="budget-save-btn">${icon('check',14)} Create budget</button>
      </div>
    </div>
  </div>`);
  document.getElementById('budget-modal-back').addEventListener('click', closeBudgetModal);
  document.getElementById('budget-cat').addEventListener('change', (e) => {
    document.getElementById('budget-custom-field').style.display = e.target.value === '' ? 'block' : 'none';
  });
  document.getElementById('budget-save-btn').addEventListener('click', async () => {
    const cat = document.getElementById('budget-cat').value || document.getElementById('budget-custom-cat').value;
    const limit = parseFloat(document.getElementById('budget-limit').value);
    if (!cat || !limit) { showToast('Please fill in all fields'); return; }
    await api('/api/budgets', 'POST', { category: cat, amount: limit });
    closeBudgetModal();
    showToast(`Budget set: ${cat} · ${fmtCurrency(limit)}/mo`);
    refreshCurrentView();
  });
}

window.closeBudgetModal = function() { document.getElementById('budget-modal-back')?.remove(); };

window.editBudget = function(category, currentLimit) {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="budget-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>Edit budget</h3><button class="icon-btn" onclick="closeBudgetModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Category</label><input value="${category}" disabled style="opacity:0.6"></div>
        <div class="field" style="margin-top:12px"><label>Monthly limit</label><input id="budget-edit-limit" value="${currentLimit}" inputmode="decimal"></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeBudgetModal()">Cancel</button>
        <button class="btn btn-primary" id="budget-edit-save">Save</button>
      </div>
    </div>
  </div>`);
  document.getElementById('budget-modal-back').addEventListener('click', closeBudgetModal);
  document.getElementById('budget-edit-save').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('budget-edit-limit').value);
    if (!amount) { showToast('Enter a valid amount'); return; }
    await api('/api/budgets', 'POST', { category, amount });
    closeBudgetModal();
    showToast(`Budget updated: ${category}`);
    refreshCurrentView();
  });
};

window.deleteBudget = async function(category) {
  if (!await appConfirm(`Delete the budget for "${category}"?`, { title: 'Delete budget', danger: true })) return;
  await api(`/api/budgets/${encodeURIComponent(category)}`, 'DELETE');
  showToast('Budget deleted');
  refreshCurrentView();
};

function openGoalModal() {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="goal-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>New savings goal</h3><button class="icon-btn" onclick="closeGoalModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Goal name</label><input id="goal-name" placeholder="e.g. Emergency Fund"></div>
        <div class="field" style="margin-top:12px"><label>Target amount</label><input id="goal-target" placeholder="e.g. 10000" inputmode="decimal"></div>
        <div class="field" style="margin-top:12px"><label>Icon (optional emoji)</label><input id="goal-icon" placeholder="e.g. 🎯"></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeGoalModal()">Cancel</button>
        <button class="btn btn-primary" id="goal-save-btn">${icon('check',14)} Create goal</button>
      </div>
    </div>
  </div>`);
  document.getElementById('goal-modal-back').addEventListener('click', closeGoalModal);
  document.getElementById('goal-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('goal-name').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const goalIcon = document.getElementById('goal-icon').value;
    if (!name || !target) { showToast('Please fill in name and target'); return; }
    await api('/api/goals', 'POST', { name, target_amount: target, icon: goalIcon });
    closeGoalModal();
    refreshCurrentView();
  });
}

window.closeGoalModal = function() { document.getElementById('goal-modal-back')?.remove(); };

window.contributeGoal = async function(id) {
  const amount = await appPrompt('How much would you like to contribute?', { title: 'Add contribution', placeholder: '50.00' });
  if (!amount) return;
  await api(`/api/goals/${id}/contribute`, 'POST', { amount: parseFloat(amount) });
  refreshCurrentView();
};

window.deleteGoal = async function(id) {
  if (!await appConfirm('Delete this savings goal?', { title: 'Delete goal', danger: true })) return;
  await api(`/api/goals/${id}`, 'DELETE');
  refreshCurrentView();
};

window.editGoal = async function(id) {
  const goals = await api('/api/goals');
  const g = (goals||[]).find(x => x.id === id);
  if (!g) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="goal-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>Edit goal</h3><button class="icon-btn" onclick="closeGoalModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
          <div class="field"><label>Goal name</label><input id="goal-edit-name" value="${esc(g.name)}"></div>
          <div class="field"><label>Icon</label><input id="goal-edit-icon" value="${esc(g.icon||'')}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div class="field"><label>Target amount</label><input id="goal-edit-target" value="${g.target_amount}" inputmode="decimal"></div>
          <div class="field"><label>Current amount</label><input id="goal-edit-current" value="${g.current_amount}" inputmode="decimal"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeGoalModal()">Cancel</button>
        <button class="btn btn-primary" id="goal-edit-save">Save</button>
      </div>
    </div>
  </div>`);
  document.getElementById('goal-modal-back').addEventListener('click', closeGoalModal);
  document.getElementById('goal-edit-save').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('goal-edit-name').value.trim(),
      icon: document.getElementById('goal-edit-icon').value.trim(),
      target_amount: parseFloat(document.getElementById('goal-edit-target').value),
      current_amount: parseFloat(document.getElementById('goal-edit-current').value),
    };
    if (!data.name || !data.target_amount) { showToast('Name and target are required'); return; }
    await api(`/api/goals/${id}`, 'PATCH', data);
    closeGoalModal();
    refreshCurrentView();
  });
};

// ══════════════════════════════════════════════════════════════
// ACCOUNTS VIEW
// ══════════════════════════════════════════════════════════════
async function _renderAccounts(c) {
  const [accounts, nw] = await Promise.all([
    api('/api/accounts-list'),
    api('/api/net-worth'),
  ]);
  const list = accounts || [];
  const totalAssets = list.filter(a => (a.balance||0) >= 0).reduce((s,a) => s + (a.balance||0), 0);
  const totalDebt = list.filter(a => (a.balance||0) < 0).reduce((s,a) => s + Math.abs(a.balance||0), 0);
  const netWorth = totalAssets - totalDebt;
  const nwData = (nw||[]).map(d => ({m:d.month, v:d.net_worth}));
  const prevNW = nwData.length >= 2 ? nwData[nwData.length-2].v : netWorth;
  const deltaNW = prevNW ? ((netWorth - prevNW) / Math.abs(prevNW) * 100) : 0;
  const maxBalance = Math.max(totalAssets, totalDebt, 1);

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Accounts & net worth</div>
        <div class="page-sub">All balances computed from your opening balances + imported transactions — nothing leaves your machine</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="add-acct-btn">${icon('plus',14)} Add account</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi hero-aurora">
        <div class="kpi-label">Net worth</div>
        <div class="kpi-value">${fmtCurrencyHTML(netWorth)}</div>
        <div class="kpi-delta">
          <span class="chip ${deltaNW >= 0 ? 'chip-up' : 'chip-dn'}">${icon(deltaNW >= 0 ? 'arrow_up' : 'arrow_dn', 11)} ${Math.abs(deltaNW).toFixed(1)}%</span>
          <span>vs last month</span>
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Assets</div>
        <div class="kpi-value" style="color:var(--pos)">${fmtCurrencyHTML(totalAssets)}</div>
        <div class="kpi-delta"><span>across ${list.filter(a => (a.balance||0) >= 0).length} accounts</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Liabilities</div>
        <div class="kpi-value" style="color:var(--danger)">−${fmtCurrencyHTML(totalDebt)}</div>
        <div class="kpi-delta"><span>${list.filter(a => (a.balance||0) < 0).length || 'no'} credit balance${list.filter(a => (a.balance||0) < 0).length !== 1 ? 's' : ''}</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-h">
        <div>
          <h3>Net worth over time</h3>
          <div style="font-size:22px;font-weight:500;letter-spacing:-0.02em;margin-top:4px;font-variant-numeric:tabular-nums">
            ${fmtCurrency(netWorth,true)}
            ${nwData.length >= 2 ? `<span style="margin-left:10px;font-size:13px;color:${netWorth - nwData[0].v >= 0 ? 'var(--pos)' : 'var(--danger)'};font-weight:500">
              ${netWorth - nwData[0].v >= 0 ? '+' : ''}${fmtCurrency(netWorth - nwData[0].v, true)} <span style="color:var(--ink-3)">over ${nwData.length} months</span>
            </span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="filter-chip">3M</button>
          <button class="filter-chip">6M</button>
        <div style="display:flex;gap:4px" id="acct-nw-filters">
          <button class="filter-chip" data-months="3">3M</button>
          <button class="filter-chip" data-months="6">6M</button>
          <button class="filter-chip active" data-months="12">1Y</button>
          <button class="filter-chip" data-months="0">All</button>
        </div>
      </div>
      <div id="acct-nw-chart">${svgNetWorthChart(nwData)}</div>
    </div>

    <div class="section-h"><h2>Your accounts</h2><p>Click any account to see details and edit</p></div>
    <div class="card" style="padding:0;overflow:hidden">
      ${list.length ? list.map((a, i) => {
        const pct = (Math.abs(a.balance||0) / maxBalance) * 100;
        const ac = acctColor(a);
        const isDebt = (a.balance||0) < 0;
        return `<div style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:16px;padding:16px 20px;align-items:center;${i < list.length-1 ? 'border-bottom:1px solid var(--line-1)' : ''};cursor:pointer" onclick="editAccount(${a.id})">
          <div class="acct-glyph" style="width:40px;height:40px;background:${ac}15;color:${ac};border-color:${ac}30;font-size:15px;font-weight:600">${esc((a.name||'?')[0])}</div>
          <div>
            <div style="font-weight:500;font-size:14.5px">${esc(a.name)}</div>
            <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${esc(a.account_type||'chequing')} · Opening ${fmtCurrency(a.opening_balance||0,true)}</div>
          </div>
          <div style="width:160px">
            <div class="progress"><div class="fill" style="width:${pct}%;background:${isDebt ? 'var(--danger)' : ac}"></div></div>
          </div>
          <div style="text-align:right;min-width:110px">
            <div style="font-weight:600;font-size:15px;font-variant-numeric:tabular-nums;color:${isDebt ? 'var(--danger)' : 'var(--ink-1)'}">${fmtCurrency(a.balance||0)}</div>
            <div style="font-size:11px;color:var(--ink-3)">${isDebt ? 'owed' : 'balance'}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" onclick="event.stopPropagation();editAccount(${a.id})">${icon('edit',13)}</button>
          </div>
        </div>`;
      }).join('') : '<div style="padding:20px;text-align:center;color:var(--ink-3)">No accounts yet</div>'}
    </div>
  </div>`;

  document.getElementById('add-acct-btn')?.addEventListener('click', () => openAccountModal());

  // Net worth time range filter
  document.querySelectorAll('#acct-nw-filters .filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#acct-nw-filters .filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const months = parseInt(btn.dataset.months);
      const filtered = months === 0 ? nwData : nwData.slice(-months);
      const container = document.getElementById('acct-nw-chart');
      if (container) container.innerHTML = svgNetWorthChart(filtered);
    });
  });
}

function openAccountModal(existing) {
  const isEdit = !!existing;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="acct-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>${isEdit ? 'Edit' : 'New'} account</h3><button class="icon-btn" onclick="closeAccountModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Account name</label><input id="acct-name" value="${esc(existing?.name||'')}" placeholder="e.g. RBC Chequing"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div class="field"><label>Type</label><select id="acct-type">
            <option value="chequing" ${(existing?.account_type||'chequing')==='chequing'?'selected':''}>Chequing</option>
            <option value="savings" ${existing?.account_type==='savings'?'selected':''}>Savings</option>
            <option value="credit" ${existing?.account_type==='credit'?'selected':''}>Credit</option>
            <option value="investment" ${existing?.account_type==='investment'?'selected':''}>Investment</option>
            <option value="other" ${existing?.account_type==='other'?'selected':''}>Other</option>
          </select></div>
          <div class="field"><label>Opening balance</label><input id="acct-balance" value="${existing?.opening_balance||0}" inputmode="decimal"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeAccountModal()">Cancel</button>
        <button class="btn btn-primary" id="acct-save-btn">${isEdit ? 'Save' : 'Add account'}</button>
      </div>
    </div>
  </div>`);
  document.getElementById('acct-modal-back').addEventListener('click', closeAccountModal);
  document.getElementById('acct-save-btn').addEventListener('click', async () => {
    const data = { name: document.getElementById('acct-name').value, account_type: document.getElementById('acct-type').value, opening_balance: parseFloat(document.getElementById('acct-balance').value) || 0 };
    if (!data.name) { showToast('Account name is required'); return; }
    if (isEdit) await api(`/api/accounts-list/${existing.id}`, 'PATCH', data);
    else await api('/api/accounts-list', 'POST', data);
    closeAccountModal();
    refreshCurrentView();
  });
}

window.closeAccountModal = function() { document.getElementById('acct-modal-back')?.remove(); };

function acctRow(a) {
  return `<div class="acct-row" style="cursor:pointer" onclick="editAccount(${a.id})">
    <div class="left">
      <div class="acct-glyph" style="background:${acctColor(a)}18;color:${acctColor(a)};border-color:${acctColor(a)}40">${esc((a.name||'?')[0])}</div>
      <div><div class="name">${esc(a.name)}</div><div class="type">${esc(a.account_type||'')}</div></div>
    </div>
    <div class="bal" style="color:${a.balance<0?'var(--danger)':'var(--ink-1)'}">
      ${fmtCurrency(a.balance)}
    </div>
  </div>`;
}

window.editAccount = async function(id) {
  const accounts = await api('/api/accounts-list');
  const a = (accounts||[]).find(x => x.id === id);
  if (a) openAccountModal(a);
};

// ══════════════════════════════════════════════════════════════
// YEAR VIEW
// ══════════════════════════════════════════════════════════════
async function _renderYear(c) {
  const year = (currentMonth()||new Date().toISOString().slice(0,7)).slice(0,4);
  const [data, trends] = await Promise.all([
    api(`/api/year/${year}`),
    api('/api/trends?months=12'),
  ]);
  const allMonths = data?.months || [];
  const months = allMonths.filter(m => m.income > 0 || m.expenses > 0);
  const totalInc = allMonths.reduce((s,m) => s + (m.income||0), 0);
  const totalExp = allMonths.reduce((s,m) => s + (m.expenses||0), 0);
  const totalNet = totalInc - totalExp;
  const activeCount = months.length || 1;
  const avgInc = totalInc / activeCount;
  const avgExp = totalExp / activeCount;

  function monthLabel(ym) {
    const [y,m] = ym.split('-').map(Number);
    return new Date(y, m-1, 15).toLocaleString('en-CA',{month:'long',year:'numeric'});
  }
  function monthShort(ym) {
    const [y,m] = ym.split('-').map(Number);
    return new Date(y, m-1, 15).toLocaleString('en-CA',{month:'short'});
  }

  const savingsRate = totalInc ? ((totalNet/totalInc)*100).toFixed(0) : 0;
  const max = Math.max(...allMonths.map(m => Math.max(m.income||0, m.expenses||0)), 1);

  // Find best/worst months
  const bestMonth = months.length ? months.reduce((a,b) => ((b.income||0)-(b.expenses||0)) > ((a.income||0)-(a.expenses||0)) ? b : a) : null;
  const worstMonth = months.length ? months.reduce((a,b) => (b.expenses||0) > (a.expenses||0) ? b : a) : null;

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Year in review · ${year}</div>
        <div class="page-sub">${months.length} months with data · Net savings ${fmtCurrency(totalNet, true)}</div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi">
        <div class="kpi-label">Total income</div>
        <div class="kpi-value" style="color:var(--pos)">${fmtCurrencyHTML(totalInc)}</div>
        <div class="kpi-delta"><span>across ${months.length} months</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total expenses</div>
        <div class="kpi-value">${fmtCurrencyHTML(totalExp)}</div>
        <div class="kpi-delta"><span>${fmtCurrency(avgExp,true)}/mo avg</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Net saved</div>
        <div class="kpi-value" style="color:${totalNet>=0?'var(--pos)':'var(--danger)'}">${fmtCurrencyHTML(totalNet)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Savings rate</div>
        <div class="kpi-value">${savingsRate}<span class="cents">%</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-h">
        <h3>Income vs expenses, every month</h3>
        <div style="display:flex;gap:12px;font-size:12px;color:var(--ink-3)">
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:var(--pos)"></span>Income</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:var(--ink-2)"></span>Expenses</span>
        </div>
      </div>
      <div class="year-strip">
        ${allMonths.map((m,i) => {
          const incH = max ? ((m.income||0)/max*100) : 0;
          const expH = max ? ((m.expenses||0)/max*100) : 0;
          const isCurrent = m.month === currentMonth();
          return `<div class="year-bar${isCurrent?' current':''}" title="${monthLabel(m.month)}: ${fmtCurrency(m.income||0)} in / ${fmtCurrency(m.expenses||0)} out">
            <div style="display:flex;align-items:flex-end;gap:3px;height:calc(100% - 18px);justify-content:center">
              <div class="ypos" style="width:11px;height:${incH}%;min-height:${m.income?2:0}px"></div>
              <div class="yneg" style="width:11px;height:${expH}%;min-height:${m.expenses?2:0}px"></div>
            </div>
            <div class="ymo">${monthShort(m.month)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="grid-2">
      ${data?.top_categories?.length ? `<div class="card">
        <div class="card-h"><h3>Top categories this year</h3></div>
        ${(data.top_categories).map(x => {
          const pct = totalExp ? (x.total/totalExp*100) : 0;
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
              <span style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:2px;background:${catColor(x.category)}"></span><span style="font-weight:500">${esc(x.category)}</span></span>
              <span style="font-variant-numeric:tabular-nums">${fmtCurrency(x.total,true)} <span style="color:var(--ink-3);margin-left:6px">${pct.toFixed(0)}%</span></span>
            </div>
            <div class="progress"><div class="fill" style="width:${pct}%;background:${catColor(x.category)}"></div></div>
          </div>`;
        }).join('')}
      </div>` : '<div></div>'}

      <div class="card">
        <div class="card-h"><h3>Year at a glance</h3></div>
        ${[
          ['Best saving month', bestMonth ? monthLabel(bestMonth.month) : '—', bestMonth ? `+${fmtCurrency((bestMonth.income||0)-(bestMonth.expenses||0))} saved` : ''],
          ['Biggest spending', worstMonth ? monthLabel(worstMonth.month) : '—', worstMonth ? `${fmtCurrency(worstMonth.expenses)} spent` : ''],
          ['Average income', fmtCurrency(avgInc, true)+'/mo', `across ${months.length} months`],
          ['Average expenses', fmtCurrency(avgExp, true)+'/mo', `${savingsRate}% savings rate`],
        ].map(row => `<div class="list-row">
          <div>
            <div style="font-size:11.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.04em;font-weight:500">${esc(row[0])}</div>
            <div style="font-size:13.5px;font-weight:500;margin-top:2px">${row[1]}</div>
          </div>
          <div style="font-size:12px;color:var(--ink-3)">${row[2]}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// SCHEDULES VIEW
// ══════════════════════════════════════════════════════════════
async function _renderSchedules(c) {
  const [schedules, recurring] = await Promise.all([
    api('/api/schedules'),
    api('/api/recurring'),
  ]);
  const sList_ = schedules || [];
  // Map enabled→paused for UI convenience
  const sList = sList_.map(s => ({...s, paused: !s.enabled}));
  const rItems = recurring?.recurring || (Array.isArray(recurring) ? recurring : []);
  const totalMonthly = sList.filter(s => !s.paused && (s.frequency||'').toLowerCase()==='monthly').reduce((s,x) => s + Math.abs(x.amount||0), 0)
    + rItems.reduce((s,r) => s + (r.total_monthly||r.avg_amount||0), 0);
  const now = new Date();
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const due = sList.filter(s => !s.paused && s.next_due && new Date(s.next_due+'T00:00:00') <= in7);
  const active = sList.filter(s => !s.paused).length;
  const paused = sList.length - active;

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Scheduled transactions</div>
        <div class="page-sub">Pre-define recurring expenses & income — Boreal auto-posts them on the due date</div>
      </div>
      <div style="display:flex;gap:8px">
        ${due.length ? `<button class="btn" id="post-all-due-btn">${icon('clock',14)} Post all due (${due.length})</button>` : ''}
        <button class="btn btn-primary" id="add-sched-btn">${icon('plus',14)} New schedule</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi">
        <div class="kpi-label">Monthly committed</div>
        <div class="kpi-value">${fmtCurrencyHTML(totalMonthly)}</div>
        <div class="kpi-delta"><span>recurring expenses</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Due in next 7 days</div>
        <div class="kpi-value">${due.length}</div>
        <div class="kpi-delta"><span>${fmtCurrency(due.reduce((s,d) => s + Math.abs(d.amount||0), 0), true)} pending</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Active schedules</div>
        <div class="kpi-value">${active}<span class="cents">/${sList.length}</span></div>
        <div class="kpi-delta"><span>${paused} paused</span></div>
      </div>
    </div>

    <div class="section-h"><h2>Coming up</h2><p>Your scheduled payments</p></div>

    ${sList.length ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
      ${sList.map(s => {
        const isDue = !s.paused && s.next_due && new Date(s.next_due+'T00:00:00') <= in7;
        const catC = catColor(s.category || 'Uncategorized');
        const isIncome = (s.type||'').toLowerCase() === 'income';
        return `<div class="schedule-card${isDue?' due':''}" style="${s.paused?'opacity:0.55':''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="display:flex;gap:12px;align-items:center">
              <div style="width:40px;height:40px;border-radius:10px;background:${catC}18;color:${catC};display:grid;place-items:center;font-size:16px;font-weight:600">${(s.name||'?')[0].toUpperCase()}</div>
              <div>
                <div style="font-size:14px;font-weight:500">${esc(s.name)}${s.paused ? '<span style="margin-left:6px;font-size:11px;color:var(--ink-3);font-weight:400">· paused</span>' : ''}</div>
                <div style="font-size:11.5px;color:var(--ink-3);margin-top:2px">${esc(s.frequency||'Monthly')} · ${esc(s.category||'Uncategorized')}</div>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:15px;font-weight:500;font-variant-numeric:tabular-nums;color:${isIncome?'var(--pos)':'var(--ink-1)'}">${isIncome?'+':'−'}${fmtCurrency(Math.abs(s.amount||0),true)}</div>
              <div style="font-size:11.5px;color:var(--ink-3);margin-top:2px">Next: ${fmtDateLong(s.next_due||s.due_date)}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:12px;justify-content:flex-end">
            <button class="btn btn-sm btn-ghost" onclick="togglePauseSchedule(${s.id},${!s.paused})">${icon(s.paused?'play':'pause',12)}</button>
            <button class="btn btn-sm btn-ghost" onclick="editSchedule(${s.id})">${icon('edit',12)}</button>
            <button class="btn btn-sm btn-ghost" onclick="deleteSchedule(${s.id})">${icon('trash',12)}</button>
            ${isDue && !s.paused ? `<button class="btn btn-sm btn-primary" onclick="postDueSchedule(${s.id})">Post now</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    ${rItems.length ? `<div class="section-h"><h2>Detected recurring</h2><p>Auto-detected from your transactions</p></div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
      ${rItems.map(r => `<div class="schedule-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;gap:12px;align-items:center">
            ${merchantGlyph(r.name)}
            <div>
              <div style="font-size:14px;font-weight:500">${esc(r.name)}</div>
              <div style="font-size:11.5px;color:var(--ink-3);margin-top:2px">${esc(r.frequency||'Monthly')} · seen ${r.months_seen||0} months</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:15px;font-weight:500;font-variant-numeric:tabular-nums">${fmtCurrency(r.avg_amount||0)}</div>
            <div style="font-size:11.5px;color:var(--ink-3);margin-top:2px">/mo avg</div>
          </div>
        </div>
      </div>`).join('')}
    </div>` : ''}

    ${!sList.length && !rItems.length ? '<div style="color:var(--ink-3);font-size:13px;padding:20px 0">No scheduled or recurring transactions yet. Add one to get started!</div>' : ''}
  </div>`;

  document.getElementById('add-sched-btn')?.addEventListener('click', () => openScheduleModal());
  document.getElementById('post-all-due-btn')?.addEventListener('click', async () => {
    for (const s of due) {
      await api(`/api/schedules/post-due`, 'POST', { id: s.id });
    }
    showToast(`Posted ${due.length} due schedules`);
    refreshCurrentView();
  });
}

function openScheduleModal(existing) {
  const isEdit = !!existing;
  // Fetch accounts for dropdown
  api('/api/accounts-list').then(accts => {
    const el = document.getElementById('sched-account');
    if (el) el.innerHTML = (accts||[]).map(a => `<option value="${esc(a.name)}" ${a.name===(existing?.account||'')? 'selected':''}>${esc(a.name)}</option>`).join('');
  });
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="sched-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>${isEdit ? 'Edit' : 'New'} schedule</h3><button class="icon-btn" onclick="closeScheduleModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field"><label>Name</label><input id="sched-name" value="${esc(existing?.name||'')}" placeholder="e.g. Netflix"></div>
          <div class="field"><label>Amount</label><input id="sched-amount" value="${existing?.amount||''}" placeholder="17.99" inputmode="decimal"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div class="field"><label>Type</label><select id="sched-type">
            <option value="Expense" ${(existing?.type||'Expense')==='Expense'?'selected':''}>Expense</option>
            <option value="Income" ${existing?.type==='Income'?'selected':''}>Income</option>
          </select></div>
          <div class="field"><label>Frequency</label><select id="sched-freq">
            <option value="monthly" ${(existing?.frequency||'monthly')==='monthly'?'selected':''}>Monthly</option>
            <option value="biweekly" ${existing?.frequency==='biweekly'?'selected':''}>Biweekly</option>
            <option value="weekly" ${existing?.frequency==='weekly'?'selected':''}>Weekly</option>
            <option value="yearly" ${existing?.frequency==='yearly'?'selected':''}>Yearly</option>
          </select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div class="field"><label>Category</label><input id="sched-cat" value="${esc(existing?.category||'')}" placeholder="e.g. Subscriptions"></div>
          <div class="field"><label>Next due date</label><input type="date" id="sched-due" value="${existing?.next_due||''}"></div>
        </div>
        <div class="field" style="margin-top:12px"><label>Account</label><select id="sched-account"><option>Loading…</option></select></div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeScheduleModal()">Cancel</button>
        <button class="btn btn-primary" id="sched-save-btn">${isEdit ? 'Save changes' : 'Create schedule'}</button>
      </div>
    </div>
  </div>`);
  document.getElementById('sched-modal-back').addEventListener('click', closeScheduleModal);
  document.getElementById('sched-save-btn').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('sched-name').value,
      amount: parseFloat(document.getElementById('sched-amount').value),
      type: document.getElementById('sched-type').value,
      frequency: document.getElementById('sched-freq').value,
      next_due: document.getElementById('sched-due').value,
      category: document.getElementById('sched-cat').value,
      account: document.getElementById('sched-account').value,
    };
    if (!data.name || !data.amount || !data.category || !data.account || !data.next_due) {
      showToast('Please fill in all required fields'); return;
    }
    if (isEdit) await api(`/api/schedules/${existing.id}`, 'PATCH', data);
    else await api('/api/schedules', 'POST', data);
    closeScheduleModal();
    refreshCurrentView();
  });
}

window.closeScheduleModal = function() {
  document.getElementById('sched-modal-back')?.remove();
};

window.togglePauseSchedule = async function(id, pause) {
  await api(`/api/schedules/${id}`, 'PATCH', { enabled: !pause });
  refreshCurrentView();
};

window.editSchedule = async function(id) {
  const schedules = await api('/api/schedules');
  const s = (schedules||[]).find(x => x.id === id);
  if (s) openScheduleModal(s);
};

window.postDueSchedule = async function(id) {
  const r = await api(`/api/schedules/${id}/post`, 'POST');
  if (r?.posted) showToast('Transaction posted');
  else showToast('Scheduled — advanced to next date');
  await refreshMonths();
  refreshCurrentView();
};

window.deleteSchedule = async function(id) {
  if (!await appConfirm('Delete this schedule?', { title: 'Delete schedule', danger: true })) return;
  await api(`/api/schedules/${id}`, 'DELETE');
  refreshCurrentView();
};

// ══════════════════════════════════════════════════════════════
// IMPORT VIEW (CSV wizard + drag-drop + OFX)
// ══════════════════════════════════════════════════════════════
async function _renderImport(c) {
  const banks = [
    { n: "TD",           ch: "#0d8a2e" },
    { n: "Tangerine",    ch: "#ff6e1f" },
    { n: "RBC",          ch: "#0046ad" },
    { n: "CIBC",         ch: "#c8102e" },
    { n: "Scotia",       ch: "#ec111a" },
    { n: "BMO",          ch: "#0079c1" },
    { n: "National",     ch: "#e3001b" },
    { n: "Wealthsimple", ch: "#000000" },
    { n: "Amex",         ch: "#006fcf" },
    { n: "Any (CSV)",    ch: "#9b6fb7" },
  ];

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Import</div>
        <div class="page-sub">Drop bank CSVs or OFX/QFX downloads — duplicates are detected by SHA-256 hash, never double-counted</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="window.location.href='/api/backup'">${icon('upload',14)} Backup</button>
        <button class="btn" id="import-restore-btn">${icon('download',14)} Restore</button>
      </div>
    </div>

    <div class="dropzone" id="csv-drop">
      <div style="width:56px;height:56px;border-radius:16px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;margin:0 auto">
        ${icon('upload',24)}
      </div>
      <h3>Drop your bank exports here</h3>
      <p>CSV · OFX · QFX — multiple files at once · auto-detects format</p>
      <div class="browse" style="display:flex;gap:8px;justify-content:center;margin-top:16px">
        <button class="btn btn-primary" id="import-choose-btn">${icon('plus',14)} Choose files</button>
      </div>
      <input type="file" id="csv-file" accept=".csv,.ofx,.qfx" multiple style="display:none">
    </div>

    <div id="csv-wizard" style="display:none"></div>

    <div class="section-h">
      <h2>Supported banks</h2>
      <p>If yours isn't here, the CSV wizard will map columns for you</p>
    </div>

    <div class="bank-grid">
      ${banks.map(b => `<div class="bank-chip">
        <div class="bank-glyph" style="background:${b.ch}">${b.n[0]}</div>
        <span>${esc(b.n)}</span>
      </div>`).join('')}
    </div>

    <div class="section-h" style="margin-top:24px">
      <h2>Data management</h2>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
      <div class="card" style="padding:16px">
        <div style="font-size:14px;font-weight:500;margin-bottom:4px">Export all transactions</div>
        <div style="font-size:12px;color:var(--ink-3);margin-bottom:12px">CSV format — re-importable into Boreal</div>
        <button class="btn btn-sm" onclick="window.location.href='/api/export'">${icon('download',14)} Export CSV</button>
      </div>
      <div class="card" style="padding:16px">
        <div style="font-size:14px;font-weight:500;margin-bottom:4px">Restore from backup</div>
        <div style="font-size:12px;color:var(--ink-3);margin-bottom:12px">Replace your current database</div>
        <input type="file" id="restore-file" accept=".db,.sqlite,.bak" style="display:none">
        <button class="btn btn-sm" id="restore-btn">${icon('upload',14)} Upload</button>
      </div>
    </div>
  </div>`;

  const dropZone = document.getElementById('csv-drop');
  const fileInput = document.getElementById('csv-file');

  document.getElementById('import-choose-btn')?.addEventListener('click', (e) => { e.stopPropagation(); fileInput?.click(); });
  dropZone?.addEventListener('click', (e) => { if (e.target === dropZone || dropZone.contains(e.target)) fileInput?.click(); });
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('hover'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
  dropZone?.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('hover'); handleFiles(e.dataTransfer.files); });
  fileInput?.addEventListener('change', () => { if (fileInput.files.length) handleFiles(fileInput.files); });

  document.getElementById('import-restore-btn')?.addEventListener('click', () => document.getElementById('restore-file')?.click());
  document.getElementById('restore-btn')?.addEventListener('click', () => document.getElementById('restore-file')?.click());
  document.getElementById('restore-file')?.addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    if (!await appConfirm('This will replace all current data with the backup. Continue?', { title: 'Restore backup', danger: true })) return;
    const fd = new FormData();
    fd.append('file', e.target.files[0]);
    await _ensureCsrf();
    const res = await authFetch('/api/restore', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': _csrfToken } });
    if (!res) return;
    const data = await res.json();
    showToast(data.message || 'Restored');
    refreshCurrentView();
  });

  async function handleFiles(files) {
    for (const file of files) {
      try {
        if (file.name.endsWith('.ofx') || file.name.endsWith('.qfx')) {
          await importOFX(file);
        } else {
          await startCSVWizard(file);
        }
      } catch(e) {
        console.error('Import error:', e);
        showToast(`Error processing ${file.name}: ${e.message}`);
      }
    }
  }

  async function importOFX(file) {
    const fd = new FormData();
    fd.append('file', file);
    await _ensureCsrf();
    const res = await authFetch('/api/import-ofx', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': _csrfToken } });
    if (!res) return;
    const data = await res.json();
    showToast(data.message || `Imported ${data.imported||0} transactions`);
    refreshCurrentView();
  }

  async function startCSVWizard(file) {
    const fd = new FormData();
    fd.append('file', file);
    await _ensureCsrf();

    const detectRes = await authFetch('/api/detect-csv', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': _csrfToken } });
    if (!detectRes) { showToast('Failed to analyze CSV'); return; }
    if (!detectRes.ok) { const err = await detectRes.json().catch(() => ({})); showToast(err.error || 'Failed to analyze CSV'); return; }
    const detect = await detectRes.json();

    const wizard = document.getElementById('csv-wizard');
    wizard.style.display = 'block';

    const bankName = detect.bank || detect.detected_bank || '';
    const previewFd = new FormData();
    previewFd.append('file', file);
    if (bankName) previewFd.append('bank', bankName);
    const prevRes = await authFetch('/api/preview-parse', { method: 'POST', body: previewFd, headers: { 'X-CSRF-Token': _csrfToken } });
    if (!prevRes) { wizard.style.display='none'; showToast('Failed to preview CSV'); return; }
    if (!prevRes.ok) { const err = await prevRes.json().catch(() => ({})); wizard.style.display='none'; showToast(err.error || 'Failed to preview CSV'); return; }
    const preview = await prevRes.json();
    const rows = preview.transactions || preview.rows || [];

    wizard.innerHTML = `<div class="card" style="margin-top:20px">
      <div class="card-h">
        <h3>CSV import — ${esc(file.name)}</h3>
        <span class="cat-pill">${bankName ? esc(bankName) : 'Unknown bank'}</span>
      </div>
      ${bankName ? '' : `<div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:500;color:var(--ink-3);display:block;margin-bottom:4px">Select bank format</label>
        <select id="wiz-bank" style="padding:6px 10px;border:1px solid var(--line-1);border-radius:8px;background:var(--bg-surface);font-size:13px">
          <option value="">Auto-detect</option>
          ${(detect.available_banks||[]).map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}
        </select>
      </div>`}
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:500;color:var(--ink-3);display:block;margin-bottom:4px">Account</label>
        <input type="text" id="wiz-account" placeholder="e.g. TD Chequing" value="${esc(detect.suggested_account||'')}" style="padding:6px 10px;border:1px solid var(--line-1);border-radius:8px;background:var(--bg-surface);font-size:13px;width:100%;box-sizing:border-box">
      </div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Description</th><th class="right">Amount</th><th>Category</th></tr></thead>
          <tbody>${rows.slice(0,20).map(r => `<tr>
            <td style="color:var(--ink-3)">${fmtDate(r.date)}</td>
            <td>${esc(r.name||r.description||'')}</td>
            <td class="right mono" style="color:${(r.amount||0)>0?'var(--pos)':'var(--ink-1)'}">${fmtCurrency(r.amount||0)}</td>
            <td>${catPill(r.category||'Uncategorized')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <div style="font-size:12px;color:var(--ink-3);margin-bottom:12px">${rows.length} transactions found${rows.length>20?' (showing first 20)':''}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="wiz-import">${icon('check',14)} Import ${rows.length} transactions</button>
        <button class="btn" id="wiz-cancel">Cancel</button>
      </div>
    </div>`;

    document.getElementById('wiz-cancel')?.addEventListener('click', () => { wizard.style.display='none'; wizard.innerHTML=''; });

    document.getElementById('wiz-import')?.addEventListener('click', async () => {
      const importFd = new FormData();
      importFd.append('file', file);
      const bank = document.getElementById('wiz-bank')?.value || bankName;
      if (bank) importFd.append('bank', bank);
      const acct = document.getElementById('wiz-account')?.value;
      if (acct) importFd.append('account', acct);

      await _ensureCsrf();
      const res = await authFetch('/api/import', { method: 'POST', body: importFd, headers: { 'X-CSRF-Token': _csrfToken } });
      if (!res) { showToast('Import failed'); return; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); showToast(err.error || 'Import failed'); return; }
      const result = await res.json();
      // result is an array of per-file results
      const total = Array.isArray(result) ? result.reduce((s, r) => s + (r.added || 0), 0) : (result.imported || 0);
      const dupes = Array.isArray(result) ? result.reduce((s, r) => s + (r.dupes || 0), 0) : 0;
      const errors = Array.isArray(result) ? result.filter(r => r.error) : [];
      if (errors.length) {
        showToast(`Import had errors: ${errors.map(e => e.error).join(', ')}`);
      } else {
        showToast(`Imported ${total} transaction${total!==1?'s':''}${dupes ? ` (${dupes} duplicate${dupes!==1?'s':''} skipped)` : ''}`);
      }
      invalidateApiCache();
      wizard.style.display = 'none';
      wizard.innerHTML = '';
      navigateTo('transactions');
    });
  }
}

// ══════════════════════════════════════════════════════════════
// RULES VIEW
// ══════════════════════════════════════════════════════════════
async function _renderRules(c) {
  const [rules, templates] = await Promise.all([
    api('/api/rules'),
    api('/api/rule-templates'),
  ]);
  const rList = rules || [];
  const tList = templates || [];

  function ruleDesc(r) {
    const conds = (r.conditions||[]).map(c => `<span class="mono" style="font-size:12.5px;color:var(--ink-2)">${esc(c.field)} ${esc(c.operator)} <strong style="color:var(--ink-1)">"${esc(c.value)}"</strong></span>`).join(' <span style="color:var(--ink-3);font-size:11px">AND</span> ');
    let actionLabel = esc(r.action);
    if (r.action === 'label') actionLabel = `Label as <span style="color:var(--accent)">${esc(r.action_value||'')}</span>`;
    else if (r.action === 'hide') actionLabel = 'Hide transaction';
    else if (r.action === 'pass') actionLabel = 'Skip (pass)';
    return { conds, actionLabel };
  }

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Import rules</div>
        <div class="page-sub">Rules run automatically on every CSV/OFX import — first match wins by priority</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" id="apply-all-btn">${icon('bars',14)} Apply all</button>
        <button class="btn btn-primary" id="add-rule-btn">${icon('plus',14)} New rule</button>
      </div>
    </div>

    <div class="tabs" id="rule-tabs">
      <button class="tab active" data-tab="active-rules">Active rules (${rList.length})</button>
      <button class="tab" data-tab="templates-tab">Templates (${tList.length})</button>
      <button class="tab" data-tab="test-tab">Test rules</button>
    </div>

    <div id="active-rules">
      <div style="background:var(--accent-soft);color:var(--accent-ink);padding:10px 14px;border-radius:10px;font-size:13px;display:flex;align-items:center;gap:10px;margin-bottom:16px">
        ${icon('rules',16)}
        Rules are evaluated top-to-bottom. Higher priority rules match first.
      </div>

      ${rList.length ? rList.map((r, i) => {
        const { conds, actionLabel } = ruleDesc(r);
        return `<div class="rule-card">
        <div class="rule-num">${r.priority != null ? r.priority : (i+1)}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span style="font-size:13px;font-weight:500;color:var(--ink-1)">${esc(r.name)}</span>
            ${r.enabled === 0 ? '<span style="font-size:11px;color:var(--ink-3);font-weight:400">· disabled</span>' : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span style="font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.04em;font-weight:500">When</span>
            ${conds || '<span style="color:var(--ink-3);font-size:12px">No conditions</span>'}
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.04em;font-weight:500">Then</span>
            <span style="display:flex;align-items:center;gap:6px;font-size:12.5px">${icon('funnel',13)} ${actionLabel}</span>
          </div>
        </div>
        <label class="switch"><input type="checkbox" ${r.enabled !== 0 ? 'checked' : ''} onchange="toggleRule(${r.id},this.checked)"><span class="slider"></span></label>
        <button class="icon-btn" onclick="editRuleModal(${r.id})">${icon('edit',13)}</button>
        <button class="icon-btn" onclick="deleteRule(${r.id})">${icon('trash',13)}</button>
      </div>`;}).join('') : '<div style="color:var(--ink-3);font-size:13px;padding:16px 0">No rules yet. Add one or load a template to get started.</div>'}
    </div>

    <div id="templates-tab" style="display:none">
      <div class="section-h"><h2>Rule templates</h2><p>One-click presets for common setups</p></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${tList.map(t => `<div class="card" style="padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:14px;font-weight:500">${esc(t.name)}</div>
              <div style="font-size:12px;color:var(--ink-3);margin-top:2px">${esc(t.description||'')}</div>
            </div>
            ${t.rule_count > 0 ? `<span class="cat-pill">${t.rule_count} rules</span>` : ''}
          </div>
          <button class="btn btn-sm" style="margin-top:10px" onclick="loadRuleTemplate('${esc(t.file)}')">Load template</button>
        </div>`).join('') || '<div style="color:var(--ink-3);font-size:13px">No templates found in rules/templates/ folder.</div>'}
      </div>
    </div>

    <div id="test-tab" style="display:none">
      <div class="section-h"><h2>Test rules</h2><p>See which rule would match a transaction</p></div>
      <div class="card" style="padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field"><label>Description</label><input id="test-desc" placeholder="e.g. TRANSFER TO SAVINGS"></div>
          <div class="field"><label>Amount</label><input id="test-amount" placeholder="150.00" inputmode="decimal"></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <button class="btn btn-primary" id="test-rules-btn">Test</button>
          <span id="test-result" style="font-size:13px;color:var(--ink-3)"></span>
        </div>
      </div>
    </div>
  </div>`;

  // Tab switching
  document.querySelectorAll('#rule-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#rule-tabs .tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      ['active-rules','templates-tab','test-tab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === tabId ? '' : 'none';
      });
    });
  });

  document.getElementById('add-rule-btn')?.addEventListener('click', () => openRuleModal());
  document.getElementById('apply-all-btn')?.addEventListener('click', async () => {
    const result = await api('/api/rules/apply-all', 'POST');
    showToast(result?.message || `Applied rules to ${result?.updated||0} transactions`);
  });
  document.getElementById('test-rules-btn')?.addEventListener('click', async () => {
    const desc = document.getElementById('test-desc').value;
    const amt = document.getElementById('test-amount').value;
    const result = await api('/api/rules/test', 'POST', { description: desc, amount: parseFloat(amt)||0 });
    const el = document.getElementById('test-result');
    if (el) {
      if (result?.matched) el.innerHTML = `${icon('check',14)} Matched: <strong>${esc(result.rule_name)}</strong> → ${esc(result.action)} ${esc(result.action_value||'')}`;
      else el.textContent = 'No rule matched';
    }
  });
}

function openRuleModal(existing) {
  const isEdit = !!existing;
  const conditions = existing?.conditions || [{ field: 'description', operator: 'contains', value: '' }];

  function conditionRow(c, i) {
    return `<div class="rule-cond" style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:8px;align-items:end;margin-bottom:8px" data-cond="${i}">
      <div class="field"><label>Field</label><select class="cond-field">
        <option value="description" ${c.field==='description'?'selected':''}>Description</option>
        <option value="amount" ${c.field==='amount'?'selected':''}>Amount</option>
        <option value="account" ${c.field==='account'?'selected':''}>Account</option>
        <option value="type" ${c.field==='type'?'selected':''}>Type</option>
      </select></div>
      <div class="field"><label>Operator</label><select class="cond-op">
        <option value="contains" ${c.operator==='contains'?'selected':''}>contains</option>
        <option value="not_contains" ${c.operator==='not_contains'?'selected':''}>not contains</option>
        <option value="equals" ${c.operator==='equals'?'selected':''}>equals</option>
        <option value="not_equals" ${c.operator==='not_equals'?'selected':''}>not equals</option>
        <option value="starts_with" ${c.operator==='starts_with'?'selected':''}>starts with</option>
        <option value="ends_with" ${c.operator==='ends_with'?'selected':''}>ends with</option>
        <option value="greater_than" ${c.operator==='greater_than'?'selected':''}>greater than</option>
        <option value="less_than" ${c.operator==='less_than'?'selected':''}>less than</option>
        <option value="contains_any" ${c.operator==='contains_any'?'selected':''}>contains any</option>
      </select></div>
      <div class="field"><label>Value</label><input class="cond-val" value="${esc(c.value||'')}" placeholder="e.g. transfer"></div>
      <button class="icon-btn" onclick="this.closest('.rule-cond').remove()" style="margin-bottom:4px">${icon('x',14)}</button>
    </div>`;
  }

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="rule-modal-back">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:600px">
      <div class="modal-h"><h3>${isEdit ? 'Edit' : 'New'} rule</h3><button class="icon-btn" onclick="closeRuleModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div class="field"><label>Rule name</label><input id="rule-name" value="${esc(existing?.name||'')}" placeholder="e.g. Hide transfers"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div class="field"><label>Action</label><select id="rule-action">
            <option value="label" ${(existing?.action||'label')==='label'?'selected':''}>Label (set category)</option>
            <option value="hide" ${existing?.action==='hide'?'selected':''}>Hide transaction</option>
            <option value="pass" ${existing?.action==='pass'?'selected':''}>Pass (skip)</option>
          </select></div>
          <div class="field" id="action-value-field" style="${(existing?.action||'label')==='label'?'':'display:none'}"><label>Category</label><input id="rule-action-value" value="${esc(existing?.action_value||'')}" placeholder="e.g. Groceries"></div>
        </div>
        <div style="margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <label style="font-weight:500;font-size:13px">Conditions</label>
            <button class="btn btn-sm" id="add-cond-btn">${icon('plus',12)} Add condition</button>
          </div>
          <div id="rule-conditions">${conditions.map((c,i) => conditionRow(c,i)).join('')}</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeRuleModal()">Cancel</button>
        <button class="btn btn-primary" id="rule-save-btn">${isEdit ? 'Save' : 'Create rule'}</button>
      </div>
    </div>
  </div>`);
  document.getElementById('rule-modal-back').addEventListener('click', closeRuleModal);
  document.getElementById('rule-action').addEventListener('change', function() {
    document.getElementById('action-value-field').style.display = this.value === 'label' ? '' : 'none';
  });
  document.getElementById('add-cond-btn').addEventListener('click', () => {
    const container = document.getElementById('rule-conditions');
    const idx = container.children.length;
    container.insertAdjacentHTML('beforeend', conditionRow({ field: 'description', operator: 'contains', value: '' }, idx));
  });
  document.getElementById('rule-save-btn').addEventListener('click', async () => {
    const name = document.getElementById('rule-name').value.trim();
    const action = document.getElementById('rule-action').value;
    const action_value = document.getElementById('rule-action-value')?.value?.trim() || '';
    const condEls = document.querySelectorAll('#rule-conditions .rule-cond');
    const conds = Array.from(condEls).map(el => ({
      field: el.querySelector('.cond-field').value,
      operator: el.querySelector('.cond-op').value,
      value: el.querySelector('.cond-val').value.trim(),
    })).filter(c => c.value);
    if (!name) { showToast('Rule name is required'); return; }
    if (!conds.length) { showToast('At least one condition is required'); return; }
    const data = { name, action, action_value, conditions: conds };
    if (isEdit) await api(`/api/rules/${existing.id}`, 'PATCH', data);
    else await api('/api/rules', 'POST', data);
    closeRuleModal();
    refreshCurrentView();
  });
}

window.closeRuleModal = function() { document.getElementById('rule-modal-back')?.remove(); };

window.editRuleModal = async function(id) {
  const rules = await api('/api/rules');
  const r = (rules||[]).find(x => x.id === id);
  if (r) openRuleModal(r);
};

window.toggleRule = async function(id, enabled) {
  await api(`/api/rules/${id}`, 'PATCH', { enabled });
  refreshCurrentView();
};

window.deleteRule = async function(id) {
  if (!await appConfirm('Delete this rule?', { title: 'Delete rule', danger: true })) return;
  await api(`/api/rules/${id}`, 'DELETE');
  refreshCurrentView();
};

window.loadRuleTemplate = async function(file) {
  await api('/api/rule-templates/load', 'POST', { file });
  showToast('Template loaded');
  refreshCurrentView();
};

window.createRuleFromSuggestion = async function(pattern, category) {
  await api('/api/rules', 'POST', { name: `Auto: ${pattern}`, action: 'label', action_value: category, conditions: [{ field: 'description', operator: 'contains', value: pattern }] });
  showToast('Rule created');
  refreshCurrentView();
};

// ══════════════════════════════════════════════════════════════
// MY ACCOUNT VIEW
// ══════════════════════════════════════════════════════════════
async function _renderMyAccount(c) {
  const me = await api('/api/me');
  if (!me) return;
  const joined = me.created_at ? fmtDateLong(me.created_at.split('T')[0]) : '—';
  const initial = (me.display_name || 'U')[0].toUpperCase();

  c.innerHTML = `<div class="page" style="max-width:640px">
    <div class="page-head">
      <div>
        <div class="page-title">Account</div>
        <div class="page-sub">Manage your profile and account settings</div>
      </div>
    </div>

    <!-- PROFILE CARD -->
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--aurora);color:white;display:grid;place-items:center;font-size:22px;font-weight:600">${esc(initial)}</div>
        <div>
          <div style="font-weight:600;font-size:17px;color:var(--ink-1)" id="acct-name-display">${esc(me.display_name)}</div>
          <div style="font-size:13px;color:var(--ink-3)">${esc(me.email)}</div>
          <div style="font-size:12px;color:var(--ink-4);margin-top:2px">Joined ${esc(joined)}${me.verified ? ' · <span style="color:var(--pos)">Verified</span>' : ' · <span style="color:var(--warn)">Unverified</span>'}</div>
        </div>
      </div>
    </div>

    <!-- DISPLAY NAME -->
    <div class="section-h" style="margin-top:0"><h2>Profile</h2></div>
    <div class="settings-group" style="margin-bottom:24px">
      <div class="settings-row">
        <div class="label-block">
          <div class="lbl">Display name</div>
          <div class="desc">Shown in the sidebar and your profile</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="acct-display-name" value="${esc(me.display_name)}" style="padding:6px 10px;border:1px solid var(--line-2);border-radius:8px;font-size:13px;width:180px;background:var(--bg-surface);color:var(--ink-1)">
          <button class="btn btn-sm btn-primary" id="acct-save-name">Save</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="label-block">
          <div class="lbl">Email</div>
          <div class="desc">Used for login and recovery</div>
        </div>
        <span style="font-size:13px;color:var(--ink-2)" class="mono">${esc(me.email)}</span>
      </div>
    </div>

    <!-- CHANGE PASSWORD -->
    <div class="section-h"><h2>Security</h2></div>
    <div class="settings-group" style="margin-bottom:24px">
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:12px">
        <div class="label-block">
          <div class="lbl">Change password</div>
          <div class="desc">Must be at least 8 characters</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <input type="password" id="acct-current-pw" placeholder="Current password" style="padding:6px 10px;border:1px solid var(--line-2);border-radius:8px;font-size:13px;background:var(--bg-surface);color:var(--ink-1)">
          <input type="password" id="acct-new-pw" placeholder="New password" style="padding:6px 10px;border:1px solid var(--line-2);border-radius:8px;font-size:13px;background:var(--bg-surface);color:var(--ink-1)">
          <input type="password" id="acct-confirm-pw" placeholder="Confirm new" style="padding:6px 10px;border:1px solid var(--line-2);border-radius:8px;font-size:13px;background:var(--bg-surface);color:var(--ink-1)">
        </div>
        <div style="display:flex;justify-content:flex-end"><button class="btn btn-sm btn-primary" id="acct-save-pw">Update password</button></div>
      </div>
    </div>

    <!-- DANGER ZONE -->
    <div class="section-h"><h2 style="color:var(--danger)">Danger zone</h2></div>
    <div class="settings-group">
      <div class="settings-row">
        <div class="label-block">
          <div class="lbl" style="color:var(--danger)">Delete account</div>
          <div class="desc">Permanently delete your account and all associated data. This cannot be undone.</div>
        </div>
        <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger)" id="acct-delete-btn">${icon('trash',12)} Delete account</button>
      </div>
    </div>
  </div>`;

  // ── Save display name ──
  document.getElementById('acct-save-name')?.addEventListener('click', async () => {
    const name = document.getElementById('acct-display-name').value.trim();
    if (!name) { showToast('Name cannot be empty'); return; }
    const r = await api('/api/me', 'PATCH', { display_name: name });
    if (r && r.ok) {
      showToast('Display name updated');
      invalidateApiCache('/api/me');
      // Update sidebar immediately
      const avatarEl = document.getElementById('user-avatar');
      const nameEl = document.getElementById('user-display-name');
      if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
      if (nameEl) nameEl.textContent = name;
      const acctDisp = document.getElementById('acct-name-display');
      if (acctDisp) acctDisp.textContent = name;
    } else {
      showToast(r?.error || 'Failed to update name');
    }
  });

  // ── Change password ──
  document.getElementById('acct-save-pw')?.addEventListener('click', async () => {
    const cur = document.getElementById('acct-current-pw').value;
    const np = document.getElementById('acct-new-pw').value;
    const cp = document.getElementById('acct-confirm-pw').value;
    if (!cur || !np || !cp) { showToast('All password fields are required'); return; }
    if (np !== cp) { showToast('New passwords do not match'); return; }
    if (np.length < 8) { showToast('Password must be at least 8 characters'); return; }
    const r = await api('/api/me/password', 'POST', { current_password: cur, new_password: np, confirm_password: cp });
    if (r && r.ok) {
      showToast('Password updated');
      document.getElementById('acct-current-pw').value = '';
      document.getElementById('acct-new-pw').value = '';
      document.getElementById('acct-confirm-pw').value = '';
    } else {
      showToast(r?.error || 'Failed to update password');
    }
  });

  // ── Delete account ──
  document.getElementById('acct-delete-btn')?.addEventListener('click', async () => {
    const ok = await appConfirm(
      'This will permanently delete your account and all your financial data. This action cannot be undone.',
      { title: 'Delete your account?', danger: true }
    );
    if (!ok) return;
    const pw = await appPrompt('Enter your password to confirm deletion', { title: 'Confirm password', placeholder: 'Password' });
    if (!pw) return;
    const r = await api('/api/me', 'DELETE', { password: pw });
    if (r && r.ok) {
      window.location.href = '/login';
    } else {
      showToast(r?.error || 'Failed to delete account');
    }
  });
}

// ══════════════════════════════════════════════════════════════
// SETTINGS VIEW
// ══════════════════════════════════════════════════════════════
async function _renderSettings(c) {
  const [settings, cats, learned, txRes] = await Promise.all([
    api('/api/settings'),
    api('/api/categories'),
    api('/api/learned'),
    api('/api/transactions?limit=1'),
  ]);
  const s = settings || {};
  const catList = cats || [];
  const learnedList = learned || [];
  const txCount = txRes?.total || 0;

  c.innerHTML = `<div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">Settings</div>
        <div class="page-sub">Your data is stored in your personal database. Boreal makes no external requests.</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- LEFT COLUMN -->
      <div>
        <div class="section-h" style="margin-top:0"><h2>General</h2></div>
        <div class="settings-group">
          <div class="settings-row">
            <div class="label-block">
              <div class="lbl">Appearance</div>
              <div class="desc">Light, dark, or follow system</div>
            </div>
            <select class="btn btn-sm" style="padding:6px 10px" id="set-theme">
              <option value="light" ${s.theme==='light'?'selected':''}>Light</option>
              <option value="dark" ${s.theme==='dark'?'selected':''}>Dark</option>
            </select>
          </div>
          <div class="settings-row">
            <div class="label-block">
              <div class="lbl">Default currency</div>
              <div class="desc">CAD · Canadian Dollar</div>
            </div>
            <select class="btn btn-sm" style="padding:6px 10px" id="set-currency">
              <option value="CAD" ${s.currency==='CAD'?'selected':''}>CAD</option>
              <option value="USD" ${s.currency==='USD'?'selected':''}>USD</option>
              <option value="EUR" ${s.currency==='EUR'?'selected':''}>EUR</option>
              <option value="GBP" ${s.currency==='GBP'?'selected':''}>GBP</option>
            </select>
          </div>
          <div class="settings-row">
            <div class="label-block">
              <div class="lbl">Start of month</div>
              <div class="desc">When monthly totals reset</div>
            </div>
            <select class="btn btn-sm" style="padding:6px 10px" id="set-month-start">
              ${[1,5,10,15,20,25].map(d => `<option value="${d}" ${(s.month_start_day||1)===d?'selected':''}>${d}${d===1?'st':d===5?'th':d===10?'th':d===15?'th':d===20?'th':'th'}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="section-h"><h2>Data</h2></div>
        <div class="settings-group">
          <div class="settings-row">
            <div class="label-block">
              <div class="lbl">Backup database</div>
              <div class="desc">Download your database with a timestamp</div>
            </div>
            <button class="btn btn-sm" onclick="window.location.href='/api/backup'">${icon('download',12)} Download</button>
          </div>
          <div class="settings-row">
            <div class="label-block">
              <div class="lbl">Export all transactions</div>
              <div class="desc">CSV format — re-importable</div>
            </div>
            <button class="btn btn-sm" onclick="window.location.href='/api/export'">Export CSV</button>
          </div>
          <div class="settings-row">
            <div class="label-block">
              <div class="lbl" style="color:var(--danger)">Reset everything</div>
              <div class="desc">Delete your data and start fresh</div>
            </div>
            <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger-soft)" id="reset-btn">Reset</button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN -->
      <div>
        <div class="section-h" style="margin-top:0"><h2>Learned merchants</h2><p>${learnedList.length} merchants</p></div>
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:20px">
          ${learnedList.length ? `<table class="tbl">
            <thead><tr><th>Keyword</th><th>Category</th><th></th></tr></thead>
            <tbody>${learnedList.slice(0,30).map(m => `<tr>
              <td class="mono" style="font-size:12.5px">${esc(m.keyword||m.description||m.name||'')}</td>
              <td>${catPill(m.category)}</td>
              <td class="right"><button class="btn btn-sm btn-ghost" onclick="deleteLearned('${esc(m.keyword||m.description||m.name||'')}')">${icon('trash',12)}</button></td>
            </tr>`).join('')}</tbody>
          </table>` : '<div style="padding:16px;color:var(--ink-3);font-size:13px">No learned merchants yet</div>'}
        </div>

        <div class="section-h"><h2>Custom categories</h2><p>${catList.length} categories</p></div>
        <div class="card" style="padding:14px;margin-bottom:20px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${catList.map(cat => {
              const name = cat.name || cat;
              const ci = cat.icon || '';
              const cc = catColor(name);
              const cid = cat.id;
              return `<div style="display:flex;align-items:center;gap:6px;padding:5px 9px 5px 7px;border-radius:8px;border:1px solid var(--line-1);background:${cc}10;font-size:12.5px;cursor:pointer" onclick="editCategory(${cid},'${esc(name)}','${esc(ci)}')">
                <span>${ci}</span>${esc(name)}
                <button class="icon-btn" style="width:16px;height:16px" onclick="event.stopPropagation();deleteCategory(${cid},'${esc(name)}')">${icon('x',10)}</button>
              </div>`;
            }).join('')}
            <button class="btn btn-sm" style="border-style:dashed" id="add-cat-btn">${icon('plus',12)} Add category</button>
          </div>
        </div>

        <div class="section-h"><h2>About Boreal</h2></div>
        <div class="card" style="padding:16px;font-size:13px;color:var(--ink-2)">
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
            <div style="width:44px;height:44px;border-radius:12px;background:var(--aurora);color:white;display:grid;place-items:center">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 3 L7 10 L9.5 10 L6.5 14 L9 14 L5 19 L19 19 L15 14 L17.5 14 L14.5 10 L17 10 Z" fill="currentColor" opacity="0.95"/></svg>
            </div>
            <div>
              <div style="font-weight:600;font-size:15px;color:var(--ink-1)">Boreal · v2.4.0</div>
              <div style="font-size:12px;color:var(--ink-3)">Local-first personal finance for Canadians</div>
            </div>
          </div>
          <div style="border-top:1px solid var(--line-1);padding-top:12px;line-height:1.6">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--ink-3)">Transactions stored</span><span class="mono">${typeof txCount === 'number' ? txCount.toLocaleString() : txCount}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--ink-3)">Database size</span><span class="mono">local</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--ink-3)">External requests</span><span class="mono" style="color:var(--pos)">0</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('set-theme')?.addEventListener('change', async (e) => {
    applyTheme(e.target.value);
    await api('/api/settings', 'POST', { theme: e.target.value });
  });

  document.getElementById('set-currency')?.addEventListener('change', async (e) => {
    await api('/api/settings', 'POST', { currency: e.target.value });
    showToast('Currency updated');
  });

  document.getElementById('set-month-start')?.addEventListener('change', async (e) => {
    await api('/api/settings', 'POST', { month_start_day: parseInt(e.target.value) });
    showToast('Month start updated');
  });

  document.getElementById('add-cat-btn')?.addEventListener('click', () => {
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="cat-modal-back">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-h"><h3>Add category</h3><button class="icon-btn" onclick="closeCatModal()">${icon('x',14)}</button></div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
            <div class="field"><label>Name</label><input id="cat-new-name" placeholder="e.g. Groceries"></div>
            <div class="field"><label>Icon</label><input id="cat-new-icon" placeholder="🛒"></div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" onclick="closeCatModal()">Cancel</button>
          <button class="btn btn-primary" id="cat-save-btn">Add</button>
        </div>
      </div>
    </div>`);
    document.getElementById('cat-modal-back').addEventListener('click', closeCatModal);
    document.getElementById('cat-save-btn').addEventListener('click', async () => {
      const name = document.getElementById('cat-new-name').value.trim();
      const ci = document.getElementById('cat-new-icon').value.trim();
      if (!name) { showToast('Name is required'); return; }
      await api('/api/categories', 'POST', { name, icon: ci });
      closeCatModal();
      refreshCurrentView();
    });
  });

  document.getElementById('reset-btn')?.addEventListener('click', async () => {
    if (!await appConfirm('This will permanently delete ALL your data — transactions, accounts, budgets, and goals. This cannot be undone.', { title: 'Reset everything', danger: true })) return;
    await api('/api/demo/reset', 'POST');
    showToast('Data reset');
    location.reload();
  });
}

window.closeCatModal = function() { document.getElementById('cat-modal-back')?.remove(); };

window.deleteCategory = async function(id, name) {
  if (!await appConfirm(`Delete category "${name}"? Transactions using it will become Uncategorized.`, { title: 'Delete category', danger: true })) return;
  await api(`/api/categories/${id}`, 'DELETE');
  refreshCurrentView();
};

window.editCategory = async function(id, name, catIcon) {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-back" id="cat-modal-back">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-h"><h3>Edit category</h3><button class="icon-btn" onclick="closeCatModal()">${icon('x',14)}</button></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px">
          <div class="field"><label>Name</label><input id="cat-edit-name" value="${name}"></div>
          <div class="field"><label>Icon</label><input id="cat-edit-icon" value="${catIcon}"></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="closeCatModal()">Cancel</button>
        <button class="btn btn-primary" id="cat-edit-save">Save</button>
      </div>
    </div>
  </div>`);
  document.getElementById('cat-modal-back').addEventListener('click', closeCatModal);
  document.getElementById('cat-edit-save').addEventListener('click', async () => {
    const newName = document.getElementById('cat-edit-name').value.trim();
    const newIcon = document.getElementById('cat-edit-icon').value.trim();
    if (!newName) { showToast('Name is required'); return; }
    await api(`/api/categories/${id}`, 'PATCH', { name: newName, icon: newIcon });
    closeCatModal();
    refreshCurrentView();
  });
};

window.deleteLearned = async function(keyword) {
  await api(`/api/learned/${encodeURIComponent(keyword)}`, 'DELETE');
  refreshCurrentView();
};
