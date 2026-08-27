# FILE: tests/test_security.py
"""Security & Safety Verification Tests."""
import datetime
import hmac
import hashlib
import unittest
from decimal import Decimal

from razorpay.webhooks import verify_webhook_signature
from agents.schemas import ActionType, AuthorizedAction
from agents.finops_executor import execute as execute_action


class TestSecurityAndSafety(unittest.TestCase):
    """Verify security controls, HMAC signatures, and FinOps authorization boundaries."""

    def test_valid_hmac_webhook_signature(self):
        secret = "test_webhook_secret_123"
        payload = b'{"event": "payment.captured", "payload": {}}'
        signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        self.assertTrue(verify_webhook_signature(payload, signature, secret))

    def test_invalid_hmac_webhook_signature(self):
        secret = "test_webhook_secret_123"
        payload = b'{"event": "payment.captured", "payload": {}}'
        tampered_signature = "bad" * 16
        self.assertFalse(verify_webhook_signature(payload, tampered_signature, secret))

    def test_finops_rejects_expired_action(self):
        past_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)
        expired_action = AuthorizedAction(
            command_id="exp-001",
            payment_intent_id="intent-exp",
            policy_decision_id="dec-exp",
            action=ActionType.CAPTURE,
            amount=Decimal("100.00"),
            currency="INR",
            idempotency_key="idem-exp",
            expires_at=past_time,
        )
        import asyncio
        result = asyncio.run(execute_action(expired_action))
        self.assertEqual(result.execution_status.value if hasattr(result.execution_status, "value") else str(result.execution_status), "FAILED")
        self.assertIn("expired", (result.error or "").lower())


if __name__ == "__main__":
    unittest.main()
