# FILE: worker.py
"""Durable Outbox Worker — Polls and processes pending resolution tasks (§37).

Run as: python3 worker.py

This is the only component that calls core.resolver.resolve().
Crash-safe: if the worker dies, pending outbox items will be retried on restart.
"""
import asyncio
import json
import os
import sys
import uuid

from db.connection import init_db, get_pool, close_db
from core.idempotency import close_redis
from core.resolver import resolve

POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "2"))
MAX_ATTEMPTS = int(os.getenv("WORKER_MAX_ATTEMPTS", "5"))


async def claim_and_process() -> int:
    """Claim one pending outbox event and process it. Returns 1 if processed, 0 if idle."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Claim the oldest pending event (atomic via UPDATE ... RETURNING)
        row = await conn.fetchrow(
            """UPDATE outbox_events
               SET status = 'PROCESSING', attempts = attempts + 1
               WHERE outbox_id = (
                   SELECT outbox_id FROM outbox_events
                   WHERE status = 'PENDING' AND attempts < $1
                   ORDER BY created_at ASC
                   LIMIT 1
                   FOR UPDATE SKIP LOCKED
               )
               RETURNING outbox_id, event_type, aggregate_id, payload""",
            MAX_ATTEMPTS,
        )

        if not row:
            return 0

        outbox_id = row["outbox_id"]
        payload = json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"]
        payment_intent_id_str = payload.get("payment_intent_id", row["aggregate_id"])

        try:
            payment_intent_id = uuid.UUID(payment_intent_id_str)
            trace_id = payload.get("trace_id")

            print(f"[WORKER] Processing {payment_intent_id_str[:8]}...", file=sys.stderr)
            result = await resolve(payment_intent_id, trace_id=trace_id)
            print(f"[WORKER] Result: {result.get('status')} | {result.get('final_state', 'N/A')}", file=sys.stderr)

            # Mark as processed
            await conn.execute(
                "UPDATE outbox_events SET status = 'PROCESSED', processed_at = NOW() WHERE outbox_id = $1",
                outbox_id,
            )
            return 1

        except Exception as e:
            print(f"[WORKER] Error processing {outbox_id}: {e}", file=sys.stderr)
            await conn.execute(
                "UPDATE outbox_events SET status = CASE WHEN attempts >= $1 THEN 'FAILED' ELSE 'PENDING' END WHERE outbox_id = $2",
                MAX_ATTEMPTS, outbox_id,
            )
            return 0


async def run_worker():
    """Main worker loop."""
    print("[WORKER] Starting outbox worker...", file=sys.stderr)
    await init_db()
    print("[WORKER] Database connected. Polling for events...", file=sys.stderr)

    try:
        while True:
            processed = await claim_and_process()
            if processed == 0:
                await asyncio.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("[WORKER] Shutting down...", file=sys.stderr)
    finally:
        await close_db()
        await close_redis()
        print("[WORKER] Stopped.", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(run_worker())
