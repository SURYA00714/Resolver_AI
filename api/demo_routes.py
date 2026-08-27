# FILE: api/demo_routes.py
"""Demo & Chaos endpoints for Local Chaos Test Laboratory (§23, 28)."""
import json
import sys
import uuid
from decimal import Decimal

from fastapi import APIRouter, HTTPException

import config
from chaos_lab.faults import (
    inject_cross_rail_duplicate,
    inject_late_authorization,
    inject_out_of_order_webhook,
)
from db.connection import get_pool
from ledger.financial_effects import get_system_financial_summary

router = APIRouter(prefix="/demo", tags=["demo"])


def _check_demo_allowed():
    if config.ENVIRONMENT == "production":
        raise HTTPException(status_code=403, detail="Demo chaos endpoints disabled in production environment")


@router.post("/payment")
async def create_demo_payment():
    """Create a sample payment intent for local chaos testing."""
    _check_demo_allowed()
    pool = await get_pool()
    intent_id = uuid.uuid4()
    order_id = f"ORD_DEMO_{uuid.uuid4().hex[:8]}"
    amount = Decimal("1299.00")

    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO payment_intents
               (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
               VALUES ($1, $2, 'demo_merchant', $3, 'INR', 'PENDING_RAIL', 'RAZORPAY_TEST')""",
            intent_id, order_id, amount,
        )
        await conn.execute(
            """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
               VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
            str(intent_id),
            json.dumps({"payment_intent_id": str(intent_id), "scenario": "DEMO"}),
        )

    return {
        "status": "created",
        "payment_intent_id": str(intent_id),
        "order_id": order_id,
        "amount": "1299.00",
    }


@router.post("/chaos/late-auth")
async def chaos_late_auth():
    """Inject a Late Authorization scenario in Local Chaos Lab."""
    _check_demo_allowed()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_late_authorization(conn)
    return {"status": "injected", **result}


@router.post("/chaos/cross-rail")
async def chaos_cross_rail():
    """Inject a Duplicate Execution scenario in Local Chaos Lab."""
    _check_demo_allowed()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_cross_rail_duplicate(conn)
    return {"status": "injected", **result}


@router.post("/chaos/out-of-order")
async def chaos_out_of_order():
    """Inject an Out-of-Order Webhook scenario in Local Chaos Lab."""
    _check_demo_allowed()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_out_of_order_webhook(conn)
    return {"status": "injected", **result}


@router.get("/financial-summary")
async def financial_summary():
    """Get system-wide financial effects summary."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await get_system_financial_summary(conn)
