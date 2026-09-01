# FILE: api/webhook_receiver.py
"""POST /webhook/razorpay — Signature Verification, Deduplication, Outbox (§12)."""
import hashlib
import json
import sys
import uuid
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Header, HTTPException, Request

from core.idempotency import is_event_processed, mark_event_processed
from core.rate_limiter import is_rate_limited
from db.connection import get_pool
from domain.errors import WebhookSignatureError
from razorpay.webhooks import verify_webhook_signature

router = APIRouter()


@router.post("/webhook/razorpay")
async def handle_razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
    x_razorpay_event_id: str = Header(None, alias="X-Razorpay-Event-Id"),
):
    """
    Accept real Razorpay webhooks:
    1. Read raw body bytes
    2. Verify HMAC-SHA256 signature using X-Razorpay-Signature
    3. Deduplicate via Redis & DB
    4. Persist immutable event in payment_events
    5. Upsert payment_intent state
    6. Enqueue durable outbox resolution task
    """
    raw_body = await request.body()
    correlation_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

    # Step 1: Signature Verification
    signature_valid = verify_webhook_signature(raw_body, x_razorpay_signature or "")
    if not signature_valid:
        print(f"[WEBHOOK] Invalid Razorpay webhook signature! correlation_id={correlation_id}", file=sys.stderr)
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Step 2: Parse JSON Payload
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")

    event_type = data.get("event", "UNKNOWN_EVENT")
    payload_data = data.get("payload", {})

    # Extract payment entity or order entity
    payment_entity = payload_data.get("payment", {}).get("entity", {})
    order_entity = payload_data.get("order", {}).get("entity", {})
    refund_entity = payload_data.get("refund", {}).get("entity", {})

    razorpay_payment_id = payment_entity.get("id") or refund_entity.get("payment_id")
    razorpay_order_id = payment_entity.get("order_id") or order_entity.get("id")
    notes = payment_entity.get("notes") or order_entity.get("notes") or {}

    merchant_id = notes.get("merchant_id") or "default_merchant"
    merchant_ref = notes.get("merchant_reference") or notes.get("merchant_order_id")
    order_id = razorpay_order_id or merchant_ref or f"ORD_{uuid.uuid4().hex[:8]}"

    # Derive deterministic Payment Intent UUID from order_id or notes
    raw_intent_id = notes.get("payment_intent_id")
    if raw_intent_id:
        try:
            payment_intent_id = uuid.UUID(str(raw_intent_id))
        except ValueError:
            payment_intent_id = uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_intent_id))
    else:
        payment_intent_id = uuid.uuid5(uuid.NAMESPACE_DNS, str(order_id))

    # Parse Amount (Razorpay delivers amount in paise)
    from domain.money import minor_units_to_decimal, validate_currency
    amount_raw = payment_entity.get("amount") or order_entity.get("amount") or refund_entity.get("amount") or 0
    raw_curr = payment_entity.get("currency") or order_entity.get("currency") or "INR"
    currency = validate_currency(raw_curr)
    amount = minor_units_to_decimal(int(amount_raw), currency) if amount_raw > 0 else Decimal("0.00")

    source = "RAZORPAY"
    external_event_id = x_razorpay_event_id or data.get("event_id") or f"evt_{uuid.uuid4().hex[:12]}"
    trace_id = data.get("trace_id") or correlation_id

    # Step 3: Fast-Path Redis Deduplication
    if await is_event_processed(source, external_event_id):
        return {"status": "ignored", "reason": "duplicate event (redis)"}

    payload_json = json.dumps(data, sort_keys=True, default=str)
    payload_hash = hashlib.sha256(raw_body).hexdigest()[:32]

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Step 4: Persist Immutable Payment Event
        try:
            await conn.execute(
                """INSERT INTO payment_events
                   (payment_intent_id, merchant_id, source, external_event_id, external_transaction_id, event_type, payload, payload_hash, trace_id, correlation_id, signature_verified)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)""",
                payment_intent_id, merchant_id, source, external_event_id, razorpay_payment_id, event_type, payload_json, payload_hash, trace_id, correlation_id, signature_valid,
            )
        except asyncpg.UniqueViolationError:
            await mark_event_processed(source, external_event_id)
            return {"status": "ignored", "reason": "duplicate event (db)"}

        # Step 5: Upsert Payment Intent
        await conn.execute(
            """INSERT INTO payment_intents
               (payment_intent_id, merchant_id, merchant_reference, order_id, razorpay_order_id, active_payment_id, amount, currency, current_state, active_rail)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_RAIL', 'RAZORPAY')
               ON CONFLICT (payment_intent_id) DO UPDATE SET
                 razorpay_order_id = COALESCE(EXCLUDED.razorpay_order_id, payment_intents.razorpay_order_id),
                 active_payment_id = COALESCE(EXCLUDED.active_payment_id, payment_intents.active_payment_id),
                 amount = CASE WHEN EXCLUDED.amount > 0 THEN EXCLUDED.amount ELSE payment_intents.amount END,
                 updated_at = NOW()""",
            payment_intent_id, merchant_id, merchant_ref, order_id, razorpay_order_id, razorpay_payment_id, amount, currency,
        )

        # Step 6: Create Durable Outbox Task for Resolution Engine (with unique idempotency_key)
        outbox_idempotency_key = f"outbox_evt_{source}_{external_event_id}"
        await conn.execute(
            """INSERT INTO outbox_events (event_type, aggregate_id, merchant_id, idempotency_key, payload, status)
               VALUES ('RESOLVE_INTENT', $1, $2, $3, $4, 'PENDING')
               ON CONFLICT (idempotency_key) DO NOTHING""",
            str(payment_intent_id),
            merchant_id,
            outbox_idempotency_key,
            json.dumps({
                "payment_intent_id": str(payment_intent_id),
                "merchant_id": merchant_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_order_id": razorpay_order_id,
                "event_type": event_type,
                "trace_id": trace_id,
                "correlation_id": correlation_id,
            }),
        )

    # Mark as processed in Redis
    await mark_event_processed(source, external_event_id)

    return {
        "status": "accepted",
        "payment_intent_id": str(payment_intent_id),
        "razorpay_payment_id": razorpay_payment_id,
        "trace_id": trace_id,
        "correlation_id": correlation_id,
    }


@router.post("/webhook")
async def handle_legacy_webhook(request: Request):
    """Deprecated webhook route — redirects to the authenticated endpoint.
    
    SECURITY: This route does NOT bypass signature verification.
    Use POST /webhook/razorpay with the X-Razorpay-Signature header.
    """
    raise HTTPException(
        status_code=400,
        detail={
            "error": "deprecated_endpoint",
            "message": "Use POST /webhook/razorpay with X-Razorpay-Signature header.",
        }
    )
