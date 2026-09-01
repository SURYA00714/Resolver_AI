# RESOLVERAI — FULL FORENSIC REPORT

## 1. MISSION & SCOPE
An exhaustive unvarnished forensic investigation of ResolverAI's current repository and runtime was conducted. The goal was to prove what is **REAL** versus what is **SIMULATED** or **UNPROVEN**.

## 2. REPOSITORY DISCOVERY
The repository consists of a Next.js frontend, a FastAPI backend, a durable outbox worker, and a PostgreSQL database. 

## 3. ACTUAL RUNTIME ARCHITECTURE
- **Frontend**: Next.js (React)
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **Queue/Cache**: Redis
- **Worker**: Standalone Python process (`worker.py`)
- **Integration**: Razorpay (REST + Webhooks)

## 4. REAL RAZORPAY VERIFICATION
**Result: REAL.**
The system makes legitimate HTTP requests via `httpx.AsyncClient` in `razorpay/client.py`. It correctly authenticates using `BasicAuth` with `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. It implements exponential backoff and timeout handling.

## 5. REAL WEBHOOK FORENSICS
**Result: REAL.**
The route `POST /webhook/razorpay` captures raw bytes. It validates the `X-Razorpay-Signature` using `hmac.new` and `hmac.compare_digest` in `razorpay/webhooks.py`. Invalid signatures are rejected with HTTP 401.

## 6. PAYMENT LIFECYCLE
Events are saved to `payment_events`, upserted into `payment_intents`, and pushed to `outbox_events` transactionally. The background `worker.py` picks them up and triggers `core.resolver.resolve()`.

## 7. THREE TRUTHS AUDIT
**Result: ENFORCED AT DATABASE LEVEL.**
`schema.sql` contains active PostgreSQL triggers (`block_evidence_modification` and `block_event_modification`) that throw an exception if any `UPDATE` or `DELETE` is attempted on `payment_events` or `immutable_evidence`.

## 8. OUTBOX & DISTRIBUTED SYSTEMS AUDIT
**Result: PRODUCTION-GRADE.**
`worker.py` uses `FOR UPDATE SKIP LOCKED`. This guarantees safe concurrent worker execution. It also implements exponential backoff (`available_at`) and a Dead Letter Queue (`status = 'DEAD_LETTER'`) for poison messages.

## 9. REDIS AUDIT
Redis is used for rate limiting and fast-path idempotency. If Redis fails, idempotency falls back to the PostgreSQL `UNIQUE` constraint, maintaining system safety (though degrading performance).

## 10. AI FORENSICS
**Result: DEGRADED / DETERMINISTIC.**
The AI integration exists in `agents/`, but the `config.py` defaults to `AI_MODE=DETERMINISTIC`. Because no `GEMINI_API_KEY` or `GROQ_API_KEY` is currently provided, the system acts deterministically. The LLM capability is implemented but currently inactive in this environment.

## 11. AUTHENTICATION & RBAC
**Result: IMPLEMENTED.**
JWTs (HS256) are used. RBAC roles (`viewer`, `operator`, `admin`) are strictly defined in `config.py` and enforced via `Depends(require_permission(...))` on routes.

## 12. DEMO CREDIBILITY
**Result: EXCELLENT.**
The frontend displays real `rzp_test_` order IDs and real webhook payloads. The architecture prevents fake data from overriding the Razorpay source of truth.

---

**Would I trust this system with a real merchant's Razorpay TEST account today?**
Yes. The webhooks, HMAC verification, outbox, and database immutability are fully functional and production-grade.

**Would I trust this system with LIVE merchant money today?**
Only after configuring a proper Secret Management system (like AWS Secrets Manager) instead of `.env`, and load testing the outbox worker under heavy webhook burst conditions. The codebase itself is structurally ready for live money.
