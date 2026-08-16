import truststore
truststore.inject_into_ssl()

import os
import json
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import ValidationError

from schemas.meal_generate import MealPlanResponseSchema

logger = logging.getLogger(__name__)

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


class AiServiceError(Exception):
    """Custom exception for Gemini AI service errors without leaking keys or raw trace."""
    pass


class AiValidationError(Exception):
    """Custom exception when AI output fails strict Pydantic validation."""
    pass


def _get_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise AiServiceError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=GEMINI_API_KEY)


def generate_meal_plan(
    people: int,
    days: int,
    budget: float,
    diet: str,
    avoid: list[str],
    pantry_items: list[dict]
) -> MealPlanResponseSchema:
    """
    Generate and validate a structured meal plan using Gemini AI.
    Guarantees strict Pydantic validation of the response before returning.
    """
    client = _get_client()

    pantry_text = "\n".join(
        f"- {item['name']}: {item['quantity']} {item['unit']}"
        for item in pantry_items
    ) if pantry_items else "No items in pantry"

    avoid_text = ", ".join(avoid) if avoid else "None"

    prompt = f"""
You are a meal planning assistant for Pantriva.

Create a practical meal plan based on the following details:
- Number of people: {people}
- Number of days: {days}
- Budget: ₹{budget}
- Diet: {diet}
- Foods to avoid: {avoid_text}
- Available pantry items:
{pantry_text}

Requirements:
- Create breakfast, lunch, and dinner for each day (day 1 to {days}).
- Scale ingredient quantities accurately for {people} people.
- Prefer using available pantry items where possible.
- Strictly avoid the specified foods to avoid.
- Keep meals practical, culturally relevant, and cost-effective within the budget.
- For each ingredient, provide a numeric quantity and a standard unit (e.g. g, kg, pieces, tbsp).
"""

    try:
        response = client.models.generate_content(
            model="gemini-flash-latest",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MealPlanResponseSchema,
            )
        )
    except Exception as e:
        logger.error("Gemini API request failed: %s", type(e).__name__)
        raise AiServiceError("Failed to communicate with AI generation service") from None

    if not response or not response.text:
        logger.error("Empty response received from Gemini API")
        raise AiServiceError("Empty response from AI service")

    try:
        raw_json = json.loads(response.text)
    except json.JSONDecodeError as e:
        logger.error("Gemini output is not valid JSON: %s", e)
        raise AiValidationError("AI service returned malformed JSON") from None

    try:
        validated_plan = MealPlanResponseSchema.model_validate(raw_json)
        return validated_plan
    except ValidationError as e:
        logger.error("Pydantic validation failed on AI meal plan: %s", e)
        raise AiValidationError(f"AI response failed schema validation: {e}") from None