import truststore
truststore.inject_into_ssl()

import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from pydantic import ValidationError
from jose import jwt

from config import JWT_SECRET, JWT_ALGORITHM
from database import SessionLocal
from models.user import User
from models.pantry import PantryItem
from models.meal import Meal
from models.meal_plan import MealPlan
from models.meal_ingredient import MealIngredient
from models.grocery import GroceryItem
from models.budget import Budget

from schemas.user import UserCreate, UserLogin
from schemas.pantry import PantryItemCreate
from schemas.meal import MealCreate
from schemas.meal_generate import MealGenerateRequest, MealPlanResponseSchema
from schemas.grocery import GroceryItemCreate
from schemas.budget import BudgetCreate

from services.security import hash_password, verify_password, create_access_token
from services.auth import get_current_user
from services.grocery_generator import generate_grocery_from_meals

from routers.pantry import (
    add_pantry_item,
    get_pantry_items,
    update_pantry_item,
    delete_pantry_item
)
from routers.meal import (
    create_meal,
    get_meals,
    get_meal_by_id,
    get_meal_plans,
    get_meal_plan_by_id,
    add_ingredient,
    get_ingredients,
    generate_meals
)
from routers.grocery import (
    add_grocery_item,
    get_grocery_items,
    get_grocery_item_by_id,
    update_grocery_item,
    delete_grocery_item,
    generate_grocery_list
)
from routers.budget import (
    set_budget,
    get_budget,
    get_budget_summary
)


class TestSecuritySuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

        # Create User A
        cls.user_a = cls.db.query(User).filter(User.email == "sec_usera@example.com").first()
        if not cls.user_a:
            cls.user_a = User(
                name="Security User A",
                email="sec_usera@example.com",
                password_hash=hash_password("SuperSecretPass123")
            )
            cls.db.add(cls.user_a)
            cls.db.commit()
            cls.db.refresh(cls.user_a)

        # Create User B
        cls.user_b = cls.db.query(User).filter(User.email == "sec_userb@example.com").first()
        if not cls.user_b:
            cls.user_b = User(
                name="Security User B",
                email="sec_userb@example.com",
                password_hash=hash_password("SuperSecretPass456")
            )
            cls.db.add(cls.user_b)
            cls.db.commit()
            cls.db.refresh(cls.user_b)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        # Clean slate before each test for test users
        u_ids = [self.user_a.id, self.user_b.id]
        self.db.query(MealIngredient).filter(
            MealIngredient.meal_id.in_(self.db.query(Meal.id).filter(Meal.user_id.in_(u_ids)))
        ).delete(synchronize_session=False)
        self.db.query(Meal).filter(Meal.user_id.in_(u_ids)).delete(synchronize_session=False)
        self.db.query(MealPlan).filter(MealPlan.user_id.in_(u_ids)).delete(synchronize_session=False)
        self.db.query(GroceryItem).filter(GroceryItem.user_id.in_(u_ids)).delete(synchronize_session=False)
        self.db.query(PantryItem).filter(PantryItem.user_id.in_(u_ids)).delete(synchronize_session=False)
        self.db.query(Budget).filter(Budget.user_id.in_(u_ids)).delete(synchronize_session=False)
        self.db.commit()

    # ----------------------------------------------------
    # 1. JWT Security & Validation
    # ----------------------------------------------------
    def test_01_jwt_validation_and_tampering(self):
        # Valid token
        token = create_access_token(self.user_a.id)
        auth_cred = MagicMock(credentials=token)
        authenticated = get_current_user(credentials=auth_cred, db=self.db)
        self.assertEqual(authenticated.id, self.user_a.id)

        # Invalid signature / tampered token
        tampered_token = token[:-5] + "XXXXX"
        bad_cred = MagicMock(credentials=tampered_token)
        with self.assertRaises(HTTPException) as cm:
            get_current_user(credentials=bad_cred, db=self.db)
        self.assertEqual(cm.exception.status_code, 401)

        # Token with non-existent user ID
        ghost_token = jwt.encode({"sub": "99999999", "exp": 9999999999}, JWT_SECRET, algorithm=JWT_ALGORITHM)
        ghost_cred = MagicMock(credentials=ghost_token)
        with self.assertRaises(HTTPException) as cm:
            get_current_user(credentials=ghost_cred, db=self.db)
        self.assertEqual(cm.exception.status_code, 401)

    # ----------------------------------------------------
    # 2. Password Security & Bcrypt Hashing
    # ----------------------------------------------------
    def test_02_password_security(self):
        raw_pass = "SecurePass#2026"
        hashed = hash_password(raw_pass)

        self.assertNotEqual(raw_pass, hashed)
        self.assertTrue(hashed.startswith("$2b$") or hashed.startswith("$2a$"))
        self.assertTrue(verify_password(raw_pass, hashed))
        self.assertFalse(verify_password("WrongPassword123", hashed))

    # ----------------------------------------------------
    # 3. Pantry IDOR & Ownership (GET, PUT, DELETE)
    # ----------------------------------------------------
    def test_03_pantry_idor_protection(self):
        # User A creates item
        item_a = add_pantry_item(
            item_data=PantryItemCreate(item_name="Rice", category="Grains", quantity=5.0, unit="kg"),
            db=self.db,
            current_user=self.user_a
        )
        self.assertEqual(item_a.user_id, self.user_a.id)

        # User B cannot see User A's pantry list
        b_pantry = get_pantry_items(db=self.db, current_user=self.user_b)
        self.assertEqual(len(b_pantry), 0)

        # User B cannot update User A's pantry item -> 404
        with self.assertRaises(HTTPException) as cm:
            update_pantry_item(
                item_id=item_a.id,
                item_data=PantryItemCreate(item_name="Hacked", category="Grains", quantity=100.0, unit="kg"),
                db=self.db,
                current_user=self.user_b
            )
        self.assertEqual(cm.exception.status_code, 404)

        # User B cannot delete User A's pantry item -> 404
        with self.assertRaises(HTTPException) as cm:
            delete_pantry_item(item_id=item_a.id, db=self.db, current_user=self.user_b)
        self.assertEqual(cm.exception.status_code, 404)

        # Verify item was not deleted
        self.assertIsNotNone(self.db.query(PantryItem).filter(PantryItem.id == item_a.id).first())

    # ----------------------------------------------------
    # 4. Meal & Ingredient IDOR & Ownership
    # ----------------------------------------------------
    def test_04_meal_and_ingredient_idor_protection(self):
        # User A creates meal
        meal_a = create_meal(
            meal_data=MealCreate(day="day_1", meal_type="lunch", meal_name="User A Meal"),
            db=self.db,
            current_user=self.user_a
        )
        ing_a = add_ingredient(
            meal_id=meal_a.id,
            ingredient_data=MagicMock(ingredient_name="Paneer", quantity=200.0, unit="g"),
            db=self.db,
            current_user=self.user_a
        )

        # User B cannot read User A's meal by ID -> 404
        with self.assertRaises(HTTPException) as cm:
            get_meal_by_id(meal_id=meal_a.id, db=self.db, current_user=self.user_b)
        self.assertEqual(cm.exception.status_code, 404)

        # User B cannot add ingredient to User A's meal -> 404
        with self.assertRaises(HTTPException) as cm:
            add_ingredient(
                meal_id=meal_a.id,
                ingredient_data=MagicMock(ingredient_name="Poison", quantity=10.0, unit="g"),
                db=self.db,
                current_user=self.user_b
            )
        self.assertEqual(cm.exception.status_code, 404)

        # User B cannot get ingredients of User A's meal -> 404
        with self.assertRaises(HTTPException) as cm:
            get_ingredients(meal_id=meal_a.id, db=self.db, current_user=self.user_b)
        self.assertEqual(cm.exception.status_code, 404)

    # ----------------------------------------------------
    # 5. Meal Plan IDOR & Nested Meal Isolation
    # ----------------------------------------------------
    def test_05_meal_plan_idor_protection(self):
        plan_a = MealPlan(
            user_id=self.user_a.id,
            number_of_people=2,
            number_of_days=1,
            budget=500.0,
            diet="vegetarian"
        )
        self.db.add(plan_a)
        self.db.commit()
        self.db.refresh(plan_a)

        # User B cannot retrieve User A's meal plan -> 404
        with self.assertRaises(HTTPException) as cm:
            get_meal_plan_by_id(plan_id=plan_a.id, db=self.db, current_user=self.user_b)
        self.assertEqual(cm.exception.status_code, 404)

        # User B's meal plan list is empty
        b_plans = get_meal_plans(db=self.db, current_user=self.user_b)
        self.assertEqual(len(b_plans), 0)

    # ----------------------------------------------------
    # 6. Grocery IDOR & Ownership (GET, PUT, DELETE)
    # ----------------------------------------------------
    def test_06_grocery_idor_protection(self):
        item_a = add_grocery_item(
            item_data=GroceryItemCreate(item_name="Wheat Flour", category="Grains", quantity=2.0, unit="kg", estimated_price=53.4),
            db=self.db,
            current_user=self.user_a
        )

        # User B cannot read User A's grocery item -> 404
        with self.assertRaises(HTTPException) as cm:
            get_grocery_item_by_id(item_id=item_a.id, db=self.db, current_user=self.user_b)
        self.assertEqual(cm.exception.status_code, 404)

        # User B cannot update User A's grocery item -> 404
        with self.assertRaises(HTTPException) as cm:
            update_grocery_item(
                item_id=item_a.id,
                item_data=GroceryItemCreate(item_name="Hacked", category="Grains", quantity=1.0, unit="kg"),
                db=self.db,
                current_user=self.user_b
            )
        self.assertEqual(cm.exception.status_code, 404)

        # User B cannot delete User A's grocery item -> 404
        with self.assertRaises(HTTPException) as cm:
            delete_grocery_item(item_id=item_a.id, db=self.db, current_user=self.user_b)
        self.assertEqual(cm.exception.status_code, 404)

    # ----------------------------------------------------
    # 7. Mass Assignment Protection
    # ----------------------------------------------------
    def test_07_mass_assignment_protection(self):
        # Even if a malicious request attempts to inject user_id, backend assigns current_user.id
        item = add_pantry_item(
            item_data=PantryItemCreate(item_name="Salt", category="Spices", quantity=1.0, unit="kg"),
            db=self.db,
            current_user=self.user_a
        )
        self.assertEqual(item.user_id, self.user_a.id)
        self.assertNotEqual(item.user_id, self.user_b.id)

    # ----------------------------------------------------
    # 8. Input Validation & Boundary Testing
    # ----------------------------------------------------
    def test_08_input_validation(self):
        # Negative quantity
        with self.assertRaises(ValidationError):
            PantryItemCreate(item_name="Sugar", category="Sweeteners", quantity=-5.0, unit="kg")

        # Zero quantity
        with self.assertRaises(ValidationError):
            PantryItemCreate(item_name="Sugar", category="Sweeteners", quantity=0.0, unit="kg")

        # Invalid budget input
        with self.assertRaises(ValidationError):
            MealGenerateRequest(people=0, days=5, budget=-100.0, diet="veg")

        # Invalid email format
        with self.assertRaises(ValidationError):
            UserCreate(name="Bad Email", email="notanemail", password="ValidPassword123")

        # Short password (< 8 characters)
        with self.assertRaises(ValidationError):
            UserCreate(name="Short Pass", email="test@example.com", password="short")

    # ----------------------------------------------------
    # 9. AI Generation User-Scoped Isolation (Mocked)
    # ----------------------------------------------------
    @patch("routers.meal.generate_meal_plan")
    def test_09_meal_generation_pantry_isolation(self, mock_generate_ai):
        mock_plan = MealPlanResponseSchema.model_validate({
            "meal_plan": [
                {
                    "day": 1,
                    "breakfast": {"meal_name": "Poha", "ingredients": [{"ingredient_name": "Poha", "quantity": 100.0, "unit": "g"}]},
                    "lunch": {"meal_name": "Rice", "ingredients": [{"ingredient_name": "Rice", "quantity": 100.0, "unit": "g"}]},
                    "dinner": {"meal_name": "Roti", "ingredients": [{"ingredient_name": "Atta", "quantity": 100.0, "unit": "g"}]}
                }
            ]
        })
        mock_generate_ai.return_value = mock_plan

        # User A has Tomato in pantry
        add_pantry_item(PantryItemCreate(item_name="Tomato", category="Vegetables", quantity=2.0, unit="kg"), db=self.db, current_user=self.user_a)
        # User B has Potato in pantry
        add_pantry_item(PantryItemCreate(item_name="Potato", category="Vegetables", quantity=5.0, unit="kg"), db=self.db, current_user=self.user_b)

        # Generate for User A
        req = MealGenerateRequest(people=2, days=1, budget=500.0, diet="vegetarian")
        generate_meals(request=req, db=self.db, current_user=self.user_a)

        # Verify AI was called ONLY with User A's pantry (Tomato), NOT User B's (Potato)
        call_args = mock_generate_ai.call_args[1]
        passed_pantry_names = [p["name"] for p in call_args["pantry_items"]]
        self.assertIn("Tomato", passed_pantry_names)
        self.assertNotIn("Potato", passed_pantry_names)

    # ----------------------------------------------------
    # 10. Grocery Generation Isolation
    # ----------------------------------------------------
    @patch("services.grocery_generator.estimate_price")
    def test_10_grocery_generation_user_isolation(self, mock_estimate):
        mock_estimate.return_value = {"estimated_price": 25.0, "price_available": True}

        # User A has meal requiring Rice
        meal_a = Meal(user_id=self.user_a.id, day="day_1", meal_type="lunch", meal_name="Rice Dish")
        self.db.add(meal_a)
        self.db.flush()
        self.db.add(MealIngredient(meal_id=meal_a.id, ingredient_name="Rice", quantity=500.0, unit="g"))

        # User B has meal requiring Wheat
        meal_b = Meal(user_id=self.user_b.id, day="day_1", meal_type="lunch", meal_name="Wheat Dish")
        self.db.add(meal_b)
        self.db.flush()
        self.db.add(MealIngredient(meal_id=meal_b.id, ingredient_name="Wheat", quantity=1.0, unit="kg"))
        self.db.commit()

        # Generate groceries for User A
        groceries_a = generate_grocery_from_meals(db=self.db, user_id=self.user_a.id)
        item_names_a = [g.item_name for g in groceries_a]

        self.assertIn("Rice", item_names_a)
        self.assertNotIn("Wheat", item_names_a)

    # ----------------------------------------------------
    # 11. Database Cascade Integrity
    # ----------------------------------------------------
    def test_11_database_cascade_integrity(self):
        plan = MealPlan(user_id=self.user_a.id, number_of_people=2, number_of_days=1, budget=500.0, diet="veg")
        self.db.add(plan)
        self.db.flush()

        meal = Meal(user_id=self.user_a.id, meal_plan_id=plan.id, day="day_1", meal_type="dinner", meal_name="Dal")
        self.db.add(meal)
        self.db.flush()

        ing = MealIngredient(meal_id=meal.id, ingredient_name="Lentils", quantity=100.0, unit="g")
        self.db.add(ing)
        self.db.commit()

        meal_id = meal.id
        ing_id = ing.id

        # Delete Meal -> cascade deletes MealIngredient
        self.db.delete(meal)
        self.db.commit()

        self.assertIsNone(self.db.query(MealIngredient).filter(MealIngredient.id == ing_id).first())


if __name__ == "__main__":
    unittest.main()
