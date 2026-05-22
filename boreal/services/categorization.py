# ── AUTO-CATEGORIZATION RULES ────────────────────────────────────────────────
# Keyword → category mapping used at import time.
import re

# ── MERCHANT NAME NORMALIZATION ──────────────────────────────────────────────
# Strip trailing noise (location codes, terminal IDs, reference numbers) so
# "UBER EATS 4F2K TORONTO ON" and "UBER EATS 8J3P MISSISSAUGA ON" both
# normalize to "uber eats".

# Canadian province codes used to strip trailing city + province
_CA_PROVS = r"(?:ON|BC|AB|QC|MB|SK|NS|NB|PE|NL|NT|YT|NU)"

_NORMALIZE_PATTERNS = [
    # Strip "SQ *", "SP *", "TST *" (Square/Stripe/Toast) prefixes
    re.compile(r"^(?:SQ|SP|TST)\s*\*\s*", re.IGNORECASE),
    # Strip trailing country code (e.g., " CA", " CAN", " US")
    re.compile(r"\s+(?:CA|CAN|US|USA)\s*$", re.IGNORECASE),
    # Strip trailing " CITY ON" / " CITY BC" etc (Canadian bank descriptions)
    re.compile(rf"\s+[A-Z][A-Za-z\s]{{1,25}}\s+{_CA_PROVS}\s*$", re.IGNORECASE),
    # Strip terminal/reference codes: " #1234", " *1234"
    re.compile(r"\s+[#*]\d{3,10}\s*$"),
    # Strip trailing alphanumeric codes that have at least one digit (e.g., "4F2K", "A1B2C3")
    re.compile(r"\s+(?=[A-Z0-9]*\d)[A-Z0-9]{4,10}\s*$", re.IGNORECASE),
    # Strip trailing pure-digit codes
    re.compile(r"\s+\d{4,12}\s*$"),
]


def normalize_merchant(name: str) -> str:
    """Normalize a bank transaction description to a canonical merchant name.

    Strips trailing location codes, terminal IDs, reference numbers, and
    common prefixes so that multiple transactions from the same merchant
    resolve to the same normalized string.
    """
    n = name.strip()
    # Apply stripping patterns (order matters: city+prov first, then codes)
    for pat in _NORMALIZE_PATTERNS:
        n = pat.sub("", n)
    # Final cleanup
    n = re.sub(r"\s+", " ", n).strip().lower()
    return n

