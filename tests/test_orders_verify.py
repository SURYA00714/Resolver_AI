# FILE: tests/test_orders_verify.py
"""Unit tests for POST /orders/verify_payment and Checkout verification flow."""
import hmac
import hashlib
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import config
from app import app
from core.auth import create_access_token
from razorpay.webhooks import verify_payment_signature


def _create_mock_pool():
    mock_conn = AsyncMock()
    mock_acquire_cm = MagicMock()
    mock_acquire_cm.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_acquire_cm.__aexit__ = AsyncMock(return_value=None)

    mock_pool = MagicMock()
    mock_pool.acquire.return_value = mock_acquire_cm
    return mock_pool, mock_conn


class TestOrdersVerifyEndpoint(unittest.TestCase):
    """Test POST /orders/verify_payment endpoint & signature verification logic."""

    def setUp(self):
        self.client = TestClient(app)
        self.secret = "test_key_secret_12345"
        self.old_secret = config.RAZORPAY_KEY_SECRET
        config.RAZORPAY_KEY_SECRET = self.secret
        self.token = create_access_token(username="admin", role="admin")
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        config.RAZORPAY_KEY_SECRET = self.old_secret

    def _generate_checkout_signature(self, order_id: str, payment_id: str, secret: str = None) -> str:
        sec = secret or self.secret
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        return hmac.new(sec.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def test_verify_payment_signature_logic(self):
        """Test verify_payment_signature helper with valid and invalid signatures."""
        order_id = "order_test_123"
        payment_id = "pay_test_456"
        valid_sig = self._generate_checkout_signature(order_id, payment_id)

        self.assertTrue(verify_payment_signature(order_id, payment_id, valid_sig))
        self.assertFalse(verify_payment_signature(order_id, payment_id, "invalid_signature_hex"))
        self.assertFalse(verify_payment_signature(order_id, payment_id, valid_sig, secret="wrong_secret"))

    @patch("api.orders_routes.get_pool")
    def test_verify_checkout_invalid_signature_returns_401(self, mock_get_pool):
        """POST /orders/verify_payment with bad signature returns 401."""
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool
        mock_conn.fetchrow.return_value = {
            "payment_intent_id": "11111111-2222-3333-4444-555555555555",
            "merchant_id": "default_merchant",
            "razorpay_order_id": "order_test_123",
            "current_state": "CREATED",
        }

        body = {
            "razorpay_order_id": "order_test_123",
            "razorpay_payment_id": "pay_test_456",
            "razorpay_signature": "bad_signature_hex",
        }
        response = self.client.post("/orders/verify_payment", json=body, headers=self.headers)
        self.assertEqual(response.status_code, 401)
        self.assertIn("signature verification failed", response.text.lower())

    @patch("api.orders_routes.get_pool")
    def test_verify_checkout_success(self, mock_get_pool):
        """POST /orders/verify_payment with valid signature transitions state to AUTHORIZED."""
        order_id = "order_test_999"
        payment_id = "pay_test_888"
        signature = self._generate_checkout_signature(order_id, payment_id)

        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool
        mock_conn.fetchrow.return_value = {
            "payment_intent_id": "11111111-2222-3333-4444-555555555555",
            "merchant_id": "default_merchant",
        }

        body = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }

        response = self.client.post("/orders/verify_payment", json=body, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "VERIFIED")
        self.assertEqual(data.get("razorpay_order_id"), order_id)
        self.assertEqual(data.get("razorpay_payment_id"), payment_id)
        self.assertEqual(data.get("payment_intent_id"), "11111111-2222-3333-4444-555555555555")

    @patch("api.orders_routes.get_pool")
    def test_verify_checkout_intent_not_found_returns_404(self, mock_get_pool):
        """POST /orders/verify_payment returns 404 when order_id is not in local DB."""
        order_id = "order_missing_123"
        payment_id = "pay_missing_456"
        signature = self._generate_checkout_signature(order_id, payment_id)

        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool
        mock_conn.fetchrow.return_value = None

        body = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }

        response = self.client.post("/orders/verify_payment", json=body, headers=self.headers)
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.text.lower())


if __name__ == "__main__":
    unittest.main()
