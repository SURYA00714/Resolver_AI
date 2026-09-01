# RESOLVERAI — SYSTEM THREAT MODEL & STRIDE MITIGATION MATRIX

---

### Threat Actors & Capabilities

1. **A1: Unauthenticated External Attacker**
   - *Target*: API endpoints (`/payments`, `/cases`), webhook ingestion (`/webhook/razorpay`).
   - *Defense*: Mandatory JWT bearer token authentication on API routes; HMAC-SHA256 signature verification on raw request body for webhooks.

2. **A2: Authenticated Malicious Merchant (Cross-Tenant Attack)**
   - *Target*: Intercepting or executing actions on another merchant's payment intent.
   - *Defense*: Explicit `verify_merchant_access()` checking caller's JWT `merchant_id` against database row `merchant_id`. Returns `HTTP 403 Forbidden`.

3. **A3: Malicious AI Advisory Injection**
   - *Target*: Attempting to bypass Policy Engine rules by returning hallucinated or adversarial prompt outputs.
   - *Defense*: AI outputs (`DetectiveResult`) are treated as untrusted proposals. The deterministic `PolicyEngine` enforces mandatory rules 1–5. AI cannot generate `AuthorizedAction` tokens.

4. **A4: Replayed or Tampered Capability Tokens**
   - *Target*: Re-executing an expired or modified `AuthorizedAction` command.
   - *Defense*: Token includes `issued_at`, `expires_at`, and HMAC-SHA256 signature calculated over all payload parameters. FinOps Executor verifies signature in constant time.

5. **A5: Process / Infrastructure Crash Window**
   - *Target*: Worker process SIGKILL during outbox task processing.
   - *Defense*: PostgreSQL atomic `FOR UPDATE SKIP LOCKED` outbox queue with automated 60-second lease reclamation (`reclaim_stuck_tasks()`).
