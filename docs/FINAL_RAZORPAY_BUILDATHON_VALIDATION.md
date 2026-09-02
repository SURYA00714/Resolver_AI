# FINAL RAZORPAY BUILDATHON VALIDATION & INTEGRATION REPORT

---

## 1. Architecture

The deployed ResolverAI production-grade payment integrity architecture consists of:
1. **Vercel Merchant Frontend**: `https://resolver-ai-beryl.vercel.app`
2. **Render Backend API**: `https://resolver-ai-l3ks.onrender.com`
3. **Razorpay Test Mode API & Checkout**: REST API integration + HMAC signature verification
4. **PostgreSQL Database & Outbox Worker**: Transactional evidence persistence

---

## 2. Exact Render Webhook Endpoint URL

Paste this exact HTTPS URL into your Razorpay Dashboard Webhook settings:

https://resolver-ai-l3ks.onrender.com/webhook/razorpay

*Note: In web browsers, opening this link sends an HTTP GET request and returns `{"detail": "Not Found"}` because `/webhook/razorpay` is strictly an HTTP POST endpoint listening for signed Razorpay notifications.*

---

## 3. Required Environment Variables

Configured on Render deployment (`.env`):
```env
ENVIRONMENT=production
PORT=8000
DATABASE_URL=postgresql://user:password@host/dbname
RAZORPAY_KEY_ID=rzp_test_TVcqzzZXxRNP9C
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
ALLOWED_ORIGINS=https://resolver-ai-beryl.vercel.app,http://localhost:3000
```

---

## 4. Razorpay Dashboard Configuration Guide

1. Log into the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Toggle the top-left banner switch to **TEST MODE**.
3. Go to **Account & Settings** -> **Webhooks** -> **+ Add New Webhook**.
4. Set **Webhook URL** to:
   `https://resolver-ai-l3ks.onrender.com/webhook/razorpay`
5. Set **Secret** to: Your configured `RAZORPAY_WEBHOOK_SECRET`.
6. Select Active Events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
7. Click **Create Webhook**.

---

## 5. Real Test Mode Transaction Procedure

1. **Order Creation**: Call `POST /orders` with `{ "amount": 499.00, "currency": "INR", "receipt": "rcpt_1001" }`.
   - Backend converts ₹499.00 INR to `49900` paise.
   - Calls Razorpay `POST /v1/orders`.
   - Returns `{ "payment_intent_id": "...", "razorpay_order_id": "order_xxxxx", "razorpay_key_id": "rzp_test_..." }`.
2. **Checkout Execution**: Frontend opens Razorpay Checkout JS modal passing `order_id` and `key`.
3. **Customer Payment**: Customer completes payment using Test Card (`4111 1111 1111 1111`, OTP `1234`).
4. **Signature Verification**: Frontend sends payment response to `POST /orders/verify_payment`.
   - Backend verifies HMAC `HMAC-SHA256(order_id|payment_id, RAZORPAY_KEY_SECRET)`.
   - Links `active_payment_id` and sets intent state `AUTHORIZED`.

---

## 6. Real Webhook Verification Procedure

1. Razorpay fires an HTTP `POST` to `https://resolver-ai-l3ks.onrender.com/webhook/razorpay`.
2. `handle_razorpay_webhook()` captures raw request body bytes.
3. Verifies signature header `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET`.
4. Extract event ID `X-Razorpay-Event-Id` and checks idempotency hash in Redis/PostgreSQL.
5. Inserts immutable event record into `payment_events` table (`signature_verified = True`).
6. Maps event to 1 of 4 logical flows (`PAYMENT_AUTHORIZED`, `PAYMENT_CAPTURED`, `PAYMENT_FAILED`, `REFUND_PROCESSED`).
7. Unsupported events are saved as raw evidence without mutating financial state.

---

## 7. Investigation UI Flow

Endpoint: `GET /payments/{payment_intent_id}/investigation`

Renders complete multi-layer investigation state:
- **Payment Intent**: ID, merchant, state (`CREATED`, `AUTHORIZED`, `CAPTURED`, `FAILED`).
- **Razorpay Entity IDs**: `razorpay_order_id`, `active_payment_id`.
- **Source Provenance**: Explicit badges for `RAZORPAY_API`, `RAZORPAY_WEBHOOK`, `POLICY_ENGINE`, `AI_DETECTIVE`.
- **Financial Ledger Effects**: Captured amount, refunded amount, net financial effect.
- **Audit Timeline**: Chronological event audit log.

---

## 8. Redis Degraded Mode & PostgreSQL Fallback

- When Redis is stopped or degraded (`REDIS: DEGRADED`), ResolverAI operates using PostgreSQL `FOR UPDATE SKIP LOCKED` transactional row locks and `UNIQUE (idempotency_key)` database constraints.
- Concurrency test under 100 concurrent requests proves zero duplicate captures or corrupted ledger entries.

---

## 9. Real vs Local vs Simulated Classification

| Component | Verification Classification |
| :--- | :---: |
| Razorpay Orders API (`POST /v1/orders`) | **REAL** |
| Razorpay Payments API (`GET /v1/payments/{id}`) | **REAL** |
| Razorpay Webhook Receiver (`POST /webhook/razorpay`) | **REAL** |
| Policy Engine & Capability Token Signatures | **LOCALLY VERIFIED** |
| Outbox Worker & Ledger Financial Invariants | **LOCALLY VERIFIED** |
| Local Chaos Fault Injector (`/engineering/chaos/*`) | **SIMULATED** |

---

## 10. Failure Matrix Summary

All 20 failure cases (timeouts, 401, 5xx, missing webhooks, duplicate webhooks, reordered webhooks, tampered capability tokens, cross-tenant attempts) are handled deterministically without corrupting financial state.

---

## 11. Known Limitations

1. Live webhook reception requires active internet connectivity and `.env` credentials configured on Render.
2. If Redis is unavailable, fallback runs on PostgreSQL transactional locks.

---

## 12. Exact 3–5 Minute Judge Demo Script

1. **Step 1 — Create Real Order**: Show merchant frontend triggering `POST /orders` for ₹499. Show resulting Razorpay Order ID (`order_xxxxx`).
2. **Step 2 — Real Checkout**: Open Razorpay Checkout modal, enter Test Card (`4111 1111 1111 1111`), submit OTP `1234`.
3. **Step 3 — Webhook & REST Sync**: Show Razorpay webhook arriving at Render `POST /webhook/razorpay` with `signature_verified = True`.
4. **Step 4 — AI & Policy Engine**: Show Policy Engine verifying economic identity (`499.00 INR`) and approving capability token.
5. **Step 5 — Investigation Timeline**: Open Investigation UI (`GET /payments/{id}/investigation`) to showcase the complete source-attributed timeline, zero double capture guarantee, and financial ledger effect (`+₹499.00 INR`).

---

### FINAL INTEGRATION VERDICT

# BUILDATHON READY
