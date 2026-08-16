import truststore
truststore.inject_into_ssl()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from config import CORS_ORIGINS
from database import engine, Base

from models.user import User
from models.pantry import PantryItem
from models.grocery import GroceryItem
from models.budget import Budget
from models.meal import Meal
from models.meal_ingredient import MealIngredient
from models.meal_plan import MealPlan

from routers.meal import router as meal_router
from routers.auth import router as auth_router
from routers.pantry import router as pantry_router
from routers.grocery import router as grocery_router
from routers.budget import router as budget_router

app = FastAPI(
    title="Pantriva Backend API",
    description="AI-powered meal planning and grocery management system with Indian agricultural market pricing.",
    version="1.0.0"
)

# Configure CORS Middleware with explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth_router)
app.include_router(pantry_router)
app.include_router(grocery_router)
app.include_router(budget_router)
app.include_router(meal_router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


@app.get("/db-health", tags=["Health"])
def db_health():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return {
            "database": result.scalar()
        }