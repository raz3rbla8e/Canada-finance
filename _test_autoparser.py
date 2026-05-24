"""End-to-end test of the intelligent auto-parser.

Tests that auto_detect_columns() can correctly identify date, description,
and amount columns from CSVs of completely unknown bank formats —
then that parse_with_config() successfully parses them with the detected mapping.
"""
import os, sys, io, csv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from boreal.services.csv_parser import parse_with_config, detect_bank_config
from boreal.services.auto_detect import auto_detect_columns, build_virtual_config

PASS = 0
FAIL = 0

def check(desc, actual, expected):
    global PASS, FAIL
    ok = actual == expected
    status = "PASS" if ok else "FAIL"
    if not ok:
        FAIL += 1
        print(f"  {status}: {desc}")
        print(f"         expected: {expected!r}")
        print(f"         got:      {actual!r}")
    else:
        PASS += 1
        print(f"  {status}: {desc}")

def check_in(desc, actual, expected_set):
    global PASS, FAIL
    ok = actual in expected_set
    status = "PASS" if ok else "FAIL"
    if not ok:
        FAIL += 1
        print(f"  {status}: {desc}")
        print(f"         expected one of: {expected_set!r}")
        print(f"         got:             {actual!r}")
    else:
        PASS += 1
        print(f"  {status}: {desc}")

def check_gte(desc, actual, minimum):
    global PASS, FAIL
    ok = actual >= minimum
    status = "PASS" if ok else "FAIL"
    if not ok:
        FAIL += 1
        print(f"  {status}: {desc}")
        print(f"         expected >= {minimum}")
        print(f"         got:       {actual}")
    else:
        PASS += 1
        print(f"  {status}: {desc}")

def detect_and_config(csv_text):
    """Run auto_detect_columns and build a virtual config for parse_with_config."""
    detection = auto_detect_columns(csv_text)
    return detection, build_virtual_config(detection, account_label="Test Bank")


# ══════════════════════════════════════════════════════════════
# TEST DATA: CSVs from various "unsupported" banks
# ══════════════════════════════════════════════════════════════

# 1. Simple single-amount CSV (generic US bank style)
CSV_SIMPLE = """Date,Description,Amount
2026-05-01,COSTCO WHOLESALE,-45.99
2026-05-02,PAYROLL DEPOSIT,2500.00
2026-05-03,STARBUCKS,-6.75
2026-05-04,AMAZON.CA,-89.99
2026-05-05,ETRANSFER FROM JOHN,150.00
"""

# 2. Debit/Credit split columns (UK bank style)
CSV_DEBIT_CREDIT = """Transaction Date,Details,Money Out,Money In,Balance
01/05/2026,TESCO STORES,32.50,,1245.50
02/05/2026,SALARY,,3200.00,4445.50
03/05/2026,DIRECT DEBIT - NETFLIX,15.99,,4429.51
04/05/2026,AMAZON MARKETPLACE,67.89,,4361.62
05/05/2026,REFUND - ARGOS,,25.00,4386.62
"""

# 3. Unusual column names (European bank)
CSV_EUROPEAN = """Posting Date,Narrative,Debit,Credit,Running Balance
2026/05/01,ALBERT HEIJN -234,12.50,,890.00
2026/05/02,SALARY PAYMENT,,2800.00,3690.00
2026/05/03,NS TREINKAART,45.00,,3645.00
2026/05/04,MEDIAMARKT ELECTRONICS,299.99,,3345.01
2026/05/05,TIKKIE REFUND,,15.00,3360.01
"""

# 4. Minimal headers (Australian bank)
CSV_MINIMAL = """Date,Memo,Value
05/01/2026,WOOLWORTHS 1234,-55.20
05/02/2026,SALARY CREDIT,3100.00
05/03/2026,UBER TRIP,-12.50
05/04/2026,JB HI-FI,-199.00
05/05/2026,ATM WITHDRAWAL,-200.00
"""

# 5. Non-standard column names
CSV_NONSTANDARD = """Trans Date,Payee/Description,Withdrawal,Deposit,Account Balance
2026-05-01,SHELL GAS STATION,65.00,,2345.00
2026-05-02,DIRECT DEPOSIT - EMPLOYER,,4500.00,6845.00
2026-05-03,HYDRO ONE PAYMENT,125.00,,6720.00
2026-05-04,CANADIAN TIRE,89.99,,6630.01
2026-05-05,INSURANCE REFUND,,200.00,6830.01
"""

