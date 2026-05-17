/* ============================================================
   BOREAL — Extras:
   CommandPalette, TransactionDrawer, CSVWizard,
   InsightsStrip, UndoToast, Onboarding
   ============================================================ */

const DX = window.BOREAL_DATA;
const { useState: useSx, useEffect: useEx, useRef: useRx, useMemo: useMx } = React;

/* ============================================================
   COMMAND PALETTE (⌘K)
   ============================================================ */
function CommandPalette({ open, onClose, onNav, onAction }) {
  const [q, setQ] = useSx("");
  const [active, setActive] = useSx(0);
  const inputRef = useRx();

  useEx(() => {
    if (open) {
      setQ(""); setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const navCmds = [
    { id: "nav-dashboard",    title: "Go to Dashboard",        kind: "Navigate", icon: "dashboard", do: () => onNav("dashboard") },
    { id: "nav-transactions", title: "Go to Transactions",     kind: "Navigate", icon: "list",      do: () => onNav("transactions") },
    { id: "nav-budgets",      title: "Go to Budgets",          kind: "Navigate", icon: "target",    do: () => onNav("budgets") },
    { id: "nav-accounts",     title: "Go to Accounts",         kind: "Navigate", icon: "wallet",    do: () => onNav("accounts") },
    { id: "nav-year",         title: "Go to Year review",      kind: "Navigate", icon: "bars",      do: () => onNav("year") },
    { id: "nav-import",       title: "Go to Import",           kind: "Navigate", icon: "upload",    do: () => onNav("import") },
    { id: "nav-schedules",    title: "Go to Scheduled",        kind: "Navigate", icon: "clock",     do: () => onNav("schedules") },
    { id: "nav-rules",        title: "Go to Rules",            kind: "Navigate", icon: "rules",     do: () => onNav("rules") },
    { id: "nav-settings",     title: "Go to Settings",         kind: "Navigate", icon: "cog",       do: () => onNav("settings") },
  ];
  const actionCmds = [
    { id: "act-add",       title: "Add transaction",                         kind: "Action", icon: "plus",     do: () => onAction("add") },
    { id: "act-import",    title: "Import CSV / OFX file",                   kind: "Action", icon: "upload",   do: () => onAction("import") },
    { id: "act-transfer",  title: "Transfer between accounts",               kind: "Action", icon: "arrow_lr", do: () => onAction("transfer") },
    { id: "act-budget",    title: "Set a new budget",                        kind: "Action", icon: "target",   do: () => onAction("budget") },
    { id: "act-goal",      title: "Create a savings goal",                   kind: "Action", icon: "spark",    do: () => onAction("goal") },
    { id: "act-export",    title: "Export transactions to CSV",              kind: "Action", icon: "download", do: () => onAction("export") },
    { id: "act-backup",    title: "Download backup of finance.db",           kind: "Action", icon: "download", do: () => onAction("backup") },
    { id: "act-theme",     title: "Toggle dark mode",                        kind: "Action", icon: "moon",     do: () => onAction("theme") },
  ];
  const merchantCmds = DX.RECURRING.slice(0, 4).map(r => ({
    id: "m-" + r.name, title: `Find "${r.name}" transactions`,
    kind: "Merchants", icon: "search", do: () => onAction({ type: "search", q: r.name })
  }));

  const all = [...navCmds, ...actionCmds, ...merchantCmds];
  const filtered = q.trim() === "" ? all :
    all.filter(c => c.title.toLowerCase().includes(q.toLowerCase()));

  useEx(() => { setActive(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); filtered[active]?.do(); onClose(); }
    if (e.key === "Escape")    { e.preventDefault(); onClose(); }
  };

  if (!open) return null;

  // group
  const groups = {};
  filtered.forEach(c => { groups[c.kind] = groups[c.kind] || []; groups[c.kind].push(c); });
  let idx = -1;

  return (
    <div className="cmd-back" onClick={onClose}>
      <div className="cmd" onClick={e => e.stopPropagation()}>
        <div className="cmd-input">
          <Icon name="search" size={16}/>
          <input ref={inputRef} value={q} placeholder="Type a command, navigate, or search…"
            onChange={e => setQ(e.target.value)} onKeyDown={onKey}/>
          <span className="kbd">esc</span>
        </div>
        <div className="cmd-list">
          {filtered.length === 0 && (
            <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              No matches for "{q}"
            </div>
          )}
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="cmd-group">{group}</div>
              {items.map(c => {
                idx++;
                const isActive = idx === active;
                const myIdx = idx;
                return (
                  <div key={c.id} className={`cmd-item ${isActive ? "active" : ""}`}
                    onMouseEnter={() => setActive(myIdx)}
                    onClick={() => { c.do(); onClose(); }}>
                    <Icon name={c.icon} size={15}/>
                    <span>{c.title}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmd-foot">
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> open</span>
          <span><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TRANSACTION DRAWER
   ============================================================ */
function TransactionDrawer({ txn, onClose, onSave, onDelete }) {
  const [cat, setCat] = useSx(txn?.cat || "uncategorized");
  const [name, setName] = useSx(txn?.name || "");
  const [memo, setMemo] = useSx(txn?.memo || "");
  const [hidden, setHidden] = useSx(!!txn?.hidden);
  const [splits, setSplits] = useSx([]);
  const [showSplit, setShowSplit] = useSx(false);

  useEx(() => {
    if (txn) {
      setCat(txn.cat); setName(txn.name); setMemo(txn.memo);
      setHidden(!!txn.hidden); setSplits([]); setShowSplit(false);
    }
  }, [txn?.id]);

  if (!txn) return null;
  const acct = acctById(txn.acct);
  const category = catById(cat);

  // similar = same merchant family (first token)
  const sim = DX.TRANSACTIONS.filter(x => x.id !== txn.id && x.name.split(" ")[0] === txn.name.split(" ")[0]).slice(0, 5);

  const splitTotal = splits.reduce((s, x) => s + (parseFloat(x.amt) || 0), 0);
  const remaining = Math.abs(txn.amount) - splitTotal;

  return (
    <>
      <div className="drawer-back" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-h">
          <div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 500 }}>
              {fmtDateLong(txn.date)} · {acct.name}
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 3 }}>{txn.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>

        <div className="drawer-body">
          {/* Amount hero */}
          <div className="amt-big" style={{ color: txn.amount > 0 ? "var(--pos)" : "var(--ink-1)" }}>
            {txn.amount > 0 ? "+" : "−"}{fmtCurrency(txn.amount).replace("-", "")}
          </div>
          <div className="meta">{txn.amount > 0 ? "Income" : "Expense"} · {category.name}</div>

          {/* Quick category swap */}
          <div className="section-h" style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 13 }}>Category</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DX.CATEGORIES.filter(c => c.group !== "Hidden").slice(0, 12).map(c => (
              <button key={c.id} className="filter-chip" onClick={() => setCat(c.id)} style={cat === c.id ? {
                background: c.color + "22", borderColor: c.color, color: c.color, fontWeight: 500
              } : {}}>
                <span>{c.icon}</span>{c.name}
              </button>
            ))}
          </div>

          {/* Edit */}
          <div className="section-h"><h2 style={{ fontSize: 13 }}>Details</h2></div>
          <div className="field">
            <label>Description</label>
            <input value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div className="field">
            <label>Memo</label>
            <input value={memo} onChange={e => setMemo(e.target.value)}/>
          </div>

          <div className="settings-group" style={{ marginTop: 8 }}>
            <div className="settings-row">
              <div className="label-block">
                <div className="lbl">Hide from dashboard</div>
                <div className="desc">Removes from totals but keeps the record</div>
              </div>
              <label className="switch"><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)}/><span className="slider"></span></label>
            </div>
          </div>

          {/* Split */}
          <div className="section-h">
            <h2 style={{ fontSize: 13 }}>Split transaction</h2>
            {!showSplit && <button className="muted-link" onClick={() => { setShowSplit(true); setSplits([{ cat: "groceries", amt: "" }, { cat: "shopping", amt: "" }]); }}>+ Add split</button>}
          </div>
          {showSplit && (
            <div className="card" style={{ padding: 12 }}>
              {splits.map((s, i) => (
                <div key={i} className="split-row">
                  <select value={s.cat} onChange={e => {
                    const n = [...splits]; n[i] = { ...n[i], cat: e.target.value }; setSplits(n);
                  }} style={{ padding: "6px 8px", border: "1px solid var(--line-2)", borderRadius: 6, fontSize: 12.5 }}>
                    {DX.CATEGORIES.filter(c => c.group !== "Hidden").map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  <input placeholder="0.00" value={s.amt} onChange={e => {
                    const n = [...splits]; n[i] = { ...n[i], amt: e.target.value }; setSplits(n);
                  }} style={{ width: 80, padding: "6px 8px", border: "1px solid var(--line-2)", borderRadius: 6, fontSize: 12.5, textAlign: "right", fontVariantNumeric: "tabular-nums" }}/>
                  <button className="icon-btn" onClick={() => setSplits(splits.filter((_, j) => j !== i))}><Icon name="x" size={12}/></button>
                </div>
              ))}
              <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setSplits([...splits, { cat: "uncategorized", amt: "" }])}>
                <Icon name="plus" size={12}/> Add row
              </button>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-1)", fontSize: 12.5 }}>
                <span style={{ color: "var(--ink-3)" }}>Remaining</span>
                <span className="mono" style={{ color: remaining < 0 ? "var(--danger)" : remaining > 0.001 ? "var(--warn)" : "var(--pos)", fontWeight: 500 }}>
                  ${remaining.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Similar transactions */}
          {sim.length > 0 && (
            <>
              <div className="section-h"><h2 style={{ fontSize: 13 }}>Similar transactions</h2><p>{sim.length} found</p></div>
              <div className="card" style={{ padding: 0 }}>
                {sim.map(t => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--line-1)", fontSize: 13, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 450 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{fmtDate(t.date)} · {catById(t.cat).name}</div>
                    </div>
                    <div className="mono" style={{ fontVariantNumeric: "tabular-nums" }}>{t.amount > 0 ? "+" : "−"}${Math.abs(t.amount).toFixed(2)}</div>
                  </div>
                ))}
                <div style={{ padding: 10, textAlign: "center" }}>
                  <button className="btn btn-sm">Apply this category to all {sim.length}</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn" style={{ color: "var(--danger)", borderColor: "transparent" }} onClick={() => { onDelete(txn); onClose(); }}>
            <Icon name="trash" size={13}/> Delete
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { onSave({ ...txn, cat, name, memo, hidden }); onClose(); }}>Save changes</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   CSV WIZARD
   ============================================================ */
function CSVWizard({ open, onClose, onDone }) {
  const [step, setStep] = useSx(0);
  const [mapDate, setMapDate] = useSx("Posting Date");
  const [mapDesc, setMapDesc] = useSx("Description");
  const [mapAmt, setMapAmt] = useSx("Amount");
  const [bankName, setBankName] = useSx("Simplii Chequing");

  useEx(() => { if (open) setStep(0); }, [open]);
  if (!open) return null;

  const sampleHeaders = ["Posting Date", "Description", "Amount", "Balance", "Reference"];
  const sampleRows = [
    ["03/15/2026", "WALMART SUPERCENTER #1054", "-78.42", "1842.18", "1234"],
    ["03/14/2026", "STARBUCKS COFFEE",          "-6.75",  "1920.60", "5678"],
    ["03/13/2026", "PAYROLL CREDIT",            "1875.00", "1927.35", "9012"],
    ["03/12/2026", "RBC ETRANSFER FEE",         "-1.50",  "52.35",   "3456"],
  ];

  const parsed = sampleRows.slice(0, 3).map(r => ({
    date: r[sampleHeaders.indexOf(mapDate)],
    desc: r[sampleHeaders.indexOf(mapDesc)],
    amt: r[sampleHeaders.indexOf(mapAmt)],
  }));

  const steps = ["Upload", "Detect", "Map columns", "Preview", "Save"];

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wiz" onClick={e => e.stopPropagation()}>
        <div className="wiz-steps">
          {steps.map((s, i) => (
            <div key={i} className={`wiz-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
              <div className="num">{i < step ? "✓" : i + 1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <div className="wiz-body">
          {step === 0 && (
            <div>
              <div className="page-title" style={{ fontSize: 20 }}>Unknown bank format</div>
              <div className="page-sub" style={{ marginBottom: 20 }}>
                We couldn't recognize <span className="mono">simplii_chequing_march.csv</span>. The wizard will map columns and save the config — future imports will work automatically.
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, background: "var(--bg-sunken)", borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
                  <Icon name="upload" size={18}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>simplii_chequing_march.csv</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>4 KB · 48 rows detected · UTF-8 with BOM</div>
                </div>
                <button className="icon-btn"><Icon name="trash" size={13}/></button>
              </div>
              <div style={{ marginTop: 24 }}>
                <div className="field">
                  <label>Give this bank format a name</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)}/>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="page-title" style={{ fontSize: 20 }}>Detected headers</div>
              <div className="page-sub" style={{ marginBottom: 20 }}>We found these columns in your CSV. Confirm before mapping.</div>
              <div className="wiz-preview">
                <pre>{sampleHeaders.join(", ")}{"\n"}{sampleRows.map(r => r.join(", ")).join("\n")}</pre>
              </div>
              <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--pos-soft)", borderRadius: 10, color: "var(--pos)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="check" size={14}/>
                Looks valid · 5 columns · 48 data rows
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="page-title" style={{ fontSize: 20 }}>Map columns</div>
              <div className="page-sub" style={{ marginBottom: 20 }}>Tell us which column has what — Boreal will remember.</div>
              <div className="wiz-map">
                <div className="col-map">
                  <div className="lbl">Date column</div>
                  <select value={mapDate} onChange={e => setMapDate(e.target.value)}>
                    {sampleHeaders.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <div className="col-map">
                  <div className="lbl">Description column</div>
                  <select value={mapDesc} onChange={e => setMapDesc(e.target.value)}>
                    {sampleHeaders.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
                <div className="col-map" style={{ gridColumn: "span 2" }}>
                  <div className="lbl">Amount column</div>
                  <select value={mapAmt} onChange={e => setMapAmt(e.target.value)}>
                    {sampleHeaders.map(h => <option key={h}>{h}</option>)}
                  </select>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8 }}>
                    Negative values = expenses · Positive = income · Boreal auto-detects debit/credit splits
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="page-title" style={{ fontSize: 20 }}>Preview</div>
              <div className="page-sub" style={{ marginBottom: 20 }}>Here are the first 3 rows as Boreal will parse them.</div>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Description</th><th>Suggested category</th><th className="right">Amount</th></tr></thead>
                  <tbody>
                    {parsed.map((p, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--ink-3)" }}>{p.date}</td>
                        <td>{p.desc}</td>
                        <td><CategoryPill catId={p.desc?.toLowerCase().includes("walmart") ? "groceries" : p.desc?.toLowerCase().includes("starbucks") ? "dining" : p.desc?.toLowerCase().includes("payroll") ? "income" : "uncategorized"}/></td>
                        <td className="right mono" style={{ color: parseFloat(p.amt) > 0 ? "var(--pos)" : "var(--ink-1)" }}>{p.amt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", margin: "12px auto 16px" }}>
                <Icon name="check" size={24}/>
              </div>
              <div className="page-title" style={{ fontSize: 20, textAlign: "center" }}>All set</div>
              <div className="page-sub" style={{ textAlign: "center", marginBottom: 20 }}>
                <strong>{bankName}</strong> saved to <span className="mono">banks/simplii_chequing.yaml</span>. 48 transactions ready to import.
              </div>
              <div className="wiz-preview" style={{ fontSize: 11.5 }}>
                <pre>{`name: "${bankName}"
version: 1
last_verified: "2026-03"
encoding: "utf-8-sig"
columns:
  date: "${mapDate}"
  description: "${mapDesc}"
  amount: "${mapAmt}"`}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><Icon name="chev_l" size={13}/> Back</button>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            {step < 4 && <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue <Icon name="chev_r" size={13}/></button>}
            {step === 4 && <button className="btn btn-primary" onClick={() => { onDone(); onClose(); }}><Icon name="check" size={13}/> Import 48 transactions</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INSIGHTS STRIP
   ============================================================ */
function InsightsStrip() {
  const insights = [
    { icon: "arrow_up",  tone: "warn",  ttl: "Dining is 42% over last month",        dt: "$57.56 vs $40.50 — driven by 3 Tim Hortons & 1 Uber Eats" },
    { icon: "bell",      tone: "accent",ttl: "Netflix raised your price by $1.50",   dt: "From $16.49 to $17.99 on Mar 7 — set a reminder?" },
    { icon: "spark",     tone: "pos",   ttl: "You're on pace for $1,971 saved",     dt: "30% savings rate — best month since September" },
  ];
  const toneColors = {
    warn:   ["var(--warn-soft)",   "var(--warn)"],
    accent: ["var(--accent-soft)", "var(--accent)"],
    pos:    ["var(--pos-soft)",    "var(--pos)"],
  };
  return (
    <div className="insights">
      {insights.map((i, idx) => {
        const [bg, fg] = toneColors[i.tone];
        return (
          <div key={idx} className="insight">
            <div className="icon-circle" style={{ background: bg, color: fg }}>
              <Icon name={i.icon} size={15}/>
            </div>
            <div>
              <div className="ttl">{i.ttl}</div>
              <div className="dt">{i.dt}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   UNDO TOAST
   ============================================================ */
function UndoToast({ toast, onUndo, onDismiss }) {
  useEx(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [toast?.id]);
  if (!toast) return null;
  return (
    <div className="undo-toast">
      <div className="toast-icon"><Icon name="check" size={13}/></div>
      <span>{toast.message}</span>
      <button onClick={onUndo}>Undo</button>
      <button className="x" onClick={onDismiss}><Icon name="x" size={13}/></button>
    </div>
  );
}

/* ============================================================
   ONBOARDING
   ============================================================ */
function OnboardingView({ onDone }) {
  return (
    <div className="page">
      <div className="onboarding">
        <div className="brand-mark-lg"><BrandMark/></div>
        <h1>Welcome to Boreal.</h1>
        <p className="lede">
          A personal finance dashboard that lives on your computer. Drop in a bank export, and you'll see your money in 30 seconds — no signup, no cloud, no tracking.
        </p>
        <div className="onb-cards">
          <div className="onb-card" onClick={onDone}>
            <div className="ic"><Icon name="upload" size={18}/></div>
            <h3>Import a CSV</h3>
            <p>Drop a file from your bank — Boreal recognizes 10+ Canadian banks and walks you through unknown ones.</p>
          </div>
          <div className="onb-card" onClick={onDone}>
            <div className="ic"><Icon name="spark" size={18}/></div>
            <h3>Try sample data</h3>
            <p>Explore the app with a fully-populated demo — 12 months of transactions, accounts, budgets, goals.</p>
          </div>
          <div className="onb-card" onClick={onDone}>
            <div className="ic"><Icon name="edit" size={18}/></div>
            <h3>Start blank</h3>
            <p>Add transactions manually, set up accounts and budgets as you go. Best if you prefer to start clean.</p>
          </div>
        </div>
        <div style={{ marginTop: 32, fontSize: 12, color: "var(--ink-3)" }}>
          Your data stays in <span className="mono">~/.boreal/finance.db</span> · 0 external requests · MIT licensed
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CommandPalette, TransactionDrawer, CSVWizard,
  InsightsStrip, UndoToast, OnboardingView,
});
