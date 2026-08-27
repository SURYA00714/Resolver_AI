# FILE: razorpay/orders.py
"""Razorpay Orders API wrapper (§11)."""
from typing import Any, Dict

from razorpay.client import get_razorpay_client


async def get_order(order_id: str) -> Dict[str, Any]:
    """Fetch details of a specific order by ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"orders/{order_id}")


async def get_order_payments(order_id: str) -> Dict[str, Any]:
    """Fetch all payments associated with an order ID."""
    client = get_razorpay_client()
    return await client._request("GET", f"orders/{order_id}/payments")