# 6. MM/DD/YYYY dates with "Transaction Amount"
CSV_US_BANK = """Posted Date,Reference Number,Transaction Description,Transaction Amount
05/01/2026,REF001,WAL-MART SUPERCENTER,-78.45
05/02/2026,REF002,DIRECT DEPOSIT - PAYROLL,3250.00
05/03/2026,REF003,MCDONALD'S #12345,-9.99
05/04/2026,REF004,COSTCO GAS,-42.50
05/05/2026,REF005,VENMO CASHBACK,10.00
"""

# 7. Tab-like CSV with "Value Date"
CSV_VALUE_DATE = """Value Date,Description,Amount,Currency
2026-05-01,GROCERY STORE PURCHASE,-88.00,CAD
2026-05-02,PAYCHECK DEPOSIT,2900.00,CAD
2026-05-03,GAS STATION,-55.00,CAD
2026-05-04,ONLINE SHOPPING,-145.00,CAD
2026-05-05,REFUND FROM MERCHANT,30.00,CAD
"""

# 8. Credit card with charges and payments
CSV_CREDIT_CARD = """Trans. Date,Post Date,Description,Category,Amount
05/01/2026,05/02/2026,UBER EATS,Food & Drink,22.50
05/02/2026,05/03/2026,SPOTIFY PREMIUM,Entertainment,11.99
05/03/2026,05/04/2026,PAYMENT RECEIVED - THANK YOU,Payment,-500.00
05/04/2026,05/05/2026,LOBLAWS GROCERIES,Groceries,156.78
05/05/2026,05/06/2026,SHOPPERS DRUG MART,Health,34.50
"""

# 9. Make sure known banks are NOT misdetected by auto-parser
CSV_RBC_LIKE = """date,description,debit,credit,transaction
2026-05-01,TIM HORTONS,5.50,,POS
2026-05-02,PAYROLL,,3000.00,DEP
"""


# ══════════════════════════════════════════════════════════════
print("=" * 70)
print("INTELLIGENT AUTO-PARSER TESTS")
print("=" * 70)

# ── Test 1: Simple single-amount CSV ──
print("\n── Test 1: Simple single-amount CSV ──")
d1, cfg1 = detect_and_config(CSV_SIMPLE)
check("date_col", d1["date_col"], "Date")
check("desc_col", d1["desc_col"], "Description")
check("amount_col", d1["amount_col"], "Amount")
check_gte("confidence", d1["confidence"], 0.5)

txns1 = parse_with_config(CSV_SIMPLE, cfg1, {})
check("parsed count", len(txns1), 5)
check("first is expense", txns1[0]["type"], "Expense")
check("first amount", txns1[0]["amount"], 45.99)
check("second is income", txns1[1]["type"], "Income")
check("second amount", txns1[1]["amount"], 2500.00)

# ── Test 2: Debit/Credit split columns ──
print("\n── Test 2: Debit/Credit split (UK style) ──")
d2, cfg2 = detect_and_config(CSV_DEBIT_CREDIT)
check("date_col", d2["date_col"], "Transaction Date")
check("desc_col", d2["desc_col"], "Details")
check_in("debit_col", d2["debit_col"], {"Money Out"})
check_in("credit_col", d2["credit_col"], {"Money In"})
check_gte("confidence", d2["confidence"], 0.4)

txns2 = parse_with_config(CSV_DEBIT_CREDIT, cfg2, {})
check("parsed count", len(txns2), 5)
check("first is expense", txns2[0]["type"], "Expense")
check("first amount", txns2[0]["amount"], 32.50)
check("second is income", txns2[1]["type"], "Income")

# ── Test 3: European bank ──
print("\n── Test 3: European bank (Narrative, Running Balance) ──")
d3, cfg3 = detect_and_config(CSV_EUROPEAN)
check("date_col", d3["date_col"], "Posting Date")
check("desc_col", d3["desc_col"], "Narrative")
check_in("debit_col", d3["debit_col"], {"Debit"})
check_in("credit_col", d3["credit_col"], {"Credit"})
check_gte("confidence", d3["confidence"], 0.5)

txns3 = parse_with_config(CSV_EUROPEAN, cfg3, {})
check("parsed count", len(txns3), 5)

# ── Test 4: Minimal headers ──
print("\n── Test 4: Minimal headers (Date, Memo, Value) ──")
d4, cfg4 = detect_and_config(CSV_MINIMAL)
check("date_col", d4["date_col"], "Date")
check_in("desc_col", d4["desc_col"], {"Memo"})
check("amount_col or debit/credit detected",
         d4["amount_col"] is not None or d4["debit_col"] is not None, True)
check_gte("confidence", d4["confidence"], 0.3)

txns4 = parse_with_config(CSV_MINIMAL, cfg4, {})
check("parsed count", len(txns4), 5)

