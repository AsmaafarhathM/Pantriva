from pydantic import BaseModel, Field


class MealGenerationRequest(BaseModel):
    people: int = Field(
        gt=0,
        le=20
    )

    days: int = Field(
        gt=0,
        le=14
    )

    budget: float = Field(
        gt=0
    )

    diet: str = Field(
        min_length=1,
        max_length=50
    )

    avoid: list[str] = []