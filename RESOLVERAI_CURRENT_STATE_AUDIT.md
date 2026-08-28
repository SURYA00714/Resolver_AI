# ResolverAI — Current State Forensic Audit
**Date:** 2026-08-28  
**Auditor:** Kilo (Principal Fintech Architect)  
**Classification:** LEVEL 3 — Real Test-Integrated System (Partial Production Readiness)

---

## 1. Executive Verdict

ResolverAI is a **HYBRID** system. The distributed systems backend (transactional outbox, PostgreSQL immutability triggers, HMAC-SHA256 webhook verification, Redis idempotency, 15-state deterministic state machine, 5-rule Policy Engine, and FinOps Executor) is **genuinely production-grade**. However, the product is currently positioned as an interactive engineering demo rather than a merchant control plane. Critical gaps exist in authentication enforcement, RBAC, bounded reconciliation polling, AI provider implementation, and frontend merchant UX.

---

## 2. Feature Classification

| Feature | Classification | Evidence |
|---------|---------------|----------|
| Razorpay Order Creation API | **REAL** | `razorpay/orders.py:create_order` calls `POST /v1/orders` via httpx |
| Razorpay Payment Lookup | **REAL** | `razorpay/payments.py:get_payment` calls `GET /v1/payments/{id}` |
| Razorpay Capture API | **REAL** | `agents/finops_executor.py` calls `POST /v1/payments/{id}/capture` |
| Razorpay Refund API | **REAL** | `razorpay/refunds.py:create_refund` calls `POST /v1/payments/{id}/refund` |
| Webhook HMAC-SHA256 Verification | **REAL** | `razorpay/webhooks.py:verify_webhook_signature` uses `hmac.compare_digest` |
| Webhook Deduplication | **REAL** | Redis fast-path + PostgreSQL `UNIQUE(source, external_event_id)` |
| Transactional Outbox Worker | **REAL** | `worker.py` uses `FOR UPDATE SKIP LOCKED` with exponential backoff |
| Database Immutability Triggers | **REAL** | `schema.sql:138-160` enforces `BEFORE UPDATE OR DELETE` triggers |
| 15-State State Machine | **REAL** | `core/state_machine.py` with deterministic transition table |
| 5-Rule Policy Engine | **REAL** | `core/policy_engine.py` — AI cannot bypass |
| FinOps Executor | **REAL** | `agents/finops_executor.py` only accepts `AuthorizedAction` from Policy Engine |
| Post-Mutation Verification | **REAL** | FinOps re-fetches payment status after capture/refund |
| Decimal Money Safety | **REAL** | All amounts use `Decimal`, no float arithmetic |
| JWT Authentication | **IMPLEMENTED BUT UNPROVEN** | `core/auth.py` implements HMAC-SHA256 JWT, but routes are NOT protected |
| RBAC (Viewer, Operator, Admin) | **MISSING** | No role-based access control; login returns hardcoded `role="operator"` |
| Strict CORS | **PARTIAL** | `app.py:31-41` allows `*` methods/headers with credentials in non-production |
| Rate Limiting | **MISSING** | No rate limiting on any endpoint |
| Bounded Reconciliation Polling | **MISSING** | Resolution is webhook-driven only; no proactive polling for stale states |
| AI Advisory (Gemini/Groq) | **IMPLEMENTED BUT UNPROVEN** | Providers exist but `google.generativeai` and `groq` libraries not in requirements.txt |
| Frontend Login Page | **MISSING** | No `/login` route; no JWT storage or Authorization header propagation |
| Chaos Lab Isolation | **PARTIAL** | `chaos_lab/` exists at repo root, not in `engineering/testing/` |
| DLQ Management UI | **MISSING** | Dead-letter endpoint exists but no UI to replay or resolve |
| Correlation ID Propagation | **PARTIAL** | Columns exist in schema but not consistently populated |
| Structured JSON Logging | **PARTIAL** | Worker has it; API routes use `print(..., file=sys.stderr)` |
| "Live" vs "Stale" Data Indicators | **MISSING** | UI does not distinguish verified from unverified data |
| Razorpay External State Panel | **MISSING** | No side-by-side external vs local state view in UI |

---

## 3. Architecture Assessment

