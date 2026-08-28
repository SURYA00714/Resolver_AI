# FILE: core/reconciliation_poller.py
"""Bounded reconciliation poller — detects stale, missing, or mismatched payment states (§14, 37)."""
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import asyncpg

from core.resolver import resolve
from db.connection import get_pool

POLL_INTERVAL = int(__import__("os").getenv("RECONCILIATION_POLL_INTERVAL", "300"))
STALE_THRESHOLD_SECONDS = int(__import__("os").getenv("RECONCILIATION_STALE_THRESHOLD", "600"))
MAX_POLL_BATCH = int(__import__("os").getenv("RECONCILIATION_MAX_BATCH", "50"))


def _log(level: str, event: str, **kwargs):
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": "reconciliation_poller",
        "event": event,
        **kwargs,
    }
    print(json.dumps(entry), file=sys.stderr)


async def find_stale_intents(conn: asyncpg.Connection) -> List[Dict[str, Any]]:
    """Find payment intents that are in a non-terminal state but have not been updated recently."""
    rows = await conn.fetch(
        """
        SELECT payment_intent_id, current_state, updated_at, amount, currency, active_payment_id, razorpay_order_id
        FROM payment_intents
        WHERE current_state NOT IN ('CAPTURED', 'RECONCILED', 'MANUAL_REVIEW', 'FAILED')
          AND updated_at < NOW() - INTERVAL '1 second' * $1
        ORDER BY updated_at ASC
        LIMIT $2
        """,
        STALE_THRESHOLD_SECONDS,
        MAX_POLL_BATCH,
    )
    return [dict(r) for r in rows]


async def poll_once() -> Dict[str, int]:
    """Run one reconciliation polling cycle."""
    pool = await get_pool()
    stats = {"scanned": 0, "stale": 0, "resolved": 0, "errors": 0}
    async with pool.acquire() as conn:
        stale_intents = await find_stale_intents(conn)
        stats["stale"] = len(stale_intents)
        for intent in stale_intents:
            stats["scanned"] += 1
            try:
                pid = uuid.UUID(str(intent["payment_intent_id"]))
                result = await resolve(pid, trace_id=f"poll_{uuid.uuid4().hex[:8]}")
                if result.get("status") in ("RESOLVED", "PROCESSED"):
                    stats["resolved"] += 1
                elif result.get("status") == "ERROR":
                    stats["errors"] += 1
            except Exception as e:
                _log("ERROR", "poll_error", payment_intent_id=str(intent["payment_intent_id"])[:8], error=str(e))
                stats["errors"] += 1
    return stats


async def run_poller():
    """Main reconciliation poller loop."""
    _log("INFO", "poller_start", interval=POLL_INTERVAL, stale_threshold=STALE_THRESHOLD_SECONDS)
    await get_pool()
    try:
        while True:
            stats = await poll_once()
            _log("INFO", "poll_cycle", **stats)
            await asyncio.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        _log("INFO", "poller_shutdown_requested")
    except Exception as e:
        _log("ERROR", "poller_fatal", error=str(e))
        raise


if __name__ == "__main__":
    asyncio.run(run_poller())
