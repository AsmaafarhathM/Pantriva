from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from schemas.meal_ingredient import MealIngredientResponse


class MealCreate(BaseModel):
    day: str = Field(
        min_length=1,
        max_length=20
    )

    meal_type: str = Field(
        min_length=1,
        max_length=20
    )

    meal_name: str = Field(
        min_length=1,
        max_length=100
    )


class MealResponse(BaseModel):
    id: int
    user_id: int
    meal_plan_id: Optional[int] = None
    day: str
    meal_type: str
    meal_name: str
    created_at: Optional[datetime] = None
    ingredients: List[MealIngredientResponse] = []

    model_config = ConfigDict(from_attributes=True)


class MealPlanResponse(BaseModel):
    id: int
    user_id: int
    number_of_people: int
    number_of_days: int
    budget: float
    diet: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MealPlanDetailResponse(BaseModel):
    id: int
    user_id: int
    number_of_people: int
    number_of_days: int
    budget: float
    diet: str
    created_at: datetime
    meals: List[MealResponse] = []

    model_config = ConfigDict(from_attributes=True)