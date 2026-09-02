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

    raw_event_type = data.get("event", "UNKNOWN_EVENT")
    # Consolidate into EXACTLY 4 supported webhook flows:
    # 1. AUTHORIZED (payment.authorized)
    # 2. CAPTURED (payment.captured)
    # 3. FAILED (payment.failed)
    # 4. REFUNDED (refund.processed / refund.created / payment.refunded)
    # Generalized Razorpay Provider Event Mapping Matrix (§28)
    WEBHOOK_FLOW_MAP = {
        "payment.authorized": "payment.authorized",
        "payment.captured": "payment.captured",
        "payment.failed": "payment.failed",
        "payment.dispute.created": "payment.dispute.created",
        "payment.dispute.won": "payment.dispute.won",
        "payment.dispute.lost": "payment.dispute.lost",
        "refund.created": "refund.created",
        "refund.failed": "refund.failed",
        "refund.processed": "refund.processed",
        "payment.refunded": "refund.processed",
        "payout.initiated": "payout.initiated",
        "payout.processed": "payout.processed",
        "payout.reversed": "payout.reversed",
    }
    is_supported_flow = raw_event_type in WEBHOOK_FLOW_MAP
    event_type = WEBHOOK_FLOW_MAP.get(raw_event_type, f"UNSUPPORTED_{raw_event_type}")
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

    from core.idempotency import verify_idempotency_payload
    payload_hash = hashlib.sha256(raw_body).hexdigest()[:32]

    # Step 3: Fast-Path Redis Deduplication & Payload Match Verification
    dedup_check = await verify_idempotency_payload(source, external_event_id, payload_hash)
    if dedup_check == "PAYLOAD_MISMATCH":
        raise HTTPException(status_code=409, detail="Idempotency key payload mismatch")
    elif dedup_check == "VALID_DUPLICATE":
        return {"status": "ignored", "reason": "duplicate event (redis)"}

    payload_json = json.dumps(data, sort_keys=True, default=str)

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
            await mark_event_processed(source, external_event_id, payload_hash=payload_hash)
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

        if not is_supported_flow:
            await mark_event_processed(source, external_event_id, payload_hash=payload_hash)
            return {
                "status": "recorded",
                "event_type": event_type,
                "reason": "unsupported provider event persisted as raw evidence without state mutation",
                "payment_intent_id": str(payment_intent_id),
            }

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
    await mark_event_processed(source, external_event_id, payload_hash=payload_hash)

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


@router.get("/webhook/diagnostics", summary="Production webhook diagnostics & stats")
@router.get("/webhooks/diagnostics", summary="Production webhook diagnostics & stats (alias)")
async def get_webhook_diagnostics():
    """
    Production webhook receiver diagnostics & real-time health.
    Reports endpoint status, total events received, signature verification rates,
    and database persistence status. Never exposes secret keys.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        total_events = await conn.fetchval("SELECT COUNT(*) FROM payment_events")
        verified_events = await conn.fetchval("SELECT COUNT(*) FROM payment_events WHERE signature_verified = TRUE")
        unsupported_events = await conn.fetchval("SELECT COUNT(*) FROM payment_events WHERE event_type LIKE 'UNSUPPORTED_%'")
        last_event = await conn.fetchrow("SELECT event_id, event_type, source, received_at, signature_verified FROM payment_events ORDER BY received_at DESC LIMIT 1")

    return {
        "webhook_endpoint_configured": True,
        "public_webhook_url": "https://resolver-ai-l3ks.onrender.com/webhook/razorpay",
        "environment": config.ENVIRONMENT,
        "razorpay_mode": config.RAZORPAY_MODE,
        "stats": {
            "total_events_received": total_events or 0,
            "total_verified_events": verified_events or 0,
            "total_unsupported_events": unsupported_events or 0,
        },
        "database_persistence": "HEALTHY",
        "last_event": {
            "event_id": str(last_event["event_id"]) if last_event else None,
            "event_type": last_event["event_type"] if last_event else None,
            "source": last_event["source"] if last_event else None,
            "received_at": str(last_event["received_at"]) if last_event else None,
            "signature_verified": last_event["signature_verified"] if last_event else False,
        } if last_event else None,
    }
