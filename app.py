# FILE: app.py
"""ResolverAI — FastAPI Application Entry Point (§38-39)."""
import os
import sys

from fastapi import FastAPI

from api.demo_routes import router as demo_router
from api.webhook_receiver import router as webhook_router
from core.idempotency import close_redis
from db.connection import check_db, close_db, get_pool, init_db

app = FastAPI(
    title="ResolverAI Engine",
    description="AI-Guided Payment State Resolution & Revenue Recovery Control Plane",
    version="1.0.0",
)

# Register routers
app.include_router(webhook_router)
app.include_router(demo_router)


@app.on_event("startup")
async def startup_event():
    try:
        await init_db()
        print("[STARTUP] Database pool initialized", file=sys.stderr)
    except Exception as e:
        print(f"[STARTUP] FATAL: Could not connect to database: {e}", file=sys.stderr)
        raise


@app.on_event("shutdown")
async def shutdown_event():
    await close_db()
    await close_redis()
    print("[SHUTDOWN] Connections closed", file=sys.stderr)


@app.get("/health")
async def health():
    """Health check — is the service alive?"""
    return {"status": "ok", "service": "resolverai"}


@app.get("/ready")
async def readiness():
    """Readiness check — can we serve requests?"""
    try:
        db_ok = await check_db()
        return {"status": "ready" if db_ok else "not_ready", "db": db_ok}
    except Exception as e:
        return {"status": "not_ready", "db": False, "error": str(e)}


@app.get("/")
async def root():
    return {
        "service": "ResolverAI",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
