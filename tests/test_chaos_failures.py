# FILE: tests/test_chaos_failures.py
"""Chaos & Network Failure Scenarios Test Suite."""
import asyncio
import unittest
import uuid
from decimal import Decimal

from domain.enums import DivergenceType, ExternalStatus
from domain.money import minor_units_to_decimal, UnsupportedCurrencyError
from razorpay.webhooks import verify_webhook_signature
from razorpay.client import RazorpayClient
from domain.errors import RazorpayAPIError
import config


class TestChaosFailures(unittest.TestCase):

    def test_webhook_forged_signature_rejected(self):
        """Test forged signature on raw body returns False."""
        raw_body = b'{"event": "payment.captured", "payload": {}}'
        forged_sig = "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890"
        result = verify_webhook_signature(raw_body, forged_sig, secret="real_webhook_secret_key_123")
        self.assertFalse(result)

    def test_webhook_authentic_signature_verified(self):
        """Test valid signature on raw body returns True."""
        import hmac, hashlib
        secret = "secret_key_123"
        raw_body = b'{"event": "payment.captured", "payload": {}}'
        valid_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        result = verify_webhook_signature(raw_body, valid_sig, secret=secret)
        self.assertTrue(result)

    def test_razorpay_client_auth_failure_closed(self):
        """Test missing API credentials fail closed with RazorpayAPIError(401)."""
        async def test_auth():
            client = RazorpayClient(key_id="", key_secret="")
            with self.assertRaises(RazorpayAPIError) as ctx:
                await client._request("GET", "payments/pay_123")
            self.assertEqual(ctx.exception.status_code, 401)

        asyncio.run(test_auth())


if __name__ == "__main__":
    unittest.main()
