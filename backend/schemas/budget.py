from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class BudgetCreate(BaseModel):
    amount: float = Field(
        gt=0
    )


class BudgetResponse(BaseModel):
    id: int
    user_id: int
    amount: float

    model_config = ConfigDict(from_attributes=True)


class BudgetStatusResponse(BaseModel):
    budget: float
    estimated_cost: float
    remaining: float
    status: str