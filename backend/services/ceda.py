import time
import logging
import truststore
truststore.inject_into_ssl()

import requests
from config import CEDA_API_KEY

logger = logging.getLogger(__name__)

CEDA_BASE_URL = "https://api.ceda.ashoka.edu.in/v1"
DEFAULT_TIMEOUT = 3
MAX_RETRIES = 1


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


_rate_limit_cooldown_until: float = 0.0


def _execute_with_retry(method: str, url: str, **kwargs) -> dict:
    """Execute HTTP request with instant fallback if CEDA is rate-limited or unavailable."""
    global _rate_limit_cooldown_until
    now = time.time()
    if now < _rate_limit_cooldown_until:
        # Circuit breaker open, instantly fallback
        return {"output": {"type": "error", "message": "Rate limited cooldown", "data": []}}

    try:
        if method.lower() == "get":
            response = requests.get(url, timeout=DEFAULT_TIMEOUT, **kwargs)
        else:
            response = requests.post(url, timeout=DEFAULT_TIMEOUT, **kwargs)

        if response.status_code == 429:
            logger.warning("CEDA rate limit (429) hit for %s. Enabling 60s cooldown...", url)
            _rate_limit_cooldown_until = time.time() + 60.0
            return {"output": {"type": "error", "message": "Rate limit exceeded", "data": []}}

        response.raise_for_status()
        return response.json()

    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "unknown"
        if status == 429:
            _rate_limit_cooldown_until = time.time() + 60.0
            return {"output": {"type": "error", "message": "Rate limit exceeded", "data": []}}
        logger.debug("CEDA HTTP error: status %s for url %s", status, url)
        raise CedaApiError(f"CEDA request failed with status code {status}") from None
    except requests.exceptions.RequestException as e:
        logger.debug("CEDA connection error: %s", type(e).__name__)
        raise CedaApiError("Failed to connect to CEDA API") from None


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