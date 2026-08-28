# FILE: db/migrations.py
"""Database schema migrations for ResolverAI."""
import os
import sys
import asyncpg


async def run_migrations(pool: asyncpg.Pool) -> None:
    """Execute schema initialization and idempotent column/index migrations."""
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()
        async with pool.acquire() as conn:
            await conn.execute(sql)

            # --- Idempotent column additions ---
            await conn.execute("""
                ALTER TABLE payment_intents
                    ADD COLUMN IF NOT EXISTS merchant_reference VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS active_payment_id VARCHAR(255);

                ALTER TABLE external_executions
                    ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'RAZORPAY';

                -- Outbox: exponential backoff + dead-letter support
                ALTER TABLE outbox_events
                    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT NOW(),
                    ADD COLUMN IF NOT EXISTS last_error TEXT;

                -- Webhook: correlation tracking + signature audit
                ALTER TABLE payment_events
                    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64),
                    ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT TRUE;

                -- Evidence: correlation tracking
                ALTER TABLE immutable_evidence
                    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);

                -- Audit: correlation tracking
                ALTER TABLE audit_events
                    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);
            """)

            # --- Indexes for performance ---
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_payment_events_received
                    ON payment_events(received_at DESC);

                CREATE INDEX IF NOT EXISTS idx_payment_events_intent
                    ON payment_events(payment_intent_id, received_at);

                CREATE INDEX IF NOT EXISTS idx_outbox_pending
                    ON outbox_events(status, available_at)
                    WHERE status IN ('PENDING', 'PROCESSING');

                CREATE INDEX IF NOT EXISTS idx_payment_intents_razorpay_order
                    ON payment_intents(razorpay_order_id)
                    WHERE razorpay_order_id IS NOT NULL;

                CREATE INDEX IF NOT EXISTS idx_payment_intents_active_payment
                    ON payment_intents(active_payment_id)
                    WHERE active_payment_id IS NOT NULL;

                CREATE INDEX IF NOT EXISTS idx_cases_status
                    ON reconciliation_cases(status, opened_at DESC);

                CREATE INDEX IF NOT EXISTS idx_audit_events_created
                    ON audit_events(created_at DESC);
            """)

            print("[MIGRATIONS] Schema, columns, and indexes applied successfully.", file=sys.stderr)

