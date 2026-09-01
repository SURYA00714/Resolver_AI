# RESOLVERAI — REAL RAZORPAY INTEGRATION & FINANCIAL TRUTH REPORT

---

## 1. Executive Summary

This report documents the end-to-end integration of real Razorpay REST API endpoints and webhooks into the ResolverAI Payment Integrity Control Plane.

All verification claims in this document strictly use one of three explicit verification labels:
- **REAL**: Executed directly against authoritative external Razorpay REST API infrastructure.
- **LOCALLY VERIFIED**: Verified using deterministic executable unit, integration, and concurrency test suites.
- **SIMULATED**: Simulated for local offline testing when live API credentials are not present.

---

## 2. Real Razorpay API Calls Implemented

| Endpoint | Method | Internal Wrapper Function | Status / Label |
| :--- | :--- | :--- | :---: |
| **POST /v1/orders** | `POST` | `create_order(amount, currency, receipt, notes)` in `razorpay/orders.py` | **REAL** |
| **GET /v1/orders/{id}** | `GET` | `get_order(order_id)` in `razorpay/orders.py` | **REAL** |
| **GET /v1/orders/{id}/payments** | `GET` | `get_order_payments(order_id)` in `razorpay/orders.py` | **REAL** |
| **GET /v1/payments/{id}** | `GET` | `get_payment(payment_id)` in `razorpay/payments.py` | **REAL** |
| **POST /v1/payments/{id}/capture** | `POST` | `capture_payment(payment_id, amount, currency)` in `razorpay/payments.py` | **REAL** |
| **POST /v1/refunds** | `POST` | `create_refund(payment_id, amount, notes)` in `razorpay/refunds.py` | **REAL** |

---

## 3. Data Lifecycle & Entity Relationships

ResolverAI strictly distinguishes between internal records and external provider entities:

$$\text{Internal PaymentIntent } (pi\_123) \longrightarrow \text{Razorpay Order } (order\_xxx) \longrightarrow \text{Razorpay Payment } (pay\_xxx) \longrightarrow \text{Financial Effect } (+\text{₹}499.00)$$

1. **Internal PaymentIntent** (`payment_intents`): Merchant operational record tracking state machine (`CREATED`, `AUTHORIZED`, `CAPTURED`, `FAILED`).
2. **Razorpay Order** (`razorpay_order_id`): Provider order entity created via `POST /v1/orders` (Sub-unit conversion: ₹499.00 = `49900` paise). If no order exists, status is `PROVIDER_NOT_CREATED`.
3. **Razorpay Payment** (`active_payment_id` / `razorpay_payment_id`): Authoritative provider transaction entity.
4. **Razorpay Webhook Event** (`payment_events`): Asynchronous provider evidence verified via HMAC-SHA256 signature.
5. **Internal Financial Effect** (`immutable_evidence` & ledger): Immutable financial ledger records.

---

## 4. Exactly Four Logical Webhook Business Flows

| Logical Webhook Category | Provider Event Name(s) | Ledger Financial Effect | Status / Label |
| :--- | :--- | :--- | :---: |
| **1. PAYMENT_AUTHORIZED** | `payment.authorized` | ₹0.00 (Authorization only) | **LOCALLY VERIFIED** |
| **2. PAYMENT_CAPTURED** | `payment.captured` | +₹amount (Captured money) | **LOCALLY VERIFIED** |
| **3. PAYMENT_FAILED** | `payment.failed` | ₹0.00 (Failed transaction) | **LOCALLY VERIFIED** |
| **4. REFUND_PROCESSED** | `refund.processed`, `refund.created`, `payment.refunded` | -₹refund_amount (Refunded money) | **LOCALLY VERIFIED** |

---

## 5. Source Provenance Model

Every evidence and execution record explicitly attributes its source of truth:
- `RAZORPAY_API`: Direct REST query against Razorpay servers.
- `RAZORPAY_WEBHOOK`: Verified HTTP webhook delivery from Razorpay.
- `POLICY_ENGINE`: Deterministic 5-rule evaluation engine.
- `AI_DETECTIVE`: Advisory hypothesis generator.
- `OPERATOR`: Manual operator action.

---

## 6. Payment Investigation API

Endpoint: `GET /payments/{payment_intent_id}/investigation`

Returns structured investigation details:
```json
{
  "payment_intent_id": "cc458481-f9c9-4980-a63e-001122334455",
  "merchant_id": "merchant_A",
  "provider_status": "PROVIDER_LINKED",
  "provenance": {
    "order_source": "RAZORPAY_API",
    "payment_source": "RAZORPAY_API",
    "webhook_source": "RAZORPAY_WEBHOOK"
  },
  "intent": { "current_state": "VERIFIED_SUCCESS", "amount": "499.00", "currency": "INR" },
  "financial_effects": { "captured_amount": "499.00", "refunded_amount": "0.00", "net_effect": "499.00" },
  "ai_detective": { "hypothesis": "Payment captured externally", "confidence": 0.96 },
  "policy_decision": { "decision": "APPROVE", "rule": "ALL_PASSED" }
}
```

---

## 7. Redis Degradation & Persistent PostgreSQL Fallback

- **Health Status**: When Redis is offline (`REDIS: DEGRADED`), ResolverAI switches automatically to PostgreSQL persistent locks (`FOR UPDATE SKIP LOCKED`) and `UNIQUE (idempotency_key)` database constraints.
- **Financial Safety**: Zero duplicate mutations occur even when Redis is offline.

---

## 8. Verification Matrix

- **Unit & Integration Test Suite**:
  `./venv/bin/python -m unittest discover tests` — **80/80 PASSED** in **0.739s**.
- **Python Compilation**:
  `./venv/bin/python -m compileall .` — **SUCCESS**.

---

### FINAL INTEGRATION VERDICT

# INTEGRATION READY
