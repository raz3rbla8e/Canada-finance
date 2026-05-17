/* ============================================================
   BOREAL — Shared UI primitives & icons
   ============================================================ */

const { useState, useEffect, useMemo, useRef } = React;
const D = window.BOREAL_DATA;

/* ---------- Icons (stroke, 16px, currentColor) ---------- */
const Icon = ({ name, size = 16, ...p }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    list:      <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    target:    <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></>,
    wallet:    <><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h12"/><circle cx="17" cy="13" r="1.2"/></>,
    calendar:  <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    upload:    <><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 3v12M7 8l5-5 5 5"/></>,
    funnel:    <><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>,
    cog:       <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.15-1.43l2-1.55-2-3.46-2.36.85a7 7 0 0 0-2.48-1.43L13.5 2h-3l-.51 2.98a7 7 0 0 0-2.48 1.43l-2.36-.85-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .49.05.96.15 1.43l-2 1.55 2 3.46 2.36-.85a7 7 0 0 0 2.48 1.43L10.5 22h3l.51-2.98a7 7 0 0 0 2.48-1.43l2.36.85 2-3.46-2-1.55c.1-.47.15-.94.15-1.43z"/></>,
    chev_l:    <path d="M14 6l-6 6 6 6"/>,
    chev_r:    <path d="M10 6l6 6-6 6"/>,
    chev_d:    <path d="M6 9l6 6 6-6"/>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    search:    <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>,
    download:  <><path d="M12 3v12M7 11l5 4 5-4M4 21h16"/></>,
    bell:      <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    moon:      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
    sun:       <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    arrow_up: <><path d="M7 17L17 7M9 7h8v8"/></>,
    arrow_dn: <><path d="M7 7l10 10M9 17h8V9"/></>,
    arrow_r:  <path d="M5 12h14M13 6l6 6-6 6"/>,
    arrow_lr: <><path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/></>,
    check:    <path d="M4 12l5 5L20 6"/>,
    x:        <path d="M5 5l14 14M19 5L5 19"/>,
    pause:    <><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></>,
    play:     <path d="M6 4l14 8-14 8z"/>,
    edit:     <><path d="M16 3l5 5L8 21H3v-5z"/></>,
    trash:    <><path d="M4 6h16M9 6V4h6v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></>,
    rules:    <><path d="M4 6h10M4 12h7M4 18h10"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></>,
    eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    eye_off:  <><path d="M3 3l18 18M10.7 5.1A11 11 0 0 1 22 12s-1 2-2.5 3.5M6.7 6.7C4 8.5 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 1 0 4.2 4.2"/></>,
    bars:     <><rect x="4" y="13" width="3" height="7" rx="1"/><rect x="10.5" y="9" width="3" height="11" rx="1"/><rect x="17" y="5" width="3" height="15" rx="1"/></>,
    pie:      <><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M12 3v9h9a9 9 0 0 0-9-9z"/></>,
    spark:    <><path d="M3 17l4-6 4 3 5-8 5 6"/></>,
    home:     <><path d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></>,
    sliders:  <><path d="M4 6h12M4 12h7M4 18h16"/><circle cx="19" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="icon" {...p}>
      {paths[name] || null}
    </svg>
  );
};

/* ---------- Brand mark ---------- */
const BrandMark = () => (
  <svg viewBox="0 0 24 24" fill="none">
    {/* stylized evergreen */}
    <path d="M12 3 L7 10 L9.5 10 L6.5 14 L9 14 L5 19 L19 19 L15 14 L17.5 14 L14.5 10 L17 10 Z" fill="currentColor" opacity="0.95"/>
    <rect x="11" y="19" width="2" height="3" rx="0.5" fill="currentColor" opacity="0.6"/>
  </svg>
);

