"""End-to-end test of autocategorization improvements:
  Phase 1: Merchant normalization
  Phase 2: Smarter learned merchants (normalized storage)
  Phase 4: Confidence scores + suggestions endpoint
"""
import os, sys, tempfile, sqlite3

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from boreal.services.categorization import (
    normalize_merchant, categorize, categorize_with_confidence, load_learned_dict
)
from boreal.services.csv_parser import parse_csv_text

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

print("=" * 60)
print("PHASE 1: Merchant Name Normalization")
print("=" * 60)

# Canadian bank patterns
check("Strip city+province",
      normalize_merchant("UBER EATS 4F2K TORONTO ON"), "uber eats")
check("Same merchant, different location",
      normalize_merchant("UBER EATS 8J3P MISSISSAUGA ON"), "uber eats")
check("Strip reference number",
      normalize_merchant("COSTCO WHOLESALE #1234"), "costco wholesale")
check("Strip SQ* prefix",
      normalize_merchant("SQ *COFFEE SHOP"), "coffee shop")
check("Strip trailing digits",
      normalize_merchant("NETFLIX.COM 12345"), "netflix.com")
check("Strip city+province+country",
      normalize_merchant("AMAZON.CA TORONTO ON CA"), "amazon.ca")
check("Tim Hortons with store number and location",
      normalize_merchant("TIM HORTONS #9432 OTTAWA ON"), "tim hortons")
check("Strip terminal code",
      normalize_merchant("PRESTO TRANSIT 4J2K"), "presto transit")
check("Preserve simple names",
      normalize_merchant("SHOPPERS DRUG MART"), "shoppers drug mart")
check("Idempotent on already clean names",
      normalize_merchant("netflix"), "netflix")

# Same merchant normalizes the same
norm1 = normalize_merchant("UBER EATS 4F2K TORONTO ON")
norm2 = normalize_merchant("UBER EATS 8J3P MISSISSAUGA ON")
norm3 = normalize_merchant("UBER EATS 2R5M VANCOUVER BC")
check("3 Uber Eats variants all normalize identically",
      norm1 == norm2 == norm3, True)

print()
print("=" * 60)
print("PHASE 2: Smarter Learned Merchants")
print("=" * 60)

# Test that categorize() uses normalization for learned merchant matching
learned = {"uber eats": "Eating Out", "tim hortons": "Eating Out"}

# Exact match still works
cat, conf = categorize_with_confidence("uber eats delivery", learned)
check("Exact learned keyword match", cat, "Eating Out")
check("Exact match = high confidence", conf, "high")

# Normalized match: raw name has location noise, but learned keyword is clean
cat, conf = categorize_with_confidence("TIM HORTONS #5432 BARRIE ON", learned)
check("Normalized learned match (Tim Hortons with noise)", cat, "Eating Out")

# Rule-based match
cat, conf = categorize_with_confidence("NETFLIX.COM 99999", None)
check("Rule-based match (Netflix)", cat, "Subscriptions")
check("Rule-based = medium confidence", conf, "medium")

# No match
cat, conf = categorize_with_confidence("ZXQWPPLM RANDOM MERCHANT", None)
check("No match = UNCATEGORIZED", cat, "UNCATEGORIZED")
check("No match = low confidence", conf, "low")

print()
print("=" * 60)
print("PHASE 4: Confidence Scores")
print("=" * 60)

# Hard override = high
cat, conf = categorize_with_confidence("COSTCO GAS BAR TORONTO ON")
check("Hard override (Costco Gas) = high", conf, "high")

cat, conf = categorize_with_confidence("UBER EATS DELIVERY")
check("Hard override (Uber Eats) = high", conf, "high")

# Rule-based = medium
cat, conf = categorize_with_confidence("SHOPPERS DRUG MART")
check("Rule keyword match = medium", conf, "medium")

cat, conf = categorize_with_confidence("LOBLAWS GROCERY")
check("Rule keyword match (Loblaws) = medium", conf, "medium")

# Unknown = low
cat, conf = categorize_with_confidence("TOTALLY UNKNOWN MERCHANT XYZ")
check("Unknown merchant = low", conf, "low")

print()
print("=" * 60)
print("CSV PARSING: All sample data")
print("=" * 60)

sample_dir = 'sample_data'
all_txns = []
for f in sorted(os.listdir(sample_dir)):
    if f.endswith('.csv'):
        text = open(os.path.join(sample_dir, f), encoding='utf-8').read()
        txns, bank = parse_csv_text(text)
        all_txns.extend(txns)

uncat = [t for t in all_txns if t['category'] == 'UNCATEGORIZED']
check(f"All {len(all_txns)} sample transactions categorized",
      len(uncat), 0)

# Verify specific categorizations
import collections
cats = collections.Counter(t['category'] for t in all_txns)
check("Groceries category exists", 'Groceries' in cats, True)
check("Eating Out category exists", 'Eating Out' in cats, True)
check("Fuel category exists", 'Fuel' in cats, True)
check("Subscriptions category exists", 'Subscriptions' in cats, True)

# Verify categorize() backward compatibility (returns string, not tuple)
result = categorize("NETFLIX.COM 12345")
check("categorize() returns string (backward compat)", isinstance(result, str), True)
check("categorize() returns correct category", result, "Subscriptions")

print()
print("=" * 60)
total = PASS + FAIL
print(f"RESULTS: {PASS}/{total} passed, {FAIL} failed")
if FAIL:
    print("SOME TESTS FAILED!")
    sys.exit(1)
else:
    print("ALL TESTS PASSED!")
print("=" * 60)
