# FILE: api/dashboard_routes.py
"""Dashboard & Analytics REST API endpoints for Frontend Integration."""
import json
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

import asyncpg
from db.connection import get_pool
from ledger.financial_effects import get_system_financial_summary

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/stats")
async def get_dashboard_stats():
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

        return {
            "total_intents": total_intents,
            "open_cases": open_cases,
            "states_summary": states_summary,
            "cases_summary": cases_summary,
            "financial_summary": fin_summary,
            "recent_events": [
                {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()}
                for r in recent_events
            ],
        }


@router.get("/payments")
async def list_payments(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List payment intents with optional state filter and pagination."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                """SELECT payment_intent_id, merchant_reference, order_id, razorpay_order_id,
                          active_payment_id, merchant_id, amount, currency, current_state,
                          active_rail, retry_count, resolution_status, version, created_at, updated_at
                   FROM payment_intents WHERE current_state = $1
                   ORDER BY updated_at DESC LIMIT $2 OFFSET $3""",
                status.upper(), limit, offset
            )
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM payment_intents WHERE current_state = $1", status.upper()
            )
        else:
            rows = await conn.fetch(
                """SELECT payment_intent_id, merchant_reference, order_id, razorpay_order_id,
                          active_payment_id, merchant_id, amount, currency, current_state,
                          active_rail, retry_count, resolution_status, version, created_at, updated_at
                   FROM payment_intents ORDER BY updated_at DESC LIMIT $1 OFFSET $2""",
                limit, offset
            )
            total = await conn.fetchval("SELECT COUNT(*) FROM payment_intents")

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
async def list_audit_events(limit: int = Query(50, ge=1, le=200)):
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