/* ---------- formatters ---------- */
const fmtCurrencyParts = (n) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [d, c] = abs.toFixed(2).split(".");
  const dollars = d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { sign, dollars, cents: c };
};
const fmtCurrency = (n, opts = {}) => {
  const { sign, dollars, cents } = fmtCurrencyParts(n);
  if (opts.hideCents) return `${sign}$${dollars}`;
  return `${sign}$${dollars}.${cents}`;
};
const fmtCurrencyJSX = (n, opts = {}) => {
  const { sign, dollars, cents } = fmtCurrencyParts(n);
  return <>{sign}${dollars}<span className="cents">.{cents}</span></>;
};
const fmtSignedCurrency = (n) => (n >= 0 ? "+" : "−") + "$" + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
};
const fmtDateLong = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
};

/* ---------- Lookups ---------- */
const catById = (id) => D.CATEGORIES.find(c => c.id === id) || D.CATEGORIES[D.CATEGORIES.length-1];
const acctById = (id) => D.ACCOUNTS.find(a => a.id === id) || D.ACCOUNTS[0];

/* ---------- CategoryPill ---------- */
const CategoryPill = ({ catId }) => {
  const c = catById(catId);
  return (
    <span className="cat-pill" title={c.name}>
      <span className="dot" style={{ background: c.color }}></span>
      {c.name}
    </span>
  );
};

/* ---------- Merchant Glyph ---------- */
const MerchantGlyph = ({ name, color }) => {
  const ch = name.replace(/^(THE |INTERAC )/i, "").trim()[0]?.toUpperCase() || "?";
  return (
    <div className="merchant-glyph" style={color ? { color: color, background: color + "12", borderColor: color + "30" } : undefined}>
      {ch}
    </div>
  );
};

/* ---------- Sparkline ---------- */
const Sparkline = ({ values, w = 80, h = 24, stroke = "var(--accent)" }) => {
  if (!values.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg className="kpi-spark" width={w} height={h} fill="none">
      <polyline points={pts} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

/* ---------- Net Worth area chart ---------- */
const NetWorthChart = ({ data, accent = "var(--accent)" }) => {
  const w = 760, h = 220, pad = 28;
  const min = Math.min(...data.map(d => d.v));
  const max = Math.max(...data.map(d => d.v));
  const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const xy = (i, v) => [
    pad + i * step,
    h - pad - ((v - min) / range) * (h - pad * 2),
  ];
  const pts = data.map((d, i) => xy(i, d.v));
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const areaPath = `${path} L${pts[pts.length-1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line key={i} x1={pad} x2={w-pad} y1={pad + p * (h - pad*2)} y2={pad + p * (h - pad*2)}
            stroke="var(--line-1)" strokeWidth="1" strokeDasharray="2 4"/>
        ))}
        <path d={areaPath} fill="url(#nw-grad)"/>
        <path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 0} fill={accent}/>
        ))}
        {data.map((d, i) => (
          <text key={i} x={pad + i * step} y={h - 6} textAnchor="middle"
            fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-sans)">{d.m.split(" ")[0]}</text>
        ))}
      </svg>
    </div>
  );
};

/* ---------- Doughnut (category breakdown) ---------- */
const Doughnut = ({ slices, size = 180 }) => {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 14;
  const c = size / 2;
  let a = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const a1 = a + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = c + r * Math.cos(a), y0 = c + r * Math.sin(a);
    const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    const d = `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
    a = a1;
    return <path key={i} d={d} fill="none" stroke={s.color} strokeWidth="22" strokeLinecap="butt"/>;
  });
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line-1)" strokeWidth="22"/>
      {arcs}
    </svg>
  );
};

/* ---------- Bar group ---------- */
const BarPair = ({ income, expense, max }) => {
  const i = (income / max) * 100;
  const e = (expense / max) * 100;
  return (
    <div className="bar-col">
      <div style={{ height: `${e}%` }} className="bar-neg" title={`Exp $${expense}`}></div>
    </div>
  );
};

/* ---------- Drag handle export to window ---------- */
Object.assign(window, {
  Icon, BrandMark, CategoryPill, MerchantGlyph, Sparkline, NetWorthChart, Doughnut,
  fmtCurrency, fmtCurrencyJSX, fmtSignedCurrency, fmtDate, fmtDateLong,
  catById, acctById,
});
