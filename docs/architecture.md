# RESOLVERAI — FINTECH CONTROL PLANE SYSTEM ARCHITECTURE

---

### High-Level Architecture Overview

ResolverAI is a multi-tenant payment state integrity and 3-way reconciliation engine designed to eliminate payment state divergence between local merchant records, historical event logs, and Razorpay API authoritative state.

```
                    ┌─────────────────────────┐
                    │   Client / Dashboard    │
                    └────────────┬────────────┘
                                 │ REST API (JWT Auth + RBAC)
                                 ▼
                    ┌─────────────────────────┐
                    │    FastAPI Gateway      │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ Payment / Orders   │ │ Webhook Receiver   │ │ Replay Engine      │
│ API Routes         │ │ (Raw Body HMAC)    │ │ (100% Read-Only)   │
└──────────┬─────────┘ └─────────┬──────────┘ └──────────┬─────────┘
           │                     │                       │
           └─────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │ PostgreSQL Database     │
                    │ (Multi-Tenant Scoped)   │
                    └────────────┬────────────┘
                                 │ FOR UPDATE SKIP LOCKED
                                 ▼
                    ┌─────────────────────────┐
                    │ Durable Outbox Worker   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Central Resolver        │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ Negotiator Agent   │ │ 3-Way Recon Engine │ │ Detective Agent    │
│ (Razorpay Verification)│ │ (15 Divergences)   │ │ (Diagnostic AI)    │
└──────────┬─────────┘ └─────────┬──────────┘ └──────────┬─────────┘
           │                     │                       │
           └─────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────────┐
                    │ Deterministic Policy    │
                    │ Engine (Rules 1 - 5)    │
                    └────────────┬────────────┘
                                 │ Creates Signed AuthorizedAction
                                 ▼
                    ┌─────────────────────────┐
                    │ FinOps Executor         │
                    │ (HMAC Token Verified)   │
                    └────────────┬────────────┘
                                 │ Real Mutation
                                 ▼
                    ┌─────────────────────────┐
                    │ Razorpay REST API       │
                    └─────────────────────────┘
```

---

### Core Security & Integrity Layers

1. **Webhook Ingestion**: Raw request bytes verified using HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET` before parsing JSON.
2. **Transactional Outbox**: Events persisted to PostgreSQL in the same transaction as operational state updates.
3. **Outbox Worker**: Workers claim tasks using `FOR UPDATE SKIP LOCKED` and automatically recover crashed worker leases (`reclaim_stuck_tasks()`).
4. **Deterministic Policy Gate**: Evaluates 5 mandatory financial rules (State, Verified Evidence, Economic Identity, Duplicate Protection, Bounded Action).
5. **FinOps Execution Boundary**: Accepts ONLY cryptographically signed `AuthorizedAction` capability tokens with constant-time HMAC verification.
