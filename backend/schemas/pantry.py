from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class PantryItemCreate(BaseModel):
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

    expiry_date: Optional[date] = None


class PantryItemResponse(BaseModel):
    id: int
    user_id: int
    item_name: str
    category: str
    quantity: float
    unit: str
    expiry_date: Optional[date] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PantryExpiryResponse(BaseModel):
    id: int
    item_name: str
    category: str
    quantity: float
    unit: str
    expiry_date: Optional[date] = None
    days_remaining: Optional[int] = None
    status: str

    model_config = ConfigDict(from_attributes=True)