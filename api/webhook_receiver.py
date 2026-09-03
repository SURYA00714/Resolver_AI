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

import config

router = APIRouter()

# Global counter for rejected webhook attempts (e.g. 401 invalid signature)
REJECTED_WEBHOOK_COUNT = 0


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
    global REJECTED_WEBHOOK_COUNT
    raw_body = await request.body()
    correlation_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

    # Stage 1: RECEIVED
    print(f"[WEBHOOK] RECEIVED correlation_id={correlation_id} event_id={x_razorpay_event_id or 'none'}", file=sys.stderr)

    # Step 1: Signature Verification
    signature_valid = verify_webhook_signature(raw_body, x_razorpay_signature or "")
    if not signature_valid:
        REJECTED_WEBHOOK_COUNT += 1
        print(f"[WEBHOOK] REJECTED correlation_id={correlation_id} reason=invalid_signature", file=sys.stderr)
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Stage 2: SIGNATURE_VERIFIED
    print(f"[WEBHOOK] SIGNATURE_VERIFIED correlation_id={correlation_id}", file=sys.stderr)

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

    # Stage 3: EVENT_NORMALIZED
    print(
        f"[WEBHOOK] EVENT_NORMALIZED correlation_id={correlation_id} raw_event={raw_event_type} event_type={event_type} intent_id={payment_intent_id}",
        file=sys.stderr,
    )

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

        # Stage 4: DB_PERSISTED
        print(f"[WEBHOOK] DB_PERSISTED correlation_id={correlation_id} external_event_id={external_event_id}", file=sys.stderr)

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

        # Stage 5: OUTBOX_ENQUEUED
        print(f"[WEBHOOK] OUTBOX_ENQUEUED correlation_id={correlation_id} outbox_key={outbox_idempotency_key}", file=sys.stderr)

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


@router.get("/webhook/diagnostics", summary="Production webhook diagnostics & stats", operation_id="get_webhook_diagnostics")
async def get_webhook_diagnostics():
    """
    Production webhook receiver diagnostics & real-time health.
    Reports route status, secret config state, event counts, last event info.
    NEVER exposes secrets or sensitive data.
    """
    webhook_secret_configured = bool(config.RAZORPAY_WEBHOOK_SECRET)
    route_registered = True

    total_events = REJECTED_WEBHOOK_COUNT
    verified_events = 0
    rejected_events = REJECTED_WEBHOOK_COUNT
    last_event_at = None
    last_event_type = None

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            total_db = await conn.fetchval("SELECT COUNT(*) FROM payment_events")
            verified_db = await conn.fetchval("SELECT COUNT(*) FROM payment_events WHERE signature_verified = TRUE")
            unverified_db = await conn.fetchval("SELECT COUNT(*) FROM payment_events WHERE signature_verified = FALSE")

            verified_events = verified_db or 0
            rejected_events = REJECTED_WEBHOOK_COUNT + (unverified_db or 0)
            total_events = (total_db or 0) + REJECTED_WEBHOOK_COUNT

            last_event = await conn.fetchrow(
                "SELECT event_type, received_at FROM payment_events ORDER BY received_at DESC LIMIT 1"
            )
            if last_event:
                last_event_type = last_event["event_type"]
                if last_event["received_at"]:
                    last_event_at = str(last_event["received_at"])
    except Exception as e:
        print(f"[WEBHOOK_DIAGNOSTICS] DB query failed, returning fallback metrics: {e}", file=sys.stderr)

    return {
        "route_registered": route_registered,
        "webhook_secret_configured": webhook_secret_configured,
        "events_received": total_events,
        "verified_events": verified_events,
        "rejected_events": rejected_events,
        "last_event_at": last_event_at,
        "last_event_type": last_event_type,
        "public_webhook_url": "https://resolver-ai-l3ks.onrender.com/webhook/razorpay",
        "environment": config.ENVIRONMENT,
        "razorpay_mode": config.RAZORPAY_MODE,
    }


@router.get("/webhooks/diagnostics", summary="Production webhook diagnostics & stats (alias)", operation_id="get_webhooks_diagnostics_alias")
async def get_webhooks_diagnostics_alias():
    return await get_webhook_diagnostics()
