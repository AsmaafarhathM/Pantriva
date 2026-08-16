import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models.meal_ingredient import MealIngredient
from models.pantry import PantryItem
from models.meal import Meal
from models.meal_plan import MealPlan

from services.ai import generate_meal_plan, AiServiceError, AiValidationError
from services.auth import get_current_user

from schemas.meal_ingredient import MealIngredientCreate, MealIngredientResponse
from schemas.meal_generate import MealGenerateRequest
from schemas.meal import (
    MealCreate,
    MealResponse,
    MealPlanResponse,
    MealPlanDetailResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/meals",
    tags=["Meals"]
)


# ----------------------------------------------------
# MEAL CRUD & RETRIEVAL
# ----------------------------------------------------

@router.post(
    "/",
    response_model=MealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom meal",
    description="Create an individual meal record for the authenticated user."
)
def create_meal(
    meal_data: MealCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    meal = Meal(
        user_id=current_user.id,
        day=meal_data.day,
        meal_type=meal_data.meal_type,
        meal_name=meal_data.meal_name
    )

    db.add(meal)
    db.commit()
    db.refresh(meal)

    return meal


@router.get(
    "/",
    response_model=List[MealResponse],
    summary="Get all meals",
    description="Retrieve all saved meals for the authenticated user, including ingredients."
)
def get_meals(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    meals = db.query(Meal).options(
        selectinload(Meal.ingredients)
    ).filter(
        Meal.user_id == current_user.id
    ).order_by(Meal.id.asc()).all()

    return meals


@router.get(
    "/plans",
    response_model=List[MealPlanResponse],
    summary="Get user meal plans",
    description="Retrieve a list of all historical and active meal plans for the authenticated user."
)
def get_meal_plans(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    plans = db.query(MealPlan).filter(
        MealPlan.user_id == current_user.id
    ).order_by(MealPlan.created_at.desc()).all()

    return plans


@router.get(
    "/plans/{plan_id}",
    response_model=MealPlanDetailResponse,
    summary="Get single meal plan details",
    description="Retrieve full details for a specific meal plan including all daily meals and their ingredients."
)
def get_meal_plan_by_id(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    plan = db.query(MealPlan).options(
        selectinload(MealPlan.meals).selectinload(Meal.ingredients)
    ).filter(
        MealPlan.id == plan_id,
        MealPlan.user_id == current_user.id
    ).first()

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )

    return plan


@router.get(
    "/{meal_id}",
    response_model=MealResponse,
    summary="Get single meal by ID",
    description="Retrieve an individual meal and its ingredients. Returns 404 if not found or unowned."
)
def get_meal_by_id(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    meal = db.query(Meal).options(
        selectinload(Meal.ingredients)
    ).filter(
        Meal.id == meal_id,
        Meal.user_id == current_user.id
    ).first()

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    return meal


# ----------------------------------------------------
# MEAL INGREDIENTS
# ----------------------------------------------------

@router.post(
    "/{meal_id}/ingredients",
    response_model=MealIngredientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add ingredient to a meal",
    description="Add an ingredient to an existing meal owned by the authenticated user."
)
def add_ingredient(
    meal_id: int,
    ingredient_data: MealIngredientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    meal = db.query(Meal).filter(
        Meal.id == meal_id,
        Meal.user_id == current_user.id
    ).first()

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    ingredient = MealIngredient(
        meal_id=meal.id,
        ingredient_name=ingredient_data.ingredient_name,
        quantity=ingredient_data.quantity,
        unit=ingredient_data.unit
    )

    db.add(ingredient)
    db.commit()
    db.refresh(ingredient)

    return ingredient


@router.get(
    "/{meal_id}/ingredients",
    response_model=List[MealIngredientResponse],
    summary="Get ingredients for a meal",
    description="Retrieve all ingredients for a specific meal owned by the authenticated user."
)
def get_ingredients(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    meal = db.query(Meal).filter(
        Meal.id == meal_id,
        Meal.user_id == current_user.id
    ).first()

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal not found"
        )

    ingredients = db.query(MealIngredient).filter(
        MealIngredient.meal_id == meal_id
    ).all()

    return ingredients


# ----------------------------------------------------
# AI MEAL GENERATION
# ----------------------------------------------------

@router.post(
    "/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate AI meal plan",
    description="Generate a balanced meal plan via Gemini AI based on budget, pantry, and dietary preferences."
)
def generate_meals(
    request: MealGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Generate an AI meal plan with strict Pydantic validation and transaction safety.
    """
    # 1. Fetch user's pantry items
    pantry_items = db.query(PantryItem).filter(
        PantryItem.user_id == current_user.id
    ).all()

    pantry_data = [
        {
            "name": item.item_name,
            "quantity": item.quantity,
            "unit": item.unit
        }
        for item in pantry_items
    ]

    # 2. Call AI service with strict validation
    try:
        validated_plan = generate_meal_plan(
            people=request.people,
            days=request.days,
            budget=request.budget,
            diet=request.diet,
            avoid=request.avoid,
            pantry_items=pantry_data
        )
    except AiValidationError as e:
        logger.warning("AI output failed validation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="AI generated an invalid meal plan structure"
        )
    except AiServiceError as e:
        logger.error("AI service error during meal generation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI generation service is currently unavailable"
        )
    except Exception as e:
        logger.error("Unexpected error in generate_meals AI step: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred while generating meal plan"
        )

    # 3. Save MealPlan + Meals + Ingredients in a single atomic database transaction
    try:
        meal_plan_record = MealPlan(
            user_id=current_user.id,
            number_of_people=request.people,
            number_of_days=request.days,
            budget=request.budget,
            diet=request.diet
        )
        db.add(meal_plan_record)
        db.flush()

        saved_meals = []

        for day_plan in validated_plan.meal_plan:
            day_num = day_plan.day

            meal_mapping = {
                "breakfast": day_plan.breakfast,
                "lunch": day_plan.lunch,
                "dinner": day_plan.dinner
            }

            for meal_type, meal_obj in meal_mapping.items():
                if not meal_obj:
                    continue

                meal = Meal(
                    user_id=current_user.id,
                    meal_plan_id=meal_plan_record.id,
                    day=f"day_{day_num}",
                    meal_type=meal_type,
                    meal_name=meal_obj.meal_name
                )
                db.add(meal)
                db.flush()

                for ing in meal_obj.ingredients:
                    meal_ingredient = MealIngredient(
                        meal_id=meal.id,
                        ingredient_name=ing.ingredient_name,
                        quantity=float(ing.quantity),
                        unit=ing.unit or "serving"
                    )
                    db.add(meal_ingredient)

                saved_meals.append(meal)

        db.commit()
        db.refresh(meal_plan_record)

        logger.info(
            "Successfully created meal plan id=%d with %d meals for user_id=%d",
            meal_plan_record.id, len(saved_meals), current_user.id
        )

        return {
            "message": "AI meal plan generated successfully",
            "meal_plan": validated_plan.model_dump(),
            "saved_meals": len(saved_meals),
            "meal_plan_id": meal_plan_record.id
        }

    except Exception as e:
        db.rollback()
        logger.error("Transaction failed during meal plan persistence: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save meal plan to database"
        )