# ResolverAI — Merchant Payment Integrity & Recovery Platform

A production-grade **merchant-side payment operations control plane** for Razorpay.

---

## What ResolverAI Is

ResolverAI is a real payment integrity platform — not a demo, not a simulation.

It connects to **your actual Razorpay account** (or runs in synthetic mode without credentials) to:

1. **Receive Razorpay webhooks** with HMAC-SHA256 signature verification
2. **Persist payment state** in a 15-state deterministic state machine (PostgreSQL)
3. **Run rule-based anomaly detection** to classify payment failures
4. **Execute recovery actions** (capture, refund) via the Razorpay API
5. **Maintain audit trails** for all mutations with idempotency guarantees
6. **Expose a real-time control plane** for payment operations

---

## Architecture

```
Razorpay API
    │
    ▼
POST /webhook/razorpay   ← HMAC-SHA256 verification
    │
    ▼
PostgreSQL Outbox        ← Transactional outbox pattern
    │
    ▼
Outbox Worker            ← Exponential backoff, dead-letter
    │
    ▼
Core Resolver
  ├── Detective Agent    ← Rule engine (or Gemini/Groq if configured)
  ├── Negotiator         ← Fetch live Razorpay state
  ├── Policy Engine      ← Deterministic decision rules
  └── FinOps Executor    ← Real Razorpay API mutations
    │
    ▼
Next.js Frontend         ← Payment operations control plane
```

---

## What Is Real

| Component | What's Real |
|---|---|
| Webhook receiver | HMAC-SHA256 signature verification on every webhook |
| Payment state machine | 15 deterministic states, enforced by code |
| Outbox pattern | PostgreSQL transactional outbox with FOR UPDATE SKIP LOCKED |
| Idempotency | Redis-based distributed locking + DB UNIQUE constraints |
| Razorpay API | Real capture/refund via Razorpay REST API (when credentials set) |
| Order creation | `POST /orders` → real Razorpay order entity |
| Audit trail | Immutable event log in PostgreSQL |
| Exponential backoff | Worker retries with `2^attempts` second delay |
| Dead-letter queue | Events exceeding MAX_ATTEMPTS → DEAD_LETTER status |

## What Requires Configuration

| Feature | Environment Variable |
|---|---|
| Real Razorpay API calls | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Webhook signature verification | `RAZORPAY_WEBHOOK_SECRET` |
| Gemini AI advisory | `GEMINI_API_KEY` + `AI_MODE=ENABLED` |
| Groq AI advisory | `GROQ_API_KEY` + `AI_MODE=ENABLED` |

Without these, the platform runs in **SYNTHETIC mode** — all state is local, no Razorpay API calls are made. This is clearly indicated in the UI.

---

## Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 14+
- Redis 7+ (optional — falls back to in-memory)
- Node.js 18+

### Backend

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your Razorpay credentials
nano .env

# 3. Start dependencies (PostgreSQL + Redis)
docker compose up -d

# 4. Start backend
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# 5. Start worker (separate terminal)
python3 worker.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Access at: `http://localhost:3000`
API docs at: `http://localhost:8000/docs`

### One-command start

```bash
bash start_all.sh
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis URL (optional) |
| `RAZORPAY_KEY_ID` | — | Razorpay Key ID (rzp_test_ or rzp_live_) |
| `RAZORPAY_KEY_SECRET` | — | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | — | Webhook signing secret |
| `RAZORPAY_MODE` | `SYNTHETIC` | `TEST`, `LIVE`, or `SYNTHETIC` |
| `AI_MODE` | `DETERMINISTIC` | `DETERMINISTIC` or `ENABLED` |
| `GEMINI_API_KEY` | — | Google Gemini API key (optional) |
| `GROQ_API_KEY` | — | Groq API key (optional) |
| `ENVIRONMENT` | `development` | `development` or `production` |

---

## API Endpoints

### Core
- `GET /health` — Backend health + mode
- `GET /integrations/health` — Real-time Razorpay connectivity check

### Payments
- `GET /payments` — List payment intents
- `GET /payments/{id}` — Payment intent detail
- `POST /payments/{id}/reconcile` — Trigger resolution
- `GET /payments/{id}/verify` — Live Razorpay snapshot

### Orders
- `POST /orders` — Create a real Razorpay order
- `GET /orders/{razorpay_order_id}` — Fetch order with payments

### Webhooks
- `POST /webhook/razorpay` — Razorpay webhook receiver (HMAC verified)
- `GET /webhooks` — Webhook event history
- `GET /webhooks/{id}` — Webhook event detail
- `POST /webhooks/{id}/replay` — Internal event replay

### Reconciliation
- `GET /cases` — Reconciliation cases
- `POST /cases/{id}/manual-resolve` — Operator resolution

### Dashboard
- `GET /dashboard/stats` — KPI aggregates
- `GET /audit` — Audit event log
- `GET /outbox/dead-letters` — Dead-letter events

### Engineering (local only)
- `POST /engineering/chaos/late-auth` — Inject late authorization test
- `POST /engineering/chaos/cross-rail` — Inject duplicate execution test
- `POST /engineering/chaos/out-of-order` — Inject out-of-order webhook test

---

## AI Provider

The "AI" in ResolverAI is named honestly:

| Config | What It Uses |
|---|---|
| Default (no API key) | **Deterministic Rule Engine** — explicit audit-able rules |
| `GEMINI_API_KEY` + `AI_MODE=ENABLED` | **Gemini AI Advisory** — LLM analysis layer |
| `GROQ_API_KEY` + `AI_MODE=ENABLED` | **Groq AI Advisory** — LLM analysis layer |

The provider name is shown in the UI next to every recommendation. The AI layer is **advisory only** — it cannot authorize financial actions.

---

## Honesty Contract

> "Never fabricate external state. Never fabricate AI. Never fabricate financial outcomes."

- No demo buttons in the main product UI
- No synthetic payments presented as real
- Engineering chaos tools are clearly labeled LOCAL ENGINEERING TEST ONLY
- Every webhook shows its source (RAZORPAY vs SYNTHETIC)
- Signature verification failures are recorded and visible
- The integration health page shows exactly what is and isn't connected

---

## Tests

```bash
python3 -m pytest tests/ -v
```

---

## License

MIT
