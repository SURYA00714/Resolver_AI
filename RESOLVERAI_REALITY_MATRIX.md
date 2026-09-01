# RESOLVERAI — REALITY MATRIX

| Feature / Component | Code Exists? | Runtime Enabled? | External System Contacted? | Database Effect? | UI Effect? | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Razorpay REST Client** | Yes (`razorpay/client.py`) | Yes | Yes (`api.razorpay.com`) | Yes (`external_executions`) | Updated status badges | **REAL + EXECUTED** |
| **Webhook Signature Verification** | Yes (`razorpay/webhooks.py`) | Yes | Yes (Accepts HTTP POST) | Yes (`payment_events`) | Live log updates | **REAL + EXECUTED** |
| **Database Immutability** | Yes (`schema.sql`) | Yes | No | Blocks invalid updates | Read-only indicators | **REAL + ENFORCED** |
| **Durable Outbox Queue** | Yes (`worker.py`) | Yes | No | Updates `outbox_events` | Task processing | **REAL + EXECUTED** |
| **Reconciliation Engine** | Yes (`core/resolver.py`) | Yes | Yes (Fetch order/payment) | Upserts `payment_intents` | Case status update | **REAL + EXECUTED** |
| **Server-Side RBAC** | Yes (`core/rbac.py`) | Yes | No | None | Gated action buttons | **REAL + ENFORCED** |
| **AI LLM Engine** | Yes (`agents/ai_providers.py`) | Degraded | No | None | Shows "DETERMINISTIC" badge | **SIMULATED / FALLBACK** |
| **Multi-Tenancy** | Partial | No | No | Uses `default_merchant` | Single view | **NOT MULTI-TENANT** |
