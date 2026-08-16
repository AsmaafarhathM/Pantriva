from services.ai import generate_meal_plan


pantry_items = [
    {
        "name": "Rice",
        "quantity": 2,
        "unit": "kg"
    },
    {
        "name": "Dal",
        "quantity": 500,
        "unit": "g"
    },
    {
        "name": "Tomato",
        "quantity": 500,
        "unit": "g"
    }
]


result = generate_meal_plan(
    people=3,
    days=2,
    budget=1000,
    diet="vegetarian",
    avoid=["mushroom"],
    pantry_items=pantry_items
)

print(result)