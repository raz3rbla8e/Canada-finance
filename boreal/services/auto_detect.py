"""Intelligent CSV auto-detection engine.

Analyzes CSV content to automatically identify date, description, and amount
columns — making any bank CSV importable without a YAML config.
"""

import csv
import io
import re
from datetime import datetime

# ── Date detection ────────────────────────────────────────────────────────────

# Patterns that strongly suggest a value is a date
_DATE_PATTERNS = [
    # ISO: 2026-03-15
    re.compile(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}$"),
    # US/CA: 3/15/2026 or 03/15/2026
    re.compile(r"^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$"),
    # Named month: 15 Mar 2026, Mar 15, 2026, March 15 2026, 15 Mar. 2026
    re.compile(
        r"^\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4}$"
    ),
    re.compile(
        r"^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4}$"
    ),
    # Period-separated (European): 15.03.2026
    re.compile(r"^\d{1,2}\.\d{1,2}\.\d{2,4}$"),
    # Compact: 20260315
    re.compile(r"^\d{8}$"),
]

# All date formats to try when parsing (order matters — more specific first)
_ALL_DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%m/%d/%y",
    "%d/%m/%y",
    "%d %b %Y",
    "%d %b. %Y",
    "%b %d, %Y",
    "%b %d %Y",
    "%B %d, %Y",
    "%B %d %Y",
    "%d %B %Y",
    "%d.%m.%Y",
    "%m.%d.%Y",
    "%Y%m%d",
]

# ── Amount detection ──────────────────────────────────────────────────────────

# Matches numeric values with optional currency symbols, commas, minus/plus, parens
_AMOUNT_RE = re.compile(
    r"^[\s]*"
    r"[(\-\+]?"           # optional opening paren or sign
    r"[\$€£¥₹CAD\s]*"    # optional currency symbol/code
    r"[\-\+]?"            # sign can also come after currency
    r"\d{1,3}"            # leading digits
    r"(?:[,.\s]\d{3})*"   # thousands groups
    r"(?:[.,]\d{1,2})?"   # decimal part
    r"[\s]*\)?"           # optional closing paren
    r"[\s]*$"
)

# Simpler check: does the value look numeric after stripping currency/formatting?
_NUMERIC_CLEAN_RE = re.compile(r"[,$€£¥₹\s()CAD]")

# ── Header-name heuristics ────────────────────────────────────────────────────

_DATE_HEADER_WORDS = {
    "date", "transaction date", "trans date", "posting date", "post date",
    "value date", "trade date", "effective date", "booked date", "datum",
    "fecha", "data",
}
_AMOUNT_HEADER_WORDS = {
    "amount", "montant", "sum", "total", "value", "net", "payment",
    "charge", "price", "cost", "balance change",
}
_DEBIT_HEADER_WORDS = {
    "debit", "débit", "withdrawal", "withdrawals", "out", "paid out",
    "charges", "expense", "dr",
}
_CREDIT_HEADER_WORDS = {
    "credit", "crédit", "deposit", "deposits", "in", "paid in",
    "income", "cr",
}
_DESC_HEADER_WORDS = {
    "description", "name", "details", "narrative", "memo", "payee",
    "merchant", "transaction", "particular", "particulars", "remarks",
    "reference", "libellé", "beneficiary",
}
_IGNORE_HEADER_WORDS = {
    "balance", "total balance", "running balance", "available",
    "transaction type", "type", "check number", "cheque number",
    "card number", "account", "account number", "currency",
    "exchange rate", "country", "category", "notes", "source",
    "reference number", "confirmation", "status",
}


def _is_date_value(val: str) -> bool:
    """Check if a string looks like a date."""
    v = val.strip()
    if not v:
        return False
    return any(p.match(v) for p in _DATE_PATTERNS)


