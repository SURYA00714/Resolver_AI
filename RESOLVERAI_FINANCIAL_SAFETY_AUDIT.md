# RESOLVERAI — FINANCIAL SAFETY & IDEMPOTENCY AUDIT

## 1. Financial Mutation Guarantees

Every capture and refund request must go through the FinOps executor (`agents/finops_executor.py`) and Policy Engine (`core/policy_engine.py`).

```
Request -> RBAC Check -> Policy Evaluation -> AuthorizedAction Token -> FinOps Execution -> Razorpay API -> Audit & Evidence Logging
```

## 2. Financial Safety Controls

1. **Token Authorization:** Mutations require an `AuthorizedAction` token with an expiration timestamp and strict amount check.
2. **Idempotency Protection:**
   - **Database Level:** `external_executions` maintains a `UNIQUE` index on `idempotency_key`.
   - **Outbox Worker:** Uses PostgreSQL `FOR UPDATE SKIP LOCKED` to prevent race conditions across parallel worker instances.
3. **Database Immutability:**
   - PostgreSQL triggers `block_evidence_modification` and `block_event_modification` prevent modification or deletion of `immutable_evidence` and `payment_events`.

## 3. Crash Recovery & Ambiguity Analysis
- **Scenario:** Worker calls Razorpay `POST /payments/{id}/capture` successfully, but crashes before recording the DB response.
- **Worker Recovery:** On restart, outbox reclaims the `PENDING` transaction. 
- **Safety Mechanism:** Razorpay API returns `400 Bad Request: Payment already captured`, which ResolverAI catches and handles gracefully without double-capturing or inflating financial records.
