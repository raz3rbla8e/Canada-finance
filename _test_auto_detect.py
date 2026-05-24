"""Test the auto-detection engine against all sample CSVs and synthetic edge cases."""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from boreal.services.auto_detect import auto_detect_columns, build_virtual_config
from boreal.services.csv_parser import parse_with_config


def read_csv(path):
    with open(path, "r", encoding="utf-8-sig") as f:
        return f.read()


def test_sample_csvs():
    """Test auto-detection against all sample_data CSVs."""
    sample_dir = os.path.join(os.path.dirname(__file__), "sample_data")
    files = sorted(f for f in os.listdir(sample_dir) if f.endswith(".csv"))

    print(f"\n{'='*70}")
    print(f" AUTO-DETECTION TEST: {len(files)} sample CSVs")
    print(f"{'='*70}\n")

    passed = 0
    failed = 0

    for fname in files:
        path = os.path.join(sample_dir, fname)
        text = read_csv(path)
        det = auto_detect_columns(text)

        # Determine expected format from filename
        is_debit_credit = "rbc" in fname or "td" in fname
        is_single_amount = "tangerine" in fname

        ok = True
        issues = []

        if det.get("error"):
            ok = False
            issues.append(f"ERROR: {det['error']}")
        else:
            if not det.get("date_col"):
                ok = False
                issues.append("No date column detected")
            if not det.get("desc_col"):
                ok = False
                issues.append("No description column detected")
            if not det.get("amount_col") and not (det.get("debit_col") and det.get("credit_col")):
                ok = False
                issues.append("No amount column(s) detected")

            # Check debit/credit vs single amount
            if is_debit_credit:
                if not det.get("debit_col") or not det.get("credit_col"):
                    issues.append(f"Expected debit/credit split, got amount_col={det.get('amount_col')}")
            elif is_single_amount:
                if not det.get("amount_col"):
                    issues.append(f"Expected single amount, got debit={det.get('debit_col')} credit={det.get('credit_col')}")

            # Try parsing
            config = build_virtual_config(det)
            txns = parse_with_config(text, config, {})
            if not txns:
                ok = False
                issues.append("parse_with_config returned 0 transactions")

        status = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        else:
            passed += 1

        conf = det.get("confidence", 0)
        print(f"  [{status}] {fname}")
        print(f"         date={det.get('date_col')!r}  desc={det.get('desc_col')!r}  "
              f"amt={det.get('amount_col')!r}  dr={det.get('debit_col')!r}  cr={det.get('credit_col')!r}")
        print(f"         date_fmt={det.get('date_format')!r}  sign={det.get('amount_sign')!r}  "
              f"confidence={conf:.2f}  header_row={det.get('header_row', 0)}")
        if 'txns' in dir() and txns:
            print(f"         parsed {len(txns)} transactions")
        if issues:
            for iss in issues:
                print(f"         ⚠ {iss}")
        if det.get("warnings"):
            for w in det["warnings"]:
                print(f"         ⚠ {w}")
        print()

    print(f"{'='*70}")
    print(f" RESULTS: {passed} passed, {failed} failed out of {len(files)}")
    print(f"{'='*70}\n")
    return failed == 0