def _is_amount_value(val: str) -> bool:
    """Check if a string looks like a monetary amount."""
    v = val.strip()
    if not v:
        return False
    # Quick check with regex
    if _AMOUNT_RE.match(v):
        return True
    # Fallback: try to parse after stripping formatting
    cleaned = _NUMERIC_CLEAN_RE.sub("", v)
    cleaned = cleaned.replace("\u2212", "-").replace("\u2013", "-").replace("\u2014", "-")
    # Reject values with letters (e.g., REF001, TXN123) — those are codes, not amounts
    if re.search(r"[a-zA-Z]", cleaned):
        return False
    # Handle European decimals: 1.234,56 → 1234.56
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        float(cleaned.replace(",", ""))
        return True
    except (ValueError, AttributeError):
        return False


def _parse_amount_value(val: str) -> float | None:
    """Try to parse a string as a numeric amount. Returns None on failure."""
    v = val.strip()
    if not v:
        return None
    cleaned = v.replace("\u2212", "-").replace("\u2013", "-").replace("\u2014", "-")
    cleaned = re.sub(r"[($€£¥₹CAD)\s]", "", cleaned)
    # Handle accounting format: (123.45) = -123.45
    if "(" in v and ")" in v:
        cleaned = cleaned.replace("(", "").replace(")", "")
        cleaned = "-" + cleaned
    # Handle European decimals: 1.234,56
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
    cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def _header_matches(header: str, word_set: set) -> bool:
    """Check if a header name matches any known keyword (case-insensitive, stripped)."""
    h = header.lower().strip()
    # Remove common suffixes like ($), (CAD), etc.
    h = re.sub(r"\s*\(.*?\)\s*$", "", h).strip()
    if h in word_set:
        return True
    # Substring match — only for words >= 4 chars to avoid false positives
    # (e.g., "dr" matching "description", "cr" matching "description")
    for w in word_set:
        if len(w) >= 4 and (w in h or h in w):
            return True
    return False


# ── Core detection logic ──────────────────────────────────────────────────────

def _find_header_row(lines: list[str], max_scan: int = 30) -> int:
    """Find the most likely header row in a CSV.

    Scans up to `max_scan` lines and picks the row that:
    1. Has multiple comma/semicolon/tab-separated tokens
    2. Has mostly non-numeric, non-empty tokens (i.e., looks like column names)
    3. Is followed by rows that look like data
    """
    if not lines:
        return 0

    best_row = 0
    best_score = -1

    limit = min(len(lines), max_scan)
    for i in range(limit):
        line = lines[i].strip()
        if not line:
            continue

        # Detect delimiter for this line
        delim = _sniff_delimiter(line)
        tokens = _split_line(line, delim)

        if len(tokens) < 2:
            continue

        # Score: how many tokens are non-numeric text?
        text_count = 0
        for t in tokens:
            t = t.strip().strip('"').strip()
            if not t:
                continue
            if _is_amount_value(t) or _is_date_value(t):
                continue
            # Looks like a header name (text, not a number)
            try:
                float(t.replace(",", ""))
                continue
            except ValueError:
                text_count += 1

        # A good header has mostly text tokens and multiple columns
        score = text_count * 10 + len(tokens)

        # Bonus: row is followed by data-like rows
        if i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if next_line:
                next_tokens = _split_line(next_line, delim)
                if len(next_tokens) >= len(tokens) - 1:
                    has_data = any(
                        _is_date_value(t.strip().strip('"'))
                        or _is_amount_value(t.strip().strip('"'))
                        for t in next_tokens
                    )
                    if has_data:
                        score += 20

        # Penalty: if ALL tokens are text and no subsequent row has data, might be metadata
        if text_count == len(tokens) and i + 1 < len(lines):
            next_tokens = _split_line(lines[i + 1].strip(), delim)
            all_text = all(
                not _is_date_value(t.strip().strip('"'))
                and not _is_amount_value(t.strip().strip('"'))
                for t in next_tokens if t.strip()
            )
            if all_text:
                score -= 15

        if score > best_score:
            best_score = score
            best_row = i

    return best_row


def _sniff_delimiter(text: str) -> str:
    """Detect the CSV delimiter from a text sample."""
    try:
        dialect = csv.Sniffer().sniff(text, delimiters=",;\t|")
        return dialect.delimiter
    except csv.Error:
        # Count occurrences as fallback
        counts = {d: text.count(d) for d in [",", ";", "\t", "|"]}
        return max(counts, key=counts.get) if max(counts.values()) > 0 else ","


