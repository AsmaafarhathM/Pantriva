def calculate_required_groceries(
    requirements,
    pantry_items
):
    shopping_list = []

    for requirement in requirements:

        pantry_quantity = 0

        for item in pantry_items:

            if (
                item.item_name.lower()
                == requirement.item_name.lower()
                and item.unit.lower()
                == requirement.unit.lower()
            ):
                pantry_quantity += item.quantity

        quantity_to_buy = (
            requirement.quantity
            - pantry_quantity
        )

        if quantity_to_buy > 0:

            shopping_list.append({
                "item_name": requirement.item_name,
                "category": requirement.category,
                "quantity": quantity_to_buy,
                "unit": requirement.unit
            })

    return shopping_list