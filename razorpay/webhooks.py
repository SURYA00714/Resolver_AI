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
        return True

    if not signature:
        return False

    expected_signature = hmac.new(
        key=webhook_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature.lower(), signature.lower())
