# RESOLVERAI — DISTRIBUTED FAILURE MATRIX & SYSTEM RECOVERY SPECIFICATION

---

### Component Failure Matrix

| Component | Failure Mode | Impact | Recovery Mechanism | Deterministic State |
| :--- | :--- | :--- | :--- | :--- |
| **Razorpay API** | HTTP 5xx / Timeout | Cannot fetch external payment status | Mark negotiator status as `UNKNOWN`. Policy Engine rejects financial mutation. Schedule reconciliation polling. | `UNCERTAIN` |
| **Razorpay API** | HTTP 401 Auth Failure | Client credentials invalid | Log error, raise `RazorpayAPIError(401)`. Reject financial action. | `UNCERTAIN` |
| **Redis** | Connection Loss / Timeout | Fast-path idempotency cache unavailable | Graceful fallback to PostgreSQL authoritative `payment_events` unique constraints. | `SAFE_FALLBACK` |
| **Worker Process** | SIGKILL / OOM | Outbox task left in `PROCESSING` status | Active worker instances run `reclaim_stuck_tasks()` after 60s lease expiration, resetting status to `PENDING`. | `RECLAIMED` |
| **Database** | Connection Refused / Transient | Outbox worker or API request fails | API returns HTTP 500. Outbox worker retries task with exponential backoff ($2^{\text{attempts}}$ seconds). | `RETRIED` |
| **Webhook** | Duplicate Delivery | Identical webhook delivered multiple times | Webhook receiver checks Redis/DB idempotency key. Ignores event on duplicate without side effects. | `IGNORED_DUPLICATE` |
| **Webhook** | Out-of-Order Delivery | Success webhook arrives before Order Created event | Insert payment event into `payment_events`. Upsert `payment_intents`. Resolver reconciles state deterministically. | `RECONCILED` |
