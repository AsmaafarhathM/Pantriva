def convert_to_base(quantity: float, unit: str):

    unit = unit.lower().strip()

    if unit == "kg":
        return quantity * 1000, "g"

    if unit == "g":
        return quantity, "g"

    if unit == "mg":
        return quantity / 1000, "g"

    if unit == "l":
        return quantity * 1000, "ml"

    if unit == "ml":
        return quantity, "ml"

    return quantity, unit