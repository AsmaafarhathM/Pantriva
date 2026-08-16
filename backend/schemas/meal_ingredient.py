from pydantic import BaseModel, Field, ConfigDict


class MealIngredientCreate(BaseModel):
    ingredient_name: str = Field(
        min_length=1,
        max_length=100
    )

    quantity: float = Field(
        gt=0
    )

    unit: str = Field(
        min_length=1,
        max_length=20
    )


class MealIngredientResponse(BaseModel):
    id: int
    meal_id: int
    ingredient_name: str
    quantity: float
    unit: str

    model_config = ConfigDict(from_attributes=True)