### Current Request Flow (Real Path)
```
1. Merchant creates order via Frontend → POST /orders
2. Backend calls Razorpay POST /v1/orders → Returns order_id
3. Merchant pays via Razorpay Checkout (outside ResolverAI)
4. Razorpay sends webhook → POST /webhook/razorpay
5. Webhook receiver: HMAC verify → Parse → Deduplicate → Persist event → Upsert intent → Enqueue outbox
6. Worker polls outbox → Claims event → Runs resolve() pipeline
7. resolve(): Lock → Load → Negotiator (real API call) → Detective (deterministic/AI) → Policy Engine → FinOps Executor → Record Evidence → Update state
```

### Security Boundaries
- **Webhook ingress**: HMAC-SHA256 verified, fail-closed if secret missing in production
- **API ingress**: NO authentication on most routes. `auth_routes.py` exists but is not enforced.
- **Financial mutations**: Protected by Policy Engine + AuthorizedAction token + idempotency key
- **Database**: Immutability triggers on `payment_events` and `immutable_evidence`

### Critical Vulnerabilities
1. **Unauthenticated API**: All routes except `/auth/login` and `/auth/me` are publicly accessible
2. **CORS too permissive**: `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=True` in development
3. **No rate limiting**: Webhook and mutation endpoints unprotected from abuse
4. **Chaos Lab in production nav**: Engineering routes registered in `app.py` even if blocked by `_check_engineering_mode()`
5. **AI libraries missing**: `requirements.txt` does not include `google-generativeai` or `groq`

---

## 4. Razorpay Integration Actual State

| Operation | File | Real API | Status |
|-----------|------|----------|--------|
| Create Order | `razorpay/orders.py:9-30` | `POST /v1/orders` | REAL |
| Get Order | `razorpay/orders.py:33-36` | `GET /v1/orders/{id}` | REAL |
| Get Order Payments | `razorpay/orders.py:39-42` | `GET /v1/orders/{id}/payments` | REAL |
| Get Payment | `razorpay/payments.py:9-12` | `GET /v1/payments/{id}` | REAL |
| Capture Payment | `razorpay/payments.py:15-30` | `POST /v1/payments/{id}/capture` | REAL |
| Create Refund | `razorpay/refunds.py:21-36` | `POST /v1/payments/{id}/refund` | REAL |
| Get Refunds | `razorpay/refunds.py:9-12` | `GET /v1/payments/{id}/refunds` | REAL |
| Get Refund | `razorpay/refunds.py:15-18` | `GET /v1/refunds/{id}` | REAL |

**Note:** `RAZORPAY_MODE=SYNTHETIC` still exists in `.env.example` and `config.py`. The Negotiator and FinOps Executor have fallback paths to the Chaos Lab simulator when not in TEST/LIVE mode.

---

## 5. Webhook Pipeline Actual State

**Endpoint:** `POST /webhook/razorpay` (`api/webhook_receiver.py:20-138`)

**Steps:**
1. Read raw body bytes ✅
2. Verify HMAC-SHA256 signature ✅
3. Parse JSON payload ✅
4. Extract payment/order/refund entities ✅
5. **Fast-path Redis deduplication** ✅
6. **Persist immutable event** ✅ (`payment_events` with DB unique constraint)
7. **Upsert payment intent** ✅
8. **Enqueue outbox event** ✅

**Gaps:**
- `signature_verified` column is referenced in `dashboard_routes.py:46-48` but **never set** during webhook ingestion
- `correlation_id` column exists in schema but is **never populated**
- No webhook ingestion metrics (latency, payload size, event type distribution)

---

## 6. Database Schema Assessment

**Tables:** 8 tables with proper immutability triggers on 2 tables.

| Table | Purpose | Immutable | Indexes |
|-------|---------|-----------|---------|
| `payment_events` | Event Truth | YES (trigger) | received_at, intent+received_at |
| `payment_intents` | Operational Truth | NO | razorpay_order_id, active_payment_id |
| `external_executions` | Mutation attempts | NO | (none explicit) |
| `external_execution_attempts` | Individual attempts | NO | (none explicit) |
| `outbox_events` | Async queue | NO | status+available_at |
| `reconciliation_cases` | Incident tracking | NO | status+opened_at |
| `audit_events` | Operational audit | NO | created_at |
| `immutable_evidence` | Evidence Truth | YES (trigger) | (none explicit) |

