import logging
from typing import Optional, Dict, Any

from services.ceda_price import get_latest_price

logger = logging.getLogger(__name__)


def estimate_price(
    item_name: str,
    quantity: float,
    unit: str
) -> Dict[str, Any]:
    """
    Estimate total price for a given ingredient, quantity, and unit using live/cached CEDA price data.

    Flow:
    1. Fetch latest price from CEDA via get_latest_price(item_name).
    2. If unavailable, return price_available=False with estimated_price=None.
    3. Convert the CEDA per-kg price based on the requested unit (kg, g, mg, quintal, l, ml, tbsp, tsp).
    4. Return structured estimation.
    """
    if not item_name or quantity <= 0:
        return {
            "estimated_price": None,
            "price_available": False,
            "source": "CEDA",
            "reason": "Invalid item or quantity"
        }

    price_info = get_latest_price(item_name)
    if not price_info:
        return {
            "estimated_price": None,
            "price_available": False,
            "source": "CEDA",
            "reason": f"CEDA price unavailable for '{item_name}'"
        }

    price_per_kg = price_info.get("price_per_kg")
    if price_per_kg is None or price_per_kg <= 0:
        return {
            "estimated_price": None,
            "price_available": False,
            "source": "CEDA",
            "reason": f"Invalid CEDA reference price for '{item_name}'"
        }

    unit_clean = unit.lower().strip() if unit else ""

    # Unit conversions to kg equivalent:
    if unit_clean in ["kg", "kilogram", "kilograms"]:
        kg_equiv = quantity
    elif unit_clean in ["g", "gram", "grams", "gm"]:
        kg_equiv = quantity / 1000.0
    elif unit_clean in ["mg", "milligram", "milligrams"]:
        kg_equiv = quantity / 1000000.0
    elif unit_clean in ["quintal", "quintals", "qtl"]:
        kg_equiv = quantity * 100.0
    elif unit_clean in ["l", "litre", "liter", "litres", "liters"]:
        kg_equiv = quantity
    elif unit_clean in ["ml", "millilitre", "milliliter", "millilitres"]:
        kg_equiv = quantity / 1000.0
    elif unit_clean in ["tbsp", "tablespoon", "tablespoons"]:
        kg_equiv = quantity * 0.015
    elif unit_clean in ["tsp", "teaspoon", "teaspoons"]:
        kg_equiv = quantity * 0.005
    else:
        return {
            "estimated_price": None,
            "price_available": False,
            "source": "CEDA",
            "reason": f"Unit '{unit}' cannot be safely converted to agricultural market weight pricing"
        }

    total_cost = round(kg_equiv * price_per_kg, 2)

    return {
        "estimated_price": total_cost,
        "price_available": True,
        "price_per_kg": price_per_kg,
        "source": "CEDA",
        "price_date": price_info.get("date"),
        "market_name": price_info.get("market_name")
    }