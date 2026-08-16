import time
import logging
import truststore
truststore.inject_into_ssl()

import requests
from config import CEDA_API_KEY

logger = logging.getLogger(__name__)

CEDA_BASE_URL = "https://api.ceda.ashoka.edu.in/v1"
DEFAULT_TIMEOUT = 10
MAX_RETRIES = 2


class CedaApiError(Exception):
    """Custom exception for CEDA API errors that never leaks API credentials."""
    pass


def _validate_api_key():
    if not CEDA_API_KEY:
        raise CedaApiError("CEDA_API_KEY is not configured in environment")


def _get_headers() -> dict:
    _validate_api_key()
    return {
        "Authorization": f"Bearer {CEDA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }


def _execute_with_retry(method: str, url: str, **kwargs) -> dict:
    """Execute HTTP request with safe retry on 429 rate limit without leaking credentials."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            if method.lower() == "get":
                response = requests.get(url, timeout=DEFAULT_TIMEOUT, **kwargs)
            else:
                response = requests.post(url, timeout=DEFAULT_TIMEOUT, **kwargs)

            if response.status_code == 429:
                if attempt < MAX_RETRIES:
                    wait_sec = 2 * (attempt + 1)
                    logger.warning("CEDA rate limit (429) hit for %s. Retrying in %ds...", url, wait_sec)
                    time.sleep(wait_sec)
                    continue
                else:
                    logger.warning("CEDA rate limit (429) exceeded for %s", url)
                    return {"output": {"type": "error", "message": "Rate limit exceeded", "data": []}}

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else "unknown"
            logger.error("CEDA HTTP error: status %s for url %s", status, url)
            if status == 429:
                return {"output": {"type": "error", "message": "Rate limit exceeded", "data": []}}
            raise CedaApiError(f"CEDA request failed with status code {status}") from None
        except requests.exceptions.RequestException as e:
            logger.error("CEDA connection error: %s", type(e).__name__)
            raise CedaApiError("Failed to connect to CEDA API") from None

    return {"output": {"type": "error", "message": "Max retries exceeded", "data": []}}


def get_commodities() -> dict:
    """Fetch all available commodities from CEDA."""
    url = f"{CEDA_BASE_URL}/agmarknet/commodities"
    headers = {
        "Authorization": f"Bearer {CEDA_API_KEY}",
        "Accept": "application/json"
    }
    _validate_api_key()
    return _execute_with_retry("get", url, headers=headers)


def get_geographies() -> dict:
    """Fetch state and district mappings from CEDA."""
    url = f"{CEDA_BASE_URL}/agmarknet/geographies"
    headers = {
        "Authorization": f"Bearer {CEDA_API_KEY}",
        "Accept": "application/json"
    }
    _validate_api_key()
    return _execute_with_retry("get", url, headers=headers)


def get_markets(
    commodity_id: int,
    state_id: int,
    district_id: int,
    indicator: str = "price"
) -> dict:
    """Fetch available markets for a given commodity, state, and district."""
    url = f"{CEDA_BASE_URL}/agmarknet/markets"
    headers = _get_headers()
    payload = {
        "commodity_id": commodity_id,
        "state_id": state_id,
        "district_id": district_id,
        "indicator": indicator
    }
    return _execute_with_retry("post", url, headers=headers, json=payload)


def get_prices(
    commodity_id: int,
    state_id: int,
    district_ids: list[int],
    market_ids: list[int],
    from_date: str,
    to_date: str
) -> dict:
    """Fetch mandi prices for specific commodity, districts, and markets within a date range."""
    url = f"{CEDA_BASE_URL}/agmarknet/prices"
    headers = _get_headers()
    payload = {
        "commodity_id": commodity_id,
        "state_id": state_id,
        "district_id": district_ids,
        "market_id": market_ids,
        "from_date": from_date,
        "to_date": to_date
    }
    return _execute_with_retry("post", url, headers=headers, json=payload)