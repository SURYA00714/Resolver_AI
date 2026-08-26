# FILE: agents/negotiator.py
"""Negotiator Agent — Verifies payment state with external rail (§19-21)."""
from decimal import Decimal
from typing import Any, Dict, Optional

from agents.schemas import ExternalStatus, NegotiatorResult
from rails.simulator import get_rail


async def verify(
    intent_data: Dict[str, Any],
    idempotency_key: str,
    trace_id: Optional[str] = None,
    chaos_mode: Optional[str] = None,
) -> NegotiatorResult:
    """
    Contact external rail to verify payment status.
    Returns structured NegotiatorResult with evidence.
    """
    rail_name = intent_data.get("rail", "UPI_HDFC")
    amount = Decimal(str(intent_data.get("amount", "0")))
    currency = intent_data.get("currency", "INR")
    intent_id = intent_data.get("payment_intent_id", "unknown")

    rail = get_rail(rail_name, chaos_mode=chaos_mode)
    result = await rail.authorize(amount, idempotency_key)

    # Map rail response to ExternalStatus
    raw_status = result.get("status", "UNKNOWN")
    status_map = {
        "SUCCESS": ExternalStatus.SUCCESS,
        "FAILED": ExternalStatus.FAILED,
        "UNKNOWN": ExternalStatus.UNKNOWN,
        "VOIDED": ExternalStatus.VOIDED,
        "REFUNDED": ExternalStatus.REFUNDED,
        "DUPLICATE": ExternalStatus.DUPLICATE,
        "UNCERTAIN": ExternalStatus.UNKNOWN,
    }
    ext_status = status_map.get(raw_status, ExternalStatus.UNKNOWN)

    return NegotiatorResult(
        payment_intent_id=intent_id,
        trace_id=trace_id or "",
        external_status=ext_status,
        external_transaction_id=result.get("txn_id"),
        amount=amount,
        currency=currency,
        rail=rail_name,
    )
