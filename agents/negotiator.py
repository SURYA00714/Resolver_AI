# FILE: agents/negotiator.py
"""Negotiator Agent — Evidence Gathering Agent (§16).

CRITICAL INVARIANT: The Negotiator may ONLY call read-only Razorpay APIs.
It MUST NOT execute capture, refund, or financial mutation APIs.
"""
import sys
from decimal import Decimal
from typing import Any, Dict, Optional

import config
from agents.schemas import ExternalStatus, NegotiatorResult
from domain.errors import RazorpayAPIError
from razorpay.payments import get_payment
from razorpay.orders import get_order, get_order_payments


async def verify(
    intent_data: Dict[str, Any],
    idempotency_key: str,
    trace_id: Optional[str] = None,
    chaos_mode: Optional[str] = None,
) -> NegotiatorResult:
    """
    Gather hard evidence from Razorpay read-only APIs (or local chaos simulator).
    """
    intent_id = str(intent_data.get("payment_intent_id", "unknown"))
    amount = Decimal(str(intent_data.get("amount", "0")))
    currency = intent_data.get("currency", "INR")
    rail_name = intent_data.get("rail", "RAZORPAY_TEST")
    active_payment_id = intent_data.get("active_payment_id")
    razorpay_order_id = intent_data.get("razorpay_order_id")

    # Path A: Real Razorpay Test/Live API Mode
    if config.RAZORPAY_MODE in ("TEST", "LIVE") and not chaos_mode:
        try:
            payment_info = None
            if active_payment_id:
                payment_info = await get_payment(active_payment_id)
            elif razorpay_order_id:
                order_payments = await get_order_payments(razorpay_order_id)
                items = order_payments.get("items", [])
                if items:
                    payment_info = items[0]

            if payment_info:
                raw_status = payment_info.get("status", "").upper()
                status_map = {
                    "CAPTURED": ExternalStatus.SUCCESS,
                    "AUTHORIZED": ExternalStatus.AUTHORIZED,
                    "FAILED": ExternalStatus.FAILED,
                    "REFUNDED": ExternalStatus.REFUNDED,
                }
                ext_status = status_map.get(raw_status, ExternalStatus.UNKNOWN)

                pay_amt = Decimal(str(payment_info.get("amount", 0))) / Decimal("100") if payment_info.get("amount") else amount

                return NegotiatorResult(
                    payment_intent_id=intent_id,
                    trace_id=trace_id or "",
                    external_status=ext_status,
                    external_transaction_id=payment_info.get("id"),
                    razorpay_order_id=payment_info.get("order_id") or razorpay_order_id,
                    amount=pay_amt,
                    currency=payment_info.get("currency", currency),
                    rail="RAZORPAY_API",
                    verification_details=payment_info,
                )

        except RazorpayAPIError as e:
            print(f"[NEGOTIATOR] Razorpay API read error: {e}", file=sys.stderr)
            return NegotiatorResult(
                payment_intent_id=intent_id,
                trace_id=trace_id or "",
                external_status=ExternalStatus.UNKNOWN,
                amount=amount,
                currency=currency,
                rail="RAZORPAY_API",
            )

    # Path B: Local Chaos Lab Mode (Synthetic Rails)
    try:
        from chaos_lab.simulator import get_rail
        rail = get_rail(rail_name, chaos_mode=chaos_mode)
        result = await rail.authorize(amount, idempotency_key)

        raw_status = result.get("status", "UNKNOWN")
        status_map = {
            "SUCCESS": ExternalStatus.SUCCESS,
            "FAILED": ExternalStatus.FAILED,
            "UNKNOWN": ExternalStatus.UNKNOWN,
            "VOIDED": ExternalStatus.VOIDED,
            "REFUNDED": ExternalStatus.REFUNDED,
            "DUPLICATE": ExternalStatus.DUPLICATE,
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
    except Exception as e:
        print(f"[NEGOTIATOR] Synthetic rail verification fallback: {e}", file=sys.stderr)
        return NegotiatorResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            external_status=ExternalStatus.UNKNOWN,
            amount=amount,
            currency=currency,
            rail=rail_name,
        )
