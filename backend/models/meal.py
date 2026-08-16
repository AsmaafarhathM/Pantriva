from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    meal_plan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("meal_plans.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    day: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    meal_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    meal_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Relationships
    meal_plan = relationship("MealPlan", back_populates="meals")
    ingredients = relationship("MealIngredient", back_populates="meal", cascade="all, delete-orphan")