CATEGORY_RULES = {
    "Subscriptions": [
        "claude.ai", "anthropic", "netflix", "spotify", "apple.com/bill", "google one",
        "microsoft 365", "adobe", "notion", "chatgpt", "openai", "dropbox", "icloud",
        "youtube premium", "duolingo", "amazon prime", "prime video",
        "crunchyroll", "paramount+", "canva", "github", "hbo max", "nord vpn",
        "expressvpn", "audible", "kindle unlimited", "apple tv",
    ],
    "Fuel": [
        "shell", "esso", "petro-canada", "petro canada", "ultramar", "pioneer", "irving",
        "suncor", "husky", "pronto", "gas station", "circle k", "couche tard",
        "shefield", "sheffield", "7-eleven fuel", "costco gas", "mobil ",
        "on the run", "super save gas", "co-op gas", "canadian tire gas",
    ],
    "Groceries": [
        "loblaws", "no frills", "sobeys", "metro", "food basics", "freshco", "farm boy",
        "whole foods", "costco wholesale", "superstore", "real canadian", "t&t", "maxi",
        "provigo", "iga", "safeway", "save on food", "independent", "freshmart",
        "grocery", "supermarche", "epicerie", "wmt suprctr", "wal-mart", "walmart",
        "voila", "instacart", "pc express", "flashfood",
    ],
    "Pharmacy": [
        "shoppers drug", "rexall", "pharmasave", "jean coutu", "uniprix", "proxim",
        "guardian", "london drugs", "pharmacy", "drug mart", "supplement", "vitamin",
    ],
    "Healthcare": [
        "physio", "dentist", "dental", "doctor", "clinic", "optometrist", "medical",
        "hospital", "diagnosis", "diagnostics", "planet fitness", "goodlife",
        "anytime fitness", "gym", "yoga", "pilates", "abc*planet", "massage", "therapy",
        "lifelab", "chiropract", "walk-in", "dermatol",
    ],
    "Phone": [
        "fido", "koodo", "public mobile", "lucky mobile", "virgin mobile",
        "bell mobility", "bell canada", "telus mobile", "rogers mobile", "rogers wireless",
        "freedom mobile", "chatr", "phone bill",
    ],
    "Internet": [
        "bell internet", "rogers internet", "videotron", "shaw", "eastlink", "cogeco",
        "teksavvy", "distributel", "start.ca", "vmedia",
    ],
    "Utilities": [
        "hydro ottawa", "hydro one", "bc hydro", "enbridge", "union gas",
        "atco gas", "fortis", "water bill", "toronto hydro", "alectra",
        "nova scotia power", "manitoba hydro", "saskpower", "epcor",
    ],
    "Clothing": [
        "winners", "marshalls", "sport chek", "atmosphere", "nike", "adidas",
        "h&m", "zara", "uniqlo", "old navy", "aritzia", "lululemon",
        "simons", "the bay", "hudson's bay", "nordstrom", "reitmans", "ssense", "roots",
        "gap #", "gap factory", "mark's", "marks work",
    ],
    "Home": [
        "ikea", "canadian tire", "home depot", "rona", "home hardware",
        "wayfair", "structube", "article", "restoration hardware", "pottery barn",
        "kitchen stuff", "bed bath", "linen chest",
    ],
    "Insurance": [
        "insurance", "intact", "aviva", "state farm", "belairdirect", "wawanesa",
        "td insurance", "rbc insurance", "allstate", "cooperators", "desjardins insur",
    ],
    "Travel": [
        "airbnb", "hotel", "expedia", "booking.com", "air canada", "westjet", "porter",
        "swoop", "flair", "vrbo", "marriott", "hilton", "delta hotel", "best western",
        "kayak", "hostel", "motel", "resort", "via rail", "sunwing",
    ],
    "Education": [
        "carleton", "university", "college", "textbook", "udemy", "coursera",
        "linkedin learn", "skillshare", "pluralsight", "tuition", "osap", "bookstore",
        "mcgill", "uoft", "ubc", "western university", "queens university",
    ],
    "Entertainment": [
        "steam", "epic games", "xbox", "playstation", "nintendo", "cineplex", "landmark",
        "google play", "disney+", "twitch", "riot games", "crave", "tidal", "deezer",
        "gaming", "movie", "theatre", "concert", "ticketmaster", "eventbrite",
        "billetterie", "lcbo", "rao #", "liquor store", "beer store", "saq",
        "lotto", "lottery",
    ],
    "Transport": [
        "uber", "lyft", "oc transpo", "ttc", "stm", "translink", "presto", "parking",
        "taxi", "transit", "impark", "indigo park", "greyhound", "flixbus", "train",
        "enterprise rent", "budget rent", "hertz", "avis", "zipcar",
        "communauto", "turo", "go transit",
    ],
    "Eating Out": [
        "mcdonald", "tim horton", "subway", "starbucks", "uber eat", "skip the dishes",
        "doordash", "pizza", "burger", "wendy", "kfc", "taco bell", "harvey's", "a&w",
        "mary brown", "popeye", "chipotle", "freshii", "pita pit", "swiss chalet",
        "boston pizza", "jack astor", "milestones", "cactus club", "earls", "montana",
        "st-hubert", "five guys", "nandos", "pho ", "sushi", "thai", "domino",
        "papa john", "little caesar", "pizza pizza", "pizza hut", "hero burger",
        "mucho burrito", "shawarma", "falafel", "osmow", "6ixty wing", "happy lamb",
        "burrito", "chick-fil", "dairy queen", "d spot", "vietnamese", "restaurant",
        "cafe", "coffee", "bakery", "diner", "grill", "bistro",
        "eatery", "food court", "hot pot", "wings", "ramen", "poke", "bubble tea",
        "moxie", "denny", "ihop", "east side mario", "the keg", "joey", "menchie",
        "booster juice", "second cup", "new york fries", "panago", "extreme pita",
        "wild wing", "st louis", "scores", "baton rouge", "mr sub", "country style",
        "la belle province", "cora breakfast", "fatburger", "smokes poutine",
    ],
    "Shopping": [
        "amazon", "target", "ebay", "etsy", "aliexpress", "shein", "best buy",
        "staples", "the source", "indigo", "chapters", "paypal", "shopify",
        "dollarama", "dollar tree", "giant tiger", "tanger outlet", "rfbt",
        "homesense", "apple store", "samsung", "microsoft store", "dell",
        "value village", "goodwill", "sport check",
    ],
    "Misc": [
        "detail my ride", "car wash", "car detail", "auto detail", "dry clean",
        "laundromat", "post office", "fedex", "ups", "purolator", "canada post",
        "storage", "moving", "atm withdrawal", "atm deposit",
        "e-transfer sent", "etransfer sent", "interac e-transfer sent",
        "internet transfer",
    ],
    "Rent": [
        "rent payment", "landlord", "property management", "tenancy",
    ],
    "Savings Transfer": [
        "transfer to savings", "transfer to tfsa", "transfer to rrsp",
        "transfer to resp", "transfer to fhsa", "transfer to gic",
        "savings contribution",
    ],
    # ── Income categories ──────────────────────────────────────────────────────
    "Job": [
        "payroll", "direct deposit", "salary", "biweekly pay", "semi-monthly pay",
        "pay stub", "employer", "wages",
    ],
    "Freelance": [
        "freelance", "consulting", "contract pay", "invoice pay", "self-employ",
        "client payment",
    ],
    "Bonus": [
        "bonus", "incentive", "commission",
    ],
    "Refund": [
        "refund", "rebate", "reimbursement", "credit memo", "cashback",
        "price adjustment", "return credit",
    ],
    "Other Income": [
        "e-transfer from", "transfer from", "transfer in", "etransfer received",
        "e-transfer received", "interac e-transfer received",
        "interest earned", "interest payment", "interest paid",
        "dividend", "deposit",
        "gst credit", "gst/hst credit", "hst credit", "trillium",
        "climate action", "ccb", "child benefit", "canada child",
        "cerb", "ei payment", "employment insurance",
        "oas", "old age security", "cpp", "canada pension",
    ],
}

