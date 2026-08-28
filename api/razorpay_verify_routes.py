# FILE: api/razorpay_verify_routes.py
"""Real-time Razorpay verification and integration health endpoints.

These endpoints make REAL calls to the Razorpay API.
They are read-only — no mutations.
"""
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends

import config
from core.rbac import require_permission
from db.connection import get_pool
from razorpay.client import get_razorpay_client
from razorpay.payments import get_payment
from razorpay.orders import get_order, get_order_payments
from domain.errors import RazorpayAPIError

router = APIRouter(tags=["razorpay-verify"])


def _razorpay_configured() -> bool:
    return bool(config.RAZORPAY_KEY_ID and config.RAZORPAY_KEY_SECRET)


@router.get("/integrations/health", summary="Check Razorpay API connectivity")
async def integration_health(_: dict = Depends(require_permission("read:integration"))):
    """
    Perform a REAL read-only health check against the Razorpay API.

    Returns:
    - razorpay: CONNECTED | DEGRADED | DISCONNECTED
    - database: CONNECTED | DISCONNECTED
    - redis: CONNECTED | DEGRADED
    - outbox_worker: status based on last outbox processing
    - ai_provider: DETERMINISTIC | ACTIVE | UNAVAILABLE
    """
    result = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "environment": config.ENVIRONMENT,
        "razorpay_mode": config.RAZORPAY_MODE,
    }

    # --- Razorpay health check ---
    if not _razorpay_configured():
        result["razorpay"] = {
            "status": "NOT_CONFIGURED",
            "message": "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set in environment.",
        }
    elif config.RAZORPAY_MODE == "SYNTHETIC":
        result["razorpay"] = {
            "status": "SYNTHETIC",
            "message": "RAZORPAY_MODE=SYNTHETIC — no real API calls are made.",
        }
    else:
        try:
            # Safe read: list payments with count=1 to verify connectivity
            client = get_razorpay_client()
            resp = await client._request("GET", "payments?count=1&skip=0")
            result["razorpay"] = {
                "status": "CONNECTED",
                "mode": config.RAZORPAY_MODE,
                "key_id": config.RAZORPAY_KEY_ID,
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }
        except RazorpayAPIError as e:
            result["razorpay"] = {
                "status": "DEGRADED",
                "message": str(e),
                "mode": config.RAZORPAY_MODE,
            }
        except Exception as e:
            result["razorpay"] = {
                "status": "DISCONNECTED",
                "message": str(e),
            }

    # --- Database health check ---
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        result["database"] = {"status": "CONNECTED"}
    except Exception as e:
        result["database"] = {"status": "DISCONNECTED", "message": str(e)}

    # --- Redis health check ---
    try:
        from core.idempotency import get_redis
        r = await get_redis()
        if r is not None:
            await r.ping()
            result["redis"] = {"status": "CONNECTED"}
        else:
            result["redis"] = {"status": "DEGRADED", "message": "Using in-memory fallback"}
    except Exception as e:
        result["redis"] = {"status": "DISCONNECTED", "message": str(e)}

    # --- Outbox worker health ---
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            pending = await conn.fetchval(
                "SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING'"
            )
            dead_letters = await conn.fetchval(
                "SELECT COUNT(*) FROM outbox_events WHERE status = 'DEAD_LETTER'"
            )
            last_processed = await conn.fetchval(
                "SELECT MAX(processed_at) FROM outbox_events WHERE status = 'PROCESSED'"
            )
        result["outbox_worker"] = {
            "pending_events": pending,
            "dead_letter_events": dead_letters,
            "last_processed_at": str(last_processed) if last_processed else None,
        }
    except Exception as e:
        result["outbox_worker"] = {"status": "UNKNOWN", "message": str(e)}

    # --- AI provider status ---
    ai_mode = config.AI_MODE
    result["ai_provider"] = {
        "mode": ai_mode,
        "status": "ACTIVE" if ai_mode == "ENABLED" else "DETERMINISTIC",
        "description": "Gemini/Groq AI advisory layer" if ai_mode == "ENABLED" else "Deterministic rule-based evidence analyzer",
    }

    return result


@router.get(
    "/payments/{payment_intent_id}/verify",
    summary="Fetch live Razorpay payment snapshot for a payment intent",
)
async def verify_payment_with_razorpay(payment_intent_id: str, _: dict = Depends(require_permission("write:verify_razorpay"))):
    """
    Fetch the authoritative Razorpay state for a payment intent.

    - Looks up the local payment intent to find the Razorpay payment ID.
    - Calls Razorpay GET /v1/payments/{id} with REAL credentials.
    - Returns the Razorpay API response alongside the local state.
    - Records this verification in the audit trail.

    This is the "VERIFY WITH RAZORPAY" button.
    """
    try:
        pid = uuid.UUID(payment_intent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payment_intent_id UUID format")

    pool = await get_pool()
    async with pool.acquire() as conn:
        intent = await conn.fetchrow(
            """SELECT payment_intent_id, active_payment_id, razorpay_order_id,
                      amount, currency, current_state, updated_at
               FROM payment_intents WHERE payment_intent_id = $1""",
            pid,
        )
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")

    local_state = {
        "payment_intent_id": str(intent["payment_intent_id"]),
        "active_payment_id": intent["active_payment_id"],
        "razorpay_order_id": intent["razorpay_order_id"],
        "amount": str(intent["amount"]),
        "currency": intent["currency"],
        "current_state": intent["current_state"],
        "last_updated": str(intent["updated_at"]),
    }

    if not _razorpay_configured() or config.RAZORPAY_MODE == "SYNTHETIC":
        return {
            "local_state": local_state,
            "razorpay_snapshot": None,
            "razorpay_mode": config.RAZORPAY_MODE,
            "message": "Razorpay integration not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }

    if not intent["active_payment_id"]:
        # No payment ID yet — try fetching via order ID
        if not intent["razorpay_order_id"]:
            return {
                "local_state": local_state,
                "razorpay_snapshot": None,
                "message": "No Razorpay payment ID or order ID associated with this intent yet.",
                "verified_at": datetime.now(timezone.utc).isoformat(),
            }
        try:
            order_payments = await get_order_payments(intent["razorpay_order_id"])
            return {
                "local_state": local_state,
                "razorpay_order_payments": order_payments,
                "razorpay_mode": config.RAZORPAY_MODE,
                "verified_at": datetime.now(timezone.utc).isoformat(),
                "note": "No direct payment ID — showing order payments from Razorpay",
            }
        except RazorpayAPIError as e:
            raise HTTPException(
                status_code=502,
                detail={"error": "razorpay_api_error", "message": str(e)},
            )

    # Fetch direct payment from Razorpay
    try:
        payment_snapshot = await get_payment(intent["active_payment_id"])
    except RazorpayAPIError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": "razorpay_api_error", "message": str(e)},
        )

    verified_at = datetime.now(timezone.utc).isoformat()

    # Record this verification in audit trail
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO audit_events (event_type, actor_id, resource_type, resource_id, payload)
               VALUES ('RAZORPAY_VERIFICATION', 'SYSTEM', 'PAYMENT_INTENT', $1, $2)""",
            str(pid),
            f'{{"payment_id": "{intent["active_payment_id"]}", "verified_at": "{verified_at}", "razorpay_status": "{payment_snapshot.get("status", "unknown")}"}}'
        )

    return {
        "local_state": local_state,
        "razorpay_snapshot": payment_snapshot,
        "razorpay_mode": config.RAZORPAY_MODE,
        "verified_at": verified_at,
    }
