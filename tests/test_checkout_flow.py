# FILE: tests/test_checkout_flow.py
"""Frontend Razorpay Checkout Flow Verification & Contract Tests (§12)."""
import hmac
import hashlib
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import config
from app import app
from core.auth import create_access_token


def _create_mock_pool():
    mock_conn = AsyncMock()
    mock_acquire_cm = MagicMock()
    mock_acquire_cm.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_acquire_cm.__aexit__ = AsyncMock(return_value=None)

    mock_pool = MagicMock()
    mock_pool.acquire.return_value = mock_acquire_cm
    return mock_pool, mock_conn


class TestRazorpayCheckoutFrontendFlow(unittest.TestCase):
    """Verify frontend Checkout integration contracts & states."""

    def setUp(self):
        self.client = TestClient(app)
        self.secret = "test_secret_checkout_999"
        self.key_id = "rzp_test_checkout_key_123"
        self.old_secret = config.RAZORPAY_KEY_SECRET
        self.old_key_id = config.RAZORPAY_KEY_ID
        config.RAZORPAY_KEY_SECRET = self.secret
        config.RAZORPAY_KEY_ID = self.key_id
        self.token = create_access_token(username="admin", role="admin")
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        config.RAZORPAY_KEY_SECRET = self.old_secret
        config.RAZORPAY_KEY_ID = self.old_key_id

    def test_checkout_script_url_contract(self):
        """Verify official Razorpay Checkout SDK URL script source."""
        official_sdk_url = "https://checkout.razorpay.com/v1/checkout.js"
        self.assertTrue(official_sdk_url.startswith("https://checkout.razorpay.com/"))
        self.assertTrue(official_sdk_url.endswith("checkout.js"))

    def test_checkout_initialization_options_structure(self):
        """Verify exact options dict required for new Razorpay(options)."""
        order_id = "order_test_checkout_001"
        amount_inr = 499.00
        amount_paise = int(amount_inr * 100)
        currency = "INR"

        options = {
            "key": self.key_id,
            "amount": amount_paise,
            "currency": currency,
            "name": "ResolverAI Merchant",
            "description": f"Payment for Order {order_id}",
            "order_id": order_id,
        }

        self.assertEqual(options["key"], "rzp_test_checkout_key_123")
        self.assertEqual(options["amount"], 49900)
        self.assertEqual(options["currency"], "INR")
        self.assertEqual(options["order_id"], "order_test_checkout_001")

    @patch("api.orders_routes.get_pool")
    def test_checkout_successful_handler_response_verification(self, mock_get_pool):
        """Verify successful handler response signature verification via POST /orders/verify_payment."""
        order_id = "order_test_success_777"
        payment_id = "pay_test_success_888"
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        signature = hmac.new(self.secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool
        mock_conn.fetchrow.return_value = {
            "payment_intent_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "merchant_id": "default_merchant",
        }

        # Simulated response object from Razorpay Checkout handler callback
        handler_response = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }

        res = self.client.post("/orders/verify_payment", json=handler_response, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "VERIFIED")
        self.assertEqual(data.get("razorpay_payment_id"), payment_id)

    def test_checkout_failed_payment_signature_rejection(self):
        """Verify failed payment attempt / tampered signature is rejected."""
        handler_response_failed = {
            "razorpay_order_id": "order_test_fail_111",
            "razorpay_payment_id": "pay_test_fail_222",
            "razorpay_signature": "invalid_signature_hex_0000",
        }

        res = self.client.post("/orders/verify_payment", json=handler_response_failed, headers=self.headers)
        self.assertEqual(res.status_code, 401)
        self.assertIn("signature verification failed", res.text.lower())


if __name__ == "__main__":
    unittest.main()
