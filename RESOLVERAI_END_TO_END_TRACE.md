# RESOLVERAI — END TO END TRACE

### Scenario: Webhook Arrival & Resolution

1. **Razorpay Webhook Arrives:** POST to `/webhook/razorpay` containing raw bytes.
2. **HMAC Validation:** `X-Razorpay-Signature` checked against local `RAZORPAY_WEBHOOK_SECRET` via SHA-256 constant-time digest.
3. **Deduplication:** Checked in Redis first. If missing, relies on Postgres `UNIQUE` constraint.
4. **Persistence (Truth 1):** Raw payload written to `payment_events`. Postgres trigger makes it immutable.
5. **State Update (Truth 2):** Upserts current known state into `payment_intents`.
6. **Outbox Enqueue:** Adds a `RESOLVE_INTENT` message to `outbox_events`. Return `HTTP 200` to Razorpay.
7. **Worker Poll:** `worker.py` picks up message using `FOR UPDATE SKIP LOCKED`.
8. **Resolution:** `core.resolver.resolve()` fetches history and calls Policy Engine / AI.
9. **Mutation:** If capture/refund authorized, makes HTTP call to Razorpay via `razorpay/client.py`.
10. **Evidence (Truth 3):** Final decision written to `immutable_evidence`. Postgres trigger prevents future deletion.
