/* ============================================================
   BOREAL — Views part 1: Dashboard, Transactions, Budgets
   ============================================================ */

const D1 = window.BOREAL_DATA;

/* ============================================================
   DASHBOARD
   ============================================================ */
function DashboardView() {
  const totalIncome  = D1.TRANSACTIONS.filter(t => t.amount > 0 && !t.hidden).reduce((s, t) => s + t.amount, 0);
  const totalExp     = D1.TRANSACTIONS.filter(t => t.amount < 0 && !t.hidden).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netSaved     = totalIncome - totalExp;
  const savingsRate  = (netSaved / totalIncome) * 100;
  const netWorth     = D1.ACCOUNTS.reduce((s, a) => s + a.balance, 0);
  const prevNetWorth = D1.NET_WORTH[D1.NET_WORTH.length - 2].v;
  const deltaNW      = ((netWorth - prevNetWorth) / prevNetWorth) * 100;
  const sparkHistory = D1.HISTORY.map(h => h.net);

  // Top categories (by spend)
  const catTotals = {};
  D1.TRANSACTIONS.forEach(t => {
    if (t.amount < 0 && !t.hidden && t.cat !== "transfer") {
      catTotals[t.cat] = (catTotals[t.cat] || 0) + Math.abs(t.amount);
    }
  });
  const topCats = Object.entries(catTotals)
    .map(([cat, v]) => ({ ...catById(cat), value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Good evening, Sam.</div>
          <div className="page-sub">Here's your March 2026 — you saved {fmtCurrency(netSaved, { hideCents: true })} this month, on track for a {savingsRate.toFixed(0)}% savings rate.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="download" size={14}/> Export</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> Add transaction</button>
        </div>
      </div>

      {/* Insights strip */}
      <InsightsStrip/>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi hero-aurora" style={{ gridColumn: "span 2", padding: "20px 22px" }}>
          <div className="kpi-label">Net worth</div>
          <div className="kpi-value">{fmtCurrencyJSX(netWorth)}</div>
          <div className="kpi-delta">
            <span className="chip chip-up"><Icon name="arrow_up" size={11}/> {deltaNW.toFixed(1)}%</span>
            <span>vs last month</span>
          </div>
          <Sparkline values={D1.NET_WORTH.map(d => d.v)} w={120} h={36} stroke="rgba(255,255,255,0.7)"/>
        </div>

        <div className="kpi">
          <div className="kpi-label">Income</div>
          <div className="kpi-value" style={{ color: "var(--pos)" }}>{fmtCurrencyJSX(totalIncome)}</div>
          <div className="kpi-delta">
            <span className="chip chip-up"><Icon name="arrow_up" size={11}/> 0.7%</span>
            <span>vs Feb</span>
          </div>
          <Sparkline values={D1.HISTORY.map(h => h.income)} stroke="var(--pos)"/>
        </div>

        <div className="kpi">
          <div className="kpi-label">Expenses</div>
          <div className="kpi-value">{fmtCurrencyJSX(totalExp)}</div>
          <div className="kpi-delta">
            <span className="chip chip-up"><Icon name="arrow_dn" size={11}/> 1.4%</span>
            <span>vs Feb</span>
          </div>
          <Sparkline values={D1.HISTORY.map(h => h.expenses)} stroke="var(--ink-3)"/>
        </div>
      </div>

      {/* Net worth + categories */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Net worth, last 12 months</h3>
              <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {fmtCurrency(netWorth, { hideCents: true })}
                <span style={{ marginLeft: 10, fontSize: 13, color: "var(--pos)", fontWeight: 500 }}>
                  +{fmtCurrency(netWorth - D1.NET_WORTH[0].v, { hideCents: true })} this year
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button className="filter-chip">1M</button>
              <button className="filter-chip">6M</button>
              <button className="filter-chip active">1Y</button>
              <button className="filter-chip">All</button>
            </div>
          </div>
          <NetWorthChart data={D1.NET_WORTH}/>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Where it went</h3>
            <button className="muted-link">See all →</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Doughnut slices={topCats.map(c => ({ value: c.value, color: c.color }))} size={140}/>
            <div style={{ flex: 1 }}>
              {topCats.slice(0, 5).map(c => {
                const pct = (c.value / totalExp) * 100;
                return (
                  <div key={c.id} className="cat-row">
                    <span className="label"><span className="dot" style={{ background: c.color }}></span>{c.name}</span>
                    <span><span className="amt">{fmtCurrency(c.value, { hideCents: true })}</span><span className="pct">{pct.toFixed(0)}%</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Accounts + Budgets */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>Budgets</h3>
            <button className="muted-link">Manage →</button>
          </div>
          {D1.BUDGETS.slice(0, 6).map(b => {
            const c = catById(b.cat);
            const pct = (b.spent / b.limit) * 100;
            const cls = pct >= 100 ? "danger" : pct >= 85 ? "warn" : "";
            return (
              <div key={b.cat} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }}></span>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-2)" }}>
                    <span style={{ color: pct >= 100 ? "var(--danger)" : "var(--ink-1)", fontWeight: 500 }}>{fmtCurrency(b.spent, { hideCents: true })}</span>
                    <span style={{ color: "var(--ink-3)" }}> / {fmtCurrency(b.limit, { hideCents: true })}</span>
                  </span>
                </div>
                <div className={`progress ${cls}`}>
                  <div className="fill" style={{ width: Math.min(pct, 100) + "%" }}></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Accounts</h3>
            <button className="muted-link">Add →</button>
          </div>
          {D1.ACCOUNTS.map(a => (
            <div key={a.id} className="acct-row">
              <div className="left">
                <div className="acct-glyph" style={{ background: a.color + "15", color: a.color, borderColor: a.color + "30" }}>
                  {a.bank[0]}
                </div>
                <div>
                  <div className="name">{a.name}</div>
                  <div className="type">{a.type}</div>
                </div>
              </div>
              <div className="bal" style={{ color: a.balance < 0 ? "var(--danger)" : "var(--ink-1)" }}>
                {fmtCurrency(a.balance)}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--line-1)", marginTop: 4 }}>
            <span style={{ color: "var(--ink-3)", fontSize: 12 }}>Total</span>
            <span style={{ fontWeight: 600, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{fmtCurrency(netWorth)}</span>
          </div>
        </div>
      </div>

      {/* Recurring + Goals */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>Recurring & subscriptions</h3>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{D1.RECURRING.length} detected · {fmtCurrency(D1.RECURRING.reduce((s, r) => s + r.avg, 0), { hideCents: true })}/mo</span>
          </div>
          {D1.RECURRING.map((r, i) => (
            <div key={i} className="recur-row">
              <MerchantGlyph name={r.name}/>
              <div>
                <div className="nm">{r.name}{r.warn && <span className="warn-badge">↑ price</span>}</div>
                <div className="when">{r.freq} · last {fmtDate(r.last)}{r.warn ? ` · ${r.warn}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="avg">{fmtCurrency(r.avg)}</div>
                <div className="freq">avg</div>
              </div>
              <button className="btn btn-sm btn-ghost"><Icon name="cog" size={13}/></button>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Savings goals</h3>
            <button className="muted-link">+ New</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {D1.GOALS.map(g => {
              const pct = (g.saved / g.target) * 100;
              return (
                <div key={g.id} className="goal">
                  <div className="goal-h">
                    <div className="goal-n">{g.name}</div>
                    <div className="goal-amt">{fmtCurrency(g.saved, { hideCents: true })} / {fmtCurrency(g.target, { hideCents: true })}</div>
                  </div>
                  <div className="progress"><div className="fill" style={{ width: pct + "%", background: g.color }}></div></div>
                  <div className="goal-pct"><span>{pct.toFixed(0)}% complete</span><span>{fmtCurrency(g.target - g.saved, { hideCents: true })} to go</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spending trend */}
      <div className="card">
        <div className="card-h">
          <h3>Income vs expenses, last 12 months</h3>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--ink-3)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--pos)" }}></span>Income</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ink-2)" }}></span>Expenses</span>
          </div>
        </div>
        <SpendBars/>
      </div>
    </div>
  );
}

const SpendBars = () => {
  const max = Math.max(...D1.HISTORY.map(h => Math.max(h.income, h.expenses)));
  return (
    <div className="bars">
      {D1.HISTORY.map((h, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 160, justifyContent: "center" }}>
            <div className="bar-pos" style={{ width: 12, height: `${(h.income / max) * 100}%`, minHeight: 2 }} title={`Income ${fmtCurrency(h.income)}`}></div>
            <div className="bar-neg" style={{ width: 12, height: `${(h.expenses / max) * 100}%`, minHeight: 2 }} title={`Expenses ${fmtCurrency(h.expenses)}`}></div>
          </div>
          <div className="bar-label" style={i === D1.HISTORY.length - 1 ? { color: "var(--ink-1)", fontWeight: 600 } : {}}>{h.m}</div>
        </div>
      ))}
    </div>
  );
};

/* ============================================================
   TRANSACTIONS
   ============================================================ */
function TransactionsView() {
  const [query, setQuery] = useState("");
  const [acctFilter, setAcctFilter] = useState(null);
  const [catFilter, setCatFilter] = useState(null);
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const filtered = D1.TRANSACTIONS.filter(t => {
    if (!showHidden && t.hidden) return false;
    if (query && !(t.name + " " + t.memo).toLowerCase().includes(query.toLowerCase())) return false;
    if (acctFilter && t.acct !== acctFilter) return false;
    if (catFilter && t.cat !== catFilter) return false;
    return true;
  });

  const totalIn = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const toggleSel = (id) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-sub">{filtered.length} of {D1.TRANSACTIONS.length} · {fmtCurrency(totalIn, { hideCents: true })} in, {fmtCurrency(totalOut, { hideCents: true })} out</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="download" size={14}/> Export CSV</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> Add transaction</button>
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <div className="searchbox" style={{ width: 280 }}>
          <Icon name="search" size={14}/>
          <input placeholder="Search transactions, merchants, memos…" value={query} onChange={e => setQuery(e.target.value)}/>
          <span className="kbd">/</span>
        </div>

        <div className="chip-row">
          <button className={`filter-chip ${!acctFilter ? "active" : ""}`} onClick={() => setAcctFilter(null)}>All accounts</button>
          {D1.ACCOUNTS.slice(0, 4).map(a => (
            <button key={a.id} className={`filter-chip ${acctFilter === a.id ? "active" : ""}`} onClick={() => setAcctFilter(a.id)}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: a.color }}></span>
              {a.name}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button className="btn btn-sm" style={{ borderStyle: "dashed" }}><Icon name="funnel" size={13}/> Category</button>
          <button className="btn btn-sm" style={{ borderStyle: "dashed" }}><Icon name="calendar" size={13}/> Date range</button>
          <button className={`btn btn-sm ${showHidden ? "btn-primary" : ""}`} onClick={() => setShowHidden(!showHidden)}>
            <Icon name={showHidden ? "eye" : "eye_off"} size={13}/> Hidden
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div style={{ background: "var(--ink-1)", color: "var(--bg-app)", padding: "10px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 14, marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 500 }}>{selected.size} selected</span>
          <button className="btn btn-sm" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.2)" }}><Icon name="funnel" size={13}/> Categorize</button>
          <button className="btn btn-sm" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.2)" }}><Icon name="eye_off" size={13}/> Hide</button>
          <button className="btn btn-sm" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.2)" }}><Icon name="trash" size={13}/> Delete</button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13 }}>Clear</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th className="check"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll}/></th>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Account</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => {
              const a = acctById(t.acct);
              const sel = selected.has(t.id);
              return (
                <tr key={t.id} style={sel ? { background: "var(--accent-soft)" } : { cursor: "pointer" }}
                    onClick={(e) => {
                      if (e.target.type === "checkbox") return;
                      window.dispatchEvent(new CustomEvent("boreal:openTxn", { detail: t }));
                    }}>
                  <td className="check" onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel} onChange={() => toggleSel(t.id)}/></td>
                  <td style={{ color: "var(--ink-3)", fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                  <td>
                    <div className="name-cell">
                      <MerchantGlyph name={t.name} color={catById(t.cat).color}/>
                      <div>
                        <div style={{ fontWeight: 500, color: "var(--ink-1)" }}>{t.name}</div>
                        {t.memo && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 1 }}>{t.memo}</div>}
                      </div>
                    </div>
                  </td>
                  <td><CategoryPill catId={t.cat}/></td>
                  <td><span className="acct-tag">{a.bank}</span></td>
                  <td className={`right ${t.amount > 0 ? "amount-pos" : "amount-neg"}`}>
                    {t.amount > 0 ? "+" : "−"}${Math.abs(t.amount).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12, color: "var(--ink-3)" }}>
        <span>Showing {filtered.length} of {D1.TRANSACTIONS.length}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-sm"><Icon name="chev_l" size={13}/></button>
          <button className="btn btn-sm">1</button>
          <button className="btn btn-sm"><Icon name="chev_r" size={13}/></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   BUDGETS & GOALS
   ============================================================ */
function BudgetsView() {
  const totalBudgeted = D1.BUDGETS.reduce((s, b) => s + b.limit, 0);
  const totalSpent    = D1.BUDGETS.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">Budgets & goals</div>
          <div className="page-sub">{fmtCurrency(totalSpent, { hideCents: true })} of {fmtCurrency(totalBudgeted, { hideCents: true })} spent · {((totalSpent / totalBudgeted) * 100).toFixed(0)}% of budgets used in March</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icon name="sliders" size={14}/> Adjust all</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> New budget</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">Budgeted</div>
          <div className="kpi-value">{fmtCurrencyJSX(totalBudgeted)}</div>
          <div className="kpi-delta"><span>across {D1.BUDGETS.length} categories</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Spent</div>
          <div className="kpi-value">{fmtCurrencyJSX(totalSpent)}</div>
          <div className="kpi-delta"><span className="chip chip-up"><Icon name="check" size={11}/> on track</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Remaining</div>
          <div className="kpi-value" style={{ color: "var(--pos)" }}>{fmtCurrencyJSX(totalBudgeted - totalSpent)}</div>
          <div className="kpi-delta"><span>11 days left in month</span></div>
        </div>
      </div>

      <div className="section-h">
        <h2>Monthly budgets</h2>
        <p>Track spending against limits — set per category</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {D1.BUDGETS.map(b => {
          const c = catById(b.cat);
          const pct = (b.spent / b.limit) * 100;
          const cls = pct >= 100 ? "danger" : pct >= 85 ? "warn" : "";
          const status = pct >= 100 ? "Over" : pct >= 85 ? "Close" : "OK";
          return (
            <div key={b.cat} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: c.color + "18", color: c.color, display: "grid", placeItems: "center", fontSize: 16 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{c.group}</div>
                  </div>
                </div>
                <span className={pct >= 100 ? "warn-badge" : ""} style={{
                  fontSize: 11, padding: "2px 7px", borderRadius: 5,
                  color: pct >= 100 ? "var(--danger)" : pct >= 85 ? "var(--warn)" : "var(--pos)",
                  background: pct >= 100 ? "var(--danger-soft)" : pct >= 85 ? "var(--warn-soft)" : "var(--pos-soft)",
                  fontWeight: 500,
                }}>{status}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontWeight: 500 }}>{fmtCurrency(b.spent)}</span>
                <span style={{ color: "var(--ink-3)" }}>of {fmtCurrency(b.limit, { hideCents: true })}</span>
              </div>
              <div className={`progress ${cls}`}>
                <div className="fill" style={{ width: Math.min(pct, 100) + "%" }}></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5, color: "var(--ink-3)" }}>
                <span>{pct.toFixed(0)}% used</span>
                <span>{fmtCurrency(Math.max(b.limit - b.spent, 0), { hideCents: true })} remaining</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-h">
        <h2>Savings goals</h2>
        <p>Stash money toward specific targets</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {D1.GOALS.map(g => {
          const pct = (g.saved / g.target) * 100;
          return (
            <div key={g.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>Goal</div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginTop: 2 }}>{g.name}</div>
                </div>
                <button className="btn btn-sm">Contribute</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                <span style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrency(g.saved, { hideCents: true })}
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>of {fmtCurrency(g.target, { hideCents: true })}</span>
              </div>
              <div className="progress"><div className="fill" style={{ width: pct + "%", background: g.color }}></div></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
                <span style={{ color: g.color, fontWeight: 500 }}>{pct.toFixed(0)}% complete</span>
                <span>{fmtCurrency(g.target - g.saved, { hideCents: true })} to go</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { DashboardView, TransactionsView, BudgetsView });