# Priority order for category matching
_PRIORITY_ORDER = [
    "Subscriptions", "Fuel", "Groceries", "Pharmacy", "Healthcare",
    "Phone", "Internet", "Utilities", "Clothing", "Home", "Insurance",
    "Travel", "Education", "Entertainment", "Transport", "Eating Out",
    "Shopping", "Rent", "Savings Transfer", "Misc",
    # Income categories (checked for credit/positive-amount transactions)
    "Job", "Freelance", "Bonus", "Refund", "Other Income",
]


def categorize(name: str, learned: dict = None) -> str:
    """Categorize a transaction by name. Returns a category string.

    Also sets a confidence attribute on the returned string (via wrapper)
    for the caller to inspect if needed.
    """
    cat, confidence = categorize_with_confidence(name, learned)
    return cat


def categorize_with_confidence(name: str, learned: dict = None):
    """Categorize and return (category, confidence).

    Confidence levels:
      'high'   — exact learned merchant match or specific keyword rule
      'medium' — normalized learned merchant match or broad keyword rule
      'low'    — no match (UNCATEGORIZED)
    """
    n = name.lower().strip()
    normalized = normalize_merchant(name)

    # Hard overrides — check multi-word matches before single-word rules
    if "costco gas" in n:
        return "Fuel", "high"
    if "uber eat" in n or "ubereats" in n:
        return "Eating Out", "high"

    # User-learned merchants (highest priority)
    if learned:
        # Exact raw match (highest confidence)
        for keyword, cat in learned.items():
            if keyword in n:
                return cat, "high"
        # Normalized match (still high — user explicitly taught this)
        for keyword, cat in learned.items():
            if keyword in normalized or normalized in keyword:
                return cat, "high"

    # Rule-based (check specific categories before generic ones)
    for cat in _PRIORITY_ORDER:
        for kw in CATEGORY_RULES.get(cat, []):
            if kw in n:
                return cat, "medium"

    return "UNCATEGORIZED", "low"


def load_learned_dict(db) -> dict:
    rows = db.execute("SELECT keyword, category FROM learned_merchants").fetchall()
    return {r["keyword"]: r["category"] for r in rows}
