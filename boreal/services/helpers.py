import re
from datetime import datetime


def parse_date(raw: str, formats=None) -> str:
    raw = raw.strip()
    default_fmts = (
        "%m-%d-%Y", "%Y-%m-%d", "%d-%m-%Y", "%b %d %Y",
        "%B %d %Y", "%d %b %Y", "%Y%m%d",
        "%d.%m.%Y", "%m.%d.%Y",
        "%b %d, %Y", "%B %d, %Y",
    )
    for fmt in (formats or default_fmts):
        # Normalize separators for matching (/ and . to -)
        normalized_raw = raw.replace("/", "-").replace(".", "-")
        normalized_fmt = fmt.replace("/", "-").replace(".", "-")
        try:
            return datetime.strptime(normalized_raw, normalized_fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
        # Also try without normalization (for named-month formats like "Mar 15, 2026")
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {raw!r}")


def safe_abs_float(raw: str) -> float:
    """Parse a numeric string and return its absolute value.

    Sign is stripped intentionally — callers (csv_parser) determine
    debit/credit direction from separate columns.
    """
    cleaned = raw.strip()
    # Normalize Unicode minus signs to ASCII
    cleaned = cleaned.replace("\u2212", "-").replace("\u2013", "-").replace("\u2014", "-")
    # Handle accounting format: (123.45) = 123.45
    if "(" in cleaned and ")" in cleaned:
        cleaned = cleaned.replace("(", "").replace(")", "")
    cleaned = re.sub(r"[$€£¥₹\s]", "", cleaned)
    # Handle European comma-decimal: 1.234,56 → 1234.56
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
    cleaned = cleaned.replace(",", "")
    cleaned = cleaned.lstrip("-")
    return float(cleaned) if cleaned else 0.0
