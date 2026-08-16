from datetime import datetime
from typing import List

from sqlalchemy import String, DateTime, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    number_of_people: Mapped[int] = mapped_column(
        nullable=False
    )

    number_of_days: Mapped[int] = mapped_column(
        nullable=False
    )

    budget: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    diet: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Relationships
    meals = relationship("Meal", back_populates="meal_plan", cascade="all, delete-orphan")