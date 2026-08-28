# FILE: core/idempotency.py
"""Redis-backed idempotency + distributed lock (§14-15) with in-memory fallback."""
import os
import sys

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    aioredis = None
    HAS_REDIS = False

_redis_client = None
_in_memory_locks = set()
_in_memory_dedup = set()


async def get_redis():
    global _redis_client
    if not HAS_REDIS:
        return None
    if _redis_client is None:
        try:
            client = aioredis.from_url(REDIS_URL, decode_responses=True)
            await client.ping()
            _redis_client = client
        except Exception as e:
            print(f"[REDIS] Connection failed, using in-memory fallback: {e}", file=sys.stderr)
            _redis_client = None
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None


async def acquire_intent_lock(payment_intent_id: str, ttl_seconds: int = 30) -> bool:
    """Try to acquire a short-lived distributed lock for processing an intent."""
    r = await get_redis()
    lock_key = f"lock:intent:{payment_intent_id}"
    if r is not None:
        try:
            acquired = await r.set(lock_key, "1", ex=ttl_seconds, nx=True)
            return bool(acquired)
        except Exception:
            pass
    
    # In-memory lock fallback
    if lock_key in _in_memory_locks:
        return False
    _in_memory_locks.add(lock_key)
    return True


async def release_intent_lock(payment_intent_id: str) -> None:
    """Release the distributed lock for an intent."""
    r = await get_redis()
    lock_key = f"lock:intent:{payment_intent_id}"
    if r is not None:
        try:
            await r.delete(lock_key)
            return
        except Exception:
            pass
    _in_memory_locks.discard(lock_key)


async def is_event_processed(source: str, external_event_id: str) -> bool:
    """Check if an event has already been processed (deduplication)."""
    r = await get_redis()
    key = f"event:dedup:{source}:{external_event_id}"
    if r is not None:
        try:
            return bool(await r.exists(key))
        except Exception:
            pass
    return key in _in_memory_dedup


async def mark_event_processed(source: str, external_event_id: str, ttl_seconds: int = 3600) -> None:
    """Mark an event as processed with a TTL for garbage collection."""
    r = await get_redis()
    key = f"event:dedup:{source}:{external_event_id}"
    if r is not None:
        try:
            await r.set(key, "1", ex=ttl_seconds)
            return
        except Exception:
            pass
    _in_memory_dedup.add(key)
