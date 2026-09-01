# FILE: razorpay/payments.py
"""Razorpay Payments API wrapper (§11)."""
from typing import Any, Dict, Optional
from decimal import Decimal

from razorpay.client import get_razorpay_client


async def get_payment(payment_id: str) -> Dict[str, Any]:
    """Fetch details of a specific payment by ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"payments/{payment_id}")


async def capture_payment(
    payment_id: str,
    amount: Decimal,
    currency: str = "INR",
) -> Dict[str, Any]:
    """
    Capture an authorized payment.
    Note: Razorpay API expects amount in sub-units (paise for INR).
    """
    if currency and currency.upper() not in ("INR", "USD", "EUR", "GBP"):
        raise ValueError(f"Unsupported or unverified currency for automatic sub-unit conversion: {currency}")
    client = get_razorpay_client()
    amount_in_paise = int(amount * 100)
    data = {
        "amount": amount_in_paise,
        "currency": currency.upper() if currency else "INR",
    }
    return await client._request("POST", f"payments/{payment_id}/capture", data=data)
