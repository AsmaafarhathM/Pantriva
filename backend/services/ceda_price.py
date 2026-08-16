import os
import json
import time
import logging
from typing import Optional, Dict, Any, Tuple

from config import CEDA_STATE_ID, CEDA_DISTRICT_ID, CEDA_MARKET_ID
from services.ceda import get_commodities, get_markets, get_prices, CedaApiError

logger = logging.getLogger(__name__)

# Cache TTLs in seconds
COMMODITY_CACHE_TTL = 24 * 60 * 60  # 24 hours
MARKET_CACHE_TTL = 12 * 60 * 60     # 12 hours
PRICE_CACHE_TTL = 12 * 60 * 60      # 12 hours

# Cache persistence path for local development / restart resilience
CACHE_FILE_PATH = os.path.join(os.path.dirname(__file__), ".ceda_cache.json")

# In-memory caches
_commodity_cache: Dict[str, Any] = {"data": {}, "timestamp": 0}
_market_cache: Dict[Tuple[int, int, int], Any] = {}
_price_cache: Dict[Tuple[int, int], Any] = {}


def _load_disk_cache():
    """Load cached prices from disk if available to survive process restarts."""
    global _price_cache
    if not os.path.exists(CACHE_FILE_PATH):
        return
    try:
        with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
            disk_data = json.load(f)
            now = time.time()
            for key_str, val in disk_data.items():
                cid, mid = map(int, key_str.split(":"))
                res_data = val.get("data")
                ts = val.get("timestamp", 0)
                if now - ts < PRICE_CACHE_TTL:
                    _price_cache[(cid, mid)] = (res_data, ts)
    except Exception as e:
        logger.debug("Could not load disk cache: %s", e)


def _save_disk_cache():
    """Persist price cache to disk."""
    try:
        disk_data = {}
        for (cid, mid), (res_data, ts) in _price_cache.items():
            disk_data[f"{cid}:{mid}"] = {"data": res_data, "timestamp": ts}
        with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(disk_data, f)
    except Exception as e:
        logger.debug("Could not save disk cache: %s", e)


# Initialize disk cache
_load_disk_cache()


# Common aliases mapping ingredient terms to standard commodity search names
COMMON_ALIASES = {
    "tomatoes": "tomato",
    "onions": "onion",
    "potatoes": "potato",
    "garlic": "garlic",
    "ginger": "ginger(dry)",
    "adrak": "ginger(dry)",
    "rice": "rice",
    "paddy": "rice",
    "basmati rice": "rice",
    "raw rice": "rice",
    "wheat": "wheat",
    "atta": "wheat",
    "wheat flour": "wheat",
    "gehu": "wheat",
    "maize": "maize",
    "corn": "maize",
    "red gram": "red gram",
    "toor dal": "red gram",
    "arhar dal": "red gram",
    "tuvar dal": "red gram",
    "yellow dal": "red gram",
    "black gram": "black gram (urd beans)(whole)",
    "urad dal": "black gram (urd beans)(whole)",
    "green gram": "green gram (moong)(whole)",
    "moong dal": "green gram (moong)(whole)",
    "bengal gram": "bengal gram(gram)(whole)",
    "chana": "bengal gram(gram)(whole)",
    "chana dal": "bengal gram(gram)(whole)",
    "chickpeas": "bengal gram(gram)(whole)",
    "mustard": "mustard",
    "mustard seeds": "mustard",
    "rai": "mustard",
    "groundnut": "groundnut",
    "peanuts": "groundnut",
    "sesame": "sesamum(sesamegingellytil)",
    "sesame seeds": "sesamum(sesamegingellytil)",
    "til": "sesamum(sesamegingellytil)",
    "apple": "apple",
    "apples": "apple",
    "banana": "banana",
    "bananas": "banana",
    "mango": "mango",
    "mangoes": "mango",
    "chili": "chili red",
    "chillies": "chili red",
    "green chillies": "chili red",
    "green chili": "chili red",
    "red chili": "chili red",
    "cabbage": "cabbage",
    "cauliflower": "cauliflower",
    "carrot": "carrot",
    "carrots": "carrot",
    "spinach": "spinach",
    "palak": "spinach",
    "brinjal": "brinjal",
    "eggplant": "brinjal",
    "cucumber": "cucumber",
    "curd": "curd",
}

# Static seed for staple commodities to avoid unnecessary CEDA network calls
SEED_COMMODITIES = {
    "wheat": 1,
    "paddy": 2,
    "rice": 3,
    "maize": 4,
    "jowar": 5,
    "bengal gram(gram)(whole)": 6,
    "red gram": 7,
    "black gram (urd beans)(whole)": 8,
    "green gram (moong)(whole)": 9,
    "groundnut": 10,
    "sesamum(sesamegingellytil)": 11,
    "mustard": 12,
    "soyabean": 13,
    "sunflower": 14,
    "apple": 17,
    "orange": 18,
    "banana": 19,
    "mango": 20,
    "pineapple": 21,
    "grapes": 22,
    "onion": 23,
    "potato": 24,
    "garlic": 25,
    "chili red": 26,
    "ginger(dry)": 27,
    "tomato": 78,
    "cabbage": 154,
    "cauliflower": 155,
    "brinjal": 156,
    "carrot": 157,
    "cucumber": 159,
    "spinach": 275,
}


def _get_commodity_mapping() -> Dict[str, int]:
    """Retrieve cached commodities mapping or seed mapping."""
    global _commodity_cache
    now = time.time()

    if _commodity_cache["data"] and (now - _commodity_cache["timestamp"] < COMMODITY_CACHE_TTL):
        return _commodity_cache["data"]

    mapping = dict(SEED_COMMODITIES)
    _commodity_cache["data"] = mapping
    _commodity_cache["timestamp"] = now

    return _commodity_cache["data"]


