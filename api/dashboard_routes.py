# FILE: api/dashboard_routes.py
"""Dashboard & Analytics REST API endpoints for Frontend Integration."""
import json
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends

import asyncpg
from core.auth import get_current_user, has_permission
from core.rbac import require_permission
from db.connection import get_pool
from ledger.financial_effects import get_system_financial_summary

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(_: dict = Depends(require_permission("read:dashboard"))):
    """Aggregate KPI statistics for the dashboard overview."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Payment Intents by state
        state_rows = await conn.fetch(
            "SELECT current_state, COUNT(*) as cnt FROM payment_intents GROUP BY current_state"
        )
        states_summary = {r["current_state"]: r["cnt"] for r in state_rows}
        total_intents = sum(states_summary.values())

        # Cases summary by status
        case_rows = await conn.fetch(
            "SELECT status, COUNT(*) as cnt FROM reconciliation_cases GROUP BY status"
        )
        cases_summary = {r["status"]: r["cnt"] for r in case_rows}
        open_cases = cases_summary.get("OPEN", 0)

        # Financial summary
        fin_summary = await get_system_financial_summary(conn)

        # Recent 10 events
        recent_events = await conn.fetch(
            """SELECT event_id, payment_intent_id, source, event_type, received_at
               FROM payment_events ORDER BY received_at DESC LIMIT 10"""
        )

        # Webhook metrics
        webhook_total = await conn.fetchval("SELECT COUNT(*) FROM payment_events")
        webhook_sig_failed = await conn.fetchval(
            "SELECT COUNT(*) FROM payment_events WHERE signature_verified = FALSE"
        )
        dead_letter_count = await conn.fetchval(
            "SELECT COUNT(*) FROM outbox_events WHERE status = 'DEAD_LETTER'"
        )
        pending_outbox = await conn.fetchval(
            "SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING'"
        )

        return {
            "total_intents": total_intents,
            "open_cases": open_cases,
            "states_summary": states_summary,
            "cases_summary": cases_summary,
            "financial_summary": fin_summary,
            "webhook_stats": {
                "total_received": webhook_total,
                "signature_failures": webhook_sig_failed,
                "dead_letter_events": dead_letter_count,
                "outbox_pending": pending_outbox,
            },
            "recent_events": [
                {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()}
                for r in recent_events
            ],
        }


@router.get("/payments")
async def list_payments(
    _: dict = Depends(require_permission("read:payments")),
    status: Optional[str] = None,
    razorpay_order_id: Optional[str] = None,
    active_payment_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List payment intents with optional filters and pagination."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        where_clauses = []
        params = []
        p = 1

        if status:
            where_clauses.append(f"current_state = ${p}")
            params.append(status.upper())
            p += 1
        if razorpay_order_id:
            where_clauses.append(f"razorpay_order_id = ${p}")
            params.append(razorpay_order_id)
            p += 1
        if active_payment_id:
            where_clauses.append(f"active_payment_id = ${p}")
            params.append(active_payment_id)
            p += 1

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        params.extend([limit, offset])

        rows = await conn.fetch(
            f"""SELECT payment_intent_id, merchant_reference, order_id, razorpay_order_id,
                      active_payment_id, merchant_id, amount, currency, current_state,
                      active_rail, retry_count, resolution_status, version, created_at, updated_at
               FROM payment_intents {where_sql}
               ORDER BY updated_at DESC LIMIT ${p} OFFSET ${p+1}""",
            *params,
        )
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM payment_intents {where_sql}",
            *params[:-2],
        )

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [
                {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()}
                for r in rows
            ],
        }


@router.get("/audit")
async def list_audit_events(limit: int = Query(50, ge=1, le=200), _: dict = Depends(require_permission("read:audit"))):
    """Fetch audit event log for compliance and operational tracking."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1", limit
        )
        return [
            {
                k: json.loads(v) if k == "payload" and isinstance(v, str) else (str(v) if isinstance(v, (uuid.UUID, Decimal)) else v)
                for k, v in dict(r).items()
            }
            for r in rows
        ]


# ─── Webhook Operations ──────────────────────────────────────────────────────