def _split_line(line: str, delim: str) -> list[str]:
    """Split a line respecting quoted fields."""
    try:
        reader = csv.reader(io.StringIO(line), delimiter=delim)
        return next(reader)
    except (csv.Error, StopIteration):
        return line.split(delim)


def _classify_columns(
    headers: list[str],
    sample_rows: list[dict],
) -> dict:
    """Classify each column as date, amount, description, or ignore.

    Returns a dict mapping each header to its classification:
    {"col_name": "date"|"amount"|"debit"|"credit"|"description"|"ignore"}
    """
    col_scores = {}

    for h in headers:
        scores = {"date": 0, "amount": 0, "description": 0, "ignore": 0}
        values = [row.get(h, "").strip() for row in sample_rows if row.get(h, "").strip()]

        if not values:
            scores["ignore"] = 100
            col_scores[h] = scores
            continue

        # ── Header-name heuristics (weighted) ──
        if _header_matches(h, _DATE_HEADER_WORDS):
            scores["date"] += 40
        if _header_matches(h, _AMOUNT_HEADER_WORDS):
            scores["amount"] += 40
        if _header_matches(h, _DEBIT_HEADER_WORDS):
            scores["amount"] += 35  # will refine to debit later
        if _header_matches(h, _CREDIT_HEADER_WORDS):
            scores["amount"] += 35  # will refine to credit later
        if _header_matches(h, _DESC_HEADER_WORDS):
            scores["description"] += 40
        if _header_matches(h, _IGNORE_HEADER_WORDS):
            scores["ignore"] += 30

        # ── Value-based heuristics ──
        n = len(values)
        date_hits = sum(1 for v in values if _is_date_value(v))
        amt_hits = sum(1 for v in values if _is_amount_value(v))

        date_ratio = date_hits / n if n else 0
        amt_ratio = amt_hits / n if n else 0

        # Strong date column: >80% of values parse as dates
        if date_ratio >= 0.8:
            scores["date"] += 50
        elif date_ratio >= 0.5:
            scores["date"] += 25

        # Strong amount column: >80% of values parse as amounts
        if amt_ratio >= 0.8:
            scores["amount"] += 50
        elif amt_ratio >= 0.5:
            scores["amount"] += 25

        # Text column: mostly non-numeric, non-date values
        text_ratio = 1.0 - max(date_ratio, amt_ratio)
        if text_ratio >= 0.7:
            scores["description"] += 30
            # Bonus for high cardinality (unique text = likely descriptions)
            unique = len(set(values))
            if unique > n * 0.5:
                scores["description"] += 20
            # Bonus for longer average text length
            avg_len = sum(len(v) for v in values) / n
            if avg_len > 10:
                scores["description"] += 15

        # Columns where many values are empty are likely debit/credit splits
        empty_count = sum(1 for row in sample_rows if not row.get(h, "").strip())
        empty_ratio = empty_count / len(sample_rows) if sample_rows else 0
        if empty_ratio > 0.3 and amt_ratio >= 0.5:
            scores["amount"] += 10  # mild boost — partial amount column

        col_scores[h] = scores

    # ── Assign roles by picking the best score per role ──
    result = {}
    assigned = set()

    # Priority order: date first, then amount, then description
    # Date: pick the column with the highest date score
    date_col = max(headers, key=lambda h: col_scores[h]["date"])
    if col_scores[date_col]["date"] > 20:
        result[date_col] = "date"
        assigned.add(date_col)

    # Amount: find amount columns
    amount_candidates = [
        h for h in headers
        if h not in assigned and col_scores[h]["amount"] > 20
    ]

    # Detect debit/credit split pattern
    debit_credit = _detect_debit_credit_split(
        headers, sample_rows, amount_candidates, col_scores
    )
    if debit_credit:
        result[debit_credit["debit"]] = "debit"
        result[debit_credit["credit"]] = "credit"
        assigned.add(debit_credit["debit"])
        assigned.add(debit_credit["credit"])
    elif amount_candidates:
        # Single amount column — pick the best one
        best_amt = max(amount_candidates, key=lambda h: col_scores[h]["amount"])
        result[best_amt] = "amount"
        assigned.add(best_amt)

    # Description: pick the best remaining text column
    desc_candidates = [
        h for h in headers
        if h not in assigned and col_scores[h]["description"] > 20
    ]
    if desc_candidates:
        best_desc = max(desc_candidates, key=lambda h: col_scores[h]["description"])
        result[best_desc] = "description"
        assigned.add(best_desc)
    else:
        # Fallback: pick the first unassigned non-ignored column
        for h in headers:
            if h not in assigned and col_scores[h]["ignore"] < 30:
                values = [row.get(h, "").strip() for row in sample_rows if row.get(h, "").strip()]
                if values:
                    result[h] = "description"
                    assigned.add(h)
                    break

    # Everything else is ignored
    for h in headers:
        if h not in result:
            result[h] = "ignore"

    return result


