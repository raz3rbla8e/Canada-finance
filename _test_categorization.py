"""Quick test: parse all sample CSVs and show categorization results."""
import os, collections
from boreal.services.csv_parser import parse_csv_text
from boreal.services.categorization import categorize_with_confidence, normalize_merchant

sample_dir = 'sample_data'
all_txns = []
for f in sorted(os.listdir(sample_dir)):
    if f.endswith('.csv'):
        text = open(os.path.join(sample_dir, f), encoding='utf-8').read()
        txns, bank = parse_csv_text(text)
        all_txns.extend(txns)

# Show category distribution
cats = collections.Counter(t['category'] for t in all_txns)
print('=== CATEGORY DISTRIBUTION ===')
for cat, count in cats.most_common():
    print(f'  {cat:25s} {count:4d}')

uncat_count = cats.get("UNCATEGORIZED", 0)
print(f'\nTotal: {len(all_txns)}, Uncategorized: {uncat_count}')

# Show all UNCATEGORIZED with their normalized names
print('\n=== UNCATEGORIZED (unique normalized names) ===')
uncat = [t for t in all_txns if t['category'] == 'UNCATEGORIZED']
seen = set()
for t in uncat:
    norm = normalize_merchant(t['name'])
    if norm not in seen:
        seen.add(norm)
        _, conf = categorize_with_confidence(t['name'])
        raw = t['name'][:55]
        print(f'  {raw:55s}  norm={norm[:30]:30s}  conf={conf}')

print(f'\n  {len(seen)} unique uncategorized merchants out of {len(uncat)} transactions')
