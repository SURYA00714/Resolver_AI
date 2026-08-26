# FILE: db/connection.py
import os
import sys
import asyncpg
from typing import Optional

DB_URL = os.getenv("DATABASE_URL", "postgresql://resolver:resolver@localhost:5432/resolverai")

_pool: Optional[asyncpg.Pool] = None


async def init_db() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(dsn=DB_URL)
        except Exception as e:
            print(f"Database connection pool initialization error: {e}", file=sys.stderr)
            raise e
    return _pool


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        return await init_db()
    return _pool


async def close_db() -> None:
    global _pool
    if _pool is not None:
        try:
            await _pool.close()
            _pool = None
        except Exception as e:
            print(f"Error closing database pool: {e}", file=sys.stderr)
            raise e


async def check_db() -> bool:
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            val = await conn.fetchval("SELECT 1")
            return val == 1
    except Exception as e:
        print(f"Database check failed: {e}", file=sys.stderr)
        raise e
