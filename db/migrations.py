# FILE: db/migrations.py
"""Database schema migrations for ResolverAI — Production Hardened."""
import os
import sys
import asyncpg


async def run_migrations(pool: asyncpg.Pool) -> None:
    """Execute schema initialization and idempotent migrations."""
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.sql")
    if os.path.exists(schema_path):
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()
        async with pool.acquire() as conn:
            await conn.execute(sql)

            await conn.execute("""
                -- Multi-Tenancy & Outbox Lease Recovery column additions
                ALTER TABLE payment_intents
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant',
                    ADD COLUMN IF NOT EXISTS merchant_reference VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS active_payment_id VARCHAR(255);

                ALTER TABLE payment_events
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant',
                    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64),
                    ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT TRUE;

                ALTER TABLE external_executions
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant',
                    ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'RAZORPAY';

                ALTER TABLE outbox_events
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant',
                    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT NOW(),
                    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS last_error TEXT;

                ALTER TABLE immutable_evidence
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant',
                    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);

                ALTER TABLE audit_events
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant',
                    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(64);

                ALTER TABLE reconciliation_cases
                    ADD COLUMN IF NOT EXISTS divergence_type VARCHAR(50) DEFAULT 'NONE',
                    ADD COLUMN IF NOT EXISTS evidence_refs JSONB,
                    ADD COLUMN IF NOT EXISTS assigned_operator VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS merchant_id VARCHAR(255) DEFAULT 'default_merchant';
            """)

            # --- Indexes for performance and multi-tenancy ---
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_payment_intents_merchant
                    ON payment_intents(merchant_id, created_at DESC);

                CREATE INDEX IF NOT EXISTS idx_payment_events_merchant
                    ON payment_events(merchant_id, received_at DESC);

                CREATE INDEX IF NOT EXISTS idx_payment_events_received
                    ON payment_events(received_at DESC);

                CREATE INDEX IF NOT EXISTS idx_payment_events_intent
                    ON payment_events(payment_intent_id, received_at);

                CREATE INDEX IF NOT EXISTS idx_outbox_pending
                    ON outbox_events(status, available_at)
                    WHERE status IN ('PENDING', 'PROCESSING');

                CREATE INDEX IF NOT EXISTS idx_outbox_claim
                    ON outbox_events(status, available_at)
                    WHERE status IN ('PENDING', 'PROCESSING') AND available_at <= NOW();

                CREATE INDEX IF NOT EXISTS idx_payment_intents_razorpay_order
                    ON payment_intents(razorpay_order_id)
                    WHERE razorpay_order_id IS NOT NULL;

                CREATE INDEX IF NOT EXISTS idx_payment_intents_active_payment
                    ON payment_intents(active_payment_id)
                    WHERE active_payment_id IS NOT NULL;

                CREATE INDEX IF NOT EXISTS idx_cases_merchant_status
                    ON reconciliation_cases(merchant_id, status, opened_at DESC);

                CREATE INDEX IF NOT EXISTS idx_cases_status
                    ON reconciliation_cases(status, opened_at DESC);

                CREATE INDEX IF NOT EXISTS idx_audit_events_created
                    ON audit_events(created_at DESC);

                CREATE INDEX IF NOT EXISTS idx_evidence_intent
                    ON immutable_evidence(payment_intent_id, created_at);

                ALTER TABLE ai_test_runs
                    ADD COLUMN IF NOT EXISTS error_message TEXT;

                -- AI Test Lab tables
                CREATE TABLE IF NOT EXISTS ai_test_runs (
                    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    run_type VARCHAR(50) NOT NULL DEFAULT 'BASELINE',
                    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                    scenarios_total INT DEFAULT 0,
                    scenarios_passed INT DEFAULT 0,
                    scenarios_failed INT DEFAULT 0,
                    scenarios_warning INT DEFAULT 0,
                    risk_level VARCHAR(50) DEFAULT 'INFORMATIONAL',
                    started_at TIMESTAMPTZ DEFAULT NOW(),
                    completed_at TIMESTAMPTZ,
                    error_message TEXT,
                    created_by VARCHAR(255) DEFAULT 'OPERATOR',
                    provenance VARCHAR(255) DEFAULT 'LOCAL_AI_SIMULATION'
                );

                CREATE TABLE IF NOT EXISTS ai_test_results (
                    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    run_id UUID REFERENCES ai_test_runs(run_id) ON DELETE CASCADE,
                    scenario_id VARCHAR(255) NOT NULL,
                    scenario_type VARCHAR(255) NOT NULL,
                    category VARCHAR(100) DEFAULT 'SECURITY',
                    risk_level VARCHAR(50) DEFAULT 'INFORMATIONAL',
                    status VARCHAR(50) DEFAULT 'PENDING',
                    expected_result JSONB,
                    actual_result JSONB,
                    trace JSONB,
                    ai_analysis JSONB,
                    provenance VARCHAR(255) DEFAULT 'LOCAL_AI_SIMULATION',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)

            print("[MIGRATIONS] Schema, columns, indexes, and AI Test Lab tables applied successfully.", file=sys.stderr)

