# FILE: razorpay/orders.py
"""Razorpay Orders API wrapper."""
from typing import Any, Dict, Optional
from decimal import Decimal

from razorpay.client import get_razorpay_client


from domain.money import decimal_to_minor_units


async def create_order(
    amount: Decimal,
    currency: str = "INR",
    receipt: Optional[str] = None,
    notes: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Create a new Razorpay order via POST /v1/orders.
    Amount is converted to sub-units (paise for INR, minor units for supported currencies).
    Returns the full Razorpay order entity.
    """
    client = get_razorpay_client()
    amount_in_minor_units = decimal_to_minor_units(amount, currency)
    data: Dict[str, Any] = {
        "amount": amount_in_minor_units,
        "currency": currency.upper(),
    }
    if receipt:
        data["receipt"] = receipt
    if notes:
        data["notes"] = notes
    return await client._request("POST", "orders", data=data)


async def get_order(order_id: str) -> Dict[str, Any]:
    """Fetch details of a specific order by Razorpay order ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"orders/{order_id}")


async def get_order_payments(order_id: str) -> Dict[str, Any]:
    """Fetch all payments associated with a Razorpay order ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"orders/{order_id}/payments")

