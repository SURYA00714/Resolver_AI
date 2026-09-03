# FILE: razorpay/webhooks.py
"""Razorpay Webhook Signature Verification (§12)."""
import hmac
import hashlib
import sys
from typing import Optional

import config
from domain.errors import WebhookSignatureError


def verify_webhook_signature(
    raw_body: bytes,
    signature: str,
    secret: Optional[str] = None,
) -> bool:
    """
    Verify Razorpay HMAC-SHA256 webhook signature.
    Requirements:
    1. Raw body bytes (before JSON parsing).
    2. Signature from X-Razorpay-Signature header.
    3. Configured webhook secret.
    """
    webhook_secret = secret or config.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        print("[WEBHOOK_SECURITY] WARNING: RAZORPAY_WEBHOOK_SECRET is not configured.", file=sys.stderr)
        # In non-production mode if secret is empty, log warning
        if config.ENVIRONMENT == "production":
            raise WebhookSignatureError("RAZORPAY_WEBHOOK_SECRET not configured in production")
        return False

    if not signature:
        return False

    expected_signature = hmac.new(
        key=webhook_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature.lower(), signature.lower())


def verify_payment_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    signature: str,
    secret: Optional[str] = None,
) -> bool:
    """
    Verify Razorpay Checkout payment signature.
    Formula: HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)
    """
    key_secret = secret or config.RAZORPAY_KEY_SECRET
    if not key_secret or not signature:
        return False

    msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        key=key_secret.encode("utf-8"),
        msg=msg,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature.lower(), signature.lower())
