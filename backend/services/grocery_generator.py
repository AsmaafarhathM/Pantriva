import logging
from sqlalchemy.orm import Session

from models.meal import Meal
from models.meal_ingredient import MealIngredient
from models.pantry import PantryItem
from models.grocery import GroceryItem

from services.units import convert_to_base
from services.price_estimator import estimate_price

logger = logging.getLogger(__name__)


def generate_grocery_from_meals(
    db: Session,
    user_id: int
) -> list[GroceryItem]:
    """
    Generate missing grocery items from user's planned meals minus current pantry inventory,
    with CEDA-estimated prices.
    """

    # --------------------------------
    # 1. Get user's meals
    # --------------------------------
    meals = db.query(Meal).filter(
        Meal.user_id == user_id
    ).all()

    if not meals:
        return []

    # --------------------------------
    # 2. Get and aggregate all meal ingredients
    # --------------------------------
    required = {}

    for meal in meals:
        ingredients = db.query(MealIngredient).filter(
            MealIngredient.meal_id == meal.id
        ).all()

        for ingredient in ingredients:
            quantity, unit = convert_to_base(
                ingredient.quantity,
                ingredient.unit
            )

            name = ingredient.ingredient_name.lower().strip()

            if name not in required:
                required[name] = {
                    "quantity": 0.0,
                    "unit": unit
                }

            # Only aggregate if units are compatible
            if required[name]["unit"] == unit:
                required[name]["quantity"] += quantity
            else:
                # Handle distinct unit safely
                key = f"{name} ({unit})"
                if key not in required:
                    required[key] = {
                        "quantity": 0.0,
                        "unit": unit,
                        "raw_name": name
                    }
                required[key]["quantity"] += quantity

    # --------------------------------
    # 3. Get and aggregate pantry items
    # --------------------------------
    pantry = db.query(PantryItem).filter(
        PantryItem.user_id == user_id
    ).all()

    pantry_data = {}

    for item in pantry:
        quantity, unit = convert_to_base(
            item.quantity,
            item.unit
        )

        name = item.item_name.lower().strip()

        if name not in pantry_data:
            pantry_data[name] = {
                "quantity": 0.0,
                "unit": unit
            }

        if pantry_data[name]["unit"] == unit:
            pantry_data[name]["quantity"] += quantity

    # --------------------------------
    # 4. Calculate missing ingredients and estimate prices
    # --------------------------------
    grocery_items = []

    for name_key, requirement in required.items():
        name = requirement.get("raw_name", name_key)
        required_quantity = requirement["quantity"]
        unit = requirement["unit"]

        # Check pantry inventory
        pantry_match = pantry_data.get(name)
        if pantry_match and pantry_match["unit"] == unit:
            pantry_quantity = pantry_match["quantity"]
        else:
            pantry_quantity = 0.0

        missing = required_quantity - pantry_quantity

        if missing <= 0:
            continue

        missing = round(missing, 2)

        # Estimate price via CEDA
        price_result = estimate_price(
            item_name=name,
            quantity=missing,
            unit=unit
        )
        estimated_price = price_result.get("estimated_price")

        grocery = GroceryItem(
            user_id=user_id,
            item_name=name.title(),
            quantity=missing,
            unit=unit,
            category="Meal Ingredients",
            estimated_price=estimated_price,
            is_purchased=False
        )

        db.add(grocery)
        grocery_items.append(grocery)

    db.commit()

    for item in grocery_items:
        db.refresh(item)

    logger.info("Generated %d grocery items for user_id=%s", len(grocery_items), user_id)
    return grocery_items