**Missing columns that are referenced:**
- `payment_events.signature_verified` — referenced in queries but not populated
- `payment_events.correlation_id` — column exists, never set
- `immutable_evidence.correlation_id` — column exists, never set
- `outbox_events.last_error` — added in migration, used by worker
- `outbox_events.available_at` — added in migration, used for backoff

---

## 7. Frontend Actual State

**Framework:** Next.js (App Router) with inline styles  
**Pages:**
- `/` — Dashboard with real stats + synthetic injection not present (good)
- `/payments` — Real payment intent list with reconcile buttons
- `/payments/new` — Real Razorpay order creation form
- `/payments/[id]` — Timeline, evidence, executions tabs + Verify with Razorpay
- `/cases` — Reconciliation case management with manual resolve modal
- `/webhooks` — Webhook history with replay + dead-letter tab
- `/audit` — Audit trail table
- `/settings/integration` — Integration health check
- `/engineering/testing` — **Chaos Lab** (should be isolated)

**Frontend Gaps:**
- No login page
- No JWT token storage or Authorization header propagation
- No RBAC-based navigation
- Chaos Lab exposed in main sidebar navigation
- No "Live" vs "Stale" data indicators
- No Razorpay External State panel

---

## 8. Test Coverage Actual State

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/test_policy.py` | 11 | PASS — 5-rule policy engine |
| `tests/test_security.py` | 3 | PASS — HMAC, FinOps expiry |
| `tests/test_state_machine.py` | 7 | PASS — 15 states, transitions |
| `tests/test_agents.py` | 7 | PASS — Detective, Negotiator, FinOps |
| `tests/test_invariants.py` | 6 | PASS — Three Truths, Decimal safety |

**Total:** 34 unit tests, all passing. No integration or E2E tests against live Razorpay.

---

## 9. Production Blocker Summary

| Blocker | Severity | Phase |
|---------|----------|-------|
| No authentication enforcement on API routes | CRITICAL | 1 |
| No RBAC (Viewer, Operator, Admin) | CRITICAL | 1 |
| CORS allows credentials + wildcard methods/headers | HIGH | 1 |
| No rate limiting on webhook/mutation endpoints | HIGH | 1 |
| `signature_verified` never populated | MEDIUM | 3 |
| `correlation_id` never propagated | MEDIUM | 3 |
| No bounded reconciliation polling | MEDIUM | 5 |
| AI providers not in requirements.txt | MEDIUM | 7 |
| Frontend has no login/JWT flow | HIGH | 1 |
| Chaos Lab in main nav, not isolated | MEDIUM | 9-13 |
| No DLQ management UI | LOW | 8 |
| No "Live"/"Stale" data indicators | MEDIUM | 9-13 |

---

## 10. Strengths (Do Not Break)

1. **Transactional Outbox**: Crash-safe, exponential backoff, dead-letter, `FOR UPDATE SKIP LOCKED`
2. **Database Immutability**: PostgreSQL triggers prevent tampering with events and evidence
3. **Policy Engine**: 5 deterministic rules, AI cannot bypass
4. **FinOps Executor**: Only accepts `AuthorizedAction` from Policy Engine, post-mutation verification
5. **Decimal Safety**: All money uses `Decimal`, no float
6. **Idempotency**: Redis + PostgreSQL unique constraints
7. **State Machine**: 15 states, deterministic transitions, TIMEOUT never equals FAILED
8. **Webhook Signature**: Constant-time HMAC-SHA256 on raw bytes

---

## 11. Safe Transformation Path

The system must evolve from "Level 3: Real Test-Integrated System" to "Level 5: Production-Capable System" by:
1. **Securing the perimeter**: Auth, RBAC, CORS, rate limiting
2. **Cleaning the data path**: Fix webhook ingestion, add correlation IDs, bounded polling
3. **Hardening financial operations**: Explicit idempotency, pre-flight validation, bounded retries
4. **Making AI real (or honest)**: Either integrate real LLMs or clearly label deterministic analysis
5. **Transforming the UI**: From demo/chaos to merchant control plane
