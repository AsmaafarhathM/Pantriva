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


# Fallback model priority chain
PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
FALLBACK_MODELS = [
    PRIMARY_MODEL,
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
]
# Remove duplicates while preserving order
MODELS_TO_TRY = list(dict.fromkeys(FALLBACK_MODELS))


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
    Uses automatic fallback across multiple Gemini models to prevent
    failures caused by temporary demand spikes or per-model quota limits.
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

    response = None
    last_error = None

    for model_name in MODELS_TO_TRY:
        try:
            logger.info("Attempting meal plan generation with model: %s", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=MealPlanResponseSchema,
                )
            )
            if response and response.text:
                logger.info("Successfully generated meal plan with model: %s", model_name)
                break
            else:
                logger.warning("Empty response from model %s, trying fallback...", model_name)
        except Exception as e:
            logger.warning(
                "Gemini model %s failed: %s (%s). Trying next fallback...",
                model_name,
                type(e).__name__,
                str(e)[:200]
            )
            last_error = e

    if not response or not response.text:
        logger.error("All Gemini models failed. Last error: %s", last_error)
        raise AiServiceError(
            f"Failed to communicate with AI generation service: {last_error or 'Empty response'}"
        )

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