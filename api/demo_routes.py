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


@router.post("/late-auth", summary="[ENGINEERING] Inject Late Authorization scenario")
@router.post("/delayed_webhook", summary="[ENGINEERING] Inject Delayed Webhook scenario")
async def chaos_late_auth():
    """
    Inject a Late Authorization synthetic scenario for engineering tests.

    WARNING: This creates SYNTHETIC payment intents — not real Razorpay payments.
    Use only in LOCAL ENGINEERING TEST environments to verify the resolution pipeline.
    """
    _check_engineering_mode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_late_authorization(conn)
    return {"_banner": ENGINEERING_BANNER, "injected": result, "payment_intent_id": result.get("payment_intent_id")}


@router.post("/cross-rail", summary="[ENGINEERING] Inject Duplicate Execution scenario")
@router.post("/duplicate_webhook", summary="[ENGINEERING] Inject Duplicate Webhook scenario")
async def chaos_cross_rail():
    """
    Inject a Cross-Rail Duplicate synthetic scenario for engineering tests.

    WARNING: This creates SYNTHETIC payment intents — not real Razorpay payments.
    """
    _check_engineering_mode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_cross_rail_duplicate(conn)
    return {"_banner": ENGINEERING_BANNER, "injected": result, "payment_intent_id": result.get("payment_intent_id")}


@router.post("/out-of-order", summary="[ENGINEERING] Inject Out-of-Order Webhook scenario")
@router.post("/tampered_signature", summary="[ENGINEERING] Inject Tampered Signature scenario")
async def chaos_out_of_order():
    """
    Inject an Out-of-Order Webhook synthetic scenario for engineering tests.

    WARNING: This creates SYNTHETIC payment intents — not real Razorpay payments.
    """
    _check_engineering_mode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await inject_out_of_order_webhook(conn)
    return {"_banner": ENGINEERING_BANNER, "injected": result, "payment_intent_id": result.get("payment_intent_id")}

