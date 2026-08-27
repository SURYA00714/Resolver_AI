# FILE: razorpay/refunds.py
"""Razorpay Refunds API wrapper (§11)."""
from typing import Any, Dict, Optional
from decimal import Decimal

from razorpay.client import get_razorpay_client


async def get_refunds(payment_id: str) -> Dict[str, Any]:
    """Fetch all refunds for a specific payment ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"payments/{payment_id}/refunds")


async def get_refund(refund_id: str) -> Dict[str, Any]:
    """Fetch details of a specific refund by refund ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"refunds/{refund_id}")


async def create_refund(
    payment_id: str,
    amount: Decimal,
    notes: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Create a refund for a payment.
    Amount is converted to sub-units (paise for INR).
    """
    client = get_razorpay_client()
    amount_in_paise = int(amount * 100)
    data = {
        "amount": amount_in_paise,
    }
    if notes:
        data["notes"] = notes
    return await client._request("POST", f"payments/{payment_id}/refund", data=data)
