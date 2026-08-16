from pydantic import BaseModel, Field


class MealGenerateRequest(BaseModel):
    people: int = Field(gt=0, le=20)
    days: int = Field(gt=0, le=30)
    budget: float = Field(gt=0)
    diet: str = Field(min_length=1, max_length=50)
    avoid: list[str] = []


class GeneratedIngredient(BaseModel):
    ingredient_name: str = Field(description="Name of the ingredient")
    quantity: float = Field(description="Numeric quantity, e.g. 150, 1.5, 2")
    unit: str = Field(description="Unit of measurement, e.g. g, kg, pieces, tbsp, cups")


class GeneratedMeal(BaseModel):
    meal_name: str = Field(description="Name of the dish or meal")
    ingredients: list[GeneratedIngredient] = Field(description="List of ingredients needed")


class GeneratedDayPlan(BaseModel):
    day: int = Field(description="Day number, e.g. 1, 2, 3")
    breakfast: GeneratedMeal = Field(description="Breakfast meal details")
    lunch: GeneratedMeal = Field(description="Lunch meal details")
    dinner: GeneratedMeal = Field(description="Dinner meal details")


class MealPlanResponseSchema(BaseModel):
    meal_plan: list[GeneratedDayPlan] = Field(description="List of daily meal plans")