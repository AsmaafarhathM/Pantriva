import re
import logging
from typing import Optional, Dict, Any

from services.ceda_price import get_latest_price

logger = logging.getLogger(__name__)

# Curated Indian Retail Market Benchmark Prices (in ₹ per KG)
BENCHMARK_PRICES_PER_KG = {
    # Grains, Flours & Breakfast Staples
    "rice": 55.0,
    "basmati rice": 95.0,
    "brown rice": 80.0,
    "paddy": 40.0,
    "wheat": 38.0,
    "wheat flour": 42.0,
    "atta": 42.0,
    "maida": 45.0,
    "suji": 48.0,
    "rava": 48.0,
    "semolina": 48.0,
    "poha": 52.0,
    "flattened rice": 52.0,
    "oats": 160.0,
    "besan": 90.0,
    "gram flour": 90.0,
    "dosa batter": 60.0,
    "idli batter": 60.0,
    "batter": 60.0,
    "vermicelli": 65.0,
    "seviyan": 65.0,
    "bread": 120.0,
    "noodles": 110.0,
    "pasta": 120.0,
    "corn": 40.0,
    "maize": 35.0,

    # Dals & Pulses (Lentils)
    "toor dal": 160.0,
    "arhar dal": 160.0,
    "red gram": 160.0,
    "tuvar dal": 160.0,
    "yellow dal": 150.0,
    "moong dal": 130.0,
    "green gram": 130.0,
    "moong": 125.0,
    "chana dal": 90.0,
    "bengal gram": 90.0,
    "chana": 85.0,
    "chickpeas": 130.0,
    "kabuli chana": 140.0,
    "kala chana": 85.0,
    "urad dal": 140.0,
    "black gram": 140.0,
    "masoor dal": 110.0,
    "red lentil": 110.0,
    "rajma": 150.0,
    "kidney beans": 150.0,
    "lobia": 120.0,
    "cowpea": 120.0,
    "soyabean": 80.0,
    "soya chunks": 140.0,

    # Vegetables & Fresh Greens
    "potato": 30.0,
    "aloo": 30.0,
    "onion": 35.0,
    "pyaz": 35.0,
    "tomato": 35.0,
    "tamatar": 35.0,
    "garlic": 180.0,
    "lehsun": 180.0,
    "ginger": 150.0,
    "adrak": 150.0,
    "green chillies": 80.0,
    "green chili": 80.0,
    "chilli": 80.0,
    "chillies": 80.0,
    "carrot": 50.0,
    "gajar": 50.0,
    "cabbage": 35.0,
    "patta gobhi": 35.0,
    "cauliflower": 45.0,
    "gobhi": 45.0,
    "spinach": 40.0,
    "palak": 40.0,
    "coriander leaves": 50.0,
    "coriander": 50.0,
    "dhania patta": 50.0,
    "cilantro": 50.0,
    "mint": 60.0,
    "mint leaves": 60.0,
    "pudina": 60.0,
    "curry leaves": 80.0,
    "kadi patta": 80.0,
    "capsicum": 70.0,
    "bell pepper": 70.0,
    "shimla mirch": 70.0,
    "cucumber": 35.0,
    "kheera": 35.0,
    "brinjal": 40.0,
    "eggplant": 40.0,
    "baingan": 40.0,
    "ladyfinger": 50.0,
    "okra": 50.0,
    "bhindi": 50.0,
    "beans": 60.0,
    "french beans": 65.0,
    "peas": 60.0,
    "green peas": 60.0,
    "matar": 60.0,
    "bottle gourd": 30.0,
    "lauki": 30.0,
    "bitter gourd": 45.0,
    "karela": 45.0,
    "ridge gourd": 45.0,
    "turai": 45.0,
    "radish": 35.0,
    "mooli": 35.0,
    "beetroot": 45.0,
    "chukandar": 45.0,
    "mushroom": 240.0,
    "mushrooms": 240.0,
    "lemon": 90.0,
    "nimbu": 90.0,

    # Dairy, Fats & Cooking Oils
    "cooking oil": 140.0,
    "oil": 140.0,
    "vegetable oil": 140.0,
    "sunflower oil": 145.0,
    "mustard oil": 150.0,
    "groundnut oil": 170.0,
    "olive oil": 600.0,
    "coconut oil": 220.0,
    "ghee": 600.0,
    "butter": 550.0,
    "milk": 65.0,
    "curd": 70.0,
    "dahi": 70.0,
    "yogurt": 80.0,
    "paneer": 380.0,
    "cheese": 500.0,
    "cream": 280.0,

    # Spices & Seasonings
    "salt": 25.0,
    "namak": 25.0,
    "turmeric powder": 220.0,
    "turmeric": 220.0,
    "haldi": 220.0,
    "red chilli powder": 300.0,
    "chilli powder": 300.0,
    "mirchi powder": 300.0,
    "cumin seeds": 380.0,
    "cumin": 380.0,
    "jeera": 380.0,
    "mustard seeds": 160.0,
    "mustard": 160.0,
    "rai": 160.0,
    "sarson": 160.0,
    "coriander powder": 240.0,
    "dhania powder": 240.0,
    "garam masala": 550.0,
    "black pepper": 750.0,
    "pepper": 750.0,
    "kali mirch": 750.0,
    "cardamom": 2800.0,
    "elaichi": 2800.0,
    "cloves": 1100.0,
    "laung": 1100.0,
    "cinnamon": 600.0,
    "dalchini": 600.0,
    "bay leaf": 300.0,
    "tejpatta": 300.0,
    "fennel seeds": 240.0,
    "saunf": 240.0,
    "carom seeds": 260.0,
    "ajwain": 260.0,
    "fenugreek seeds": 120.0,
    "methi seeds": 120.0,
    "kasuri methi": 400.0,
    "hing": 1400.0,
    "asafoetida": 1400.0,
    "amchur": 350.0,
    "chaat masala": 400.0,
    "sambar powder": 350.0,
    "biryani masala": 450.0,
    "curry powder": 300.0,

    # Condiments & Sauces
    "soy sauce": 160.0,
    "soya sauce": 160.0,
    "tomato sauce": 140.0,
    "ketchup": 140.0,
    "vinegar": 80.0,
    "chilli sauce": 140.0,
    "mayonnaise": 220.0,
    "tamarind": 180.0,
    "imli": 180.0,
    "sugar": 45.0,
    "chini": 45.0,
    "jaggery": 60.0,
    "gur": 60.0,
    "honey": 400.0,
    "tea": 380.0,
    "chai": 380.0,
    "coffee": 800.0,

    # Meats & Non-Veg Proteins
    "chicken": 240.0,
    "boneless chicken": 320.0,
    "chicken breast": 340.0,
    "mutton": 750.0,
    "lamb": 750.0,
    "fish": 280.0,
    "prawns": 480.0,
    "egg": 140.0,
    "eggs": 140.0,

    # Nuts & Dry Fruits
    "peanuts": 140.0,
    "groundnut": 140.0,
    "cashews": 850.0,
    "kaju": 850.0,
    "almonds": 800.0,
    "badam": 800.0,
    "raisins": 400.0,
    "kishmish": 400.0,
    "sesame seeds": 220.0,
    "til": 220.0
}

