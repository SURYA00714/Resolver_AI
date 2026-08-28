# RESOLVERAI_FORENSIC_ARCHITECTURE_REPORT

**Target:** `SURYA00714/Resolver_AI`  
**Auditor Role:** Principal Fintech Architect / Distributed Systems Engineer  
**Date:** August 2026

---

## 1. Executive Verdict
**Classification: LEVEL 3 — REAL TEST-INTEGRATED SYSTEM**

ResolverAI is **not** a UI mockup or a pure simulation, nor is it a production-ready system. It sits strictly at Level 3. It contains genuine, authenticated cryptographic integration with Razorpay's API and Webhooks, relies on a robust transactional outbox pattern using PostgreSQL `FOR UPDATE SKIP LOCKED`, and cleanly separates operational intent from external evidence. However, its "AI" features are largely deterministic, the frontend contains vestigial simulation components, and critical deployment infrastructure (like HTTPS termination and proper secrets management) is entirely absent. It solves a real problem (webhook loss and state divergence) but requires significant hardening before touching live funds.

## 2. System Identity
- **Is it a simulation?** No, the core engine communicates with `api.razorpay.com`.
- **Is it a real control plane?** Yes, but strictly in a staging/test capacity.
- **What is synthetic?** The Chaos Lab (`chaos_lab/`) which injects fake webhook delays and faults, and some UI elements that assume the presence of data.
- **What is real?** Razorpay order creation (`POST /v1/orders`), webhook signature verification (HMAC-SHA256), the FinOps executor's `httpx` client, and the database transactional boundaries.

## 3. Complete Architecture
The system employs a "Three Truths" architecture:
1. **Event Truth:** Raw webhooks stored immutably in `payment_events`.
2. **Operational Truth:** Merchant's desired state in `payment_intents`.
3. **Evidence Truth:** Cryptographically bounded execution logs in `immutable_evidence`.

## 4. Complete Runtime Flow
1. **User Action:** Merchant clicks "Create Order" in Next.js UI.
2. **Backend Entry:** `POST /api/orders` hits FastAPI.
3. **External API:** `razorpay/orders.py` calls Razorpay API `POST /v1/orders`.
4. **State Creation:** Returns Order ID, FastAPI creates `payment_intents` row (state: CREATED).
5. **Webhook Arrival:** `POST /webhook/razorpay` receives `payment.captured`.
6. **Validation:** `api/webhook_receiver.py` computes HMAC-SHA256. Fails if invalid.
7. **Event Persistence:** Saved to `payment_events` (fails on unique constraint if duplicate).
8. **Outbox Creation:** Row inserted to `outbox_events` in same transaction.
9. **Worker Processing:** `worker.py` selects `FOR UPDATE SKIP LOCKED` and triggers reconciliation.
10. **Reconciliation:** Compares Razorpay event against `payment_intents`. Updates intent to `CAPTURED`.
11. **Anomaly Flow:** If divergence detected, `AIProvider` suggests action -> `PolicyEngine` approves -> `FinOpsExecutor` calls Razorpay `POST /payments/{id}/capture`.

## 5. Razorpay Integration Map
- **Create Order:** `razorpay/orders.py:create_order()` -> `POST /v1/orders` [REAL]
- **Verify Payment:** `razorpay/client.py` -> `GET /v1/orders/{id}/payments` [REAL]
- **Webhook Verify:** `api/webhook_receiver.py` -> HMAC-SHA256 [REAL]
- **Client implementation:** Uses `httpx.AsyncClient` with 10.0s explicit timeout. Throws `RazorpayAPIError`.

## 6. Webhook Forensics
- **Endpoint:** `POST /webhook/razorpay`
- **Validation:** Implements constant-time HMAC-SHA256 signature verification against `X-Razorpay-Signature`. [REAL EXTERNAL INTEGRATION]
- **Duplicate handling:** Relies on PostgreSQL unique constraint `UNIQUE(source, external_event_id)` in `payment_events`.
- **Attack surface:** Safe from forgery if `RAZORPAY_WEBHOOK_SECRET` is strong. Replay attacks are stopped by the DB unique constraint.

## 7. Outbox/Worker Forensics
- **Transactional Correctness:** Uses `FOR UPDATE SKIP LOCKED` to prevent concurrent workers from processing the same event.
- **Crash Recovery:** If a worker crashes before deleting the `outbox_events` row, another worker will pick it up after a timeout.
- **Idempotency:** Highly dependent on Razorpay's idempotency keys for mutations. The internal state updates rely on strict state machine transitions.

## 8. Database Forensics
- **Immutability:** `immutable_evidence` and `payment_events` have PostgreSQL triggers (`block_evidence_modification()`) that physically reject `UPDATE` or `DELETE` statements. [REAL]
- **Transactions:** `asyncpg` transaction blocks are used correctly in critical paths.

## 9. Payment State Machine
Transitions explicitly defined in `core/state_machine.py`. 
States: CREATED, PENDING_RAIL, AUTHORIZED, CAPTURED, FAILED, REFUNDED, DUPLICATE_SUSPECTED, UNCERTAIN.

## 10. Reconciliation Engine
Located in `core/reconciliation.py`. It compares the external webhook payload (or fetched status) against the internal `payment_intents` state. If `intent.amount != event.amount`, it flags an anomaly.

## 11. AI/Agent Forensics
- **Implementation:** `agents/ai_providers.py`. Includes `GeminiProvider`, `GroqProvider`, and `DeterministicProvider`.
- **Verdict:** The system DOES call an external LLM if configured, but its output is **ADVISORY ONLY**. The LLM returns a structured `DetectiveResult` JSON.
- **Financial Authority:** ZERO. The AI cannot execute payments.

