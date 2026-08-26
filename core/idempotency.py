# FILE: core/idempotency.py
"""Redis-backed idempotency + distributed lock (§14-15)."""
import os
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


async def acquire_intent_lock(payment_intent_id: str, ttl_seconds: int = 30) -> bool:
    """Try to acquire a short-lived distributed lock for processing an intent."""
    r = await get_redis()
    lock_key = f"lock:intent:{payment_intent_id}"
    acquired = await r.set(lock_key, "1", ex=ttl_seconds, nx=True)
    return bool(acquired)


async def release_intent_lock(payment_intent_id: str) -> None:
    """Release the distributed lock for an intent."""
    r = await get_redis()
    lock_key = f"lock:intent:{payment_intent_id}"
    await r.delete(lock_key)


async def is_event_processed(source: str, external_event_id: str) -> bool:
    """Check if an event has already been processed (deduplication)."""
    r = await get_redis()
    key = f"event:dedup:{source}:{external_event_id}"
    return bool(await r.exists(key))


async def mark_event_processed(source: str, external_event_id: str, ttl_seconds: int = 3600) -> None:
    """Mark an event as processed with a TTL for garbage collection."""
    r = await get_redis()
    key = f"event:dedup:{source}:{external_event_id}"
    await r.set(key, "1", ex=ttl_seconds)