def test_synthetic_csvs():
    """Test with diverse synthetic CSV formats."""
    print(f"\n{'='*70}")
    print(f" SYNTHETIC CSV TESTS")
    print(f"{'='*70}\n")

    tests = []

    # 1. Semicolon-delimited (European bank)
    tests.append(("Semicolon-delimited European", """Datum;Beschreibung;Betrag;Saldo
15.03.2026;REWE MARKT BERLIN;-45,90;1234,56
16.03.2026;AMAZON EU SARL;-29,99;1204,57
17.03.2026;GEHALT ARBEITGEBER;2800,00;4004,57
18.03.2026;MIETE WOHNUNG;-850,00;3154,57
19.03.2026;DB BAHN TICKET;-35,50;3119,07""", {
        "expect_date": "Datum",
        "expect_desc": "Beschreibung",
        "expect_amount": "Betrag",
        "expect_delimiter": ";",
    }))

    # 2. Tab-delimited
    tests.append(("Tab-delimited", "Date\tPayee\tAmount\tBalance\n2026-03-15\tGrocery Store\t-52.30\t1500.00\n2026-03-16\tGas Station\t-40.00\t1460.00\n2026-03-17\tPayroll Deposit\t2500.00\t3960.00\n2026-03-18\tElectric Bill\t-95.00\t3865.00\n2026-03-19\tRestaurant\t-35.00\t3830.00", {
        "expect_date": "Date",
        "expect_desc": "Payee",
        "expect_amount": "Amount",
        "expect_delimiter": "\t",
    }))

    # 3. DD/MM/YYYY date format (day > 12 present for disambiguation)
    tests.append(("DD/MM/YYYY dates", """Date,Description,Amount
15/03/2026,TESCO GROCERIES,-32.50
16/03/2026,TFL TRAVEL,-5.40
17/03/2026,SALARY PAYMENT,3200.00
18/03/2026,NETFLIX SUBSCRIPTION,-12.99
25/03/2026,SAINSBURYS,-45.00""", {
        "expect_date": "Date",
        "expect_desc": "Description",
        "expect_amount": "Amount",
        "expect_date_format_contains": "%d",  # should detect DD/MM since 15, 16 etc > 12
    }))

    # 4. Named month dates
    tests.append(("Named month dates", """Posted Date,Reference,Description,Amount
"Mar 15, 2026",REF001,WHOLE FOODS MARKET,-78.30
"Mar 16, 2026",REF002,UBER TRIP,-22.50
"Mar 17, 2026",REF003,DIRECT DEPOSIT,4500.00
"Mar 18, 2026",REF004,COMCAST INTERNET,-89.99
"Mar 19, 2026",REF005,TARGET STORES,-34.50""", {
        "expect_date": "Posted Date",
        "expect_desc": "Description",
        "expect_amount": "Amount",
    }))

    # 5. Debit/credit split with different column names
    tests.append(("Debit/credit split (Paid Out/Paid In)", """Transaction Date,Details,Paid Out,Paid In,Balance
2026-03-15,GROCERY STORE,45.00,,1455.00
2026-03-16,RESTAURANT,32.50,,1422.50
2026-03-17,SALARY,,3000.00,4422.50
2026-03-18,RENT,1200.00,,3222.50
2026-03-19,TRANSFER IN,,500.00,3722.50""", {
        "expect_date": "Transaction Date",
        "expect_desc": "Details",
        "expect_debit": "Paid Out",
        "expect_credit": "Paid In",
    }))

    # 6. CSV with extra ignored columns
    tests.append(("Extra columns (ref, card, status)", """Date,Card Number,Reference,Description,Category,Amount,Status
2026-03-15,****1234,TXN001,WALMART SUPERCENTER,Shopping,-89.50,Posted
2026-03-16,****1234,TXN002,SHELL GAS,Transportation,-45.00,Posted
2026-03-17,****1234,TXN003,PAYROLL DEPOSIT,Income,3500.00,Posted
2026-03-18,****1234,TXN004,HYDRO BILL,Utilities,-120.00,Pending
2026-03-19,****1234,TXN005,AMAZON.COM,Shopping,-67.99,Posted""", {
        "expect_date": "Date",
        "expect_desc": "Description",
        "expect_amount": "Amount",
    }))

    # 7. CSV with quoted fields containing commas
    tests.append(("Quoted fields with commas", '''Date,Description,Amount
2026-03-15,"SMITH, JOHN - TRANSFER",-200.00
2026-03-16,"ACME CORP, INC.",3500.00
2026-03-17,"GROCERY STORE #1,234",-55.00
2026-03-18,"DR. JOHNSON, DENTIST",-150.00
2026-03-19,"PIZZA HUT, DELIVERY",-28.50''', {
        "expect_date": "Date",
        "expect_desc": "Description",
        "expect_amount": "Amount",
    }))

    # 8. Currency symbols in amounts
    tests.append(("Currency symbols in amounts", """Date,Merchant,Amount
2026-03-15,STARBUCKS,$-7.85
2026-03-16,BEST BUY,$-149.99
2026-03-17,EMPLOYER PAYROLL,$3200.00
2026-03-18,NETFLIX,$-15.99
2026-03-19,GAS STATION,$-52.10""", {
        "expect_date": "Date",
        "expect_desc": "Merchant",
        "expect_amount": "Amount",
    }))

    # 9. CSV with metadata rows before header (like Amex)
    tests.append(("Metadata rows before header", """Account Summary
Card: ****4567
Statement Period: March 2026
Download Date: 2026-04-01

Transaction Date,Description,Amount
2026-03-15,RESTAURANT LA BELLE,-95.00
2026-03-16,UBER EATS,-28.50
2026-03-17,APPLE STORE,-999.00
2026-03-18,REFUND - AMAZON,45.00
2026-03-19,GAS STATION,-52.10""", {
        "expect_date": "Transaction Date",
        "expect_desc": "Description",
        "expect_amount": "Amount",
        "expect_header_row_gt": 0,  # header should NOT be row 0
    }))

    # 10. Inverted sign convention (positive = expense)
    tests.append(("Inverted sign (positive=expense)", """Date,Merchant,Amount
2026-03-15,GROCERY STORE,72.30
2026-03-16,GAS STATION,55.00
2026-03-17,RESTAURANT,45.00
2026-03-18,REFUND AMAZON,-29.99
2026-03-19,ONLINE SHOPPING,89.99""", {
        "expect_date": "Date",
        "expect_desc": "Merchant",
        "expect_amount": "Amount",
        "expect_sign": "inverted",
    }))

    # 11. European decimal format (comma decimal, period thousands)
    tests.append(("European decimals (1.234,56)", """Datum;Beschreibung;Betrag
15.03.2026;LIDL FILIALE;-45,90
16.03.2026;AMAZON.DE;-1.299,99
17.03.2026;GEHALT;2.800,00
18.03.2026;MIETE;-850,00
19.03.2026;ROSSMANN;-12,50""", {
        "expect_date": "Datum",
        "expect_desc": "Beschreibung",
        "expect_amount": "Betrag",
        "expect_delimiter": ";",
    }))

    # 12. Pipe-delimited
    tests.append(("Pipe-delimited", """Date|Description|Debit|Credit
2026-03-15|GROCERY STORE|45.00|
2026-03-16|RESTAURANT|32.50|
2026-03-17|SALARY||3000.00
2026-03-18|RENT|1200.00|
2026-03-19|FREELANCE INCOME||800.00""", {
        "expect_date": "Date",
        "expect_desc": "Description",
        "expect_debit": "Debit",
        "expect_credit": "Credit",
        "expect_delimiter": "|",
    }))

    # 13. Minimal 3-column CSV
    tests.append(("Minimal 3 columns", """date,name,amount
2026-03-15,Coffee Shop,-5.50
2026-03-16,Subway Fare,-3.25
2026-03-17,Direct Deposit,2800.00
2026-03-18,Phone Bill,-65.00
2026-03-19,Grocery,-42.30""", {
        "expect_date": "date",
        "expect_desc": "name",
        "expect_amount": "amount",
    }))

    # 14. French column names
    tests.append(("French column names", """Date,Libellé,Débit,Crédit
15/03/2026,ÉPICERIE METRO,45.00,
16/03/2026,RESTAURANT CHEZ JULES,32.50,
17/03/2026,SALAIRE,,3000.00
18/03/2026,LOYER,1200.00,
19/03/2026,VIREMENT ENTRANT,,500.00""", {
        "expect_date": "Date",
        "expect_desc": "Libellé",
        "expect_debit": "Débit",
        "expect_credit": "Crédit",
    }))

    # 15. Accounting format with parentheses for negative
    tests.append(("Accounting format parens", """Date,Description,Amount
2026-03-15,Office Supplies,(45.00)
2026-03-16,Client Payment,1500.00
2026-03-17,Software License,(299.00)
2026-03-18,Consulting Fee,2500.00
2026-03-19,Travel Expense,(350.00)""", {
        "expect_date": "Date",
        "expect_desc": "Description",
        "expect_amount": "Amount",
    }))

    passed = 0
    failed = 0

    for name, csv_text, expects in tests:
        det = auto_detect_columns(csv_text)
        ok = True
        issues = []

        if det.get("error"):
            ok = False
            issues.append(f"ERROR: {det['error']}")
        else:
            # Check expectations
            for key, expected in expects.items():
                if key == "expect_date" and det.get("date_col") != expected:
                    issues.append(f"date_col: expected {expected!r}, got {det.get('date_col')!r}")
                elif key == "expect_desc" and det.get("desc_col") != expected:
                    issues.append(f"desc_col: expected {expected!r}, got {det.get('desc_col')!r}")
                elif key == "expect_amount" and det.get("amount_col") != expected:
                    issues.append(f"amount_col: expected {expected!r}, got {det.get('amount_col')!r}")
                elif key == "expect_debit" and det.get("debit_col") != expected:
                    issues.append(f"debit_col: expected {expected!r}, got {det.get('debit_col')!r}")
                    ok = False
                elif key == "expect_credit" and det.get("credit_col") != expected:
                    issues.append(f"credit_col: expected {expected!r}, got {det.get('credit_col')!r}")
                    ok = False
                elif key == "expect_delimiter" and det.get("delimiter") != expected:
                    issues.append(f"delimiter: expected {expected!r}, got {det.get('delimiter')!r}")
                elif key == "expect_sign" and det.get("amount_sign") != expected:
                    issues.append(f"sign: expected {expected!r}, got {det.get('amount_sign')!r}")
                elif key == "expect_header_row_gt" and det.get("header_row", 0) <= expected:
                    issues.append(f"header_row: expected > {expected}, got {det.get('header_row', 0)}")
                    ok = False
                elif key == "expect_date_format_contains" and expected not in det.get("date_format", ""):
                    issues.append(f"date_format: expected to contain {expected!r}, got {det.get('date_format')!r}")

            # Basic column detection must succeed
            if not det.get("date_col"):
                ok = False
                issues.append("No date column detected")
            if not det.get("desc_col"):
                ok = False
                issues.append("No description column detected")
            if not det.get("amount_col") and not (det.get("debit_col") and det.get("credit_col")):
                ok = False
                issues.append("No amount column(s) detected")

            # Try parsing
            config = build_virtual_config(det)
            try:
                txns = parse_with_config(csv_text, config, {})
                if not txns:
                    ok = False
                    issues.append("parse_with_config returned 0 transactions")
            except Exception as e:
                ok = False
                issues.append(f"Parse error: {e}")

        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1

        conf = det.get("confidence", 0)
        print(f"  [{status}] {name}")
        print(f"         date={det.get('date_col')!r}  desc={det.get('desc_col')!r}  "
              f"amt={det.get('amount_col')!r}  dr={det.get('debit_col')!r}  cr={det.get('credit_col')!r}")
        print(f"         delim={det.get('delimiter')!r}  date_fmt={det.get('date_format')!r}  "
              f"sign={det.get('amount_sign')!r}  conf={conf:.2f}  hdr_row={det.get('header_row', 0)}")
        if 'txns' in dir() and txns:
            print(f"         parsed {len(txns)} transactions")
        if issues:
            for iss in issues:
                print(f"         ⚠ {iss}")
        print()

    print(f"{'='*70}")
    print(f" RESULTS: {passed} passed, {failed} failed out of {len(tests)}")
    print(f"{'='*70}\n")
    return failed == 0


if __name__ == "__main__":
    ok1 = test_sample_csvs()
    ok2 = test_synthetic_csvs()
    if ok1 and ok2:
        print("\n ✅ ALL TESTS PASSED\n")
        sys.exit(0)
    else:
        print("\n ❌ SOME TESTS FAILED\n")
        sys.exit(1)
