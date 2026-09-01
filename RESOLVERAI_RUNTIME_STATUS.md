# RESOLVERAI — RUNTIME STATUS

| Component | Status | Detail |
| :--- | :--- | :--- |
| **FastAPI Backend** | 🟢 HEALTHY | Running and accepting requests. |
| **Next.js Frontend** | 🟢 HEALTHY | Serving UI. |
| **PostgreSQL** | 🟢 HEALTHY | Connected and schema initialized. |
| **Redis** | 🟡 DEGRADED / 🟢 CONNECTED | Varies based on local Docker state. If unavailable, falls back to DB idempotency safely. |
| **Outbox Worker** | 🟢 HEALTHY | Polling via `worker.py`. |
| **Razorpay API** | 🟢 HEALTHY | Configured in TEST mode with valid credentials. |
| **AI Provider** | 🟡 DEGRADED | `AI_MODE=DETERMINISTIC`. Keys are missing, so it acts deterministically. |
