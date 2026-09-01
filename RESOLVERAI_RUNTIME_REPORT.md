# RESOLVERAI — RUNTIME FORENSIC REPORT

**Timestamp:** 2026-08-29T20:52:00Z  
**Environment:** Development (`ENVIRONMENT=development`)  
**Active Razorpay Mode:** `RAZORPAY_MODE=TEST`  
**Active AI Mode:** `AI_MODE=DETERMINISTIC`  

## 1. Runtime Process & Service Audit

| Component | Service | Process / Port | Observed Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | FastAPI (uvicorn) | `0.0.0.0:8000` | 🟢 HEALTHY | Responding to GET `/health` & GET `/integrations/health`. |
| **Frontend UI** | Next.js | `localhost:3000` | 🟢 HEALTHY | SSR & CSR routes rendering properly. |
| **Database** | PostgreSQL | `localhost:5432` | 🟢 HEALTHY | `asyncpg` pool initialized, schema tables & triggers active. |
| **Cache/Queue** | Redis | `localhost:6379` | 🟡 DEGRADED / CONNECTED | Operating via Docker or falling back safely to in-memory idempotency. |
| **Outbox Worker**| Python script | `worker.py` | 🟢 HEALTHY | Polling `outbox_events` with `FOR UPDATE SKIP LOCKED`. |
| **Reconciliation**| Poller / Worker | Background task | 🟢 HEALTHY | Triggered via outbox event processing & manual `/reconciliation/sweep`. |

## 2. Configuration & Environment State

- `RAZORPAY_KEY_ID`: Configured (`rzp_test_...`)
- `RAZORPAY_KEY_SECRET`: Configured in `.env` (Masked)
- `RAZORPAY_WEBHOOK_SECRET`: Configured (`my_super_secret_...`)
- `JWT_SECRET_KEY`: Configured (`resolverai_production_...`)
- `AI_MODE`: `DETERMINISTIC` (No external LLM key provided; using rule-based engine)

## 3. Configuration Anomalies
1. `.env` stores plain-text credentials locally. No hardware or cloud KMS (Vault/AWS Secrets Manager) integration is hooked up.
2. `AI_MODE` defaults to `DETERMINISTIC` when API keys for Gemini/Groq are empty, ensuring continuous availability without throwing unhandled exceptions.
