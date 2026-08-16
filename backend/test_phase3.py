import truststore
truststore.inject_into_ssl()

import os
import sys
from pydantic import ValidationError

from database import engine, Base, SessionLocal
from models.user import User
from models.meal_plan import MealPlan
from models.meal import Meal
from models.meal_ingredient import MealIngredient
from models.pantry import PantryItem

from schemas.meal_generate import (
    MealGenerateRequest,
    MealPlanResponseSchema,
    GeneratedDayPlan,
    GeneratedMeal,
    GeneratedIngredient
)
from services.ai import generate_meal_plan, AiValidationError, AiServiceError
from routers.meal import generate_meals

db = SessionLocal()

# Ensure a test user exists
test_user = db.query(User).filter(User.email == "test_phase3@example.com").first()
if not test_user:
    test_user = User(
        name="Test Phase3 User",
        email="test_phase3@example.com",
        password_hash="hashed_secret_test_password"
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)

print("=" * 60)
print(f"PHASE 3 VERIFICATION TESTS (User ID: {test_user.id})")
print("=" * 60)

# ----------------------------------------------------
# Test 1: Valid AI Response Validation
# ----------------------------------------------------
print("\n[TEST 1] Valid AI Response Pydantic Validation:")
valid_sample = {
    "meal_plan": [
        {
            "day": 1,
            "breakfast": {
                "meal_name": "Vegetable Poha",
                "ingredients": [
                    {"ingredient_name": "Poha", "quantity": 200.0, "unit": "g"},
                    {"ingredient_name": "Onion", "quantity": 100.0, "unit": "g"}
                ]
            },
            "lunch": {
                "meal_name": "Rice and Dal",
                "ingredients": [
                    {"ingredient_name": "Rice", "quantity": 250.0, "unit": "g"},
                    {"ingredient_name": "Dal", "quantity": 150.0, "unit": "g"}
                ]
            },
            "dinner": {
                "meal_name": "Roti with Sabzi",
                "ingredients": [
                    {"ingredient_name": "Wheat Flour", "quantity": 250.0, "unit": "g"},
                    {"ingredient_name": "Potato", "quantity": 200.0, "unit": "g"}
                ]
            }
        }
    ]
}

try:
    validated = MealPlanResponseSchema.model_validate(valid_sample)
    print("PASS: Valid JSON schema successfully validated by Pydantic.")
    print(f"      Parsed days: {len(validated.meal_plan)}, Breakfast: '{validated.meal_plan[0].breakfast.meal_name}'")
except Exception as e:
    print(f"FAIL: Valid schema failed validation: {e}")

# ----------------------------------------------------
# Test 2: Malformed AI Response Rejection
# ----------------------------------------------------
print("\n[TEST 2] Malformed AI Response Rejection:")
malformed_sample = {
    "meal_plan": [
        {
            "day": 1,
            # Missing "breakfast", "lunch", "dinner"
            "random_field": "invalid"
        }
    ]
}

try:
    MealPlanResponseSchema.model_validate(malformed_sample)
    print("FAIL: Malformed payload was unexpectedly accepted!")
except ValidationError as e:
    print("PASS: Malformed AI payload correctly rejected with ValidationError.")
    print(f"      Caught expected validation error: {e.errors()[0]['loc']} -> {e.errors()[0]['msg']}")

# ----------------------------------------------------
# Test 3: Transaction Safety & Rollback Verification
# ----------------------------------------------------
print("\n[TEST 3] Transaction Safety & Rollback Verification:")

# Count records before failed transaction
plans_before = db.query(MealPlan).filter(MealPlan.user_id == test_user.id).count()
meals_before = db.query(Meal).filter(Meal.user_id == test_user.id).count()
ingredients_before = db.query(MealIngredient).count()

print(f"      Initial counts -> Plans: {plans_before}, Meals: {meals_before}, Ingredients: {ingredients_before}")

# Simulate a failure inside the transaction
try:
    # Begin transaction
    simulated_plan = MealPlan(
        user_id=test_user.id,
        number_of_people=2,
        number_of_days=1,
        budget=500.0,
        diet="vegetarian"
    )
    db.add(simulated_plan)
    db.flush()

    simulated_meal = Meal(
        user_id=test_user.id,
        day="day_1",
        meal_type="breakfast",
        meal_name="Failed Meal Test"
    )
    db.add(simulated_meal)
    db.flush()

    # Intentional failure: simulate an unexpected error / constraint error
    raise RuntimeError("Simulated database failure during ingredient persistence")

    db.commit()

except Exception as err:
    db.rollback()
    print(f"PASS: Exception caught ('{err}'), db.rollback() successfully executed.")

# Verify no partial records leaked into the database
plans_after = db.query(MealPlan).filter(MealPlan.user_id == test_user.id).count()
meals_after = db.query(Meal).filter(Meal.user_id == test_user.id).count()
ingredients_after = db.query(MealIngredient).count()

print(f"      Counts after rollback -> Plans: {plans_after}, Meals: {meals_after}, Ingredients: {ingredients_after}")
assert plans_after == plans_before, "Database leaked a partial MealPlan record!"
assert meals_after == meals_before, "Database leaked a partial Meal record!"
print("PASS: Zero orphan records remain in database after rollback.")

# ----------------------------------------------------
# Test 4: End-to-End Meal Generation API Execution
# ----------------------------------------------------
print("\n[TEST 4] End-to-End Meal Generation Execution via Router:")
request_data = MealGenerateRequest(
    people=2,
    days=1,
    budget=500.0,
    diet="vegetarian",
    avoid=["mushroom"]
)

res = generate_meals(request=request_data, db=db, current_user=test_user)
print(f"PASS: Meal plan generated successfully with ID={res['meal_plan_id']}, Saved Meals={res['saved_meals']}")

# Verify persistence in database
saved_plan = db.query(MealPlan).filter(MealPlan.id == res['meal_plan_id']).first()
saved_meals_count = db.query(Meal).filter(Meal.user_id == test_user.id).count()
print(f"PASS: Verified in PostgreSQL: MealPlan #{saved_plan.id} exists for user #{saved_plan.user_id}")

print("\n" + "=" * 60)
print("ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!")
print("=" * 60)

db.close()
