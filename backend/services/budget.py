from typing import Sequence, Dict, Any, List


def calculate_budget(
    grocery_items: Sequence[Any],
    budget: float
) -> Dict[str, Any]:
    """
    Calculate budget summary from grocery items, ignoring items with unavailable prices.

    Status rules:
    - 'over_budget': Total known estimated cost exceeds the allocated budget.
    - 'partially_estimated': Total known cost is within budget, but some items have unknown prices.
    - 'within_budget': All item prices are known and within budget.
    """
    total_cost = 0.0
    items_without_price: List[str] = []

    for item in grocery_items:
        price = getattr(item, "estimated_price", None)
        item_name = getattr(item, "item_name", "Unknown Item")

        # Also support dict inputs
        if isinstance(item, dict):
            price = item.get("estimated_price")
            item_name = item.get("item_name", "Unknown Item")

        if price is not None and price > 0:
            total_cost += float(price)
        else:
            items_without_price.append(item_name)

    remaining = budget - total_cost

    if total_cost > budget:
        status = "over_budget"
    elif items_without_price:
        status = "partially_estimated"
    else:
        status = "within_budget"

    return {
        "budget": round(budget, 2),
        "total_estimated_cost": round(total_cost, 2),
        "remaining_budget": round(remaining, 2),
        "status": status,
        "items_without_price": items_without_price
    }