# FILE: db/connection.py
import os
import sys
import asyncpg
from typing import Optional

import asyncio

def get_db_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql://resolver:resolver@localhost:5432/resolverai")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

_pool: Optional[asyncpg.Pool] = None


async def init_db(max_retries: int = 3, retry_interval: int = 1) -> asyncpg.Pool:
    global _pool
    if _pool is None:
        db_url = get_db_url()
        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                _pool = await asyncpg.create_pool(dsn=db_url)
                if _pool:
                    try:
                        from db.migrations import run_migrations
                        await run_migrations(_pool)
                    except Exception as me:
                        print(f"[DB] Migration notice: {me}", file=sys.stderr)
                print(f"[DB] Connection pool initialized successfully (attempt {attempt})", file=sys.stderr)
                return _pool
            except Exception as e:
                last_error = e
                print(f"[DB] Connection pool attempt {attempt}/{max_retries} failed: {e}", file=sys.stderr)
                if attempt < max_retries:
                    await asyncio.sleep(retry_interval)

        if last_error:
            raise last_error
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
