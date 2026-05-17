/* ============================================================
   BOREAL — Mock data
   ============================================================ */

window.BOREAL_DATA = (() => {

  const CATEGORIES = [
    { id: "groceries",      name: "Groceries",       icon: "🛒", color: "#5b9c6e", group: "Essentials" },
    { id: "dining",         name: "Dining & Coffee", icon: "☕", color: "#c08a4e", group: "Lifestyle" },
    { id: "transport",      name: "Transport",       icon: "🚇", color: "#6b8eb5", group: "Essentials" },
    { id: "fuel",           name: "Fuel",            icon: "⛽", color: "#a47c5b", group: "Essentials" },
    { id: "subscriptions",  name: "Subscriptions",   icon: "📺", color: "#9b6fb7", group: "Lifestyle" },
    { id: "shopping",       name: "Shopping",        icon: "🛍", color: "#c7798d", group: "Lifestyle" },
    { id: "rent",           name: "Rent & Housing",  icon: "🏠", color: "#4a7a8f", group: "Essentials" },
    { id: "utilities",      name: "Utilities",       icon: "💡", color: "#8a96a3", group: "Essentials" },
    { id: "phone",          name: "Phone & Internet",icon: "📱", color: "#7c8aab", group: "Essentials" },
    { id: "health",         name: "Health",          icon: "💊", color: "#76a89c", group: "Essentials" },
    { id: "fitness",        name: "Fitness",         icon: "🏋", color: "#7ba072", group: "Lifestyle" },
    { id: "entertainment",  name: "Entertainment",   icon: "🎬", color: "#b08bbf", group: "Lifestyle" },
    { id: "alcohol",        name: "Alcohol",         icon: "🍷", color: "#9c5a5a", group: "Lifestyle" },
    { id: "income",         name: "Income",          icon: "💼", color: "#3f7f5c", group: "Income" },
    { id: "freelance",      name: "Freelance",       icon: "💻", color: "#5a8db5", group: "Income" },
    { id: "transfer",       name: "Transfer",        icon: "↔",  color: "#9aa5b3", group: "Hidden" },
    { id: "uncategorized",  name: "Uncategorized",   icon: "❓", color: "#b8b0a3", group: "Lifestyle" },
  ];

  const ACCOUNTS = [
    { id: "td_che",    name: "TD Chequing",       type: "Chequing",    bank: "TD",         color: "#0d8a2e", balance: 4382.16,  opening: 2100 },
    { id: "tan_che",   name: "Tangerine Chequing",type: "Chequing",    bank: "Tangerine",  color: "#ff6e1f", balance: 1247.88,  opening: 800 },
    { id: "tan_sav",   name: "Tangerine Savings", type: "Savings",     bank: "Tangerine",  color: "#ff6e1f", balance: 12450.00, opening: 9500 },
    { id: "tan_cc",    name: "Tangerine Mastercard", type: "Credit Card", bank: "Tangerine", color: "#ff6e1f", balance: -842.45, opening: 0 },
    { id: "ws",        name: "Wealthsimple Cash", type: "Chequing",    bank: "Wealthsimple", color: "#000",  balance: 268.42,   opening: 0 },
    { id: "ws_invest", name: "Wealthsimple TFSA", type: "Investment",  bank: "Wealthsimple", color: "#000",  balance: 28140.55, opening: 22000 },
  ];

  // Transactions (March 2026, ordered by date desc)
  const TRANSACTIONS = [
    { id: 1,  date: "2026-03-31", name: "ENBRIDGE GAS",                    memo: "Utilities",            amount: -120.00, cat: "utilities",     acct: "td_che" },
    { id: 2,  date: "2026-03-30", name: "ROGERS WIRELESS",                 memo: "Phone bill",           amount: -85.00,  cat: "phone",         acct: "td_che" },
    { id: 3,  date: "2026-03-29", name: "GoodLife Fitness",                memo: "Gym membership",       amount: -55.00,  cat: "fitness",       acct: "tan_cc" },
    { id: 4,  date: "2026-03-28", name: "Transfer to Savings",             memo: "Monthly auto-save",    amount: -500.00, cat: "transfer",      acct: "tan_che", hidden: true },
    { id: 5,  date: "2026-03-27", name: "Cineplex Entertainment",          memo: "Movie tickets",        amount: -28.00,  cat: "entertainment", acct: "tan_cc" },
    { id: 6,  date: "2026-03-26", name: "No Frills #3312",                 memo: "Groceries",            amount: -98.76,  cat: "groceries",     acct: "tan_che" },
    { id: 7,  date: "2026-03-25", name: "Tim Hortons #3921",               memo: "Morning coffee",       amount: -4.25,   cat: "dining",        acct: "tan_che" },
    { id: 8,  date: "2026-03-22", name: "Canadian Tire #102",              memo: "Auto maintenance",     amount: -67.89,  cat: "shopping",      acct: "tan_cc" },
    { id: 9,  date: "2026-03-21", name: "LCBO #423",                       memo: "",                     amount: -42.30,  cat: "alcohol",       acct: "tan_cc" },
    { id: 10, date: "2026-03-20", name: "Shoppers Drug Mart #2145",        memo: "Pharmacy",             amount: -15.00,  cat: "health",        acct: "tan_che" },
    { id: 11, date: "2026-03-19", name: "Uber Eats",                       memo: "Dinner delivery",      amount: -34.56,  cat: "dining",        acct: "tan_cc" },
    { id: 12, date: "2026-03-18", name: "Spotify Premium",                 memo: "Monthly subscription", amount: -11.99,  cat: "subscriptions", acct: "tan_cc" },
    { id: 13, date: "2026-03-17", name: "Payroll Deposit",                 memo: "ACME Corp salary",     amount: 3250.00, cat: "income",        acct: "td_che" },
    { id: 14, date: "2026-03-16", name: "Dollarama #218",                  memo: "Household",            amount: -8.50,   cat: "shopping",      acct: "tan_che" },
    { id: 15, date: "2026-03-15", name: "Petro-Canada",                    memo: "Fuel",                 amount: -58.40,  cat: "fuel",          acct: "tan_cc" },
    { id: 16, date: "2026-03-14", name: "Interac e-Transfer — John Doe",   memo: "Dinner reimbursement", amount: 45.00,   cat: "freelance",     acct: "tan_che" },
    { id: 17, date: "2026-03-12", name: "Amazon.ca",                       memo: "Books & electronics",  amount: -89.99,  cat: "shopping",      acct: "tan_cc" },
    { id: 18, date: "2026-03-11", name: "Presto Transit",                  memo: "Monthly pass",         amount: -156.00, cat: "transport",     acct: "tan_che" },
    { id: 19, date: "2026-03-10", name: "Interac e-Transfer — Landlord",   memo: "March rent",           amount: -2200.00,cat: "rent",          acct: "td_che" },
    { id: 20, date: "2026-03-09", name: "Tim Hortons #3921",               memo: "Lunch",                amount: -12.30,  cat: "dining",        acct: "tan_che" },
    { id: 21, date: "2026-03-08", name: "Costco Wholesale #441",           memo: "Groceries & household",amount: -210.45, cat: "groceries",     acct: "tan_cc" },
    { id: 22, date: "2026-03-07", name: "Netflix.com",                     memo: "Monthly subscription", amount: -17.99,  cat: "subscriptions", acct: "tan_cc" },
    { id: 23, date: "2026-03-05", name: "Shell Gas Station",               memo: "Fuel",                 amount: -62.80,  cat: "fuel",          acct: "tan_cc" },
    { id: 24, date: "2026-03-04", name: "Loblaws #1042",                   memo: "Weekly groceries",     amount: -145.23, cat: "groceries",     acct: "tan_che" },
    { id: 25, date: "2026-03-03", name: "Payroll Deposit",                 memo: "ACME Corp salary",     amount: 3250.00, cat: "income",        acct: "td_che" },
    { id: 26, date: "2026-03-02", name: "Shoppers Drug Mart #2145",        memo: "Personal care",        amount: -23.50,  cat: "shopping",      acct: "tan_che" },
    { id: 27, date: "2026-03-01", name: "Tim Hortons #3921",               memo: "Coffee & bagel",       amount: -6.45,   cat: "dining",        acct: "tan_che" },
  ];

  const BUDGETS = [
    { cat: "groceries",     limit: 600, spent: 454.44 },
    { cat: "dining",        limit: 150, spent: 57.56 },
    { cat: "fuel",          limit: 200, spent: 121.20 },
    { cat: "transport",     limit: 180, spent: 156.00 },
    { cat: "subscriptions", limit: 50,  spent: 29.98 },
    { cat: "shopping",      limit: 200, spent: 189.88 },
    { cat: "entertainment", limit: 80,  spent: 28.00 },
    { cat: "alcohol",       limit: 60,  spent: 42.30 },
    { cat: "fitness",       limit: 55,  spent: 55.00 },
  ];

  const GOALS = [
    { id: "g1", name: "Emergency Fund",   target: 10000, saved: 6450, color: "#5b9c6e" },
    { id: "g2", name: "Iceland Trip",     target: 3000,  saved: 1820, color: "#6b8eb5" },
    { id: "g3", name: "New Bike",         target: 1500,  saved: 1230, color: "#c08a4e" },
    { id: "g4", name: "TFSA Top-up",      target: 7000,  saved: 4200, color: "#9b6fb7" },
  ];

  const SCHEDULES = [
    { id: "s1", name: "Rent",            type: "expense", cat: "rent",          amount: 2200, account: "td_che", freq: "monthly",  next: "2026-04-01", paused: false },
    { id: "s2", name: "Netflix",         type: "expense", cat: "subscriptions", amount: 17.99, account: "tan_cc", freq: "monthly",  next: "2026-04-07", paused: false },
    { id: "s3", name: "Spotify",         type: "expense", cat: "subscriptions", amount: 11.99, account: "tan_cc", freq: "monthly",  next: "2026-04-18", paused: false },
    { id: "s4", name: "GoodLife Gym",    type: "expense", cat: "fitness",       amount: 55,    account: "tan_cc", freq: "monthly",  next: "2026-04-29", paused: false },
    { id: "s5", name: "Payroll",         type: "income",  cat: "income",        amount: 3250,  account: "td_che", freq: "biweekly", next: "2026-04-03", paused: false },
    { id: "s6", name: "Auto-save → TFSA",type: "expense", cat: "transfer",      amount: 500,   account: "tan_che",freq: "monthly",  next: "2026-04-28", paused: false },
    { id: "s7", name: "Annual domain",   type: "expense", cat: "subscriptions", amount: 18,    account: "tan_cc", freq: "yearly",   next: "2026-08-14", paused: false },
    { id: "s8", name: "Summer pool pass",type: "expense", cat: "fitness",       amount: 25,    account: "tan_che",freq: "monthly",  next: "2026-06-01", paused: true  },
  ];

  const RULES = [
    { id: "r1", priority: 1, when: { field: "description", op: "contains", val: "transfer to savings" }, action: "hide",      label: "" },
    { id: "r2", priority: 2, when: { field: "description", op: "contains", val: "payroll deposit" },    action: "label",     label: "Income / Salary" },
    { id: "r3", priority: 3, when: { field: "description", op: "contains", val: "interac e-transfer from john" }, action: "label", label: "Income / Freelance" },
    { id: "r4", priority: 4, when: { field: "amount",      op: "<",        val: -1000 },                 action: "label",     label: "Large expense — review" },
    { id: "r5", priority: 5, when: { field: "description", op: "contains", val: "cc payment" },          action: "hide",      label: "" },
  ];

  const RECURRING = [
    { name: "Netflix",            avg: 17.99,  freq: "Monthly", months: 12, last: "2026-03-07", warn: "Was $16.49 — increased $1.50" },
    { name: "Spotify Premium",    avg: 11.99,  freq: "Monthly", months: 12, last: "2026-03-18" },
    { name: "GoodLife Fitness",   avg: 55.00,  freq: "Monthly", months: 9,  last: "2026-03-29" },
    { name: "Rogers Wireless",    avg: 85.00,  freq: "Monthly", months: 12, last: "2026-03-30" },
    { name: "Enbridge Gas",       avg: 96.40,  freq: "Monthly", months: 6,  last: "2026-03-31" },
    { name: "Presto Transit",     avg: 156.00, freq: "Monthly", months: 8,  last: "2026-03-11" },
  ];

  // Monthly history for charts (Apr 2025 → Mar 2026)
  const HISTORY = [
    { m: "Apr",  income: 6325, expenses: 4520, net: 1805 },
    { m: "May",  income: 6500, expenses: 4980, net: 1520 },
    { m: "Jun",  income: 6500, expenses: 5340, net: 1160 },
    { m: "Jul",  income: 6840, expenses: 4720, net: 2120 },
    { m: "Aug",  income: 6500, expenses: 5630, net: 870 },
    { m: "Sep",  income: 6500, expenses: 4150, net: 2350 },
    { m: "Oct",  income: 6500, expenses: 4890, net: 1610 },
    { m: "Nov",  income: 6500, expenses: 5220, net: 1280 },
    { m: "Dec",  income: 9100, expenses: 6840, net: 2260 },
    { m: "Jan",  income: 6500, expenses: 4980, net: 1520 },
    { m: "Feb",  income: 6500, expenses: 4640, net: 1860 },
    { m: "Mar",  income: 6545, expenses: 4574, net: 1971 },
  ];

  // Net worth trail (sum-of-accounts approx, monthly snapshots)
  const NET_WORTH = [
    { m: "Apr 25", v: 28940 },
    { m: "May 25", v: 30460 },
    { m: "Jun 25", v: 31620 },
    { m: "Jul 25", v: 33740 },
    { m: "Aug 25", v: 34610 },
    { m: "Sep 25", v: 36960 },
    { m: "Oct 25", v: 38570 },
    { m: "Nov 25", v: 39850 },
    { m: "Dec 25", v: 42110 },
    { m: "Jan 26", v: 43630 },
    { m: "Feb 26", v: 45490 },
    { m: "Mar 26", v: 47461 },
  ];

  const LEARNED_MERCHANTS = [
    { keyword: "TIM HORTONS",   cat: "dining",        count: 28 },
    { keyword: "LOBLAWS",       cat: "groceries",     count: 12 },
    { keyword: "NETFLIX",       cat: "subscriptions", count: 11 },
    { keyword: "PRESTO",        cat: "transport",     count: 9 },
    { keyword: "ENBRIDGE",      cat: "utilities",     count: 6 },
    { keyword: "SHELL",         cat: "fuel",          count: 14 },
    { keyword: "AMAZON",        cat: "shopping",      count: 18 },
    { keyword: "GOODLIFE",      cat: "fitness",       count: 9 },
  ];

  return {
    CATEGORIES, ACCOUNTS, TRANSACTIONS, BUDGETS, GOALS,
    SCHEDULES, RULES, RECURRING, HISTORY, NET_WORTH, LEARNED_MERCHANTS,
  };
})();
