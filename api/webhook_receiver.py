# FILE: api/webhook_receiver.py
"""POST /webhook — Validate, deduplicate, store, enqueue (§35-36)."""
import hashlib
import json
import sys
import uuid

from decimal import Decimal
from fastapi import APIRouter, HTTPException, Request

import asyncpg

from core.idempotency import is_event_processed, mark_event_processed
from db.connection import get_pool

router = APIRouter()


@router.post("/webhook")
async def handle_webhook(request: Request):
    """
    Accept a payment webhook. Steps:
    1. Parse and validate
    2. Check Redis dedup (fast path)
    3. Store event in payment_events (DB dedup via UNIQUE)
    4. Upsert payment_intent
    5. Create outbox entry for async resolution
    6. Return fast
    """
    payload = await request.json()

    raw_intent_id = payload.get("payment_intent_id")
    order_id = payload.get("order_id")
    amount_raw = payload.get("amount")
    event_type = payload.get("event_type", "PAYMENT_INITIATED")
    source = payload.get("source", "RAZORPAY")
    external_event_id = payload.get("event_id", payload.get("external_event_id", f"evt_{uuid.uuid4().hex[:12]}"))
    rail = payload.get("rail", payload.get("active_rail", "UPI_HDFC"))
    merchant_id = payload.get("merchant_id", "default_merchant")
    currency = payload.get("currency", "INR")

    if not raw_intent_id or not order_id or amount_raw is None:
        raise HTTPException(status_code=400, detail="Missing: payment_intent_id, order_id, amount")

    try:
        payment_intent_id = uuid.UUID(str(raw_intent_id))
    except ValueError:
        payment_intent_id = uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_intent_id))

    try:
        amount = Decimal(str(amount_raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid amount: {e}")

    # Fast-path dedup via Redis
    if await is_event_processed(source, external_event_id):
        return {"status": "ignored", "reason": "duplicate event (redis)"}

    payload_json = json.dumps(payload, sort_keys=True, default=str)
    payload_hash = hashlib.sha256(payload_json.encode()).hexdigest()[:32]
    trace_id = payload.get("trace_id", uuid.uuid4().hex[:16])

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Store event (DB-level dedup via UNIQUE constraint)
        try:
            await conn.execute(
                """INSERT INTO payment_events
                   (payment_intent_id, source, external_event_id, event_type, payload, payload_hash, trace_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                payment_intent_id, source, external_event_id, event_type, payload_json, payload_hash, trace_id,
            )
        except asyncpg.UniqueViolationError:
            await mark_event_processed(source, external_event_id)
            return {"status": "ignored", "reason": "duplicate event (db)"}

        # Upsert payment intent
        await conn.execute(
            """INSERT INTO payment_intents
               (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
               VALUES ($1, $2, $3, $4, $5, 'PENDING_RAIL', $6)
               ON CONFLICT (payment_intent_id) DO UPDATE SET
                 amount = EXCLUDED.amount,
                 active_rail = EXCLUDED.active_rail,
                 updated_at = NOW()""",
            payment_intent_id, order_id, merchant_id, amount, currency, rail,
        )

        # Create outbox entry for durable async processing
        await conn.execute(
            """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
               VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
            str(payment_intent_id),
            json.dumps({"payment_intent_id": str(payment_intent_id), "trace_id": trace_id}),
        )

    # Mark in Redis
    await mark_event_processed(source, external_event_id)

    return {"status": "accepted", "payment_intent_id": str(payment_intent_id), "trace_id": trace_id}