@router.get("/webhooks")
async def list_webhooks(
    _: dict = Depends(require_permission("read:webhooks")),
    event_type: Optional[str] = None,
    payment_intent_id: Optional[str] = None,
    signature_verified: Optional[bool] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    List received webhook events with their processing status.

    All events here are REAL received webhooks — not synthetic injections.
    Synthetic events from the engineering test environment are labeled source='SYNTHETIC'.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        where_clauses = []
        params: list = []
        p = 1

        if event_type:
            where_clauses.append(f"event_type = ${p}")
            params.append(event_type)
            p += 1
        if payment_intent_id:
            try:
                pid = uuid.UUID(payment_intent_id)
                where_clauses.append(f"payment_intent_id = ${p}")
                params.append(pid)
                p += 1
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID")
        if signature_verified is not None:
            where_clauses.append(f"(signature_verified IS NOT DISTINCT FROM ${p})")
            params.append(signature_verified)
            p += 1

        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        params.extend([limit, offset])

        rows = await conn.fetch(
            f"""SELECT event_id, payment_intent_id, source, external_event_id,
                       event_type, received_at, trace_id, signature_verified, correlation_id
               FROM payment_events {where_sql}
               ORDER BY received_at DESC LIMIT ${p} OFFSET ${p+1}""",
            *params,
        )
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM payment_events {where_sql}",
            *params[:-2],
        )

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [
                {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()}
                for r in rows
            ],
        }


@router.get("/webhooks/{event_id}")
async def get_webhook_event(event_id: str, _: dict = Depends(require_permission("read:webhooks"))):
    """Fetch a single webhook event with full payload details."""
    pool = await get_pool()
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event_id UUID format")

    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM payment_events WHERE event_id = $1", eid)
        if not row:
            raise HTTPException(status_code=404, detail="Webhook event not found")
        result = {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(row).items()}

    # Redact sensitive fields from raw payload before returning
    if "raw_payload" in result and result["raw_payload"]:
        try:
            payload = json.loads(result["raw_payload"]) if isinstance(result["raw_payload"], str) else result["raw_payload"]
            # Redact PII/sensitive data at the top level
            for sensitive_key in ("card", "bank_account", "vpa"):
                if sensitive_key in payload.get("payload", {}).get("payment", {}).get("entity", {}):
                    payload["payload"]["payment"]["entity"][sensitive_key] = "[REDACTED]"
            result["raw_payload"] = payload
        except Exception:
            result["raw_payload"] = "[PARSE ERROR]"

    return result


@router.post("/webhooks/{event_id}/replay")
async def replay_webhook_event(event_id: str, _: dict = Depends(require_permission("write:replay_webhook"))):
    """
    INTERNAL EVENT REPLAY — replays an already-persisted webhook event through the resolution pipeline.

    IMPORTANT: This is NOT a re-delivery from Razorpay.
    This replays an already-stored event through the outbox worker.
    It is protected by idempotency — no duplicate financial action will occur.
    The response is labeled INTERNAL_REPLAY to make this clear.
    """
    pool = await get_pool()
    try:
        eid = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid event_id UUID format")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT event_id, payment_intent_id, event_type FROM payment_events WHERE event_id = $1",
            eid,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Webhook event not found")

        import json as _json
        # Enqueue into outbox for re-processing
        await conn.execute(
            """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
               VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
            str(row["payment_intent_id"]),
            _json.dumps({
                "payment_intent_id": str(row["payment_intent_id"]),
                "replay_source": "INTERNAL_REPLAY",
                "original_event_id": str(eid),
            }),
        )

        # Record in audit
        await conn.execute(
            """INSERT INTO audit_events (event_type, actor_id, resource_type, resource_id, payload)
               VALUES ('INTERNAL_EVENT_REPLAY', 'OPERATOR', 'PAYMENT_EVENT', $1, $2)""",
            str(eid),
            _json.dumps({"original_event_id": str(eid), "payment_intent_id": str(row["payment_intent_id"])}),
        )

    return {
        "replay_type": "INTERNAL_REPLAY",
        "warning": "This is NOT a re-delivery from Razorpay. The already-persisted event is being re-processed through the resolution pipeline.",
        "event_id": str(eid),
        "payment_intent_id": str(row["payment_intent_id"]),
        "status": "QUEUED",
    }


@router.get("/outbox/dead-letters")
async def get_dead_letter_events(limit: int = Query(50, ge=1, le=200), _: dict = Depends(require_permission("read:webhooks"))):
    """Fetch dead-letter outbox events that have exceeded maximum retry attempts."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT outbox_id, event_type, aggregate_id, attempts, last_error,
                      created_at, processed_at
               FROM outbox_events WHERE status = 'DEAD_LETTER'
               ORDER BY created_at DESC LIMIT $1""",
            limit,
        )
        return [
            {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()}
            for r in rows
        ]


