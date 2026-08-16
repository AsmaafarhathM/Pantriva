import truststore
truststore.inject_into_ssl()

from fastapi import HTTPException
from database import SessionLocal
from models.user import User
from models.meal import Meal
from models.meal_plan import MealPlan
from models.meal_ingredient import MealIngredient
from models.grocery import GroceryItem

from schemas.meal import MealCreate, MealResponse, MealPlanResponse, MealPlanDetailResponse
from schemas.meal_ingredient import MealIngredientCreate
from schemas.grocery import GroceryItemCreate, GroceryResponse

from routers.meal import (
    get_meals,
    get_meal_by_id,
    get_meal_plans,
    get_meal_plan_by_id,
    create_meal,
    add_ingredient
)
from routers.grocery import (
    get_grocery_items,
    get_grocery_item_by_id,
    add_grocery_item
)

db = SessionLocal()

# Setup two distinct users for authorization & cross-user access testing
user_a = db.query(User).filter(User.email == "usera_phase4@example.com").first()
if not user_a:
    user_a = User(name="User A", email="usera_phase4@example.com", password_hash="hash_a")
    db.add(user_a)
    db.commit()
    db.refresh(user_a)

user_b = db.query(User).filter(User.email == "userb_phase4@example.com").first()
if not user_b:
    user_b = User(name="User B", email="userb_phase4@example.com", password_hash="hash_b")
    db.add(user_b)
    db.commit()
    db.refresh(user_b)

# Clean up existing test data for these users to ensure clean slate
db.query(MealIngredient).filter(
    MealIngredient.meal_id.in_(db.query(Meal.id).filter(Meal.user_id.in_([user_a.id, user_b.id])))
).delete(synchronize_session=False)
db.query(Meal).filter(Meal.user_id.in_([user_a.id, user_b.id])).delete(synchronize_session=False)
db.query(MealPlan).filter(MealPlan.user_id.in_([user_a.id, user_b.id])).delete(synchronize_session=False)
db.query(GroceryItem).filter(GroceryItem.user_id.in_([user_a.id, user_b.id])).delete(synchronize_session=False)
db.commit()

print("=" * 60)
print(f"PHASE 4 VERIFICATION TESTS (User A: {user_a.id}, User B: {user_b.id})")
print("=" * 60)

# ----------------------------------------------------
# TEST 1: Empty Data Retrieval
# ----------------------------------------------------
print("\n[TEST 1] Empty Data Handling (New User):")
a_meals_empty = get_meals(db=db, current_user=user_a)
a_plans_empty = get_meal_plans(db=db, current_user=user_a)
a_grocery_empty = get_grocery_items(db=db, current_user=user_a)

assert a_meals_empty == [], "Expected empty list for meals"
assert a_plans_empty == [], "Expected empty list for meal plans"
assert a_grocery_empty == [], "Expected empty list for grocery items"
print("PASS: Empty queries return [] without errors.")

# ----------------------------------------------------
# TEST 2: Meal Creation & Retrieval for User A
# ----------------------------------------------------
print("\n[TEST 2] Meal Creation and Retrieval for User A:")
created_meal = create_meal(
    meal_data=MealCreate(day="day_1", meal_type="breakfast", meal_name="Vegetable Poha"),
    db=db,
    current_user=user_a
)

# Add ingredient
add_ingredient(
    meal_id=created_meal.id,
    ingredient_data=MealIngredientCreate(ingredient_name="Poha", quantity=250.0, unit="g"),
    db=db,
    current_user=user_a
)

# User A retrieves single meal
meal_res = get_meal_by_id(meal_id=created_meal.id, db=db, current_user=user_a)
assert meal_res.id == created_meal.id
assert meal_res.meal_name == "Vegetable Poha"
assert len(meal_res.ingredients) == 1
assert meal_res.ingredients[0].ingredient_name == "Poha"
print(f"PASS: User A retrieved own meal (ID={meal_res.id}) with ingredients: {[i.ingredient_name for i in meal_res.ingredients]}")

# ----------------------------------------------------
# TEST 3: Cross-User Authorization on Meal
# ----------------------------------------------------
print("\n[TEST 3] Cross-User Meal Access (User B requesting User A's meal):")
try:
    get_meal_by_id(meal_id=created_meal.id, db=db, current_user=user_b)
    print("FAIL: User B was able to access User A's meal!")
