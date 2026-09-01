# FILE: api/payment_routes.py
"""Payment operations REST API endpoints (§28)."""
import json
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel

import asyncpg
from core.rbac import require_permission
from core.resolver import resolve
from db.connection import get_pool

router = APIRouter(prefix="/payments", tags=["payments"])


class ManualResolveRequest(BaseModel):
    operator_id: str
    resolution_notes: str
    action: str  # CAPTURE, REFUND, VOID, CLOSE


def verify_merchant_access(user: dict, row_merchant_id: str):
    user_merchant = user.get("merchant_id")
    user_role = user.get("role")
    if user_role != "admin" and user_merchant and user_merchant != row_merchant_id:
        raise HTTPException(status_code=403, detail="Cross-tenant access forbidden: merchant_id mismatch")


@router.get("/{payment_intent_id}")
async def get_payment_intent(payment_intent_id: str, user: dict = Depends(require_permission("read:payments"))):
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

        verify_merchant_access(user, row["merchant_id"])

        return {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(row).items()}


@router.get("/{payment_intent_id}/timeline")
async def get_payment_timeline(payment_intent_id: str, user: dict = Depends(require_permission("read:payments"))):
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

        verify_merchant_access(user, intent["merchant_id"])

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
async def reconcile_payment(payment_intent_id: str, user: dict = Depends(require_permission("write:reconcile"))):
    """Trigger on-demand reconciliation and resolution pipeline for an intent."""
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    pool = await get_pool()
    async with pool.acquire() as conn:
        intent = await conn.fetchrow("SELECT merchant_id FROM payment_intents WHERE payment_intent_id = $1", pid)
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")
        verify_merchant_access(user, intent["merchant_id"])

    result = await resolve(pid)
    return result


@router.post("/{payment_intent_id}/resolve")
async def resolve_payment(payment_intent_id: str, user: dict = Depends(require_permission("write:reconcile"))):
    """Trigger manual or automated resolution for an intent."""
    return await reconcile_payment(payment_intent_id, user=user)


@router.get("/evidence/{payment_intent_id}")
async def get_payment_evidence(payment_intent_id: str, user: dict = Depends(require_permission("read:payments"))):
    """Fetch immutable audit evidence trail for a specific payment intent."""
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    pool = await get_pool()
    async with pool.acquire() as conn:
        intent = await conn.fetchrow("SELECT merchant_id FROM payment_intents WHERE payment_intent_id = $1", pid)
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")
        verify_merchant_access(user, intent["merchant_id"])

        evidence = await conn.fetch(
            "SELECT * FROM immutable_evidence WHERE payment_intent_id = $1 ORDER BY created_at ASC",
            pid,
        )
        return [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in evidence]


@router.get("/{payment_intent_id}/investigation", summary="Judge-friendly payment investigation details")
async def get_payment_investigation(payment_intent_id: str, user: dict = Depends(require_permission("read:payments"))):
    """
    Fetch comprehensive payment investigation details:
    - Intent record & Razorpay order/payment identifiers
    - Source provenance (RAZORPAY_API, RAZORPAY_WEBHOOK, POLICY_ENGINE, AI_DETECTIVE)
    - Webhook event timeline & external execution history
    - Policy Engine decision & AI Detective hypothesis
    - Immutable ledger financial effects
    """
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    pool = await get_pool()
    async with pool.acquire() as conn:
        intent = await conn.fetchrow("SELECT * FROM payment_intents WHERE payment_intent_id = $1", pid)
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")

        verify_merchant_access(user, intent["merchant_id"])

        events = await conn.fetch(
            "SELECT event_id, source, external_event_id, event_type, received_at, trace_id, signature_verified FROM payment_events WHERE payment_intent_id = $1 ORDER BY received_at ASC",
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

        from ledger.financial_effects import get_financial_summary
        financial_summary = await get_financial_summary(conn, pid)

        # Parse decision chain for AI Detective and Policy Engine reasoning
        latest_chain = {}
        if evidence:
            raw_chain = evidence[-1].get("decision_chain")
            if raw_chain:
                try:
                    latest_chain = json.loads(raw_chain) if isinstance(raw_chain, str) else raw_chain
                except Exception:
                    latest_chain = {}

        provider_status = "PROVIDER_NOT_CREATED" if not intent["razorpay_order_id"] and not intent["active_payment_id"] else "PROVIDER_LINKED"

        return {
            "payment_intent_id": str(pid),
            "merchant_id": intent["merchant_id"],
            "provider_status": provider_status,
            "provenance": {
                "order_source": "RAZORPAY_API" if intent["razorpay_order_id"] else "LOCAL",
                "payment_source": "RAZORPAY_API" if intent["active_payment_id"] else "LOCAL",
                "webhook_source": "RAZORPAY_WEBHOOK" if events else "NONE",
            },
            "intent": {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(intent).items()},
            "financial_effects": financial_summary,
            "ai_detective": latest_chain.get("detective"),
            "policy_decision": latest_chain.get("policy"),
            "reconciliation": latest_chain.get("reconciliation"),
            "webhook_events": [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in events],
            "external_executions": [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in executions],
            "evidence_trail": [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in evidence],
        }