# Unit piece weight approximations (in KG)
PIECE_WEIGHT_KG = {
    "egg": 0.05,        # 50g -> ~₹7
    "eggs": 0.05,
    "garlic": 0.004,    # 4g per clove -> ~₹0.70
    "clove": 0.004,
    "cloves": 0.004,
    "green chillies": 0.005,  # 5g per chilli -> ~₹0.40
    "green chili": 0.005,
    "chilli": 0.005,
    "chillies": 0.005,
    "lemon": 0.04,      # 40g -> ~₹3.60
    "bread": 0.025,     # 25g slice -> ~₹3.00
    "slice": 0.025,
    "slices": 0.025,
    "onion": 0.10,      # 100g -> ~₹3.50
    "potato": 0.12,     # 120g -> ~₹3.60
    "tomato": 0.08,     # 80g -> ~₹2.80
    "bunch": 0.15,      # 150g -> ~₹7.50
    "bunches": 0.15,
    "pack": 0.20,
    "packet": 0.20,
}


def _match_benchmark_price(item_name: str) -> float:
    """Fuzzy match item name against the curated retail benchmark database."""
    clean = re.sub(r"\(.*?\)", "", item_name).lower().strip()

    # 1. Exact match
    if clean in BENCHMARK_PRICES_PER_KG:
        return BENCHMARK_PRICES_PER_KG[clean]

    # 2. Key phrases
    for key, price in BENCHMARK_PRICES_PER_KG.items():
        if key in clean or clean in key:
            return price

    # 3. Individual token match
    tokens = clean.split()
    for token in tokens:
        if token in BENCHMARK_PRICES_PER_KG:
            return BENCHMARK_PRICES_PER_KG[token]

    # 4. General default grocery rate
    return 75.0


