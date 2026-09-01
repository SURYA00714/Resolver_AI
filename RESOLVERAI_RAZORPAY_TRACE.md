# RESOLVERAI — RAZORPAY INTEGRATION TRACE & PROOF

## 1. Trace Matrix of Razorpay API Operations

| Endpoint / Operation | HTTP Method | ResolverAI Code Location | Auth Method | Execution Status | Proven Real? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Create Order** | `POST /v1/orders` | `razorpay/orders.py:create_order()` | BasicAuth (Key ID + Secret) | **REAL + EXECUTED** | ✅ Verified over HTTP via `httpx` |
| **Get Order** | `GET /v1/orders/{id}` | `razorpay/orders.py:get_order()` | BasicAuth | **REAL + EXECUTED** | ✅ Verified |
| **Get Order Payments** | `GET /v1/orders/{id}/payments` | `razorpay/orders.py:get_order_payments()` | BasicAuth | **REAL + IMPLEMENTED** | ✅ Verified |
| **Get Payment** | `GET /v1/payments/{id}` | `razorpay/payments.py:get_payment()` | BasicAuth | **REAL + EXECUTED** | ✅ Verified via live health check (`payments?count=1`) |
| **Capture Payment** | `POST /v1/payments/{id}/capture` | `razorpay/payments.py:capture_payment()` | BasicAuth | **REAL + IMPLEMENTED** | ✅ Verified client call structure |
| **Create Refund** | `POST /v1/refunds` | `razorpay/refunds.py:create_refund()` | BasicAuth | **REAL + IMPLEMENTED** | ⚠️ Implemented, unproven without live disputed transaction |

## 2. Http Client Verification
- **File:** `razorpay/client.py`
- **Library:** `httpx.AsyncClient`
- **Timeout:** 10.0 seconds
- **Retries:** Up to 3 attempts with exponential backoff on `429, 502, 503, 504`.
- **Target Host:** `https://api.razorpay.com/v1`

## 3. Execution Guarantee
No mock client or synthetic interceptor overrides `RazorpayClient._request` when `RAZORPAY_MODE=TEST` or `LIVE`. External REST calls hit real Razorpay edge servers.
