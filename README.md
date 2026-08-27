# ResolverAI — AI Payment Integrity & Recovery Platform
> *"Don't guess what happened to a payment. Verify it, resolve it, and prove it."*

---

## 🌟 Executive Summary & Judge Narrative

**ResolverAI** is a merchant-side payment operations, integrity, and recovery platform built for the **Razorpay AI Buildathon**.

In distributed payment processing, payment gateways (like Razorpay) and merchant application databases frequently disagree due to asynchronous webhook delays, network dropouts, out-of-order event delivery, and bank timeouts. 

When a payment times out or hangs in an ambiguous state, traditional merchant software faces a critical dilemma: **blindly retry and risk double-charging the customer**, or **mark the transaction as failed and lose revenue**.

ResolverAI solves this by acting as a merchant-side control plane above Razorpay:

```
  AI Investigates  ➔  Evidence Verifies  ➔  Policy Authorizes  ➔  Execution Acts  ➔  Reconciliation Closes
```

1. **AI Investigates**: Formulates hypotheses about what went wrong without mutating payment state.
2. **Evidence Verifies**: Gathers authoritative ground truth directly from read-only Razorpay APIs.
3. **Policy Authorizes**: Evaluates a 5-rule deterministic safety gate to produce a signed `AuthorizedAction`.
4. **Execution Acts**: Executes the mutation (Capture or Refund) *only* if authorized by policy.
5. **Reconciliation Closes**: Persists an immutable evidence trail in PostgreSQL to prove what happened.

---

## 🏗️ System Architecture & Data Flow

ResolverAI sits **ABOVE** Razorpay as a merchant-side control plane. It does not replace Razorpay, nor does it connect directly to internal bank switches.

```
                    ┌─────────────────────────┐
                    │      Razorpay API       │
                    └────────────┬────────────┘
                                 │ Webhook Events / API Calls
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          RESOLVERAI CONTROL PLANE                         │
│                                                                           │
│  ┌───────────────────────┐         ┌───────────────────────────────────┐  │
│  │ Webhook Ingestion     │ ──────> │ Fast-Path Redis Deduplication     │  │
│  │ (HMAC-SHA256 Signed)  │         └─────────────────┬─────────────────┘  │
│  └───────────┬───────────┘                           │                    │
│              │                                       ▼                    │
│              │                     ┌───────────────────────────────────┐  │
│              └───────────────────> │ PostgreSQL Immutability Storage   │  │
│                                    │ (Triggers Block UPDATE/DELETE)    │  │
│                                    └─────────────────┬─────────────────┘  │
│                                                      │ Outbox Pattern     │
│                                                      ▼                    │
│                                    ┌───────────────────────────────────┐  │
│                                    │ Background Resolution Worker      │  │
│                                    │ (FOR UPDATE SKIP LOCKED)          │  │
│                                    └─────────────────┬─────────────────┘  │
│                                                      │                    │
│                                                      ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         RESOLUTION PIPELINE                         │  │
│  │                                                                     │  │
│  │   1. AI Detective ──────> Formulates advisory hypothesis            │  │
│  │   2. Evidence Agent ────> Queries Razorpay APIs for ground truth    │  │
│  │   3. Policy Engine  ────> Validates 5 deterministic safety rules    │  │
│  │   4. FinOps Executor ───> Executes authorized mutation on Razorpay │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📐 The Three Truths Architecture

ResolverAI strictly separates data into three distinct architectural layers to prevent state corruption:

| Layer | System Table | Description | Properties |
| :--- | :--- | :--- | :--- |
| **1. Event Truth** | `payment_events` | Raw, immutable inbound webhook events received from Razorpay. | Append-Only, HMAC Verified, DB Trigger Locked |
| **2. Operational Truth** | `payment_intents` | Merchant's current operational state (15 distinct lifecycle states). | Mutable, Transactionally Locked |
| **3. Evidence Truth** | `immutable_evidence` | Audit trail of AI hypotheses, policy decisions, and execution tokens. | Database-Enforced Append-Only Immutability |

---

## 🛡️ AI Safety Model: The 5-Rule Policy Gate

The AI Detective is treated as the **least trusted component** in the architecture. It is strictly **advisory** and cannot directly execute financial mutations.

Before any money is moved or payment captured, the **Deterministic Policy Engine** evaluates 5 mandatory rules:

1. **RULE 1 (State Validity)**: Payment intent must be in a state permitting resolution (`UNCERTAIN`, `VERIFYING`, `DUPLICATE_SUSPECTED`).
2. **RULE 2 (Verified External Evidence)**: Gateway state must be explicitly confirmed (`CAPTURED`, `AUTHORIZED`, `FAILED`), never `UNKNOWN`.
3. **RULE 3 (Economic Identity)**: Payment ID, Order ID, Amount (`Decimal`), and Currency must match merchant intent.
4. **RULE 4 (Duplicate Protection)**: Prevents duplicate captures across local database history and external gateway state.
5. **RULE 5 (Bounded Action)**: Proposed mutation must logically fit the external state.

If any rule fails, the action is rejected and escalated to `MANUAL_REVIEW`.

---

## 🚦 Payment Lifecycle State Machine

ResolverAI implements a 15-state deterministic state machine:

```
CREATED ➔ PENDING_RAIL ➔ UNCERTAIN ➔ VERIFYING ➔ AUTHORIZED ➔ CAPTURED ➔ RECONCILED
                              │                                  │
                              ├─> DUPLICATE_SUSPECTED ───────────┼─> REFUNDED
                              │                                  │
                              └─> MANUAL_REVIEW ─────────────────┘
