import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.pantry import PantryItem
from schemas.pantry import (
    PantryItemCreate,
    PantryItemResponse,
    PantryExpiryResponse
)
from services.expiry import calculate_expiry_status
from services.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/pantry",
    tags=["Pantry"]
)


# CREATE
@router.post(
    "/",
    response_model=PantryItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a pantry item",
    description="Add an item to the authenticated user's pantry inventory."
)
def add_pantry_item(
    item_data: PantryItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = PantryItem(
        user_id=current_user.id,
        item_name=item_data.item_name,
        category=item_data.category,
        quantity=item_data.quantity,
        unit=item_data.unit,
        expiry_date=item_data.expiry_date
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


# READ ALL
@router.get(
    "/",
    response_model=List[PantryItemResponse],
    summary="Get all pantry items",
    description="Retrieve all pantry items belonging exclusively to the authenticated user."
)
def get_pantry_items(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(PantryItem).filter(
        PantryItem.user_id == current_user.id
    ).order_by(PantryItem.id.asc()).all()


# EXPIRY STATUS
@router.get(
    "/expiry-status",
    response_model=List[PantryExpiryResponse],
    summary="Get pantry expiry status",
    description="Retrieve expiry analysis and remaining days for the user's pantry inventory."
)
def get_expiry_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    items = db.query(PantryItem).filter(
        PantryItem.user_id == current_user.id
    ).order_by(PantryItem.id.asc()).all()

    result = []

    for item in items:
        expiry_info = calculate_expiry_status(
            item.expiry_date
        )

        result.append({
            "id": item.id,
            "item_name": item.item_name,
            "category": item.category,
            "quantity": item.quantity,
            "unit": item.unit,
            "expiry_date": item.expiry_date,
            "days_remaining": expiry_info["days_remaining"],
            "status": expiry_info["status"]
        })

    return result


# READ SINGLE
@router.get(
    "/{item_id}",
    response_model=PantryItemResponse,
    summary="Get single pantry item",
    description="Retrieve an individual pantry item by ID. Returns 404 if not found or unowned."
)
def get_pantry_item_by_id(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(PantryItem).filter(
        PantryItem.id == item_id,
        PantryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pantry item not found"
        )

    return item


# UPDATE
@router.put(
    "/{item_id}",
    response_model=PantryItemResponse,
    summary="Update a pantry item",
    description="Update a pantry item owned by the authenticated user. Returns 404 if not found/unowned."
)
def update_pantry_item(
    item_id: int,
    item_data: PantryItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(PantryItem).filter(
        PantryItem.id == item_id,
        PantryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pantry item not found"
        )

    item.item_name = item_data.item_name
    item.category = item_data.category
    item.quantity = item_data.quantity
    item.unit = item_data.unit
    item.expiry_date = item_data.expiry_date

    db.commit()
    db.refresh(item)

    return item


# DELETE
@router.delete(
    "/{item_id}",
    summary="Delete a pantry item",
    description="Remove an item from the authenticated user's pantry. Returns 404 if not found/unowned."
)
def delete_pantry_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    item = db.query(PantryItem).filter(
        PantryItem.id == item_id,
        PantryItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pantry item not found"
        )

    db.delete(item)
    db.commit()

    return {
        "message": "Pantry item deleted successfully"
    }