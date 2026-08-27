# FILE: db/migrations.py
"""Database schema migrations for ResolverAI (§8)."""
import os
import sys
import asyncpg


async def run_migrations(pool: asyncpg.Pool) -> None:
    """Execute schema initialization and column migrations."""
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()
        async with pool.acquire() as conn:
            await conn.execute(sql)
            # Ensure new columns exist on existing tables if upgraded
            await conn.execute("""
                ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS merchant_reference VARCHAR(255);
                ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
                ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS active_payment_id VARCHAR(255);
                ALTER TABLE external_executions ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'RAZORPAY';
            """)
            print("[MIGRATIONS] Database schema and column updates applied successfully.", file=sys.stderr)