def _detect_debit_credit_split(
    headers: list[str],
    sample_rows: list[dict],
    amount_candidates: list[str],
    col_scores: dict,
) -> dict | None:
    """Detect if two amount columns form a debit/credit pair.

    The telltale sign: values are mutually exclusive (when one has a value,
    the other is empty).
    """
    if len(amount_candidates) < 2:
        return None

    # Check each pair of amount candidates
    for i, col_a in enumerate(amount_candidates):
        for col_b in amount_candidates[i + 1:]:
            # Count rows where values are mutually exclusive
            mutual_exclusive = 0
            both_present = 0
            total_data = 0

            for row in sample_rows:
                a = row.get(col_a, "").strip()
                b = row.get(col_b, "").strip()
                if not a and not b:
                    continue
                total_data += 1
                if (a and not b) or (b and not a):
                    mutual_exclusive += 1
                elif a and b:
                    both_present += 1

            if total_data == 0:
                continue

            # If >80% mutually exclusive, this is a debit/credit split
            if mutual_exclusive / total_data >= 0.8 and both_present <= 1:
                # Determine which is debit vs credit using header names
                a_is_debit = _header_matches(col_a, _DEBIT_HEADER_WORDS)
                b_is_debit = _header_matches(col_b, _DEBIT_HEADER_WORDS)
                a_is_credit = _header_matches(col_a, _CREDIT_HEADER_WORDS)
                b_is_credit = _header_matches(col_b, _CREDIT_HEADER_WORDS)

                if a_is_debit or b_is_credit:
                    return {"debit": col_a, "credit": col_b}
                elif b_is_debit or a_is_credit:
                    return {"debit": col_b, "credit": col_a}
                else:
                    # Can't determine from headers — use column order
                    # Convention: debit (withdrawals) listed before credit (deposits)
                    return {"debit": col_a, "credit": col_b}

    return None


