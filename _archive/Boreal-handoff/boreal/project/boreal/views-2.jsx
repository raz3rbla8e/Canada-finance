/* ============================================================
   BOREAL — Views part 2:
   Accounts, Year, Import, Schedules, Rules, Settings
   ============================================================ */

const D2 = window.BOREAL_DATA;

/* ============================================================
   ACCOUNTS / NET WORTH
   ============================================================ */
function AccountsView() {
  const totalAssets = D2.ACCOUNTS.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalDebt   = D2.ACCOUNTS.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth    = totalAssets - totalDebt;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Accounts & net worth</div>
          <div className="page-sub">All balances computed from your opening balances + imported transactions — nothing leaves your machine</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="arrow_lr" size={14}/> Transfer</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> Add account</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi hero-aurora">
          <div className="kpi-label">Net worth</div>
          <div className="kpi-value">{fmtCurrencyJSX(netWorth)}</div>
          <div className="kpi-delta"><span className="chip chip-up"><Icon name="arrow_up" size={11}/> 4.3%</span><span>vs last month</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Assets</div>
          <div className="kpi-value" style={{ color: "var(--pos)" }}>{fmtCurrencyJSX(totalAssets)}</div>
          <div className="kpi-delta"><span>across {D2.ACCOUNTS.filter(a => a.balance > 0).length} accounts</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Liabilities</div>
          <div className="kpi-value" style={{ color: "var(--danger)" }}>−{fmtCurrencyJSX(totalDebt)}</div>
          <div className="kpi-delta"><span>1 credit card balance</span></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <div>
            <h3>Net worth over time</h3>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {fmtCurrency(netWorth, { hideCents: true })}
              <span style={{ marginLeft: 12, fontSize: 13, color: "var(--pos)", fontWeight: 500 }}>
                +{fmtCurrency(netWorth - D2.NET_WORTH[0].v, { hideCents: true })} <span style={{ color: "var(--ink-3)" }}>over 12 months</span>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="filter-chip">3M</button>
            <button className="filter-chip">6M</button>
            <button className="filter-chip active">1Y</button>
            <button className="filter-chip">All</button>
          </div>
        </div>
        <NetWorthChart data={D2.NET_WORTH}/>
      </div>

      <div className="section-h">
        <h2>Your accounts</h2>
        <p>Click any account to see its transactions and balance history</p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {D2.ACCOUNTS.map((a, i) => {
          const pct = (Math.abs(a.balance) / Math.max(totalAssets, totalDebt)) * 100;
          return (
            <div key={a.id} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto auto",
              gap: 16, padding: "16px 20px", alignItems: "center",
              borderBottom: i < D2.ACCOUNTS.length - 1 ? "1px solid var(--line-1)" : "none",
            }}>
              <div className="acct-glyph" style={{ width: 40, height: 40, background: a.color + "15", color: a.color, borderColor: a.color + "30", fontSize: 15, fontWeight: 600 }}>
                {a.bank[0]}
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14.5 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{a.type} · {a.bank} · Opening {fmtCurrency(a.opening, { hideCents: true })}</div>
              </div>
              <div style={{ width: 160 }}>
                <div className="progress"><div className="fill" style={{ width: pct + "%", background: a.balance < 0 ? "var(--danger)" : a.color }}></div></div>
              </div>
              <div style={{ textAlign: "right", minWidth: 110 }}>
                <div style={{ fontWeight: 600, fontSize: 15, fontVariantNumeric: "tabular-nums", color: a.balance < 0 ? "var(--danger)" : "var(--ink-1)" }}>
                  {fmtCurrency(a.balance)}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{a.type === "Credit Card" ? "owed" : "balance"}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="icon-btn"><Icon name="edit" size={13}/></button>
                <button className="icon-btn"><Icon name="chev_r" size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   YEAR REVIEW
   ============================================================ */
function YearView() {
  const total = D2.HISTORY.reduce((acc, h) => ({
    income: acc.income + h.income,
    expenses: acc.expenses + h.expenses,
    net: acc.net + h.net,
  }), { income: 0, expenses: 0, net: 0 });
  const max = Math.max(...D2.HISTORY.map(h => Math.max(h.income, h.expenses)));

  // Top 5 cats (faked for year)
  const yearCats = [
    { name: "Rent & Housing", value: 26400, color: "#4a7a8f" },
    { name: "Groceries",      value: 5840,  color: "#5b9c6e" },
    { name: "Dining & Coffee",value: 2160,  color: "#c08a4e" },
    { name: "Transport",      value: 1820,  color: "#6b8eb5" },
    { name: "Subscriptions",  value: 1620,  color: "#9b6fb7" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Year in review · 2025–2026</div>
          <div className="page-sub">Apr 2025 — Mar 2026 · A full year of imported transactions</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="chev_l" size={13}/> 2024</button>
          <button className="btn">2025 <Icon name="chev_r" size={13}/></button>
          <button className="btn"><Icon name="download" size={13}/> Export PDF</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">Total income</div>
          <div className="kpi-value" style={{ color: "var(--pos)" }}>{fmtCurrencyJSX(total.income)}</div>
          <div className="kpi-delta"><span>across 12 months</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total expenses</div>
          <div className="kpi-value">{fmtCurrencyJSX(total.expenses)}</div>
          <div className="kpi-delta"><span>{fmtCurrency(total.expenses / 12, { hideCents: true })}/mo avg</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net saved</div>
          <div className="kpi-value" style={{ color: "var(--pos)" }}>{fmtCurrencyJSX(total.net)}</div>
          <div className="kpi-delta"><span className="chip chip-up"><Icon name="arrow_up" size={11}/> 22%</span><span>vs last year</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Savings rate</div>
          <div className="kpi-value">{((total.net / total.income) * 100).toFixed(0)}<span className="cents">%</span></div>
          <div className="kpi-delta"><span>5pt above target</span></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h3>Income vs expenses, every month</h3>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--ink-3)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--pos)" }}></span>Income</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ink-2)" }}></span>Expenses</span>
          </div>
        </div>
        <div className="year-strip">
          {D2.HISTORY.map((h, i) => (
            <div key={i} className={`year-bar ${i === D2.HISTORY.length - 1 ? "current" : ""}`}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "calc(100% - 18px)", justifyContent: "center" }}>
                <div className="ypos" style={{ width: 11, height: `${(h.income / max) * 100}%`, minHeight: 2 }}></div>
                <div className="yneg" style={{ width: 11, height: `${(h.expenses / max) * 100}%`, minHeight: 2 }}></div>
              </div>
              <div className="ymo">{h.m}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Top categories this year</h3></div>
          {yearCats.map((c, i) => {
            const pct = (c.value / yearCats.reduce((s, x) => s + x.value, 0)) * 100;
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }}></span>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(c.value, { hideCents: true })}<span style={{ color: "var(--ink-3)", marginLeft: 6 }}>{pct.toFixed(0)}%</span></span>
                </div>
                <div className="progress"><div className="fill" style={{ width: pct + "%", background: c.color }}></div></div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-h"><h3>Year at a glance</h3></div>
          {[
            ["Best saving month",   "September 2025",  "+$2,350 saved"],
            ["Biggest spending",    "December 2025",   "$6,840 — holidays"],
            ["Most-spent category", "Rent & Housing",  "$26,400 · 56% of expenses"],
            ["Top merchant",        "Loblaws",         "47 visits · $5,842"],
            ["New merchants",       "23 first-seen",   "auto-categorized 19"],
            ["Subscription cost",   "Recurring",       "$1,620 across 8 services"],
          ].map((row, i) => (
            <div key={i} className="list-row">
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>{row[0]}</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{row[1]}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{row[2]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   IMPORT
   ============================================================ */
function ImportView({ onOpenWizard }) {
  const [hover, setHover] = useState(false);

  const banks = [
    { n: "TD",           c: "#0d8a2e" },
    { n: "Tangerine",    c: "#ff6e1f" },
    { n: "RBC",          c: "#0046ad" },
    { n: "CIBC",         c: "#c8102e" },
    { n: "Scotia",       c: "#ec111a" },
    { n: "BMO",          c: "#0079c1" },
    { n: "National",     c: "#e3001b" },
    { n: "Wealthsimple", c: "#000000" },
    { n: "Amex",         c: "#006fcf" },
    { n: "Any (OFX)",    c: "#5b9c6e" },
    { n: "Any (CSV)",    c: "#9b6fb7" },
    { n: "+ Add",        c: "#aaa" },
  ];

  const recentImports = [
    { file: "tangerine_chequing_march2026.csv",  bank: "Tangerine Chequing", txns: 22, when: "12 min ago", new: 22 },
    { file: "td_chequing_march2026.csv",         bank: "TD Chequing",        txns: 8,  when: "12 min ago", new: 8 },
    { file: "tangerine_credit_march2026.csv",    bank: "Tangerine Credit Card", txns: 14, when: "12 min ago", new: 12 },
    { file: "rbc_chequing_march2026.csv",        bank: "RBC Chequing",       txns: 6,  when: "yesterday",  new: 0 },
    { file: "tangerine_chequing_feb2026.csv",    bank: "Tangerine Chequing", txns: 24, when: "Mar 1",      new: 24 },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Import</div>
          <div className="page-sub">Drop bank CSVs or OFX/QFX downloads — duplicates are detected by SHA-256 hash, never double-counted</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="upload" size={14}/> Backup</button>
          <button className="btn"><Icon name="download" size={14}/> Restore</button>
        </div>
      </div>

      <div
        className={`dropzone ${hover ? "hover" : ""}`}
        onDragOver={e => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={e => { e.preventDefault(); setHover(false); onOpenWizard && onOpenWizard(); }}
        onClick={() => onOpenWizard && onOpenWizard()}
        style={{ cursor: "pointer" }}
      >
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", margin: "0 auto" }}>
          <Icon name="upload" size={24}/>
        </div>
        <h3>Drop your bank exports here</h3>
        <p>CSV · OFX · QFX — multiple files at once · auto-detects format</p>
        <div className="browse">
          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); onOpenWizard && onOpenWizard(); }}><Icon name="plus" size={14}/> Choose files</button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); onOpenWizard && onOpenWizard(); }}>Try unknown CSV wizard</button>
        </div>
      </div>

      <div className="section-h">
        <h2>Supported banks</h2>
        <p>If yours isn't here, the CSV wizard will map columns for you</p>
      </div>

      <div className="bank-grid">
        {banks.map((b, i) => (
          <div key={i} className="bank-chip">
            <div className="bank-glyph" style={{ background: b.c }}>{b.n[0]}</div>
            <span>{b.n}</span>
          </div>
        ))}
      </div>

      <div className="section-h">
        <h2>Recent imports</h2>
        <p>Last 5 files</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>File</th>
              <th>Bank</th>
              <th className="right">Transactions</th>
              <th className="right">New</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentImports.map((r, i) => (
              <tr key={i}>
                <td><span className="mono" style={{ fontSize: 12.5 }}>{r.file}</span></td>
                <td>{r.bank}</td>
                <td className="right">{r.txns}</td>
                <td className="right">
                  {r.new === 0
                    ? <span style={{ color: "var(--ink-3)" }}>0 (dupes)</span>
                    : <span style={{ color: "var(--pos)", fontWeight: 500 }}>+{r.new}</span>}
                </td>
                <td style={{ color: "var(--ink-3)" }}>{r.when}</td>
                <td className="right"><button className="btn btn-sm btn-ghost"><Icon name="trash" size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================
   SCHEDULED
   ============================================================ */
function SchedulesView() {
  const due = D2.SCHEDULES.filter(s => !s.paused && new Date(s.next + "T00:00:00") <= new Date("2026-04-08"));
  const monthlyCommitted = D2.SCHEDULES.filter(s => !s.paused && s.freq === "monthly" && s.type === "expense").reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Scheduled transactions</div>
          <div className="page-sub">Pre-define recurring expenses & income — Boreal auto-posts them on the due date</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="clock" size={14}/> Post all due ({due.length})</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> New schedule</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">Monthly committed</div>
          <div className="kpi-value">{fmtCurrencyJSX(monthlyCommitted)}</div>
          <div className="kpi-delta"><span>recurring expenses</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Due in next 7 days</div>
          <div className="kpi-value">{due.length}</div>
          <div className="kpi-delta"><span>{fmtCurrency(due.reduce((s, d) => s + Math.abs(d.amount), 0), { hideCents: true })} pending</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active schedules</div>
          <div className="kpi-value">{D2.SCHEDULES.filter(s => !s.paused).length}<span className="cents">/{D2.SCHEDULES.length}</span></div>
          <div className="kpi-delta"><span>1 paused</span></div>
        </div>
      </div>

      <div className="section-h"><h2>Coming up</h2><p>Next 30 days</p></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {D2.SCHEDULES.map(s => {
          const cat = catById(s.cat);
          const acct = acctById(s.account);
          const isDue = !s.paused && new Date(s.next + "T00:00:00") <= new Date("2026-04-08");
          return (
            <div key={s.id} className={`schedule-card ${isDue ? "due" : ""}`} style={s.paused ? { opacity: 0.55 } : {}}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.color + "18", color: cat.color, display: "grid", placeItems: "center", fontSize: 16 }}>
                    {cat.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}{s.paused && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>· paused</span>}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                      {s.freq[0].toUpperCase() + s.freq.slice(1)} · {acct.name} · {cat.name}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: s.type === "income" ? "var(--pos)" : "var(--ink-1)" }}>
                    {s.type === "income" ? "+" : "−"}{fmtCurrency(s.amount, { hideCents: true })}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>Next: {fmtDateLong(s.next)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "flex-end" }}>
                <button className="btn btn-sm btn-ghost"><Icon name={s.paused ? "play" : "pause"} size={12}/></button>
                <button className="btn btn-sm btn-ghost"><Icon name="edit" size={12}/></button>
                {isDue && !s.paused && <button className="btn btn-sm btn-primary">Post now</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   RULES
   ============================================================ */
function RulesView() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Import rules</div>
          <div className="page-sub">Rules run automatically on every CSV/OFX import — first match wins by priority</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="bars" size={14}/> Templates</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> New rule</button>
        </div>
      </div>

      <div className="tabs">
        <button className="tab active">Active rules ({D2.RULES.length})</button>
        <button className="tab">Templates (5)</button>
        <button className="tab">Test rules</button>
      </div>

      <div style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", padding: "10px 14px", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Icon name="rules" size={16}/>
        Rules are evaluated top-to-bottom. Drag to reorder priorities.
      </div>

      {D2.RULES.map(r => (
        <div key={r.id} className="rule-card">
          <div className="rule-num">{r.priority}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>When</span>
              <span className="rule-when mono" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                {r.when.field} {r.when.op} <strong style={{ color: "var(--ink-1)" }}>"{r.when.val}"</strong>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Then</span>
              <span className="rule-act">
                {r.action === "hide" && <><Icon name="eye_off" size={13}/> Hide from dashboard</>}
                {r.action === "label" && <><Icon name="funnel" size={13}/> Label as <span style={{ color: "var(--accent)" }}>{r.label}</span></>}
              </span>
            </div>
          </div>
          <label className="switch"><input type="checkbox" defaultChecked/><span className="slider"></span></label>
          <button className="icon-btn"><Icon name="edit" size={13}/></button>
          <button className="icon-btn"><Icon name="trash" size={13}/></button>
        </div>
      ))}

      <div className="section-h"><h2>Rule templates</h2><p>One-click presets for common setups</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { n: "Default",       d: "Hide transfers, label payroll",            r: 4 },
          { n: "Freelancer",    d: "Track 1099 income, hide HST refunds",      r: 6 },
          { n: "Student",       d: "OSAP, tuition, hide refundable deposits",  r: 5 },
          { n: "Self-Employed", d: "Business expenses, GST tracking",          r: 8 },
          { n: "Carpool",       d: "Split fuel, label reimbursements",         r: 3 },
          { n: "Custom",        d: "Start from scratch",                        r: 0 },
        ].map((t, i) => (
          <div key={i} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.n}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{t.d}</div>
              </div>
              {t.r > 0 && <span className="cat-pill">{t.r} rules</span>}
            </div>
            <button className="btn btn-sm" style={{ marginTop: 10 }}>Load template</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   SETTINGS
   ============================================================ */
function SettingsView({ onTheme, onShowOnboarding }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Your data lives in <span className="mono" style={{ fontSize: 12.5 }}>finance.db</span> on this machine. Boreal makes no external requests.</div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="section-h" style={{ marginTop: 0 }}><h2>General</h2></div>
          <div className="settings-group">
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Appearance</div>
                <div className="desc">Light, dark, or follow system</div>
              </div>
              <select className="btn btn-sm" style={{ padding: "6px 10px" }} onChange={e => onTheme(e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">System</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Default currency</div>
                <div className="desc">CAD · Canadian Dollar</div>
              </div>
              <button className="btn btn-sm">Change</button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Start of month</div>
                <div className="desc">When monthly totals reset</div>
              </div>
              <button className="btn btn-sm">1st</button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Round to nearest cent</div>
                <div className="desc">Display only — stored at full precision</div>
              </div>
              <label className="switch"><input type="checkbox" defaultChecked/><span className="slider"></span></label>
            </div>
          </div>

          <div className="section-h"><h2>Data</h2></div>
          <div className="settings-group">
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Backup database</div>
                <div className="desc">Download finance.db with a timestamp</div>
              </div>
              <button className="btn btn-sm"><Icon name="download" size={12}/> Download</button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Restore from backup</div>
                <div className="desc">Replace your current database</div>
              </div>
              <button className="btn btn-sm"><Icon name="upload" size={12}/> Upload</button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Export all transactions</div>
                <div className="desc">CSV format — re-importable</div>
              </div>
              <button className="btn btn-sm">Export CSV</button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Restart with first-run experience</div>
                <div className="desc">See the welcome screen again</div>
              </div>
              <button className="btn btn-sm" onClick={() => onShowOnboarding && onShowOnboarding()}>Show</button>
            </div>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl" style={{ color: "var(--danger)" }}>Reset everything</div>
                <div className="desc">Delete finance.db and start fresh</div>
              </div>
              <button className="btn btn-sm" style={{ color: "var(--danger)", borderColor: "var(--danger-soft)" }}>Reset</button>
            </div>
          </div>
        </div>

        <div>
          <div className="section-h" style={{ marginTop: 0 }}><h2>Learned merchants</h2><p>{D2.LEARNED_MERCHANTS.length} merchants</p></div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Category</th>
                  <th className="right">Matches</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {D2.LEARNED_MERCHANTS.map((m, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 12.5 }}>{m.keyword}</td>
                    <td><CategoryPill catId={m.cat}/></td>
                    <td className="right">{m.count}</td>
                    <td className="right"><button className="btn btn-sm btn-ghost"><Icon name="trash" size={12}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-h"><h2>Custom categories</h2><p>{D2.CATEGORIES.length} categories</p></div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {D2.CATEGORIES.filter(c => c.group !== "Hidden").map(c => (
                <div key={c.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 9px 5px 7px",
                  borderRadius: 8,
                  border: "1px solid var(--line-1)",
                  background: c.color + "10",
                  fontSize: 12.5,
                }}>
                  <span>{c.icon}</span>{c.name}
                </div>
              ))}
              <button className="btn btn-sm" style={{ borderStyle: "dashed" }}><Icon name="plus" size={12}/> Add category</button>
            </div>
          </div>

          <div className="section-h"><h2>About Boreal</h2></div>
          <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--ink-2)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--aurora)", color: "white", display: "grid", placeItems: "center" }}>
                <BrandMark/>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--ink-1)" }}>Boreal · v2.4.0</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Local-first personal finance for Canadians</div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 12, lineHeight: 1.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink-3)" }}>Transactions stored</span><span className="mono">2,847</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink-3)" }}>Database size</span><span className="mono">1.2 MB</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink-3)" }}>External requests</span><span className="mono" style={{ color: "var(--pos)" }}>0</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AccountsView, YearView, ImportView, SchedulesView, RulesView, SettingsView });
