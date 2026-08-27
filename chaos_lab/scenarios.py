# FILE: chaos_lab/scenarios.py
"""Chaos scenario definitions (§22)."""
from typing import List, Dict

CHAOS_SCENARIOS: List[Dict[str, str]] = [
    {
        "id": "late_auth",
        "name": "Late Authorization",
        "description": "Payment times out initially, but authorization arrives later asynchronously.",
    },
    {
        "id": "cross_rail_dup",
        "name": "Duplicate Execution Attempt",
        "description": "Multiple execution attempts exist for the same payment intent.",
    },
    {
        "id": "out_of_order",
        "name": "Out-of-Order Webhook",
        "description": "payment.captured arrives before payment.authorized.",
    },
    {
        "id": "ambiguous_timeout",
        "name": "Ambiguous Mutation Timeout",
        "description": "Financial mutation HTTP request times out mid-flight.",
    },
]
