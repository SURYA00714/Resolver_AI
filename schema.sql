-- ResolverAI Database Schema — Production Hardened
-- Payment State Integrity & Recovery Control Plane

-- ============================================================
-- TRUTH 1: EVENT TRUTH — What events did we receive?
-- Immutable: enforced by DB trigger
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
    event_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id    UUID NOT NULL,
    merchant_id          VARCHAR(255) NOT NULL DEFAULT 'default_merchant',
    source               VARCHAR(50)  NOT NULL,
    external_event_id    VARCHAR(255) NOT NULL,
    external_transaction_id VARCHAR(255),
    event_type           VARCHAR(50)  NOT NULL,
    payload              JSONB        NOT NULL,
    payload_hash         VARCHAR(64),
    trace_id             VARCHAR(255),
    correlation_id       VARCHAR(64),
    signature_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    received_at          TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT uq_payment_events_source_ext_event UNIQUE(source, external_event_id)
);

-- ============================================================
-- TRUTH 2: OPERATIONAL TRUTH — Current resolution state
-- Mutable, but constrained by CHECK on current_state
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_intents (
    payment_intent_id     UUID PRIMARY KEY,
    merchant_id           VARCHAR(255) NOT NULL DEFAULT 'default_merchant',
    merchant_reference    VARCHAR(255),
    order_id              VARCHAR(255)  NOT NULL,
    razorpay_order_id     VARCHAR(255),
    active_payment_id     VARCHAR(255),
    amount                NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency              VARCHAR(3)    NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3}$'),
    current_state         VARCHAR(50)   NOT NULL DEFAULT 'CREATED',
    active_rail           VARCHAR(50),
    retry_count           INT           DEFAULT 0 CHECK (retry_count >= 0),
    resolution_status     VARCHAR(50) DEFAULT 'PENDING',
    version               INT           DEFAULT 1 CHECK (version > 0),
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT chk_payment_intents_state CHECK (
        current_state IN ('CREATED','PENDING_RAIL','UNCERTAIN','VERIFYING','AUTHORIZED',
                          'CAPTURED','FAILED','DUPLICATE_SUSPECTED','RECONCILIATION_REQUIRED',
                          'ACTION_PENDING','ACTION_EXECUTING','ACTION_CONFIRMED','UNKNOWN',
                          'MANUAL_REVIEW','RECONCILED')
    ),
    CONSTRAINT chk_payment_intents_resolution CHECK (
        resolution_status IN ('PENDING','IN_PROGRESS','RESOLVED','ESCALATED')
    )
);

-- ============================================================
-- External Executions — Actual payment provider attempts
-- Idempotency protected by UNIQUE constraint
-- ============================================================
CREATE TABLE IF NOT EXISTS external_executions (
    execution_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id   UUID NOT NULL REFERENCES payment_intents(payment_intent_id) ON DELETE CASCADE,
    merchant_id         VARCHAR(255) NOT NULL DEFAULT 'default_merchant',
    provider            VARCHAR(50)   NOT NULL DEFAULT 'RAZORPAY',
    rail_id             VARCHAR(50)   NOT NULL DEFAULT 'RAZORPAY_TEST',
    external_txn_id     VARCHAR(255),
    operation           VARCHAR(50)   NOT NULL DEFAULT 'AUTHORIZE',
    amount              NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    currency            VARCHAR(3)    NOT NULL DEFAULT 'INR',
    status              VARCHAR(50)   NOT NULL,
    idempotency_key     VARCHAR(255)  NOT NULL UNIQUE,
    execution_metadata  JSONB,
    created_at          TIMESTAMPTZ   DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   DEFAULT NOW(),
    CONSTRAINT chk_external_executions_status CHECK (
        status IN ('SUCCESS','CAPTURED','FAILED','UNKNOWN','REFUNDED','VOIDED','DUPLICATE','PROCESSING')
    ),
    CONSTRAINT chk_external_executions_operation CHECK (
        operation IN ('AUTHORIZE','CAPTURE','REFUND','VOID','VERIFY','NO_ACTION')
    )
);

