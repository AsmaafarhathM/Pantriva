import truststore
truststore.inject_into_ssl()

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db, SessionLocal
from main import app
from models.user import User
from models.pantry import PantryItem
from models.meal import Meal
from models.meal_plan import MealPlan
from models.meal_ingredient import MealIngredient
from models.grocery import GroceryItem
from models.budget import Budget
from schemas.meal_generate import MealPlanResponseSchema
from services.ai import AiValidationError, AiServiceError

client = TestClient(app)


# ----------------------------------------------------
# PYTEST FIXTURES & DB SETUP
# ----------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database tables exist for integration tests."""
    db = SessionLocal()
    yield
    # Cleanup any created integration test users and their cascade data
    test_emails = [
        "int_usera@pantriva.com",
        "int_userb@pantriva.com",
        "rollback_user@pantriva.com"
    ]
    test_users = db.query(User).filter(User.email.in_(test_emails)).all()
    user_ids = [u.id for u in test_users]
    if user_ids:
        db.query(MealIngredient).filter(
            MealIngredient.meal_id.in_(db.query(Meal.id).filter(Meal.user_id.in_(user_ids)))
        ).delete(synchronize_session=False)
        db.query(Meal).filter(Meal.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(MealPlan).filter(MealPlan.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(GroceryItem).filter(GroceryItem.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(PantryItem).filter(PantryItem.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(Budget).filter(Budget.user_id.in_(user_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.commit()
    db.close()


@pytest.fixture
def auth_user_a():
    """Register and log in User A, returning auth headers."""
    email = "int_usera@pantriva.com"
    password = "SecurePassword123!"

    # Register
    client.post("/api/auth/register", json={
        "name": "Integration User A",
        "email": email,
        "password": password
    })

    # Login
    res = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "email": email}


@pytest.fixture
def auth_user_b():
    """Register and log in User B, returning auth headers."""
    email = "int_userb@pantriva.com"
    password = "SecurePassword456!"

    # Register
    client.post("/api/auth/register", json={
        "name": "Integration User B",
        "email": email,
        "password": password
    })

    # Login
    res = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "email": email}


# ----------------------------------------------------
# 1. AUTHENTICATION & LOGIN TESTS
# ----------------------------------------------------
def test_01_user_registration_and_login():
    email = "new_auth_test@pantriva.com"
    password = "ValidPassword789"

    # Clean up if existed
    db = SessionLocal()
    db.query(User).filter(User.email == email).delete()
    db.commit()
    db.close()

    # 1. Register
    reg_res = client.post("/api/auth/register", json={
        "name": "New Tester",
        "email": email,
        "password": password
    })
    assert reg_res.status_code == 200
    assert "user_id" in reg_res.json()

    # 2. Duplicate registration should fail
    dup_res = client.post("/api/auth/register", json={
        "name": "New Tester",
        "email": email,
        "password": password
    })
    assert dup_res.status_code == 400

    # 3. Valid Login
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()
    assert login_res.json()["token_type"] == "bearer"

    # 4. Invalid Login (wrong password)
    bad_pass_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPassword!"
    })
    assert bad_pass_res.status_code == 401

    # 5. Non-existent User Login
    ghost_res = client.post("/api/auth/login", json={
        "email": "nonexistent@pantriva.com",
        "password": "AnyPassword123"
    })
    assert ghost_res.status_code == 401


def test_02_jwt_protection_and_failure_modes():
    # Missing JWT
    res_no_jwt = client.get("/api/pantry/")
    assert res_no_jwt.status_code in [401, 403]

    # Invalid JWT
    res_bad_jwt = client.get("/api/pantry/", headers={"Authorization": "Bearer invalid.token.payload"})
    assert res_bad_jwt.status_code == 401


# ----------------------------------------------------
# 2. PANTRY CRUD TESTS
# ----------------------------------------------------
def test_03_pantry_workflow(auth_user_a):
    headers = {"Authorization": auth_user_a["Authorization"]}

    # 1. Add pantry item
    add_res = client.post("/api/pantry/", headers=headers, json={
        "item_name": "Wheat Flour",
        "category": "Grains",
        "quantity": 3.0,
        "unit": "kg"
    })
    assert add_res.status_code == 201
    item_id = add_res.json()["id"]
    assert add_res.json()["item_name"] == "Wheat Flour"

    # 2. Retrieve pantry items
    get_res = client.get("/api/pantry/", headers=headers)
    assert get_res.status_code == 200
    items = get_res.json()
    assert any(i["id"] == item_id for i in items)

    # 3. Update pantry item
    upd_res = client.put(f"/api/pantry/{item_id}", headers=headers, json={
        "item_name": "Whole Wheat Flour",
        "category": "Grains",
        "quantity": 4.5,
        "unit": "kg"
    })
    assert upd_res.status_code == 200
    assert upd_res.json()["quantity"] == 4.5
    assert upd_res.json()["item_name"] == "Whole Wheat Flour"

    # 4. Check expiry status endpoint
    exp_res = client.get("/api/pantry/expiry-status", headers=headers)
    assert exp_res.status_code == 200
    assert isinstance(exp_res.json(), list)

    # 5. Delete pantry item
    del_res = client.delete(f"/api/pantry/{item_id}", headers=headers)
    assert del_res.status_code == 200


# ----------------------------------------------------
# 3. AI MEAL PLAN GENERATION (MOCKED) & PERSISTENCE
# ----------------------------------------------------
@patch("routers.meal.generate_meal_plan")
def test_04_ai_meal_plan_generation_and_persistence(mock_generate_ai, auth_user_a):
    headers = {"Authorization": auth_user_a["Authorization"]}

    # Mocked Gemini AI output
    mocked_plan = MealPlanResponseSchema.model_validate({
        "meal_plan": [
            {
                "day": 1,
                "breakfast": {
                    "meal_name": "Oatmeal with Milk",
                    "ingredients": [
                        {"ingredient_name": "Oats", "quantity": 100.0, "unit": "g"},
                        {"ingredient_name": "Milk", "quantity": 250.0, "unit": "ml"}
                    ]
                },
                "lunch": {
                    "meal_name": "Dal Tadka with Rice",
                    "ingredients": [
                        {"ingredient_name": "Toor Dal", "quantity": 150.0, "unit": "g"},
                        {"ingredient_name": "Rice", "quantity": 200.0, "unit": "g"}
                    ]
                },
                "dinner": {
                    "meal_name": "Roti with Mixed Veg",
                    "ingredients": [
                        {"ingredient_name": "Wheat", "quantity": 200.0, "unit": "g"},
                        {"ingredient_name": "Tomato", "quantity": 100.0, "unit": "g"}
                    ]
                }
            }
        ]
    })
    mock_generate_ai.return_value = mocked_plan

    # Trigger Generation
    gen_res = client.post("/api/meals/generate", headers=headers, json={
        "people": 2,
        "days": 1,
        "budget": 600.0,
        "diet": "vegetarian",
        "avoid": ["eggplant"]
    })
    assert gen_res.status_code == 200
    data = gen_res.json()
    assert data["saved_meals"] == 3
    plan_id = data["meal_plan_id"]

    # Retrieve Meal Plans List
    plans_res = client.get("/api/meals/plans", headers=headers)
    assert plans_res.status_code == 200
    assert any(p["id"] == plan_id for p in plans_res.json())

    # Retrieve Single Meal Plan with full nested meals & ingredients
    plan_detail_res = client.get(f"/api/meals/plans/{plan_id}", headers=headers)
    assert plan_detail_res.status_code == 200
    detail = plan_detail_res.json()
    assert detail["id"] == plan_id
    assert len(detail["meals"]) == 3
    assert detail["meals"][0]["meal_name"] == "Oatmeal with Milk"
    assert len(detail["meals"][0]["ingredients"]) == 2

    # Retrieve Single Meal directly
    meal_id = detail["meals"][0]["id"]
    meal_res = client.get(f"/api/meals/{meal_id}", headers=headers)
    assert meal_res.status_code == 200
    assert meal_res.json()["meal_name"] == "Oatmeal with Milk"


# ----------------------------------------------------
# 4. AI FAILURE MODES
# ----------------------------------------------------
@patch("routers.meal.generate_meal_plan")
def test_05_ai_failure_handling(mock_generate_ai, auth_user_a):
    headers = {"Authorization": auth_user_a["Authorization"]}

    # 1. AI Service Error (e.g. network/quota issue) -> 502
    mock_generate_ai.side_effect = AiServiceError("Gemini service down")
    res_502 = client.post("/api/meals/generate", headers=headers, json={
        "people": 2,
        "days": 1,
        "budget": 500.0,
        "diet": "vegetarian"
    })
    assert res_502.status_code == 502

    # 2. AI Validation Error (malformed schema) -> 422
    mock_generate_ai.side_effect = AiValidationError("Invalid schema returned")
    res_422 = client.post("/api/meals/generate", headers=headers, json={
        "people": 2,
        "days": 1,
        "budget": 500.0,
        "diet": "vegetarian"
    })
    assert res_422.status_code == 422


# ----------------------------------------------------
# 5. GROCERY GENERATION & MOCKED CEDA PRICE ESTIMATION
# ----------------------------------------------------
@patch("services.grocery_generator.estimate_price")
def test_06_grocery_generation_and_budget(mock_estimate_price, auth_user_a):
    headers = {"Authorization": auth_user_a["Authorization"]}

    # Mock CEDA price return for ingredients
    def side_effect_price(item_name, quantity, unit):
        if "wheat" in item_name.lower():
            return {"estimated_price": 53.40, "price_available": True, "price_per_kg": 26.70, "source": "CEDA"}
        elif "rice" in item_name.lower():
            return {"estimated_price": 32.50, "price_available": True, "price_per_kg": 32.50, "source": "CEDA"}
        elif "tomato" in item_name.lower():
            return {"estimated_price": 28.00, "price_available": True, "price_per_kg": 28.00, "source": "CEDA"}
        else:
            # Unpriced item (e.g. special spice)
            return {"estimated_price": None, "price_available": False, "source": "CEDA"}

    mock_estimate_price.side_effect = side_effect_price

    # Generate grocery list from user's planned meals
    gen_res = client.post("/api/grocery/generate", headers=headers)
    assert gen_res.status_code == 200
    data = gen_res.json()
    assert "items" in data
    assert "budget_summary" in data

    # Verify budget calculations
    budget_sum = data["budget_summary"]
    assert "budget" in budget_sum
    assert "total_estimated_cost" in budget_sum
    assert "remaining_budget" in budget_sum
    assert budget_sum["status"] in ["within_budget", "over_budget", "partially_estimated"]

    # Verify grocery list retrieval
    grocery_list_res = client.get("/api/grocery/", headers=headers)
    assert grocery_list_res.status_code == 200
    items = grocery_list_res.json()
    assert len(items) > 0

    # Retrieve single grocery item
    single_item_id = items[0]["id"]
    single_res = client.get(f"/api/grocery/{single_item_id}", headers=headers)
    assert single_res.status_code == 200
    assert single_res.json()["id"] == single_item_id

    # Toggle purchased status
    patch_res = client.patch(f"/api/grocery/{single_item_id}/purchase", headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["is_purchased"] is True


# ----------------------------------------------------
# 6. USER ISOLATION & IDOR ATTACK PREVENTION
# ----------------------------------------------------
def test_07_cross_user_isolation(auth_user_a, auth_user_b):
    headers_a = {"Authorization": auth_user_a["Authorization"]}
    headers_b = {"Authorization": auth_user_b["Authorization"]}

    # User A creates a private pantry item
    res_a_pantry = client.post("/api/pantry/", headers=headers_a, json={
        "item_name": "User A Private Almonds",
        "category": "Nuts",
        "quantity": 1.0,
        "unit": "kg"
    })
    item_a_id = res_a_pantry.json()["id"]

    # User A creates a private grocery item
    res_a_grocery = client.post("/api/grocery/", headers=headers_a, json={
        "item_name": "User A Secret Spices",
        "category": "Spices",
        "quantity": 100.0,
        "unit": "g",
        "estimated_price": 50.0
    })
    grocery_a_id = res_a_grocery.json()["id"]

    # User A creates a private custom meal
    res_a_meal = client.post("/api/meals/", headers=headers_a, json={
        "day": "day_1",
        "meal_type": "dinner",
        "meal_name": "User A Private Feast"
    })
    meal_a_id = res_a_meal.json()["id"]

    # 1. User B attempts to GET User A's pantry item -> 404
    assert client.get(f"/api/pantry/{item_a_id}", headers=headers_b).status_code == 404

    # 2. User B attempts to UPDATE User A's pantry item -> 404
    assert client.put(f"/api/pantry/{item_a_id}", headers=headers_b, json={
        "item_name": "Hacked", "category": "Nuts", "quantity": 10.0, "unit": "kg"
    }).status_code == 404

    # 3. User B attempts to DELETE User A's pantry item -> 404
    assert client.delete(f"/api/pantry/{item_a_id}", headers=headers_b).status_code == 404

    # 4. User B attempts to GET User A's grocery item -> 404
    assert client.get(f"/api/grocery/{grocery_a_id}", headers=headers_b).status_code == 404

    # 5. User B attempts to DELETE User A's grocery item -> 404
    assert client.delete(f"/api/grocery/{grocery_a_id}", headers=headers_b).status_code == 404

    # 6. User B attempts to GET User A's meal -> 404
    assert client.get(f"/api/meals/{meal_a_id}", headers=headers_b).status_code == 404

    # 7. User B's list endpoints do not contain User A's data
    b_pantry = client.get("/api/pantry/", headers=headers_b).json()
    assert not any(i["id"] == item_a_id for i in b_pantry)

    b_grocery = client.get("/api/grocery/", headers=headers_b).json()
    assert not any(i["id"] == grocery_a_id for i in b_grocery)

    b_meals = client.get("/api/meals/", headers=headers_b).json()
    assert not any(m["id"] == meal_a_id for m in b_meals)
