# FILE: api/demo_routes.py
"""Demo & chaos endpoints for demonstrating ResolverAI capabilities (§38)."""
import json
import sys
import uuid
from decimal import Decimal

from fastapi import APIRouter, HTTPException

import asyncpg

from db.connection import get_pool
from rails.faults import (
    inject_cross_rail_duplicate,
    inject_late_authorization,
    inject_out_of_order_webhook,
)
from ledger.financial_effects import get_financial_summary, get_system_financial_summary

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/payment")
async def create_demo_payment():
    """Create a sample payment intent for demo purposes."""
    pool = await get_pool()
    intent_id = uuid.uuid4()
    order_id = f"ORD_DEMO_{uuid.uuid4().hex[:8]}"
    amount = Decimal("1299.00")

    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO payment_intents
               (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
               VALUES ($1, $2, 'demo_merchant', $3, 'INR', 'PENDING_RAIL', 'UPI_HDFC')""",
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
    """Inject a Late Authorization scenario."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_late_authorization(conn)
    return {"status": "injected", **result}


@router.post("/chaos/cross-rail")
async def chaos_cross_rail():
    """Inject a Cross-Rail Duplicate scenario."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_cross_rail_duplicate(conn)
    return {"status": "injected", **result}


@router.post("/chaos/out-of-order")
async def chaos_out_of_order():
    """Inject an Out-of-Order Webhook scenario."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_out_of_order_webhook(conn)
    return {"status": "injected", **result}


@router.get("/payments/{payment_intent_id}")
async def get_payment(payment_intent_id: str):
    """Get payment intent details."""
    pool = await get_pool()
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT payment_intent_id, order_id, merchant_id, amount, currency,
                      current_state, active_rail, retry_count, resolution_status, version,
                      created_at, updated_at
               FROM payment_intents WHERE payment_intent_id = $1""",
            pid,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Payment intent not found")

        return {k: str(v) for k, v in dict(row).items()}


@router.get("/payments/{payment_intent_id}/timeline")
async def get_timeline(payment_intent_id: str):
    """Get full event timeline for a payment intent."""
    pool = await get_pool()
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID")

    async with pool.acquire() as conn:
        events = await conn.fetch(
            """SELECT event_id, source, external_event_id, event_type, received_at, trace_id
               FROM payment_events WHERE payment_intent_id = $1 ORDER BY received_at""",
            pid,
        )
        evidence = await conn.fetch(
            """SELECT evidence_id, action, amount, decision, policy_reason, trace_id, created_at
               FROM immutable_evidence WHERE payment_intent_id = $1 ORDER BY created_at""",
            pid,
        )
        executions = await conn.fetch(
            """SELECT execution_id, rail_id, operation, amount, status, created_at
               FROM external_executions WHERE payment_intent_id = $1 ORDER BY created_at""",
            pid,
        )

        return {
            "payment_intent_id": payment_intent_id,
            "events": [{k: str(v) for k, v in dict(r).items()} for r in events],
            "evidence": [{k: str(v) for k, v in dict(r).items()} for r in evidence],
            "executions": [{k: str(v) for k, v in dict(r).items()} for r in executions],
        }


@router.get("/financial-summary")
async def financial_summary():
    """Get system-wide financial effects summary."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await get_system_financial_summary(conn)
