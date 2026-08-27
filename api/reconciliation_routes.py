# FILE: api/reconciliation_routes.py
"""Reconciliation Case Management REST API endpoints (§27-28)."""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import asyncpg
from db.connection import get_pool

router = APIRouter(prefix="/cases", tags=["cases"])


class ManualCaseResolveRequest(BaseModel):
    operator_id: str
    resolution_notes: str
    action: str = "MANUAL_RESOLVE"  # CAPTURE, REFUND, VOID, CLOSE


@router.get("")
async def list_cases(status: Optional[str] = None):
    """List operational reconciliation cases, optionally filtered by status (OPEN, IN_PROGRESS, RESOLVED)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if status:
            rows = await conn.fetch(
                "SELECT * FROM reconciliation_cases WHERE status = $1 ORDER BY opened_at DESC",
                status.upper(),
            )
        else:
            rows = await conn.fetch("SELECT * FROM reconciliation_cases ORDER BY opened_at DESC")

        return [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in rows]


@router.get("/{case_id}")
async def get_case(case_id: str):
    """Fetch details of a specific reconciliation case."""
    pool = await get_pool()
    try:
        cid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case_id UUID format")

    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM reconciliation_cases WHERE case_id = $1", cid)
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")

        return {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(row).items()}


@router.post("/{case_id}/manual-resolve")
async def manual_resolve_case(case_id: str, req: ManualCaseResolveRequest):
    """Perform operator manual resolution on an ambiguous payment case."""
    pool = await get_pool()
    try:
        cid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid case_id UUID format")

    if not req.operator_id or not req.resolution_notes:
        raise HTTPException(status_code=400, detail="operator_id and resolution_notes are mandatory")

    async with pool.acquire() as conn:
        case_row = await conn.fetchrow("SELECT * FROM reconciliation_cases WHERE case_id = $1", cid)
        if not case_row:
            raise HTTPException(status_code=404, detail="Case not found")

        intent_id = case_row["payment_intent_id"]

        # Update case status
        await conn.execute(
            """UPDATE reconciliation_cases
               SET status = 'RESOLVED', resolved_at = NOW(),
                   operator_id = $1, resolution_notes = $2
               WHERE case_id = $3""",
            req.operator_id, req.resolution_notes, cid,
        )

        # Update intent state to MANUAL_REVIEW or RECONCILED
        new_state = "RECONCILED" if req.action in ("CAPTURE", "REFUND", "CLOSE") else "MANUAL_REVIEW"
        await conn.execute(
            """UPDATE payment_intents
               SET current_state = $1, resolution_status = 'RESOLVED', updated_at = NOW()
               WHERE payment_intent_id = $2""",
            new_state, intent_id,
        )

        # Record Audit Event
        await conn.execute(
            """INSERT INTO audit_events (event_type, actor_id, resource_type, resource_id, payload)
               VALUES ('MANUAL_CASE_RESOLUTION', $1, 'RECONCILIATION_CASE', $2, $3)""",
            req.operator_id, str(cid),
            f'{{"action": "{req.action}", "notes": "{req.resolution_notes}", "payment_intent_id": "{intent_id}"}}',
        )

        return {
            "status": "RESOLVED",
            "case_id": str(cid),
            "payment_intent_id": str(intent_id),
            "operator_id": req.operator_id,
            "action": req.action,
        }
