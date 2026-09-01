# FILE: api/reconciliation_routes.py
"""Reconciliation Case Management REST API endpoints (§27-28)."""
import uuid
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

import asyncpg
from core.rbac import require_permission
from db.connection import get_pool

router = APIRouter(prefix="/cases", tags=["cases"])


class ManualCaseResolveRequest(BaseModel):
    operator_id: str
    resolution_notes: str
    action: str = "MANUAL_RESOLVE"  # CAPTURE, REFUND, VOID, CLOSE


from api.payment_routes import verify_merchant_access


@router.get("")
async def list_cases(status: Optional[str] = None, user: dict = Depends(require_permission("read:cases"))):
    """List operational reconciliation cases, optionally filtered by status (OPEN, IN_PROGRESS, RESOLVED)."""
    pool = await get_pool()
    merchant_id = user.get("merchant_id")
    user_role = user.get("role")
    async with pool.acquire() as conn:
        if user_role == "admin" or not merchant_id:
            if status:
                rows = await conn.fetch(
                    "SELECT * FROM reconciliation_cases WHERE status = $1 ORDER BY opened_at DESC",
                    status.upper(),
                )
            else:
                rows = await conn.fetch("SELECT * FROM reconciliation_cases ORDER BY opened_at DESC")
        else:
            if status:
                rows = await conn.fetch(
                    "SELECT * FROM reconciliation_cases WHERE merchant_id = $1 AND status = $2 ORDER BY opened_at DESC",
                    merchant_id, status.upper(),
                )
            else:
                rows = await conn.fetch("SELECT * FROM reconciliation_cases WHERE merchant_id = $1 ORDER BY opened_at DESC", merchant_id)

        return [{k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(r).items()} for r in rows]


@router.get("/{case_id}")
async def get_case(case_id: str, user: dict = Depends(require_permission("read:cases"))):
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

        verify_merchant_access(user, row["merchant_id"])
        return {k: str(v) if isinstance(v, (uuid.UUID, Decimal)) else v for k, v in dict(row).items()}


@router.post("/manual-resolve/{case_id}")
@router.post("/{case_id}/manual-resolve")
async def manual_resolve_case(case_id: str, req: ManualCaseResolveRequest, user: dict = Depends(require_permission("write:resolve_case"))):
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

        verify_merchant_access(user, case_row["merchant_id"])
        intent_id = case_row["payment_intent_id"]

        # Update case status
        await conn.execute(
            """UPDATE reconciliation_cases
               SET status = 'RESOLVED', resolved_at = NOW(),
                   assigned_operator = $1, resolution_notes = $2
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


@router.post("/replay/{payment_intent_id}", tags=["replay"])
async def forensic_replay(payment_intent_id: str, user: dict = Depends(require_permission("read:cases"))):
    """Perform a 100% read-only forensic replay for a payment intent. Zero side effects."""
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

    from core.replay import replay_intent
    result = await replay_intent(pid)
    if result.get("replay_status") == "ERROR":
        raise HTTPException(status_code=404, detail=result.get("reason", "Payment intent not found"))
    return result