def _detect_date_format(values: list[str]) -> tuple[str, list[str]]:
    """Detect the date format from a list of date values.

    Returns (best_format, warnings).
    Tries all known formats and picks the one with the highest parse rate.
    Handles MM/DD vs DD/MM ambiguity.
    """
    warnings = []
    if not values:
        return "%Y-%m-%d", ["No date values to analyze"]

    # Clean values
    clean = [v.strip() for v in values if v.strip()]
    if not clean:
        return "%Y-%m-%d", ["No date values to analyze"]

    best_fmt = None
    best_count = 0

    for fmt in _ALL_DATE_FORMATS:
        parsed = 0
        for v in clean:
            try:
                # Normalize separators: /, . → -
                norm_v = v.strip().replace("/", "-").replace(".", "-")
                norm_fmt = fmt.replace("/", "-").replace(".", "-")
                datetime.strptime(norm_v, norm_fmt)
                parsed += 1
            except ValueError:
                # Try without normalization (named-month formats)
                try:
                    datetime.strptime(v.strip(), fmt)
                    parsed += 1
                except ValueError:
                    continue
        if parsed > best_count:
            best_count = parsed
            best_fmt = fmt

    if best_fmt is None or best_count == 0:
        return "%Y-%m-%d", ["Could not determine date format"]

    if best_count < len(clean):
        warnings.append(
            f"Date format {best_fmt} matched {best_count}/{len(clean)} values"
        )

    # Check for MM/DD vs DD/MM ambiguity
    if best_fmt in ("%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%m.%d.%Y"):
        # See if DD/MM also parses everything — if so, it's ambiguous
        alt_fmt = best_fmt.replace("%m", "__M__").replace("%d", "%m").replace("__M__", "%d")
        alt_count = 0
        for v in clean:
            try:
                norm_v = v.strip().replace("/", "-").replace(".", "-")
                norm_alt = alt_fmt.replace("/", "-").replace(".", "-")
                datetime.strptime(norm_v, norm_alt)
                alt_count += 1
            except ValueError:
                continue
        if alt_count == best_count:
            # Both work — check if any value disambiguates
            has_day_gt_12 = False
            for v in clean:
                parts = re.split(r"[-/.]", v.strip())
                if len(parts) >= 2:
                    try:
                        first_num = int(parts[0])
                        second_num = int(parts[1])
                        if first_num > 12:
                            # First number > 12, must be DD/MM
                            best_fmt = alt_fmt
                            has_day_gt_12 = True
                            break
                        elif second_num > 12:
                            # Second number > 12, must be MM/DD (current)
                            has_day_gt_12 = True
                            break
                    except ValueError:
                        continue
            if not has_day_gt_12:
                warnings.append(
                    "Date format is ambiguous (MM/DD vs DD/MM) — "
                    "defaulting to MM/DD (North American convention)"
                )

    return best_fmt, warnings


def _detect_sign_convention(values: list[float]) -> tuple[str, list[str]]:
    """Detect whether negative values = expenses (standard) or positive = expenses (inverted).

    Returns (convention, warnings).
    """
    warnings = []
    if not values:
        return "standard", []

    neg_count = sum(1 for v in values if v < 0)
    pos_count = sum(1 for v in values if v > 0)
    total = neg_count + pos_count

    if total == 0:
        return "standard", []

    neg_ratio = neg_count / total

    # Standard: majority of transactions are negative (expenses)
    # Inverted: majority are positive (Amex-style)
    if neg_ratio >= 0.4:
        return "standard", []
    elif neg_ratio <= 0.1:
        return "inverted", [
            "Most amounts are positive — treating positive as expense (inverted sign convention)"
        ]
    else:
        warnings.append(
            f"Sign convention unclear ({neg_count} negative, {pos_count} positive) — "
            "defaulting to standard (negative = expense)"
        )
        return "standard", warnings


# ── Public API ────────────────────────────────────────────────────────────────