# ── Test 5: Non-standard column names ──
print("\n── Test 5: Non-standard columns (Payee/Description, Withdrawal, Deposit) ──")
d5, cfg5 = detect_and_config(CSV_NONSTANDARD)
check_in("date_col", d5["date_col"], {"Trans Date"})
check_in("desc_col", d5["desc_col"], {"Payee/Description"})
check_in("debit_col", d5["debit_col"], {"Withdrawal"})
check_in("credit_col", d5["credit_col"], {"Deposit"})

txns5 = parse_with_config(CSV_NONSTANDARD, cfg5, {})
check("parsed count", len(txns5), 5)
check("first is expense", txns5[0]["type"], "Expense")
check("second is income", txns5[1]["type"], "Income")

# ── Test 6: US bank with Transaction Amount + Transaction Description ──
print("\n── Test 6: US bank (Posted Date, Transaction Description, Transaction Amount) ──")
d6, cfg6 = detect_and_config(CSV_US_BANK)
check_in("date_col", d6["date_col"], {"Posted Date"})
check_in("desc_col", d6["desc_col"], {"Transaction Description"})
check_in("amount_col", d6["amount_col"], {"Transaction Amount"})

txns6 = parse_with_config(CSV_US_BANK, cfg6, {})
check("parsed count", len(txns6), 5)

# ── Test 7: Value Date + Currency column ──
print("\n── Test 7: Value Date + Currency column ──")
d7, cfg7 = detect_and_config(CSV_VALUE_DATE)
check_in("date_col", d7["date_col"], {"Value Date"})
check("desc_col", d7["desc_col"], "Description")
check_in("amount_col", d7["amount_col"], {"Amount"})

txns7 = parse_with_config(CSV_VALUE_DATE, cfg7, {})
check("parsed count", len(txns7), 5)

# ── Test 8: Credit card with Category column ──
print("\n── Test 8: Credit card CSV (with Category, Trans./Post Date) ──")
d8, cfg8 = detect_and_config(CSV_CREDIT_CARD)
check_in("date_col", d8["date_col"], {"Trans. Date", "Post Date"})
check("desc_col", d8["desc_col"], "Description")
check_in("amount_col", d8["amount_col"], {"Amount"})

txns8 = parse_with_config(CSV_CREDIT_CARD, cfg8, {})
check("parsed count >= 4", len(txns8) >= 4, True)

# ── Test 9: Known banks shouldn't reach auto-parser ──
print("\n── Test 9: Known banks detected by YAML (not auto-parser) ──")
header_line = CSV_RBC_LIKE.strip().splitlines()[0]
config, name = detect_bank_config(header_line)
check("RBC-like detected", config is not None, True)

# ── Test 10: Edge cases ──
print("\n── Test 10: Edge cases ──")
d_empty = auto_detect_columns("")
check("empty CSV → low confidence", d_empty["confidence"], 0.0)

d_headers_only = auto_detect_columns("Col1\n")
check("headers-only → low confidence", d_headers_only["confidence"] <= 0.5, True)

# ── Test 11: End-to-end flow (detect → auto-detect → parse) ──
print("\n── Test 11: End-to-end flow (detect fails → auto-detect → parse) ──")
CSV_UNKNOWN_E2E = """Transaction Date,Payee,Value
2026-05-01,COSTCO WHOLESALE,-45.99
2026-05-02,PAYROLL DEPOSIT,2500.00
2026-05-03,STARBUCKS,-6.75
2026-05-04,AMAZON.CA,-89.99
2026-05-05,ETRANSFER FROM JOHN,150.00
"""
header_line_e2e = CSV_UNKNOWN_E2E.strip().splitlines()[0]
cfg_det, name_det = detect_bank_config(header_line_e2e)
check("unknown CSV not detected as known bank", cfg_det, None)
check("returns unknown", name_det, "unknown")

d_e2e, cfg_e2e = detect_and_config(CSV_UNKNOWN_E2E)
check("auto-detected date", d_e2e["date_col"], "Transaction Date")
check_in("auto-detected desc", d_e2e["desc_col"], {"Payee"})
check_in("auto-detected amount", d_e2e["amount_col"], {"Value"})

txns_e2e = parse_with_config(CSV_UNKNOWN_E2E, cfg_e2e, {})
check("e2e parsed 5 txns", len(txns_e2e), 5)
check("e2e first name", txns_e2e[0]["name"], "COSTCO WHOLESALE")
check("e2e first type", txns_e2e[0]["type"], "Expense")
check("e2e first amount", txns_e2e[0]["amount"], 45.99)
check("e2e second type", txns_e2e[1]["type"], "Income")


# ══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print(f"RESULTS: {PASS} passed, {FAIL} failed, {PASS+FAIL} total")
print("=" * 70)
sys.exit(1 if FAIL else 0)
