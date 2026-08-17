import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.budget import Budget
from models.grocery import GroceryItem
from schemas.budget import BudgetCreate, BudgetResponse, BudgetStatusResponse
from services.auth import get_current_user
from services.price_estimator import estimate_price

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/budget",
    tags=["Budget"]
)


# SET / UPDATE BUDGET
@router.post(
    "/",
    response_model=BudgetResponse,
    status_code=status.HTTP_200_OK,
    summary="Set or update budget",
    description="Set or update the allocated grocery budget for the authenticated user."
)
def set_budget(
    budget_data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()

    if budget:
        budget.amount = budget_data.amount
    else:
        budget = Budget(
            user_id=current_user.id,
            amount=budget_data.amount
        )
        db.add(budget)

    db.commit()
    db.refresh(budget)

    return budget


# GET BUDGET
@router.get(
    "/",
    response_model=Optional[BudgetResponse],
    summary="Get user budget",
    description="Retrieve the currently configured budget for the authenticated user."
)
def get_budget(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not set"
        )

    return budget


@router.get(
    "/summary",
    response_model=BudgetStatusResponse,
    summary="Get budget status summary",
    description="Calculate live remaining balance and budget status against unpurchased grocery items."
)
def get_budget_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    budget = db.query(Budget).filter(
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not set"
        )

    grocery_items = db.query(GroceryItem).filter(
        GroceryItem.user_id == current_user.id,
        GroceryItem.is_purchased == False
    ).all()

    updated = False
    for item in grocery_items:
        if item.estimated_price is None or item.estimated_price <= 0:
            price_res = estimate_price(item.item_name, item.quantity, item.unit)
            if price_res.get("price_available") and price_res.get("estimated_price"):
                item.estimated_price = price_res["estimated_price"]
                updated = True

    if updated:
        db.commit()

    # Safely calculate total estimated cost across all items
    estimated_cost = sum(
        float(item.estimated_price)
        for item in grocery_items
        if item.estimated_price is not None
    )

    remaining = budget.amount - estimated_cost

    if estimated_cost > budget.amount:
        status_label = "OVER_BUDGET"
    elif estimated_cost >= budget.amount * 0.9:
        status_label = "NEAR_LIMIT"
    else:
        status_label = "WITHIN_BUDGET"

    return {
        "budget": round(budget.amount, 2),
        "estimated_cost": round(estimated_cost, 2),
        "remaining": round(remaining, 2),
        "status": status_label
    }