def _convert_quantity_to_kg(item_name: str, quantity: float, unit: str) -> float:
    """Convert requested quantity and unit into equivalent KG."""
    unit_clean = unit.lower().strip() if unit else ""
    item_clean = item_name.lower().strip()

    if unit_clean in ["kg", "kilogram", "kilograms"]:
        return quantity
    elif unit_clean in ["g", "gram", "grams", "gm"]:
        return quantity / 1000.0
    elif unit_clean in ["mg", "milligram", "milligrams"]:
        return quantity / 1000000.0
    elif unit_clean in ["quintal", "quintals", "qtl"]:
        return quantity * 100.0
    elif unit_clean in ["l", "litre", "liter", "litres", "liters"]:
        return quantity
    elif unit_clean in ["ml", "millilitre", "milliliter", "millilitres"]:
        return quantity / 1000.0
    elif unit_clean in ["tbsp", "tablespoon", "tablespoons"]:
        return quantity * 0.015
    elif unit_clean in ["tsp", "teaspoon", "teaspoons"]:
        return quantity * 0.005
    elif unit_clean in ["cup", "cups"]:
        return quantity * 0.200
    elif unit_clean in ["pinch", "pinches"]:
        return quantity * 0.001
    elif unit_clean in ["clove", "cloves"]:
        return quantity * 0.004
    elif unit_clean in ["slice", "slices"]:
        return quantity * 0.025
    elif unit_clean in ["bunch", "bunches"]:
        return quantity * 0.150
    elif unit_clean in ["pack", "packet", "packets"]:
        return quantity * 0.200
    elif unit_clean in ["piece", "pieces", "pcs", "nos", "no", "leaves"]:
        # Find item-specific piece weight if available
        piece_wt = 0.05  # default 50g
        for k, wt in PIECE_WEIGHT_KG.items():
            if k in item_clean:
                piece_wt = wt
                break
        return quantity * piece_wt
    else:
        # Fallback approximation for arbitrary unit
        return quantity * 0.05


def estimate_price(
    item_name: str,
    quantity: float,
    unit: str
) -> Dict[str, Any]:
    """
    Estimate total price for a given ingredient, quantity, and unit.

    Strategy:
    1. Try live/cached agricultural mandi price from CEDA via get_latest_price(item_name).
    2. If CEDA is offline, timed out, or doesn't list the item (e.g. spices, oils, dairy, non-veg, processed foods),
       seamlessly fall back to the Indian Retail Benchmark dataset.
    3. Calculate total cost using precise unit-to-weight conversions.
    """
    if not item_name or quantity <= 0:
        return {
            "estimated_price": None,
            "price_available": False,
            "source": "None",
            "reason": "Invalid item or quantity"
        }

    kg_equiv = _convert_quantity_to_kg(item_name, quantity, unit)

    # 1. Check live CEDA mandi price
    price_info = None
    try:
        price_info = get_latest_price(item_name)
    except Exception as e:
        logger.debug("CEDA lookup skipped or failed for '%s': %s", item_name, e)

    if price_info and price_info.get("price_per_kg") and price_info.get("price_per_kg") > 0:
        price_per_kg = price_info["price_per_kg"]
        total_cost = round(kg_equiv * price_per_kg, 2)
        if total_cost < 0.50 and quantity > 0:
            total_cost = 1.00

        return {
            "estimated_price": total_cost,
            "price_available": True,
            "price_per_kg": price_per_kg,
            "source": "CEDA",
            "price_date": price_info.get("date"),
            "market_name": price_info.get("market_name")
        }

    # 2. Fallback to Indian Retail Benchmark dataset
    benchmark_price_per_kg = _match_benchmark_price(item_name)
    total_cost = round(kg_equiv * benchmark_price_per_kg, 2)
    if total_cost < 0.50 and quantity > 0:
        total_cost = 1.00

    return {
        "estimated_price": total_cost,
        "price_available": True,
        "price_per_kg": benchmark_price_per_kg,
        "source": "Retail Benchmark",
        "price_date": "Current",
        "market_name": "Retail Average"
    }