except HTTPException as e:
    assert e.status_code == 404
    print(f"PASS: User B received HTTP {e.status_code} ({e.detail}) when accessing User A's meal.")

# User B meal list should not contain User A's meal
b_meals = get_meals(db=db, current_user=user_b)
assert len(b_meals) == 0
print("PASS: User B meal list is empty (User A's meal not leaked).")

# ----------------------------------------------------
# TEST 4: Meal Plan Creation, Eager Loading & Detail Retrieval
# ----------------------------------------------------
print("\n[TEST 4] Meal Plan Detail Retrieval with Nested Meals & Ingredients:")
plan_record = MealPlan(
    user_id=user_a.id,
    number_of_people=3,
    number_of_days=2,
    budget=1000.0,
    diet="vegetarian"
)
db.add(plan_record)
db.flush()

# Link the created meal to this meal plan
created_meal.meal_plan_id = plan_record.id
db.commit()

# User A fetches all plans
user_a_plans = get_meal_plans(db=db, current_user=user_a)
assert len(user_a_plans) == 1
assert user_a_plans[0].id == plan_record.id
print(f"PASS: User A retrieved meal plans list (Count={len(user_a_plans)}, Plan ID={user_a_plans[0].id})")

# User A fetches single plan detail
plan_detail = get_meal_plan_by_id(plan_id=plan_record.id, db=db, current_user=user_a)
assert plan_detail.id == plan_record.id
assert len(plan_detail.meals) == 1
assert plan_detail.meals[0].meal_name == "Vegetable Poha"
assert len(plan_detail.meals[0].ingredients) == 1
print(f"PASS: User A retrieved complete MealPlan #{plan_detail.id} with nested meals & ingredients.")

# ----------------------------------------------------
# TEST 5: Cross-User Authorization on Meal Plan
# ----------------------------------------------------
print("\n[TEST 5] Cross-User Meal Plan Access (User B requesting User A's plan):")
try:
    get_meal_plan_by_id(plan_id=plan_record.id, db=db, current_user=user_b)
    print("FAIL: User B was able to access User A's meal plan!")
except HTTPException as e:
    assert e.status_code == 404
    print(f"PASS: User B received HTTP {e.status_code} ({e.detail}) when accessing User A's meal plan.")

# ----------------------------------------------------
# TEST 6: Grocery Item Creation & Retrieval for User A
# ----------------------------------------------------
print("\n[TEST 6] Grocery Item Creation & Retrieval for User A:")
created_grocery = add_grocery_item(
    item_data=GroceryItemCreate(
        item_name="Wheat",
        category="Meal Ingredients",
        quantity=2.0,
        unit="kg",
        estimated_price=53.40
    ),
    db=db,
    current_user=user_a
)

a_groceries = get_grocery_items(db=db, current_user=user_a)
assert len(a_groceries) == 1
assert a_groceries[0].item_name == "Wheat"
assert a_groceries[0].estimated_price == 53.40
print(f"PASS: User A retrieved grocery list with item: {a_groceries[0].item_name} (Price=₹{a_groceries[0].estimated_price})")

# Single grocery item retrieval
single_grocery = get_grocery_item_by_id(item_id=created_grocery.id, db=db, current_user=user_a)
assert single_grocery.id == created_grocery.id
assert single_grocery.item_name == "Wheat"
print(f"PASS: User A retrieved single grocery item ID={single_grocery.id}")

# ----------------------------------------------------
# TEST 7: Cross-User Authorization on Grocery Items
# ----------------------------------------------------
print("\n[TEST 7] Cross-User Grocery Access:")
# User B grocery list should be empty
b_groceries = get_grocery_items(db=db, current_user=user_b)
assert len(b_groceries) == 0
print("PASS: User B grocery list does NOT contain User A's grocery items.")

# User B trying to access User A's grocery item by ID
try:
    get_grocery_item_by_id(item_id=created_grocery.id, db=db, current_user=user_b)
    print("FAIL: User B was able to access User A's grocery item!")
except HTTPException as e:
    assert e.status_code == 404
    print(f"PASS: User B received HTTP {e.status_code} ({e.detail}) accessing User A's grocery item.")

print("\n" + "=" * 60)
print("ALL PHASE 4 VERIFICATION TESTS PASSED SUCCESSFULLY!")
print("=" * 60)

db.close()
