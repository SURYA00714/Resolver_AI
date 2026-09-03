# FILE: tests/test_webhook_receiver.py
"""Comprehensive Webhook Receiver Tests (§12)."""
import hmac
import hashlib
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

import config
from app import app
from razorpay.webhooks import verify_webhook_signature


def _create_mock_pool():
    mock_conn = AsyncMock()
    mock_acquire_cm = MagicMock()
    mock_acquire_cm.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_acquire_cm.__aexit__ = AsyncMock(return_value=None)

    mock_pool = MagicMock()
    mock_pool.acquire.return_value = mock_acquire_cm
    return mock_pool, mock_conn


class TestWebhookReceiver(unittest.TestCase):
    """Test Razorpay Webhook receiver: signature verification, normalization, deduplication, diagnostics."""

    def setUp(self):
        self.client = TestClient(app)
        self.secret = "test_webhook_secret_key_12345"
        self.old_secret = config.RAZORPAY_WEBHOOK_SECRET
        config.RAZORPAY_WEBHOOK_SECRET = self.secret

    def tearDown(self):
        config.RAZORPAY_WEBHOOK_SECRET = self.old_secret

    def _generate_signature(self, payload_bytes: bytes, secret: str = None) -> str:
        sec = secret or self.secret
        return hmac.new(sec.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    def test_missing_webhook_secret(self):
        """When RAZORPAY_WEBHOOK_SECRET is empty/missing, verification returns False."""
        config.RAZORPAY_WEBHOOK_SECRET = ""
        payload = b'{"event":"payment.captured"}'
        sig = self._generate_signature(payload, secret="some_key")
        self.assertFalse(verify_webhook_signature(payload, sig, secret=""))

    def test_invalid_signature_returns_401(self):
        """Invalid signature header must result in HTTP 401."""
        payload = json.dumps({"event": "payment.captured", "payload": {}}).encode("utf-8")
        bad_signature = "bad" * 16

        response = self.client.post(
            "/webhook/razorpay",
            content=payload,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": bad_signature,
            },
        )
        self.assertEqual(response.status_code, 401)
        self.assertIn("Invalid signature", response.text)

    @patch("api.webhook_receiver.get_pool")
    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    @patch("core.idempotency.mark_event_processed", new_callable=AsyncMock)
    def test_valid_signature_accepted(self, mock_mark, mock_verify_dedup, mock_get_pool):
        """Valid HMAC signature must accept the payload."""
        mock_verify_dedup.return_value = "NEW"
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        body = {
            "event": "payment.captured",
            "event_id": "evt_test_valid_001",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_test_001",
                        "order_id": "order_test_001",
                        "amount": 49900,
                        "currency": "INR",
                        "status": "captured",
                    }
                }
            },
        }
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": signature,
            },
        )
        self.assertEqual(response.status_code, 200)
        resp_data = response.json()
        self.assertEqual(resp_data.get("status"), "accepted")
        self.assertEqual(resp_data.get("razorpay_payment_id"), "pay_test_001")

    def test_malformed_json(self):
        """Valid signature on non-JSON payload returns 400."""
        payload_bytes = b"THIS IS NOT VALID JSON"
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": signature,
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid JSON payload", response.text)

    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    def test_duplicate_webhook_redis(self, mock_verify_dedup):
        """Duplicate webhook detected via Redis returns status ignored."""
        mock_verify_dedup.return_value = "VALID_DUPLICATE"
        body = {"event": "payment.captured", "event_id": "evt_dup_001", "payload": {}}
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": signature,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ignored")

    @patch("api.webhook_receiver.get_pool")
    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    @patch("core.idempotency.mark_event_processed", new_callable=AsyncMock)
    def test_unsupported_event(self, mock_mark, mock_verify_dedup, mock_get_pool):
        """Unsupported provider event is recorded without state mutation."""
        mock_verify_dedup.return_value = "NEW"
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        body = {"event": "custom.unknown_event", "event_id": "evt_unsupp_001", "payload": {}}
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={
                "Content-Type": "application/json",
                "X-Razorpay-Signature": signature,
            },
        )
        self.assertEqual(response.status_code, 200)
        res_json = response.json()
        self.assertEqual(res_json.get("status"), "recorded")
        self.assertTrue(res_json.get("event_type", "").startswith("UNSUPPORTED_"))

    @patch("api.webhook_receiver.get_pool")
    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    @patch("core.idempotency.mark_event_processed", new_callable=AsyncMock)
    def test_payment_failed_event(self, mock_mark, mock_verify_dedup, mock_get_pool):
        """payment.failed event is handled and normalized."""
        mock_verify_dedup.return_value = "NEW"
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        body = {
            "event": "payment.failed",
            "event_id": "evt_fail_001",
            "payload": {"payment": {"entity": {"id": "pay_failed_001", "amount": 1000, "currency": "INR"}}},
        }
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "accepted")

    @patch("api.webhook_receiver.get_pool")
    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    @patch("core.idempotency.mark_event_processed", new_callable=AsyncMock)
    def test_payment_captured_event(self, mock_mark, mock_verify_dedup, mock_get_pool):
        """payment.captured event is accepted."""
        mock_verify_dedup.return_value = "NEW"
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        body = {
            "event": "payment.captured",
            "event_id": "evt_cap_001",
            "payload": {"payment": {"entity": {"id": "pay_cap_001", "amount": 25000, "currency": "INR"}}},
        }
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "accepted")

    @patch("api.webhook_receiver.get_pool")
    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    @patch("core.idempotency.mark_event_processed", new_callable=AsyncMock)
    def test_refund_failed_event(self, mock_mark, mock_verify_dedup, mock_get_pool):
        """refund.failed event is accepted."""
        mock_verify_dedup.return_value = "NEW"
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        body = {
            "event": "refund.failed",
            "event_id": "evt_ref_fail_001",
            "payload": {"refund": {"entity": {"id": "rfnd_001", "payment_id": "pay_ref_001", "amount": 500}}},
        }
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "accepted")

    @patch("api.webhook_receiver.get_pool")
    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    @patch("core.idempotency.mark_event_processed", new_callable=AsyncMock)
    def test_dispute_created_event(self, mock_mark, mock_verify_dedup, mock_get_pool):
        """payment.dispute.created event is accepted."""
        mock_verify_dedup.return_value = "NEW"
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        body = {
            "event": "payment.dispute.created",
            "event_id": "evt_disp_001",
            "payload": {"payment": {"entity": {"id": "pay_disp_001", "amount": 10000, "currency": "INR"}}},
        }
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "accepted")

    @patch("core.idempotency.verify_idempotency_payload", new_callable=AsyncMock)
    def test_replayed_identical_webhook(self, mock_verify_dedup):
        """Replaying identical webhook returns VALID_DUPLICATE ignored."""
        mock_verify_dedup.return_value = "VALID_DUPLICATE"
        body = {
            "event": "payment.captured",
            "event_id": "evt_replay_001",
            "payload": {"payment": {"entity": {"id": "pay_replay_001", "amount": 100}}},
        }
        payload_bytes = json.dumps(body).encode("utf-8")
        signature = self._generate_signature(payload_bytes)

        response = self.client.post(
            "/webhook/razorpay",
            content=payload_bytes,
            headers={"Content-Type": "application/json", "X-Razorpay-Signature": signature},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ignored")
        self.assertIn("duplicate", response.json().get("reason", ""))

    @patch("api.webhook_receiver.get_pool")
    def test_get_webhook_diagnostics(self, mock_get_pool):
        """GET /webhook/diagnostics returns expected diagnostic schema without secret exposure."""
        mock_pool, mock_conn = _create_mock_pool()
        mock_get_pool.return_value = mock_pool

        mock_conn.fetchval.side_effect = [10, 8, 2]
        mock_conn.fetchrow.return_value = {
            "event_type": "payment.captured",
            "received_at": "2026-09-03 14:00:00+00",
        }

        response = self.client.get("/webhook/diagnostics")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("route_registered", data)
        self.assertIn("webhook_secret_configured", data)
        self.assertIn("events_received", data)
        self.assertIn("verified_events", data)
        self.assertIn("rejected_events", data)
        self.assertIn("last_event_at", data)
        self.assertIn("last_event_type", data)
        # Ensure no secret string or key is exposed in values
        json_str = json.dumps(data)
        self.assertNotIn(self.secret, json_str)


if __name__ == "__main__":
    unittest.main()
