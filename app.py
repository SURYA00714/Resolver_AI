# FILE: app.py
"""ResolverAI — FastAPI Application Entry Point."""
import os
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from api.auth_routes import router as auth_router
from api.dashboard_routes import router as dashboard_router
from api.demo_routes import router as engineering_router
from api.orders_routes import router as orders_router
from api.payment_routes import router as payment_router
from api.razorpay_verify_routes import router as verify_router
from api.reconciliation_routes import router as case_router
from api.webhook_receiver import router as webhook_router
from core.idempotency import close_redis
from core.rate_limiter import is_rate_limited
from db.connection import check_db, close_db, get_pool, init_db

app = FastAPI(
    title="ResolverAI Engine",
    description=(
        "Merchant-side Payment Integrity & Recovery Platform. "
        "Reconciles Razorpay payment state, webhook history, and merchant intent."
    ),
    version="2.0.0",
)

# CORS configuration supporting localhost, Vercel deployments, and configured origins
_allowed_origins = [o.strip() for o in config.ALLOWED_ORIGINS if o.strip()]
if not _allowed_origins:
    _allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

if "https://resolver-ai-beryl.vercel.app" not in _allowed_origins:
    _allowed_origins.append("https://resolver-ai-beryl.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
)


# ─── Global Middleware ────────────────────────────────────────────────────────

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    limit_key = f"{client_ip}:{user_agent}"

    if path.startswith("/webhook"):
        max_req = config.RATE_LIMIT_WEBHOOK_MAX
    else:
        max_req = config.RATE_LIMIT_MAX_REQUESTS

    if await is_rate_limited(limit_key, max_req, config.RATE_LIMIT_WINDOW_SECONDS):
        return JSONResponse(
            status_code=429,
            content={"error": "rate_limit_exceeded", "message": "Too many requests. Please retry later."},
        )
    return await call_next(request)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    import uuid as _uuid
    cid = request.headers.get("X-Request-ID", str(_uuid.uuid4()))
    request.state.correlation_id = cid
    response = await call_next(request)
    response.headers["X-Request-ID"] = cid
    return response


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(webhook_router)
app.include_router(payment_router)
app.include_router(orders_router)
app.include_router(case_router)
app.include_router(dashboard_router)
app.include_router(verify_router)
# Engineering routes registered but protected by environment gate in the router itself


@app.on_event("startup")
async def startup_event():
    try:
        await init_db()
        print(
            f"[STARTUP] DB ready | RAZORPAY_MODE={config.RAZORPAY_MODE} | AI_MODE={config.AI_MODE} | ENV={config.ENVIRONMENT}",
            file=sys.stderr,
        )
    except Exception as e:
        print(
            f"[STARTUP] WARNING: Database connection failed during startup: {e}. Servicing requests in degraded mode.",
            file=sys.stderr,
        )


@app.on_event("shutdown")
async def shutdown_event():
    await close_db()
    await close_redis()
    print("[SHUTDOWN] Connections closed", file=sys.stderr)


@app.get("/health")
async def health():
    """Health check — is the service alive?"""
    return {
        "status": "ok",
        "service": "resolverai",
        "environment": config.ENVIRONMENT,
        "razorpay_mode": config.RAZORPAY_MODE,
        "ai_mode": config.AI_MODE,
    }


@app.get("/ready")
@app.get("/health/ready")
async def readiness():
    """Readiness check — can we serve requests?"""
    try:
        db_ok = await check_db()
        return {"status": "ready" if db_ok else "not_ready", "db": db_ok}
    except Exception as e:
        return {"status": "not_ready", "db": False, "error": str(e)}


@app.get("/")
async def root():
    razorpay_configured = bool(config.RAZORPAY_KEY_ID and config.RAZORPAY_KEY_SECRET)
    return {
        "service": "ResolverAI — Payment Integrity & Recovery Platform",
        "version": "2.0.0",
        "razorpay_mode": config.RAZORPAY_MODE,
        "razorpay_configured": razorpay_configured,
        "ai_mode": config.AI_MODE,
        "environment": config.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health",
    }
