# FILE: api/orders_routes.py
"""Real Razorpay Order creation and retrieval endpoints.

These endpoints create and fetch REAL Razorpay orders via the Razorpay REST API.
No synthetic data is generated here.

If Razorpay credentials are not configured, a clear error is returned.
"""
import json
import sys
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator

import config
from core.rbac import require_permission
from db.connection import get_pool
from domain.errors import RazorpayAPIError
from razorpay.orders import create_order, get_order, get_order_payments

router = APIRouter(prefix="/orders", tags=["orders"])


class CreateOrderRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Amount in INR (not paise). E.g. 499.00")
    currency: str = Field(default="INR", max_length=3)
    receipt: Optional[str] = Field(None, max_length=100, description="Merchant receipt/reference number")
    notes: Optional[dict] = Field(None, description="Optional key-value metadata for this order")

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be greater than zero")
        return v

    @field_validator("currency")
    @classmethod
    def currency_must_be_uppercase(cls, v: str) -> str:
        return v.upper()


@router.post("", summary="Create a real Razorpay order")
async def create_razorpay_order(req: CreateOrderRequest, user: dict = Depends(require_permission("write:create_order"))):
    """
    Create a real Razorpay order via the Razorpay Orders API.

    - Calls POST /v1/orders on Razorpay
    - Persists the returned order as a payment_intent in local DB
    - Returns the Razorpay order entity + local payment_intent_id

    Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to be configured.
    """
    merchant_id = user.get("merchant_id", "default_merchant")
    if not config.RAZORPAY_KEY_ID or not config.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "PROVIDER_UNAVAILABLE",
                "message": "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
            },
        )

    # Sanitize notes — embed payment_intent_id BEFORE creating order so webhook can find it
    payment_intent_id = uuid.uuid4()
    notes = req.notes or {}
    notes["payment_intent_id"] = str(payment_intent_id)
    notes["merchant_id"] = merchant_id
    notes["resolverai_version"] = "1.0"
    if req.receipt:
        notes["receipt"] = req.receipt

    try:
        razorpay_order = await create_order(
            amount=req.amount,
            currency=req.currency,
            receipt=req.receipt,
            notes={k: str(v) for k, v in notes.items()},
        )
    except RazorpayAPIError as e:
        print(f"[ORDERS] Razorpay order creation failed: {e}", file=sys.stderr)
        raise HTTPException(
            status_code=502,
            detail={
                "error": "PROVIDER_UNAVAILABLE",
                "message": str(e),
                "razorpay_mode": config.RAZORPAY_MODE,
            },
        )

    razorpay_order_id = razorpay_order.get("id")
    if not razorpay_order_id:
        raise HTTPException(status_code=502, detail="Razorpay returned an order without an ID")

    # Persist as payment_intent in local DB
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO payment_intents
               (payment_intent_id, merchant_reference, order_id, razorpay_order_id,
                merchant_id, amount, currency, current_state, active_rail)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'CREATED', 'RAZORPAY')
               ON CONFLICT (payment_intent_id) DO NOTHING""",
            payment_intent_id,
            req.receipt,
            razorpay_order_id,          # local order_id = razorpay_order_id
            razorpay_order_id,          # razorpay_order_id explicitly
            merchant_id,
            req.amount,
            req.currency,
        )
        # Audit the order creation
        await conn.execute(
            """INSERT INTO audit_events (event_type, actor_id, resource_type, resource_id, payload)
               VALUES ('ORDER_CREATED', 'MERCHANT', 'PAYMENT_INTENT', $1, $2)""",
            str(payment_intent_id),
            json.dumps({
                "razorpay_order_id": razorpay_order_id,
                "amount": str(req.amount),
                "currency": req.currency,
                "receipt": req.receipt,
                "razorpay_mode": config.RAZORPAY_MODE,
            }),
        )

    print(
        f"[ORDERS] Created real Razorpay order {razorpay_order_id} → intent {str(payment_intent_id)[:8]}",
        file=sys.stderr,
    )

    return {
        "payment_intent_id": str(payment_intent_id),
        "razorpay_order_id": razorpay_order_id,
        "amount": str(req.amount),
        "currency": req.currency,
        "receipt": req.receipt,
        "razorpay_status": razorpay_order.get("status"),
        "razorpay_mode": config.RAZORPAY_MODE,
        "razorpay_key_id": config.RAZORPAY_KEY_ID,  # Safe to return — public key ID, not secret
        "razorpay_order": razorpay_order,
    }


from api.payment_routes import verify_merchant_access


@router.get("/{razorpay_order_id}", summary="Fetch a Razorpay order with payments")
async def get_razorpay_order(razorpay_order_id: str, user: dict = Depends(require_permission("read:payments"))):
    """
    Fetch a Razorpay order from the Razorpay API including all associated payments.
    Also returns the local payment_intent if it exists.
    """
    if not razorpay_order_id.startswith("order_"):
        raise HTTPException(status_code=400, detail="Invalid Razorpay order ID format. Expected 'order_...'")

    # Look up local intent first to enforce merchant access boundary before external fetch
    pool = await get_pool()
    async with pool.acquire() as conn:
        local = await conn.fetchrow(
            "SELECT payment_intent_id, merchant_id, current_state, resolution_status, updated_at FROM payment_intents WHERE razorpay_order_id = $1",
            razorpay_order_id,
        )
        if local:
            verify_merchant_access(user, local["merchant_id"])

    try:
        order = await get_order(razorpay_order_id)
        payments = await get_order_payments(razorpay_order_id)
    except RazorpayAPIError as e:
        raise HTTPException(status_code=502, detail={"error": "PROVIDER_UNAVAILABLE", "message": str(e)})

    return {
        "razorpay_order": order,
        "razorpay_payments": payments,
        "local_intent": {
            "payment_intent_id": str(local["payment_intent_id"]),
            "current_state": local["current_state"],
            "resolution_status": local["resolution_status"],
            "updated_at": str(local["updated_at"]),
        } if local else None,
    }

class VerifyCheckoutRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    payment_intent_id: Optional[str] = None


@router.post("/verify_payment", summary="Verify Razorpay Checkout signature and link payment")
async def verify_checkout_payment(req: VerifyCheckoutRequest, user: dict = Depends(require_permission("write:create_order"))):
    """
    Verify the signature generated by Razorpay Checkout JS modal.
    Formula: HMAC-SHA256(server_order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)
    
    Security Contract:
    1. Query trusted local DB state for the payment intent by razorpay_order_id.
    2. Resolve the trusted server-side order_id from database state.
    3. Verify HMAC signature against trusted server_order_id.
    4. If signature is invalid: reject with HTTP 401 and DO NOT mutate payment state.
    5. If valid: transition state to AUTHORIZED, enqueue outbox task, record audit log.
    6. Idempotent: repeated verification for an already-authorized payment returns HTTP 200 clean payload.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Step 1: Resolve trusted server-side order_id and payment intent from DB
        intent = None
        if req.payment_intent_id:
            try:
                pid_uuid = uuid.UUID(req.payment_intent_id)
                intent = await conn.fetchrow(
                    """SELECT payment_intent_id, merchant_id, razorpay_order_id, active_payment_id, current_state
                       FROM payment_intents WHERE payment_intent_id = $1""",
                    pid_uuid
                )
            except ValueError:
                pass

        if not intent and req.razorpay_order_id:
            intent = await conn.fetchrow(
                """SELECT payment_intent_id, merchant_id, razorpay_order_id, active_payment_id, current_state
                   FROM payment_intents WHERE razorpay_order_id = $1""",
                req.razorpay_order_id
            )

        if not intent:
            raise HTTPException(
                status_code=404,
                detail={"error": "intent_not_found", "message": "Payment intent associated with order_id not found"}
            )

        verify_merchant_access(user, intent["merchant_id"])

        pid = intent["payment_intent_id"]
        server_order_id = intent.get("razorpay_order_id") or intent.get("order_id") or req.razorpay_order_id

        # Step 2: Verify signature using trusted server_order_id
        from razorpay.webhooks import verify_payment_signature
        valid = verify_payment_signature(server_order_id, req.razorpay_payment_id, req.razorpay_signature)
        if not valid:
            print(
                f"[CHECKOUT_SECURITY] REJECTED order_id={server_order_id} payment_id={req.razorpay_payment_id} reason=invalid_signature",
                file=sys.stderr
            )
            # PRESERVE STATE SAFETY: DO NOT mutate payment_intents state
            raise HTTPException(
                status_code=401,
                detail={"error": "invalid_checkout_signature", "message": "Razorpay checkout signature verification failed"}
            )

        # Step 3: Idempotent Check — if already AUTHORIZED/CAPTURED with matching payment_id, return success
        if intent.get("current_state") in ("AUTHORIZED", "CAPTURED", "RECONCILED") and intent.get("active_payment_id") == req.razorpay_payment_id:
            return {
                "status": "VERIFIED",
                "payment_intent_id": str(pid),
                "razorpay_order_id": server_order_id,
                "razorpay_payment_id": req.razorpay_payment_id,
                "idempotent": True,
            }

        # Step 4: Perform State Transition & Persistence
        await conn.execute(
            """UPDATE payment_intents
               SET active_payment_id = $1, current_state = 'AUTHORIZED', updated_at = NOW()
               WHERE payment_intent_id = $2""",
            req.razorpay_payment_id, pid
        )

        outbox_key = f"outbox_checkout_{req.razorpay_payment_id}"
        await conn.execute(
            """INSERT INTO outbox_events (event_type, aggregate_id, merchant_id, idempotency_key, payload, status)
               VALUES ('RESOLVE_INTENT', $1, $2, $3, $4, 'PENDING')
               ON CONFLICT (idempotency_key) DO NOTHING""",
            str(pid),
            intent["merchant_id"],
            outbox_key,
            json.dumps({
                "payment_intent_id": str(pid),
                "merchant_id": intent["merchant_id"],
                "razorpay_payment_id": req.razorpay_payment_id,
                "razorpay_order_id": server_order_id,
                "event_type": "payment.authorized",
                "source": "CHECKOUT_VERIFICATION",
            })
        )

        await conn.execute(
            """INSERT INTO audit_events (event_type, actor_id, resource_type, resource_id, payload)
               VALUES ('CHECKOUT_VERIFIED', 'CUSTOMER', 'PAYMENT_INTENT', $1, $2)""",
            str(pid),
            json.dumps({"razorpay_order_id": server_order_id, "razorpay_payment_id": req.razorpay_payment_id})
        )

    return {
        "status": "VERIFIED",
        "payment_intent_id": str(pid),
        "razorpay_order_id": server_order_id,
        "razorpay_payment_id": req.razorpay_payment_id,
        "idempotent": False,
    }


class ReportFailureRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    reason: Optional[str] = None
    payment_intent_id: Optional[str] = None


@router.post("/report_failure", summary="Report failed payment attempt from Razorpay Checkout JS modal")
async def report_checkout_failure(req: ReportFailureRequest, user: dict = Depends(require_permission("write:create_order"))):
    """
    Record an explicit checkout failure event reported by Razorpay Checkout JS SDK modal.
    1. Query trusted local DB state for the payment intent by razorpay_order_id / payment_intent_id.
    2. Link active_payment_id if present.
    3. Update current_state to FAILED.
    4. Record immutable audit log.
    5. Enqueue outbox resolution task so AI Detective & Policy Engine process the failure.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        intent = None
        if req.payment_intent_id:
            try:
                pid_uuid = uuid.UUID(req.payment_intent_id)
                intent = await conn.fetchrow(
                    """SELECT payment_intent_id, merchant_id, razorpay_order_id, active_payment_id, current_state
                       FROM payment_intents WHERE payment_intent_id = $1""",
                    pid_uuid
                )
            except ValueError:
                pass

        if not intent and req.razorpay_order_id:
            intent = await conn.fetchrow(
                """SELECT payment_intent_id, merchant_id, razorpay_order_id, active_payment_id, current_state
                   FROM payment_intents WHERE razorpay_order_id = $1""",
                req.razorpay_order_id
            )

        if not intent:
            raise HTTPException(
                status_code=404,
                detail={"error": "intent_not_found", "message": "Payment intent associated with order_id not found"}
            )

        verify_merchant_access(user, intent["merchant_id"])
        pid = intent["payment_intent_id"]
        server_order_id = intent.get("razorpay_order_id") or req.razorpay_order_id

        # Update intent state to FAILED
        await conn.execute(
            """UPDATE payment_intents
               SET active_payment_id = COALESCE($1, active_payment_id),
                   current_state = 'FAILED',
                   updated_at = NOW()
               WHERE payment_intent_id = $2""",
            req.razorpay_payment_id, pid
        )

        # Enqueue outbox task for AI Detective + Policy Engine processing
        outbox_key = f"outbox_failure_{req.razorpay_payment_id or uuid.uuid4().hex[:8]}"
        await conn.execute(
            """INSERT INTO outbox_events (event_type, aggregate_id, merchant_id, idempotency_key, payload, status)
               VALUES ('RESOLVE_INTENT', $1, $2, $3, $4, 'PENDING')
               ON CONFLICT (idempotency_key) DO NOTHING""",
            str(pid),
            intent["merchant_id"],
            outbox_key,
            json.dumps({
                "payment_intent_id": str(pid),
                "merchant_id": intent["merchant_id"],
                "razorpay_payment_id": req.razorpay_payment_id,
                "razorpay_order_id": server_order_id,
                "event_type": "payment.failed",
                "reason": req.reason or "Checkout payment attempt declined",
                "source": "CHECKOUT_FAILURE_CALLBACK",
            })
        )

        # Record audit log
        await conn.execute(
            """INSERT INTO audit_events (event_type, actor_id, resource_type, resource_id, payload)
               VALUES ('CHECKOUT_FAILED', 'CUSTOMER', 'PAYMENT_INTENT', $1, $2)""",
            str(pid),
            json.dumps({
                "razorpay_order_id": server_order_id,
                "razorpay_payment_id": req.razorpay_payment_id,
                "reason": req.reason,
            })
        )

    return {
        "status": "RECORDED_FAILURE",
        "payment_intent_id": str(pid),
        "razorpay_order_id": server_order_id,
        "razorpay_payment_id": req.razorpay_payment_id,
        "current_state": "FAILED",
    }