def get_commodity_id(item_name: str) -> Optional[int]:
    """
    Resolve grocery ingredient name to a CEDA commodity ID.
    Performs case-insensitive matching, whitespace trimming, alias resolution,
    and substring matching.
    """
    if not item_name or not isinstance(item_name, str):
        return None

    cleaned = item_name.lower().strip()

    # 1. Direct alias resolution
    target_name = COMMON_ALIASES.get(cleaned, cleaned)

    mapping = _get_commodity_mapping()

    # 2. Exact match in commodity mapping
    if target_name in mapping:
        return mapping[target_name]

    if cleaned in mapping:
        return mapping[cleaned]

    # 3. Check substring matching
    for name, cid in mapping.items():
        if target_name in name or name in target_name:
            return cid

    return None


def get_default_location() -> Dict[str, Optional[int]]:
    """Return default configured location for CEDA mandi price lookups."""
    return {
        "state_id": CEDA_STATE_ID,
        "district_id": CEDA_DISTRICT_ID,
        "market_id": CEDA_MARKET_ID
    }


def resolve_market(
    commodity_id: int,
    state_id: int,
    district_id: int,
    preferred_market_id: Optional[int] = None
) -> Tuple[Optional[int], Optional[str]]:
    """
    Resolve a valid market ID and market name for the given commodity and district.
    Uses cache to avoid repeated network calls.
    """
    if preferred_market_id:
        return preferred_market_id, f"Market-{preferred_market_id}"

    cache_key = (commodity_id, state_id, district_id)
    now = time.time()

    if cache_key in _market_cache:
        cached_entry, timestamp = _market_cache[cache_key]
        if now - timestamp < MARKET_CACHE_TTL:
            return cached_entry

    try:
        data = get_markets(commodity_id, state_id, district_id)
        markets = data.get("output", {}).get("data", [])
        if markets:
            first_market = markets[0]
            m_id = first_market.get("market_id")
            m_name = first_market.get("market_name", f"Market-{m_id}")
            result = (m_id, m_name)
            _market_cache[cache_key] = (result, now)
            return result
    except Exception as e:
        logger.warning(
            "Could not fetch markets for commodity_id=%s, state_id=%s, district_id=%s: %s",
            commodity_id, state_id, district_id, e
        )

    # Fallback to configured market ID
    fallback_id = CEDA_MARKET_ID or 255
    result = (fallback_id, f"Market-{fallback_id}")
    _market_cache[cache_key] = (result, now)
    return result


def get_latest_price(item_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch the latest available CEDA price for a given ingredient.

    Flow:
    1. Normalize name & resolve CEDA commodity ID.
    2. Resolve configured location & market.
    3. Check cache.
    4. Query CEDA price records within the date window.
    5. Sort descending by date.
    6. Extract reference modal_price (or avg of min & max).
    7. Convert per-quintal price to per-kg price.
    8. Return structured result.
    """
    commodity_id = get_commodity_id(item_name)
    if not commodity_id:
        logger.debug("No CEDA commodity mapping found for item: '%s'", item_name)
        return None

    location = get_default_location()
    state_id = location["state_id"] or 8
    district_id = location["district_id"] or 104
    configured_market = location["market_id"]

    market_id, market_name = resolve_market(
        commodity_id=commodity_id,
        state_id=state_id,
        district_id=district_id,
        preferred_market_id=configured_market
    )

    if not market_id:
        logger.warning("No market found for commodity_id=%s in district=%s", commodity_id, district_id)
        return None

    # Check price cache first
    cache_key = (commodity_id, market_id)
    now = time.time()
    if cache_key in _price_cache:
        cached_price, timestamp = _price_cache[cache_key]
        if now - timestamp < PRICE_CACHE_TTL:
            return cached_price

    records = []
    try:
        data = get_prices(
            commodity_id=commodity_id,
            state_id=state_id,
            district_ids=[district_id],
            market_ids=[market_id],
            from_date="2025-01-01",
            to_date="2025-06-30"
        )
        records = data.get("output", {}).get("data", [])
    except Exception as e:
        logger.warning(
            "Failed to fetch prices for commodity_id=%s, market_id=%s: %s",
            commodity_id, market_id, e
        )

    if not records:
        logger.debug("No CEDA price records returned for %s (commodity_id=%s, market_id=%s)", item_name, commodity_id, market_id)
        return None

    # Sort descending by date
    records.sort(key=lambda r: r.get("date", ""), reverse=True)
    latest_record = records[0]

    min_p = float(latest_record.get("min_price", 0) or 0)
    max_p = float(latest_record.get("max_price", 0) or 0)
    modal_p = float(latest_record.get("modal_price", 0) or 0)

    # Use modal price as primary reference; if 0, use average of min and max
    if modal_p <= 0 and (min_p > 0 or max_p > 0):
        ref_price = (min_p + max_p) / 2.0
    else:
        ref_price = modal_p

    if ref_price <= 0:
        return None

    # Agmarknet prices are in ₹ per quintal (1 quintal = 100 kg)
    price_per_kg = round(ref_price / 100.0, 2)
    record_date = latest_record.get("date", "")
    if "T" in record_date:
        record_date = record_date.split("T")[0]

    result = {
        "item": item_name.strip().title(),
        "commodity_id": commodity_id,
        "market_id": market_id,
        "market_name": market_name or f"Market-{market_id}",
        "date": record_date,
        "min_price": min_p,
        "max_price": max_p,
        "modal_price": modal_p,
        "price_per_quintal": ref_price,
        "price_per_kg": price_per_kg,
        "unit": "quintal"
    }

    # Store in memory and persist
    _price_cache[cache_key] = (result, now)
    _save_disk_cache()
    return result
