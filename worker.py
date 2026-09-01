# FILE: worker.py
"""Durable Outbox Worker — Polls and processes pending resolution tasks.

Run as: python3 worker.py

- Crash-safe: if the worker dies, pending outbox items will be retried on restart.
- Exponential backoff: failed items are retried after increasing delays.
- Dead-letter: items exceeding MAX_ATTEMPTS are moved to DEAD_LETTER status.
- FOR UPDATE SKIP LOCKED: safe for parallel workers.
- available_at: items are not retried until this timestamp passes.
"""
import asyncio
import json
import math
import os
import sys
import uuid
from datetime import datetime, timezone

from db.connection import init_db, get_pool, close_db
from core.idempotency import close_redis
from core.resolver import resolve

POLL_INTERVAL = int(os.getenv("WORKER_POLL_INTERVAL", "2"))
MAX_ATTEMPTS = int(os.getenv("WORKER_MAX_ATTEMPTS", "5"))
WORKER_ID = os.getenv("WORKER_ID", f"worker-{uuid.uuid4().hex[:6]}")

_log_format = "json"


def _log(level: str, event: str, **kwargs):
    """Emit a structured JSON log line."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": "outbox_worker",
        "worker_id": WORKER_ID,
        "event": event,
        **kwargs,
    }
    print(json.dumps(entry), file=sys.stderr)


async def reclaim_stuck_tasks(lease_timeout_seconds: int = 60) -> int:
    """Reclaim tasks stuck in PROCESSING due to worker crash/SIGKILL."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """UPDATE outbox_events
               SET status = 'PENDING',
                   available_at = NOW(),
                   last_error = 'Reclaimed after worker crash/lease timeout'
               WHERE status = 'PROCESSING'
                 AND processing_started_at IS NOT NULL
                 AND processing_started_at <= NOW() - ($1 * INTERVAL '1 second')""",
            lease_timeout_seconds,
        )
        # Extract count from 'UPDATE <n>'
        try:
            count = int(result.split(" ")[1])
        except Exception:
            count = 0
        if count > 0:
            _log("WARN", "stuck_tasks_reclaimed", count=count, lease_timeout_seconds=lease_timeout_seconds)
        return count


async def claim_and_process() -> int:
    """Claim one available pending outbox event and process it. Returns 1 if processed, 0 if idle."""
    pool = await get_pool()
    
    # First, reclaim any crashed/stuck tasks
    await reclaim_stuck_tasks()

    async with pool.acquire() as conn:
        # Claim the oldest available pending event (atomic via UPDATE ... RETURNING)
        # Respects available_at for exponential backoff and sets processing_started_at
        row = await conn.fetchrow(
            """UPDATE outbox_events
               SET status = 'PROCESSING',
                   attempts = attempts + 1,
                   processing_started_at = NOW()
               WHERE outbox_id = (
                   SELECT outbox_id FROM outbox_events
                   WHERE status = 'PENDING'
                     AND attempts < $1
                     AND (available_at IS NULL OR available_at <= NOW())
                   ORDER BY created_at ASC
                   LIMIT 1
                   FOR UPDATE SKIP LOCKED
               )
               RETURNING outbox_id, event_type, aggregate_id, merchant_id, payload, attempts""",
            MAX_ATTEMPTS,
        )

        if not row:
            return 0

        outbox_id = row["outbox_id"]
        attempts = row["attempts"]
        payload = json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"]
        payment_intent_id_str = payload.get("payment_intent_id", row["aggregate_id"])

        try:
            payment_intent_id = uuid.UUID(payment_intent_id_str)
            trace_id = payload.get("trace_id")

            _log("INFO", "processing_start",
                 outbox_id=str(outbox_id),
                 payment_intent_id=payment_intent_id_str[:8],
                 attempt=attempts)

            result = await resolve(payment_intent_id, trace_id=trace_id)

            _log("INFO", "processing_complete",
                 outbox_id=str(outbox_id),
                 payment_intent_id=payment_intent_id_str[:8],
                 status=result.get("status"),
                 final_state=result.get("final_state", "N/A"))

            # Mark as processed
            await conn.execute(
                "UPDATE outbox_events SET status = 'PROCESSED', processed_at = NOW() WHERE outbox_id = $1",
                outbox_id,
            )
            return 1

        except Exception as e:
            error_msg = str(e)
            _log("ERROR", "processing_error",
                 outbox_id=str(outbox_id),
                 payment_intent_id=payment_intent_id_str[:8],
                 error=error_msg,
                 attempt=attempts)

            if attempts >= MAX_ATTEMPTS:
                # Move to dead-letter — no more retries
                await conn.execute(
                    """UPDATE outbox_events
                       SET status = 'DEAD_LETTER', last_error = $1
                       WHERE outbox_id = $2""",
                    error_msg[:1000], outbox_id,
                )
                _log("WARN", "dead_letter",
                     outbox_id=str(outbox_id),
                     payment_intent_id=payment_intent_id_str[:8],
                     final_error=error_msg[:200])
            else:
                # Exponential backoff: 2^attempts seconds (2, 4, 8, 16, 32...)
                backoff_seconds = int(math.pow(2, attempts))
                await conn.execute(
                    """UPDATE outbox_events
                       SET status = 'PENDING',
                           last_error = $1,
                           available_at = NOW() + ($2 * INTERVAL '1 second')
                       WHERE outbox_id = $3""",
                    error_msg[:1000], backoff_seconds, outbox_id,
                )
                _log("INFO", "retry_scheduled",
                     outbox_id=str(outbox_id),
                     payment_intent_id=payment_intent_id_str[:8],
                     backoff_seconds=backoff_seconds)
            return 0


async def run_worker():
    """Main worker loop."""
    _log("INFO", "worker_start", poll_interval=POLL_INTERVAL, max_attempts=MAX_ATTEMPTS)

    db_ready = False
    while not db_ready:
        try:
            await init_db()
            db_ready = True
            _log("INFO", "db_connected")
        except Exception as e:
            _log("WARN", "db_connect_retry", error=str(e), retry_in_seconds=POLL_INTERVAL)
            await asyncio.sleep(POLL_INTERVAL)

    try:
        while True:
            processed = await claim_and_process()
            if processed == 0:
                await asyncio.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        _log("INFO", "worker_shutdown_requested")
    finally:
        await close_db()
        await close_redis()
        _log("INFO", "worker_stopped")


if __name__ == "__main__":
    asyncio.run(run_worker())

