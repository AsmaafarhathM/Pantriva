from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict


class GroceryItemCreate(BaseModel):
    item_name: str = Field(
        min_length=1,
        max_length=100
    )

    category: str = Field(
        min_length=1,
        max_length=50
    )

    quantity: float = Field(
        gt=0
    )

    unit: str = Field(
        min_length=1,
        max_length=20
    )

    estimated_price: Optional[float] = Field(
        default=None,
        ge=0
    )


class GroceryResponse(BaseModel):
    id: int
    user_id: int
    item_name: str
    category: str
    quantity: float
    unit: str
    estimated_price: Optional[float] = None
    is_purchased: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class GroceryRequirement(BaseModel):
    item_name: str = Field(
        min_length=1,
        max_length=100
    )

    category: str = Field(
        min_length=1,
        max_length=50
    )

    quantity: float = Field(
        gt=0
    )

    unit: str = Field(
        min_length=1,
        max_length=20
    )


class BudgetSummaryResponse(BaseModel):
    budget: float
    total_estimated_cost: float
    remaining_budget: float
    status: str
    items_without_price: List[str] = []


class GroceryGenerateResponse(BaseModel):
    message: str
    items: List[GroceryResponse]
    budget_summary: BudgetSummaryResponse