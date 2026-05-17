/* ============================================================
   BOREAL — App shell: sidebar nav + view router + tweaks
   ============================================================ */

const { useState: useS, useEffect: useE } = React;
const DATA = window.BOREAL_DATA;

const NAV = [
  { section: "Workspace", items: [
    { id: "dashboard",   label: "Dashboard",   icon: "dashboard" },
    { id: "transactions",label: "Transactions",icon: "list", count: 27 },
    { id: "budgets",     label: "Budgets",     icon: "target" },
    { id: "accounts",    label: "Accounts",    icon: "wallet" },
    { id: "year",        label: "Year review", icon: "bars" },
  ]},
  { section: "Automate", items: [
    { id: "import",      label: "Import",      icon: "upload" },
    { id: "schedules",   label: "Scheduled",   icon: "clock", count: 8 },
    { id: "rules",       label: "Rules",       icon: "rules", count: 5 },
  ]},
  { section: "Workspace", items: [
    { id: "settings",    label: "Settings",    icon: "cog" },
  ]},
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#3a7c5c",
  "density": "comfortable",
  "showFab": true
}/*EDITMODE-END*/;

function BoresalApp() {
  const [view, setView] = useS("dashboard");
  const [month, setMonth] = useS({ y: 2026, m: 2 }); // March 2026 (0-indexed)
  const [showAddModal, setShowAddModal] = useS(false);
  const [showCmd, setShowCmd] = useS(false);
  const [showWizard, setShowWizard] = useS(false);
  const [openTxn, setOpenTxn] = useS(null);
  const [showOnboarding, setShowOnboarding] = useS(false);
  const [toast, setToast] = useS(null);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const showToast = (message) => setToast({ id: Date.now(), message });

  // ⌘K opens command palette
  useE(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCmd(s => !s);
      }
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault(); setShowCmd(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // bus: listen for cross-component events
  useE(() => {
    const open = (e) => setOpenTxn(e.detail);
    const t = (e) => showToast(e.detail.message);
    window.addEventListener("boreal:openTxn", open);
    window.addEventListener("boreal:toast", t);
    return () => {
      window.removeEventListener("boreal:openTxn", open);
      window.removeEventListener("boreal:toast", t);
    };
  }, []);

  // Theme applies on root
  useE(() => {
    if (t.theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [t.theme]);

  // Accent var override
  useE(() => {
    const root = document.documentElement;
    if (t.accent) {
      root.style.setProperty("--accent", t.accent);
      // derive soft + ink variants by mixing in OKLCH-ish (simple alpha blend)
      root.style.setProperty("--accent-soft", t.accent + "1f");
      root.style.setProperty("--accent-ink", t.accent);
    }
  }, [t.accent]);

  const monthLabel = new Date(month.y, month.m, 1).toLocaleString("en-CA", { month: "long", year: "numeric" });
  const stepMonth = (delta) => {
    let m = month.m + delta, y = month.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setMonth({ y, m });
  };

  const renderView = () => {
    if (showOnboarding) return <OnboardingView onDone={() => { setShowOnboarding(false); showToast("Sample data loaded · 27 transactions"); }}/>;
    switch (view) {
      case "dashboard":    return <DashboardView/>;
      case "transactions": return <TransactionsView/>;
      case "budgets":      return <BudgetsView/>;
      case "accounts":     return <AccountsView/>;
      case "year":         return <YearView/>;
      case "import":       return <ImportView onOpenWizard={() => setShowWizard(true)}/>;
      case "schedules":    return <SchedulesView/>;
      case "rules":        return <RulesView/>;
      case "settings":     return <SettingsView onTheme={v => setTweak("theme", v === "auto" ? "light" : v)} onShowOnboarding={() => setShowOnboarding(true)}/>;
      default:             return <DashboardView/>;
    }
  };

  const handleCmdAction = (action) => {
    if (action === "add")       setShowAddModal(true);
    else if (action === "import")  setView("import");
    else if (action === "transfer") showToast("Transfer dialog · between accounts");
    else if (action === "budget")   setView("budgets");
    else if (action === "goal")     setView("budgets");
    else if (action === "export")   showToast("Exported 27 transactions to march-2026.csv");
    else if (action === "backup")   showToast("Backup saved · boreal-2026-03-31.db");
    else if (action === "theme")    setTweak("theme", t.theme === "dark" ? "light" : "dark");
    else if (action?.type === "search") { setView("transactions"); }
  };

  return (
    <>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark"><BrandMark/></div>
            <div>
              <div className="brand-name">Boreal</div>
              <div className="brand-sub">v2.4 · local</div>
            </div>
          </div>

          {NAV.map((sec, si) => (
            <React.Fragment key={si}>
              {si > 0 && <div className="nav-section-label">{sec.section === "Workspace" && si === 2 ? "" : sec.section}</div>}
              {si === 0 && <div className="nav-section-label">{sec.section}</div>}
              {sec.items.map(it => (
                <button
                  key={it.id}
                  className={`nav-item ${view === it.id ? "active" : ""}`}
                  onClick={() => setView(it.id)}
                  data-screen-label={`${it.label}`}
                >
                  <Icon name={it.icon} size={15}/>
                  <span>{it.label}</span>
                  {it.count && <span className="count">{it.count}</span>}
                </button>
              ))}
            </React.Fragment>
          ))}

          <div className="sidebar-foot">
            <button className="nav-item" onClick={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}>
              <Icon name={t.theme === "dark" ? "sun" : "moon"} size={15}/>
              <span>{t.theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <div className="user-row">
              <div className="avatar">SP</div>
              <div className="user-info">
                <div className="user-name">Sam Plante</div>
                <div className="user-mail">finance.db · 1.2 MB</div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <span className="topbar-crumb">{NAV.flatMap(s => s.items).find(i => i.id === view)?.label || ""}</span>
            <span style={{ color: "var(--ink-4)" }}>/</span>
            <div className="month-picker">
              <button onClick={() => stepMonth(-1)}><Icon name="chev_l" size={14}/></button>
              <span className="label">{monthLabel}</span>
              <button onClick={() => stepMonth(1)}><Icon name="chev_r" size={14}/></button>
            </div>
            <div className="topbar-spacer"/>
            <div className="searchbox" onClick={() => setShowCmd(true)} style={{ cursor: "pointer" }}>
              <Icon name="search" size={14}/>
              <input placeholder="Search or jump to…" readOnly style={{ pointerEvents: "none" }}/>
              <span className="kbd">⌘K</span>
            </div>
            <button className="icon-btn" title="Notifications"><Icon name="bell" size={14}/></button>
          </div>
          {renderView()}
        </main>

        {/* FAB */}
        {t.showFab && (
          <button className="fab" title="Add transaction" onClick={() => setShowAddModal(true)}>
            <Icon name="plus" size={20}/>
          </button>
        )}
      </div>

      {/* Add transaction modal */}
      {showAddModal && (
        <div className="modal-back" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <h3>Add transaction</h3>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}><Icon name="x" size={14}/></button>
            </div>
            <div className="modal-body">
              <div className="row-2">
                <div className="field">
                  <label>Date</label>
                  <input type="date" defaultValue="2026-03-31"/>
                </div>
                <div className="field">
                  <label>Account</label>
                  <select defaultValue="td_che">
                    {DATA.ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <input placeholder="e.g. Loblaws #1042"/>
              </div>
              <div className="row-2">
                <div className="field">
                  <label>Category</label>
                  <select defaultValue="groceries">
                    {DATA.CATEGORIES.filter(c => c.group !== "Hidden").map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Amount</label>
                  <input placeholder="-25.00" inputMode="decimal"/>
                </div>
              </div>
              <div className="field">
                <label>Memo (optional)</label>
                <input placeholder=""/>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setShowAddModal(false); showToast("Transaction added · −$25.00 Groceries"); }}>Add transaction</button>
            </div>
          </div>
        </div>
      )}

      {/* Command palette */}
      <CommandPalette
        open={showCmd}
        onClose={() => setShowCmd(false)}
        onNav={(id) => setView(id)}
        onAction={handleCmdAction}
      />

      {/* Transaction drawer */}
      <TransactionDrawer
        txn={openTxn}
        onClose={() => setOpenTxn(null)}
        onSave={(t) => showToast(`Updated "${t.name}"`)}
        onDelete={(t) => showToast(`Deleted "${t.name}"`)}
      />

      {/* CSV wizard */}
      <CSVWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onDone={() => showToast("Imported 48 transactions from Simplii Chequing")}
      />

      {/* Undo toast */}
      <UndoToast
        toast={toast}
        onUndo={() => { setToast(null); showToast("Undone"); }}
        onDismiss={() => setToast(null)}
      />

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Theme">
          <TweakRadio label="Mode" value={t.theme} options={["light", "dark"]} onChange={v => setTweak("theme", v)}/>
        </TweakSection>
        <TweakSection label="Accent color">
          <TweakColor label="Primary" value={t.accent} options={[
            "#3a7c5c",
            "#2e5f8a",
            "#8a3a5c",
            "#1f1f1f",
            "#a86b2c",
          ]} onChange={v => setTweak("accent", v)}/>
        </TweakSection>
        <TweakSection label="UI">
          <TweakToggle label="Floating + button" value={t.showFab} onChange={v => setTweak("showFab", v)}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BoresalApp/>);