-- ============================================================
-- External Execution Attempts — Individual network attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS external_execution_attempts (
    attempt_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id    UUID NOT NULL REFERENCES external_executions(execution_id) ON DELETE CASCADE,
    attempt_number  INT  NOT NULL CHECK (attempt_number > 0),
    operation       VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    request_status  VARCHAR(50),
    result_status   VARCHAR(50),
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ============================================================
-- Durable Outbox — Crash-safe async processing queue
-- Idempotency protected by UNIQUE on idempotency_key
-- ============================================================
CREATE TABLE IF NOT EXISTS outbox_events (
    outbox_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id      VARCHAR(255) NOT NULL,
    merchant_id       VARCHAR(255) NOT NULL DEFAULT 'default_merchant',
    idempotency_key   VARCHAR(255) NOT NULL UNIQUE,
    event_type        VARCHAR(100) NOT NULL,
    payload           JSONB        NOT NULL,
    status            VARCHAR(50)  NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING','PROCESSING','PROCESSED','DEAD_LETTER')
    ),
    attempts          INT          DEFAULT 0 CHECK (attempts >= 0),
    max_attempts      INT          DEFAULT 5 CHECK (max_attempts > 0),
    last_error        TEXT,
    correlation_id    VARCHAR(64),
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    available_at      TIMESTAMPTZ  DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_claim ON outbox_events(status, available_at)
    WHERE status IN ('PENDING', 'PROCESSING') AND available_at <= NOW();

-- ============================================================
-- Reconciliation Cases — Track unresolved operational incidents
-- ============================================================
CREATE TABLE IF NOT EXISTS reconciliation_cases (
    case_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id  UUID NOT NULL REFERENCES payment_intents(payment_intent_id) ON DELETE CASCADE,
    merchant_id        VARCHAR(255) NOT NULL DEFAULT 'default_merchant',
    case_type          VARCHAR(50)  NOT NULL,
    severity           VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM' CHECK (
        severity IN ('LOW','MEDIUM','HIGH','CRITICAL')
    ),
    status             VARCHAR(50)  NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')
    ),
    divergence_type    VARCHAR(50) NOT NULL DEFAULT 'NONE',
    reason             TEXT         NOT NULL,
    evidence_refs      JSONB,
    opened_at          TIMESTAMPTZ  DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  DEFAULT NOW(),
    assigned_operator  VARCHAR(255),
    resolution_notes   TEXT,
    resolved_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cases_status_opened ON reconciliation_cases(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_intent ON reconciliation_cases(payment_intent_id);

-- ============================================================
-- Audit Events — Operational audit records
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
    audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    actor_id        VARCHAR(255) NOT NULL DEFAULT 'SYSTEM',
    actor_role      VARCHAR(50),
    resource_type   VARCHAR(50)  NOT NULL,
    resource_id     VARCHAR(255) NOT NULL,
    correlation_id  VARCHAR(64),
    payload         JSONB        NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_events(correlation_id)
    WHERE correlation_id IS NOT NULL;

-- ============================================================
-- TRUTH 3: FINANCIAL-ACTION EVIDENCE — Immutable audit trail
-- Immutable: enforced by DB trigger
-- ============================================================
CREATE TABLE IF NOT EXISTS immutable_evidence (
    evidence_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL,
    merchant_id       VARCHAR(255) NOT NULL DEFAULT 'default_merchant',
    event_id          UUID,
    action            VARCHAR(50)   NOT NULL,
    amount            NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    currency          VARCHAR(3)    NOT NULL DEFAULT 'INR',
    decision          VARCHAR(50)   NOT NULL,
    policy_reason     TEXT,
    policy_rule       VARCHAR(50),
    agent_evidence    JSONB,
    external_evidence JSONB,
    execution_result  JSONB,
    decision_chain    JSONB        NOT NULL,
    correlation_id    VARCHAR(64),
    trace_id          VARCHAR(255),
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    CONSTRAINT chk_evidence_decision CHECK (
        decision IN ('APPROVE','REJECT','MANUAL_REVIEW','NO_ACTION')
    ),
    CONSTRAINT chk_evidence_action CHECK (
        action IN ('CAPTURE','REFUND','VOID','REROUTE','NO_ACTION','MANUAL_REVIEW','VERIFY')
    )
);

CREATE INDEX IF NOT EXISTS idx_evidence_intent ON immutable_evidence(payment_intent_id, created_at);

-- ============================================================
-- Immutability triggers: prevent UPDATE/DELETE on evidence and events
-- ============================================================
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

-- Auto-update updated_at for mutable tables
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_updated_at_intents ON payment_intents;
CREATE TRIGGER trg_update_updated_at_intents
    BEFORE UPDATE ON payment_intents
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_update_updated_at_executions ON external_executions;
CREATE TRIGGER trg_update_updated_at_executions
    BEFORE UPDATE ON external_executions
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_update_updated_at_cases ON reconciliation_cases;
CREATE TRIGGER trg_update_updated_at_cases
    BEFORE UPDATE ON reconciliation_cases
    EXECUTE FUNCTION update_updated_at();
