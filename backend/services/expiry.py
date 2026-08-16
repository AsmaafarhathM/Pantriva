from datetime import date


def calculate_expiry_status(expiry_date: date | None):
    if expiry_date is None:
        return {
            "days_remaining": None,
            "status": "NO_EXPIRY_DATE"
        }

    today = date.today()

    days_remaining = (
        expiry_date - today
    ).days

    if days_remaining < 0:
        status = "EXPIRED"

    elif days_remaining <= 3:
        status = "EXPIRING_SOON"

    else:
        status = "GOOD"

    return {
        "days_remaining": days_remaining,
        "status": status
    }