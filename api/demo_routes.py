# FILE: api/demo_routes.py
"""Engineering-only chaos injection endpoints.

IMPORTANT: These endpoints are for LOCAL ENGINEERING TESTING ONLY.
They are disabled in production (ENVIRONMENT=production).
They inject synthetic scenarios into the database for testing
the resolution pipeline. They DO NOT simulate Razorpay.

Route prefix: /engineering/chaos
"""
import json
import sys
import uuid
from decimal import Decimal

from fastapi import APIRouter, HTTPException

import config
from chaos_lab.faults import (
    inject_cross_rail_duplicate,
    inject_late_authorization,
    inject_out_of_order_webhook,
)
from db.connection import get_pool

router = APIRouter(prefix="/engineering/chaos", tags=["engineering"])

ENGINEERING_BANNER = {
    "environment": "LOCAL_ENGINEERING_TEST",
    "warning": "This endpoint injects SYNTHETIC data. Data generated here is NOT from Razorpay.",
}


def _check_engineering_mode():
    if config.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=403,
            detail="Engineering chaos endpoints are disabled in production.",
        )


@router.post("/late-auth")
@router.post("/delayed_webhook")
@router.post("/DELAYED_WEBHOOK")
async def chaos_late_auth():
    """Inject a Late Authorization / Delayed Webhook synthetic scenario."""
    _check_engineering_mode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_late_authorization(conn)
    return {"_banner": ENGINEERING_BANNER, "status": "SUCCESS", "injected": result, "payment_intent_id": result.get("payment_intent_id")}


@router.post("/cross-rail")
@router.post("/duplicate_webhook")
@router.post("/DUPLICATE_WEBHOOK")
async def chaos_cross_rail():
    """Inject a Cross-Rail / Duplicate Webhook synthetic scenario."""
    _check_engineering_mode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_cross_rail_duplicate(conn)
    return {"_banner": ENGINEERING_BANNER, "status": "SUCCESS", "injected": result, "payment_intent_id": result.get("payment_intent_id")}


@router.post("/out-of-order")
@router.post("/out_of_order")
@router.post("/OUT_OF_ORDER")
@router.post("/tampered_signature")
@router.post("/TAMPERED_SIGNATURE")
@router.post("/bank_error")
@router.post("/BANK_ERROR")
@router.post("/conflicting_state")
@router.post("/CONFLICTING_STATE")
async def chaos_out_of_order():
    """Inject Out-of-Order / Tampered Signature / Bank Error / Conflicting State synthetic scenario."""
    _check_engineering_mode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_out_of_order_webhook(conn)
    return {"_banner": ENGINEERING_BANNER, "status": "SUCCESS", "injected": result, "payment_intent_id": result.get("payment_intent_id")}


