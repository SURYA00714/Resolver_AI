# FILE: api/payment_routes.py
"""Payment operations REST API endpoints (§28)."""
import json
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

import asyncpg
from core.resolver import resolve
from db.connection import get_pool

router = APIRouter(prefix="/payments", tags=["payments"])


class ManualResolveRequest(BaseModel):
    operator_id: str
    resolution_notes: str
    action: str  # CAPTURE, REFUND, VOID, CLOSE


@router.get("/{payment_intent_id}")
async def get_payment_intent(payment_intent_id: str):
    """Fetch operational details for a specific payment intent."""
    pool = await get_pool()
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT payment_intent_id, merchant_reference, order_id, razorpay_order_id, active_payment_id,
                      merchant_id, amount, currency, current_state, active_rail, retry_count,
                      resolution_status, version, created_at, updated_at
               FROM payment_intents WHERE payment_intent_id = $1""",
            pid,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Payment intent not found")

        return {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(row).items()}


@router.get("/{payment_intent_id}/timeline")
async def get_payment_timeline(payment_intent_id: str):
    """Fetch complete chronological event timeline, evidence, and execution records."""
    pool = await get_pool()
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    async with pool.acquire() as conn:
        intent = await conn.fetchrow("SELECT * FROM payment_intents WHERE payment_intent_id = $1", pid)
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")

        events = await conn.fetch(
            "SELECT event_id, source, external_event_id, event_type, received_at, trace_id FROM payment_events WHERE payment_intent_id = $1 ORDER BY received_at ASC",
            pid,
        )
        evidence = await conn.fetch(
            "SELECT evidence_id, action, amount, currency, decision, policy_reason, decision_chain, trace_id, created_at FROM immutable_evidence WHERE payment_intent_id = $1 ORDER BY created_at ASC",
            pid,
        )
        executions = await conn.fetch(
            "SELECT execution_id, provider, rail_id, external_txn_id, operation, amount, status, created_at FROM external_executions WHERE payment_intent_id = $1 ORDER BY created_at ASC",
            pid,
        )

        return {
            "payment_intent_id": payment_intent_id,
            "intent": {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(intent).items()},
            "events": [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in events],
            "evidence": [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in evidence],
            "executions": [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in executions],
        }


@router.post("/{payment_intent_id}/reconcile")
async def reconcile_payment(payment_intent_id: str):
    """Trigger on-demand reconciliation and resolution pipeline for an intent."""
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    result = await resolve(pid)
    return result


@router.post("/{payment_intent_id}/resolve")
async def resolve_payment(payment_intent_id: str):
    """Trigger manual or automated resolution for an intent."""
    return await reconcile_payment(payment_intent_id)


@router.get("/evidence/{payment_intent_id}")
async def get_payment_evidence(payment_intent_id: str):
    """Fetch immutable audit evidence trail for a specific payment intent."""
    pool = await get_pool()
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    async with pool.acquire() as conn:
        evidence = await conn.fetch(
            "SELECT * FROM immutable_evidence WHERE payment_intent_id = $1 ORDER BY created_at ASC",
            pid,
        )
        return [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in evidence]