```

- **Non-Regression Rule**: Payment state can never regress backwards (e.g., `CAPTURED` can never regress to `AUTHORIZED` even if an out-of-order webhook arrives).
- **Timeout Safety Rule**: A network timeout transitions state to `UNCERTAIN`, **NEVER** directly to `FAILED`.

---

## ⚡ Quickstart Guide ($0 Cost Local Setup)

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.12+

### 2. Configure Environment (`.env`)
```bash
cp .env.example .env
```

Default configuration for local Docker PostgreSQL and Redis:
```ini
DATABASE_URL=postgresql://resolver:resolver@localhost:5432/resolverai
REDIS_URL=redis://localhost:6379/0
AI_MODE=DETERMINISTIC
RAZORPAY_MODE=TEST
RAZORPAY_KEY_ID=rzp_test_xxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
ENVIRONMENT=development
```

### 3. Start Local Database & Redis
```bash
sudo docker compose up -d
```

### 4. Install Dependencies
```bash
pip install --break-system-packages -r requirements.txt
```

### 5. Launch ResolverAI Platform
```bash
PORT=8501 bash start.sh
```

---

## 🎮 Operational Modes

### Mode A: Real Razorpay Test Mode
Connects directly to Razorpay's official Test Mode APIs and verifies real HMAC-SHA256 signatures (`X-Razorpay-Signature`) on webhooks delivered via `ngrok`.

### Mode B: Local Reliability Lab (Chaos Testing)
Segregated fault-injection laboratory (`chaos_lab/`) to stress-test failure conditions:
- **Late Authorization**: Simulates bank timeouts followed by delayed authorization callbacks.
- **Out-of-Order Webhooks**: Simulates `payment.captured` arriving before `payment.authorized`.
- **Duplicate Execution**: Simulates duplicate callbacks and retries.

---

## 🔗 Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/webhook/razorpay` | HMAC-SHA256 verified Razorpay webhook ingestion endpoint |
| `GET` | `/payments/{id}` | Fetch payment intent state and operational details |
| `GET` | `/payments/{id}/timeline` | Retrieve chronological event timeline for a payment |
| `POST` | `/payments/{id}/reconcile` | Manually trigger reconciliation pipeline for a payment |
| `GET` | `/cases` | List operational reconciliation cases |
| `POST` | `/cases/{id}/manual-resolve` | Resolve escalation case with operator audit trail |
| `GET` | `/health` | Liveness health check |
| `GET` | `/health/ready` | Readiness check verifying PostgreSQL and Redis connectivity |

---

## 🛡️ Production Readiness vs Hackathon Scope

### Production-Minded Design Principles Implemented:
- ✅ Database-level immutability triggers blocking `UPDATE`/`DELETE` on evidence.
- ✅ Durable outbox pattern with `FOR UPDATE SKIP LOCKED` for zero dropped tasks.
- ✅ HMAC-SHA256 webhook signature validation on raw request bytes.
- ✅ `Decimal` monetary precision preventing floating-point rounding errors.
- ✅ Strict separation between advisory AI hypotheses and policy execution.

### Requirements for Live Production Deployment:
- PCI-DSS Compliance certification.
- Production Razorpay Merchant Account credentials.
- Multi-region PostgreSQL replication & KMS secrets management.
