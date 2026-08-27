-- ResolverAI Database Schema
-- AI-Guided Payment State Resolution & Revenue Recovery

-- ============================================================
-- TRUTH 1: EVENT TRUTH — What events did we receive?
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL,
    source          VARCHAR(50)  NOT NULL,
    external_event_id VARCHAR(255) NOT NULL,
    external_transaction_id VARCHAR(255),
    event_type      VARCHAR(50)  NOT NULL,
    payload         JSONB        NOT NULL,
    payload_hash    VARCHAR(64),
    trace_id        VARCHAR(255),
    received_at     TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE(source, external_event_id)
);

-- ============================================================
-- TRUTH 2: OPERATIONAL TRUTH — Current resolution state
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_intents (
    payment_intent_id UUID PRIMARY KEY,
    merchant_reference VARCHAR(255),
    order_id        VARCHAR(255)  NOT NULL,
    razorpay_order_id VARCHAR(255),
    active_payment_id VARCHAR(255),
    merchant_id     VARCHAR(255)  NOT NULL DEFAULT 'default_merchant',
    amount          NUMERIC(18,2) NOT NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'INR',
    current_state   VARCHAR(50)   NOT NULL DEFAULT 'CREATED',
    active_rail     VARCHAR(50),
    retry_count     INT           DEFAULT 0,
    resolution_status VARCHAR(50) DEFAULT 'PENDING',
    version         INT           DEFAULT 1,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- External Executions — Actual payment provider attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS external_executions (
    execution_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(payment_intent_id),
    provider        VARCHAR(50)   NOT NULL DEFAULT 'RAZORPAY',
    rail_id         VARCHAR(50)   NOT NULL DEFAULT 'RAZORPAY_TEST',
    external_txn_id VARCHAR(255),
    operation       VARCHAR(50)   NOT NULL DEFAULT 'AUTHORIZE',
    amount          NUMERIC(18,2) NOT NULL,
    status          VARCHAR(50)   NOT NULL,
    idempotency_key VARCHAR(255)  UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================
-- External Execution Attempts — Individual network attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS external_execution_attempts (
    attempt_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES external_executions(execution_id),
    attempt_number  INT  NOT NULL DEFAULT 1,
    operation       VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    request_status  VARCHAR(50),
    result_status   VARCHAR(50),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ============================================================
-- Durable Outbox — Crash-safe async processing queue
-- ============================================================
CREATE TABLE IF NOT EXISTS outbox_events (
    outbox_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    aggregate_id    VARCHAR(255) NOT NULL,
    payload         JSONB        NOT NULL,
    status          VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    attempts        INT          DEFAULT 0,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

-- ============================================================
-- Reconciliation Cases — Track unresolved operational incidents
-- ============================================================
CREATE TABLE IF NOT EXISTS reconciliation_cases (
    case_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(payment_intent_id),
    case_type       VARCHAR(50)  NOT NULL,
    severity        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    status          VARCHAR(50)  NOT NULL DEFAULT 'OPEN',
    reason          TEXT         NOT NULL,
    opened_at       TIMESTAMPTZ  DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    operator_id     VARCHAR(255),
    resolution_notes TEXT
);

-- ============================================================
-- Audit Events — Operational audit records
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
    audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    actor_id        VARCHAR(255) NOT NULL DEFAULT 'SYSTEM',
    resource_type   VARCHAR(50)  NOT NULL,
    resource_id     VARCHAR(255) NOT NULL,
    payload         JSONB        NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- TRUTH 3: FINANCIAL-ACTION EVIDENCE — Immutable audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS immutable_evidence (
    evidence_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL,
    event_id        UUID,
    action          VARCHAR(50)   NOT NULL,
    amount          NUMERIC(18,2) NOT NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'INR',
    decision        VARCHAR(50)   NOT NULL,
    policy_reason   TEXT,
    agent_evidence  JSONB,
    external_evidence JSONB,
    execution_result JSONB,
    decision_chain  JSONB        NOT NULL,
    trace_id        VARCHAR(255),
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- Immutability trigger: prevent UPDATE/DELETE on evidence
CREATE OR REPLACE FUNCTION block_evidence_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Evidence trail is immutable. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS evidence_immutable ON immutable_evidence;
CREATE TRIGGER evidence_immutable
    BEFORE UPDATE OR DELETE ON immutable_evidence
    EXECUTE FUNCTION block_evidence_modification();

-- Immutability trigger: prevent UPDATE/DELETE on payment_events
CREATE OR REPLACE FUNCTION block_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Payment events are immutable. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_immutable ON payment_events;
CREATE TRIGGER events_immutable
    BEFORE UPDATE OR DELETE ON payment_events
    EXECUTE FUNCTION block_event_modification();