def auto_detect_columns(csv_text: str) -> dict:
    """Analyze CSV text and auto-detect column roles.

    Returns:
        {
            "header_row": int,       # 0-based index of the header row
            "delimiter": str,        # detected delimiter character
            "date_col": str,         # header name of the date column
            "desc_col": str,         # header name of the description column
            "amount_col": str|None,  # header name of single amount column (or None)
            "debit_col": str|None,   # header name of debit column (or None)
            "credit_col": str|None,  # header name of credit column (or None)
            "date_format": str,      # detected strptime format string
            "amount_sign": str,      # "standard" or "inverted"
            "confidence": float,     # 0.0 to 1.0
            "warnings": list[str],   # any warnings/caveats
            "headers": list[str],    # all detected headers
        }
    """
    lines = csv_text.splitlines()
    if not lines:
        return {"error": "Empty CSV", "confidence": 0.0, "warnings": ["Empty file"]}

    # Step 1: Find the header row (handles metadata rows above headers)
    header_row = _find_header_row(lines)

    # Step 2: Detect delimiter
    delimiter = _sniff_delimiter(lines[header_row])

    # Step 3: Parse with DictReader starting from header row
    csv_body = "\n".join(lines[header_row:])
    reader = csv.DictReader(io.StringIO(csv_body), delimiter=delimiter)
    if not reader.fieldnames:
        return {"error": "No headers found", "confidence": 0.0, "warnings": ["Could not parse headers"]}

    headers = list(reader.fieldnames)

    # Read sample rows (up to 50 for analysis)
    sample_rows = []
    for i, row in enumerate(reader):
        if i >= 50:
            break
        sample_rows.append(row)

    if not sample_rows:
        return {"error": "No data rows", "confidence": 0.0,
                "warnings": ["File has headers but no data"], "headers": headers}

    # Step 4: Classify columns
    classifications = _classify_columns(headers, sample_rows)

    date_col = None
    desc_col = None
    amount_col = None
    debit_col = None
    credit_col = None

    for col, role in classifications.items():
        if role == "date":
            date_col = col
        elif role == "description":
            desc_col = col
        elif role == "amount":
            amount_col = col
        elif role == "debit":
            debit_col = col
        elif role == "credit":
            credit_col = col

    warnings = []

    # Step 5: Detect date format
    if date_col:
        date_values = [row.get(date_col, "") for row in sample_rows]
        date_format, date_warnings = _detect_date_format(date_values)
        warnings.extend(date_warnings)
    else:
        date_format = "%Y-%m-%d"
        warnings.append("Could not identify a date column")

    # Step 6: Detect sign convention (only for single-amount mode)
    amount_sign = "standard"
    if amount_col:
        parsed_amounts = []
        for row in sample_rows:
            val = _parse_amount_value(row.get(amount_col, ""))
            if val is not None and val != 0:
                parsed_amounts.append(val)
        amount_sign, sign_warnings = _detect_sign_convention(parsed_amounts)
        warnings.extend(sign_warnings)

    # Step 7: Calculate confidence score
    confidence = _calculate_confidence(
        date_col, desc_col, amount_col, debit_col, credit_col, warnings
    )

    return {
        "header_row": header_row,
        "delimiter": delimiter,
        "date_col": date_col,
        "desc_col": desc_col,
        "amount_col": amount_col,
        "debit_col": debit_col,
        "credit_col": credit_col,
        "date_format": date_format,
        "amount_sign": amount_sign,
        "confidence": confidence,
        "warnings": warnings,
        "headers": headers,
    }


def _calculate_confidence(
    date_col, desc_col, amount_col, debit_col, credit_col, warnings
) -> float:
    """Calculate an overall confidence score (0.0 to 1.0)."""
    score = 1.0

    # Missing critical columns
    if not date_col:
        score -= 0.4
    if not desc_col:
        score -= 0.2
    if not amount_col and not (debit_col and credit_col):
        score -= 0.4

    # Warnings reduce confidence
    for w in warnings:
        if "ambiguous" in w.lower():
            score -= 0.15
        elif "could not" in w.lower():
            score -= 0.2
        elif "unclear" in w.lower():
            score -= 0.1
        else:
            score -= 0.05

    return max(0.0, min(1.0, score))


def build_virtual_config(detection: dict, account_label: str = "Imported Account") -> dict:
    """Build a virtual YAML-like config dict from auto-detection results.

    This config can be fed directly into parse_with_config() — no separate
    parsing logic needed.
    """
    config = {
        "name": "Auto-detected",
        "account_label": account_label,
        "encoding": "utf-8-sig",
        "date_formats": [detection["date_format"]],
        "amount_sign": detection.get("amount_sign", "standard"),
        "columns": {},
    }

    # Skip header rows (if header isn't line 0)
    if detection.get("header_row", 0) > 0:
        config["skip_header_rows"] = detection["header_row"]

    # Map columns
    if detection.get("date_col"):
        config["columns"]["date"] = detection["date_col"]
    if detection.get("desc_col"):
        config["columns"]["description"] = detection["desc_col"]

    if detection.get("amount_col"):
        config["columns"]["amount"] = detection["amount_col"]
    elif detection.get("debit_col") and detection.get("credit_col"):
        config["columns"]["debit"] = detection["debit_col"]
        config["columns"]["credit"] = detection["credit_col"]

    # Enable flexible column matching as a safety net
    config["flexible_columns"] = True

    # Pass delimiter for non-comma CSVs
    if detection.get("delimiter") and detection["delimiter"] != ",":
        config["_delimiter"] = detection["delimiter"]

    return config
