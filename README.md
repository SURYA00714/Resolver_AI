# ResolverAI

## AI-Guided Payment State Resolution & Revenue Recovery Control Plane

**Razorpay Agent Studio Buildathon Submission**

ResolverAI resolves ambiguous payment states — timeouts, late authorizations, cross-rail duplicates, out-of-order webhooks — using a 3-agent AI architecture governed by a deterministic 5-rule Policy Engine. Every financial action is recorded in an immutable evidence trail. No money moves without policy approval.

---

## Three Truths

1. **Event Truth** — Raw payment events are append-only and immutable (DB triggers prevent UPDATE/DELETE)
2. **Operational Truth** — 10-state machine tracks each payment intent through its lifecycle
3. **Financial-Action Evidence** — Every capture/void/refund is logged immutably with full decision chain

## Architecture

```
Webhook → Event Store → Outbox → Worker → Resolver Pipeline:
                                              │
                                    ┌─────────┴─────────┐
                                    │                    │
                              Detective Agent    Negotiator Agent
                              (Hypothesize)      (Verify External)
                                    │                    │
                                    └─────────┬──────────┘
                                              │
                                       Policy Engine
                                       (5 Rules Gate)
                                              │
                                       FinOps Executor
                                       (Execute Action)
                                              │
                                    Immutable Evidence
```

## Agent Squad

| Agent | Role | Input | Output |
|:---|:---|:---|:---|
| **Detective** | Analyze payment state, form hypothesis | Intent data | `DetectiveResult` (hypothesis, confidence, recommended action) |
| **Negotiator** | Verify with external rail | Intent + idempotency key | `NegotiatorResult` (external status, txn ID, amount) |
| **FinOps Executor** | Execute authorized action | `AuthorizedAction` from Policy | `FinOpsResult` (execution status, txn ID) |

**Critical:** FinOps Executor NEVER generates its own commands. It accepts ONLY `AuthorizedAction` issued by the Policy Engine.

## Policy Engine — 5 Rules

| # | Rule | Check |
|:--|:-----|:------|
| 1 | STATE | Intent must be `UNCERTAIN` or `DUPLICATE_SUSPECTED` |
| 2 | VERIFIED EVIDENCE | External status ≠ `UNKNOWN` |
| 3 | ECONOMIC IDENTITY | Amount + currency match between intent and external |
| 4 | DUPLICATE PROTECTION | No existing successful capture (unless DUPLICATE_SUSPECTED) |
| 5 | BOUNDED ACTION | Action must be valid for the current verified state |

ALL 5 must pass for APPROVE. Any single failure = REJECT with explainable reason.

## State Machine (10 States)

```
CREATED → PENDING_RAIL → UNCERTAIN → CAPTURED (happy path)
                       → FAILED (rail reject)
         UNCERTAIN → DUPLICATE_SUSPECTED → COMPENSATING → RECONCILED
                                                        → MANUAL_REVIEW
```

## Chaos Scenarios

1. **Late Authorization** — Payment times out, but auth arrives later
2. **Cross-Rail Duplicate** — Same order captured on two different rails
3. **Out-of-Order Webhook** — CAPTURED webhook arrives before AUTHORIZED

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Wait for healthy services, then init schema (if fresh)
docker compose exec postgres psql -U resolver -d resolverai -f /docker-entrypoint-initdb.d/01-schema.sql

# 3. Install Python deps
pip install -r requirements.txt

# 4. Start API server
python3 -m uvicorn app:app --reload --port 8000

# 5. Start worker (separate terminal)
python3 worker.py

# 6. Start dashboard (separate terminal)
python3 -m streamlit run ui/dashboard.py --server.port 8501

# 7. Run tests
python3 -m pytest tests/ -v
```

## Project Structure

```
├── app.py                    # FastAPI entry point
├── worker.py                 # Durable outbox poller
├── schema.sql                # 7-table PostgreSQL schema
├── docker-compose.yml        # Postgres + Redis
├── requirements.txt          # Python dependencies
├── .env.example              # Environment config template
│
├── api/
│   ├── webhook_receiver.py   # POST /webhook
│   └── demo_routes.py        # Demo + chaos endpoints
│
├── core/
│   ├── state_machine.py      # 10-state FSM
│   ├── policy_engine.py      # 5-rule deterministic gate
│   ├── resolver.py           # Central resolution pipeline
│   └── idempotency.py        # Redis locks + dedup
│
├── agents/
│   ├── schemas.py            # Pydantic agent contracts
│   ├── detective.py          # Hypothesis generator
│   ├── negotiator.py         # External rail verifier
│   └── finops_executor.py    # Policy-authorized executor
│
├── rails/
│   ├── base.py               # Abstract rail interface
│   ├── simulator.py          # 4 synthetic rails
│   └── faults.py             # 3 chaos scenarios
│
├── ledger/
│   ├── evidence.py           # Immutable evidence writer
│   └── financial_effects.py  # Financial tracking
│
├── ui/
│   └── dashboard.py          # Streamlit Mission Control
│
└── tests/
    ├── test_state_machine.py
    ├── test_policy.py
    ├── test_agents.py
    └── test_invariants.py
```

## Tech Stack

- **Python 3.11+** with `async/await` throughout
- **FastAPI** — API layer
- **asyncpg** — PostgreSQL driver (connection pooling)
- **Redis** — Distributed locks + event deduplication
- **Pydantic v2** — Agent message contracts
- **Streamlit** — Operator dashboard
- **PostgreSQL 16** — Event store + state management
- **Docker Compose** — Infrastructure orchestration

## Design Constraints

- `decimal.Decimal` for all money — never `float`
- All DB/HTTP calls are `async/await`
- AI is NOT the financial authority — Policy Engine is deterministic
- Evidence trail is immutable — enforced by PostgreSQL triggers
- No external paid AI APIs — fully local, zero-cost