## 12. Policy Engine
Located in `core/policy_engine.py`. This is the true authority. It enforces 5 strict deterministic rules (e.g., "Economic Identity: amounts must match", "Verified Evidence: status cannot be UNKNOWN"). If the AI recommends a REFUND but Rule 3 fails, the Policy Engine rejects it. [DETERMINISTIC — NOT AI]

## 13. Financial Mutation Authority Graph
- **Requester:** Webhook / AI Advisor
- **Approver:** `PolicyEngine` (Issues `AuthorizedAction` token)
- **Executor:** `FinOpsExecutor` (Requires the token to make the `httpx` call)
- **Writer:** `FinOpsExecutor` (Writes to `immutable_evidence` post-execution)

## 14. Authentication/Authorization
- API guarded by standard JWT (`core/auth.py`). 
- **CRITICAL GAP:** The frontend lacks a proper login flow to generate this JWT for operators; it relies on hardcoded headers or bypassed testing routes in some components. [IMPLEMENTED — NOT PROVEN]

## 15. Security Threat Model
- **SQL Injection:** Safe. Uses parameterized queries via `asyncpg`.
- **SSRF/Command Injection:** Safe. No user-supplied URLs or shell execution.
- **Missing Limits:** Rate limiting is entirely missing. 

## 16. Frontend Reality Audit
- The Next.js frontend calls real `/api/dashboard/stats` endpoints.
- "Verify with Razorpay" button hits a real backend route that fetches live from Razorpay. [REAL]

## 17. Simulation Contamination Audit
- The `chaos_lab/` directory contains intentional fault injection (dropping webhooks, changing amounts). While isolated to `/engineering/testing`, its presence in the codebase is dangerous for a real production deployment.

## 18. Test Coverage Audit
- **Unit Tests:** `tests/test_policy.py`, `tests/test_state_machine.py`.
- **Integration Tests:** `scripts/e2e_acceptance_test.py` proves the fail-closed nature when credentials are missing. 
- **Gap:** Missing comprehensive automated E2E tests against live Razorpay Test Mode.

## 19. Deployment Architecture
- **Current:** Local `docker compose` for PostgreSQL + Redis, local `uvicorn` and `node`.
- **Required:** Requires an API Gateway, TLS termination, Secret Manager (Vault/AWS Secrets), and managed PostgreSQL (RDS/Aurora) to be safe.

## 20. Business Value
**Why use this instead of Razorpay?**
Razorpay is a gateway; it executes what it's told. It does not know your internal business logic. If a webhook is dropped by your network, Razorpay assumes you got it. ResolverAI acts as the safety net: it actively polls for dropped states (UNCERTAIN) and safely triggers captures/refunds without human intervention while keeping a cryptographically secure audit trail.

## 21. Razorpay vs ResolverAI Comparison
Razorpay handles the money movement. ResolverAI handles the *operational integrity* of that movement against the merchant's database.

## 22. Current Demonstrable Capabilities
- Live Order Creation
- Secure Webhook Reception
- Deterministic Policy Evaluation
- Safe Fail-Closed execution

## 23. Current Non-Demonstrable Claims
- "Fully autonomous AI resolution" - Misleading. The AI is advisory; resolution is deterministic.

## 24. Critical Gaps
1. **Auth UI:** Missing operator login flow.
2. **Rate Limiting:** Absent on webhook and API routes.
3. **Chaos Lab:** Must be physically removed from production builds.

## 25. Risk Register
- **Technical Risk:** Dead-letter queue lacks automated replay UI.
- **Business Risk:** Merchants might misunderstand the AI's role and expect it to handle complex negotiations with banks, which it cannot do.

## 26. Architectural Scores
- Real external integration: 8/10
- Distributed systems correctness: 9/10 (SKIP LOCKED is excellent)
- Webhook security: 9/10
- Financial safety: 10/10 (Policy Engine strictness)
- AI integrity: 8/10 (Properly bounded)
- Production readiness: 4/10 (Missing TLS, Auth UI, Rate limiting)

## 27. Principal Architect Verdict

### WHAT IS REAL TODAY
Order creation, webhook signature validation, database immutability triggers, the outbox worker pattern, and the strict FinOps policy boundaries.

### WHAT IS IMPLEMENTED BUT UNPROVEN
End-to-end AI advisory resolution in a live production environment under heavy load.

### WHAT IS STILL SIMULATION
The Chaos Lab (`chaos_lab/`).

### WHAT IS ACTUALLY BROKEN
The system cannot boot if Docker/PostgreSQL is unavailable (no graceful degradation, which is arguably correct for a database-dependent control plane, but currently blocks local dev).

### WHAT COULD CAUSE FINANCIAL DAMAGE
If the `RAZORPAY_KEY_SECRET` is leaked, or if an attacker gains access to the JWT secret to bypass the API auth.

### WHAT PREVENTS REAL MERCHANT DEPLOYMENT
Lack of HTTPS/TLS termination, missing rate limits, and missing frontend operator authentication.

### WHAT PROVES THIS IS NOT A TOY
The usage of `FOR UPDATE SKIP LOCKED` for concurrent workers, constant-time HMAC comparison, and database-level immutability triggers. Toys use SQLite and memory queues.

### FINAL VERDICT
ResolverAI is a **Level 3 Real Test-Integrated System**. It is structurally sound and architecturally brilliant in its separation of intent, state, and evidence. It is absolutely not a toy, but it requires standard DevOps/SecOps hardening before it can touch real money. I approve this for Razorpay TEST MODE staging.
