# FILE: core/rate_limiter.py
"""Simple token-bucket style rate limiter backed by Redis with in-memory fallback."""
import asyncio
import time
from typing import Optional

import config

try:
    import redis.asyncio as aioredis
    HAS_REDIS = True
except ImportError:
    aioredis = None
    HAS_REDIS = False

_redis_client = None
_in_memory_buckets: dict = {}


async def _get_redis():
    global _redis_client
    if not HAS_REDIS:
        return None
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(config.REDIS_URL, decode_responses=True)
            await _redis_client.ping()
        except Exception:
            _redis_client = None
    return _redis_client


async def is_rate_limited(key: str, max_requests: int, window_seconds: int) -> bool:
    """Return True if the key has exceeded the rate limit."""
    if not config.RATE_LIMIT_ENABLED:
        return False
    now = time.time()
    bucket_key = f"ratelimit:{key}"
    r = await _get_redis()
    if r is not None:
        try:
            pipe = r.pipeline()
            pipe.zremrangebyscore(bucket_key, 0, now - window_seconds)
            pipe.zcard(bucket_key)
            pipe.zadd(bucket_key, {str(now): now})
            pipe.expire(bucket_key, window_seconds)
            results = await pipe.execute()
            count = results[1]
            return count >= max_requests
        except Exception:
            pass
    bucket = _in_memory_buckets.get(bucket_key, [])
    bucket = [t for t in bucket if t > now - window_seconds]
    bucket.append(now)
    _in_memory_buckets[bucket_key] = bucket
    return len(bucket) > max_requests
