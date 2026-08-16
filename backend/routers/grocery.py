import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.grocery import GroceryItem
from models.pantry import PantryItem
from models.meal_plan import MealPlan

from schemas.grocery import (
    GroceryItemCreate,
    GroceryResponse,
    GroceryGenerateResponse
)

from services.auth import get_current_user
from services.grocery_generator import generate_grocery_from_meals
from services.budget import calculate_budget

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/grocery",
    tags=["Grocery"]
)


# ----------------------------------------------------
# GROCERY CRUD & RETRIEVAL
# ----------------------------------------------------

@router.post(
    "/",
    response_model=GroceryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a grocery item",
    description="Manually add a grocery item for the authenticated user."
)
def add_grocery_item(
    item_data: GroceryItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = GroceryItem(
        user_id=current_user.id,
        item_name=item_data.item_name,
        category=item_data.category,
        quantity=item_data.quantity,
        unit=item_data.unit,
        estimated_price=item_data.estimated_price,
        is_purchased=False
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.get(
    "/",
    response_model=List[GroceryResponse],
    summary="Get all grocery items",
    description="Retrieve all grocery list items belonging exclusively to the authenticated user."
)
def get_grocery_items(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(GroceryItem).filter(
        GroceryItem.user_id == current_user.id
    ).order_by(GroceryItem.id.asc()).all()


@router.get(
    "/{item_id}",
    response_model=GroceryResponse,
    summary="Get single grocery item",
    description="Retrieve a single grocery item by ID. Returns 404 if not found or unowned."
)
def get_grocery_item_by_id(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(GroceryItem).filter(
        GroceryItem.id == item_id,
        GroceryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grocery item not found"
        )

    return item


@router.put(
    "/{item_id}",
    response_model=GroceryResponse,
    summary="Update a grocery item",
    description="Update fields of an existing grocery item owned by the authenticated user."
)
def update_grocery_item(
    item_id: int,
    item_data: GroceryItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(GroceryItem).filter(
        GroceryItem.id == item_id,
        GroceryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grocery item not found"
        )

    item.item_name = item_data.item_name
    item.category = item_data.category
    item.quantity = item_data.quantity
    item.unit = item_data.unit
    item.estimated_price = item_data.estimated_price

    db.commit()
    db.refresh(item)

    return item


@router.delete(
    "/{item_id}",
    summary="Delete a grocery item",
    description="Remove a grocery item from the authenticated user's list."
)
def delete_grocery_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(GroceryItem).filter(
        GroceryItem.id == item_id,
        GroceryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grocery item not found"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Grocery item deleted successfully"
    }


@router.patch(
    "/{item_id}/purchase",
    response_model=GroceryResponse,
    summary="Toggle purchased status",
    description="Toggle the is_purchased boolean flag for a user's grocery item."
)
def toggle_purchase_status(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(GroceryItem).filter(
        GroceryItem.id == item_id,
        GroceryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grocery item not found"
        )

    item.is_purchased = not item.is_purchased

    db.commit()
    db.refresh(item)

    return item


@router.post(
    "/generate",
    response_model=GroceryGenerateResponse,
    summary="Generate grocery list from meals",
    description="Automatically aggregate required meal ingredients, subtract pantry stock, and estimate prices."
)
def generate_grocery_list(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    grocery_items = generate_grocery_from_meals(
        db=db,
        user_id=current_user.id
    )

    meal_plan = db.query(MealPlan).filter(
        MealPlan.user_id == current_user.id
    ).order_by(
        MealPlan.id.desc()
    ).first()

    budget_val = meal_plan.budget if meal_plan else 0.0

    budget_summary = calculate_budget(
        grocery_items,
        budget_val
    )

    return {
        "message": "Grocery list generated successfully",
        "items": grocery_items,
        "budget_summary": budget_summary
    }
