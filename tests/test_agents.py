# FILE: tests/test_agents.py
"""Tests for Detective, Negotiator, and FinOps Executor agents."""
import unittest
import asyncio
import datetime
from decimal import Decimal

from agents.detective import analyze
from agents.negotiator import verify
from agents.finops_executor import execute
from agents.schemas import (
    ActionType, AuthorizedAction, DetectiveResult,
    ExternalStatus, FinOpsResult, NegotiatorResult,
)


class TestDetective(unittest.TestCase):
    def setUp(self):
        self.uncertain_upi_intent = {
            "payment_intent_id": "aaaaaaaa-1111-2222-3333-444444444444",
            "order_id": "ORD_TEST",
            "amount": Decimal("1500.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "rail": "UPI_HDFC",
            "retry_count": 0,
            "has_existing_capture": False,
        }
        self.duplicate_intent = {
            "payment_intent_id": "bbbbbbbb-1111-2222-3333-444444444444",
            "order_id": "ORD_DUP",
            "amount": Decimal("2000.00"),
            "currency": "INR",
            "current_state": "DUPLICATE_SUSPECTED",
            "rail": "UPI_ICICI",
            "retry_count": 0,
            "has_existing_capture": True,
        }

    def test_upi_late_auth(self):
        result = asyncio.run(analyze(self.uncertain_upi_intent, trace_id="test_trace"))
        self.assertIsInstance(result, DetectiveResult)
        self.assertEqual(result.hypothesis, "late_authorization_suspected")
        self.assertGreaterEqual(result.confidence, 0.8)
        self.assertEqual(result.recommended_action, ActionType.CAPTURE)

    def test_duplicate_detection(self):
        result = asyncio.run(analyze(self.duplicate_intent, trace_id="test_trace"))
        self.assertIsInstance(result, DetectiveResult)
        self.assertEqual(result.hypothesis, "duplicate_capture_detected")
        self.assertEqual(result.recommended_action, ActionType.REFUND)

    def test_card_timeout(self):
        intent = {
            "payment_intent_id": "cccccccc-1111-2222-3333-444444444444",
            "current_state": "UNCERTAIN",
            "rail": "CARD_AXIS",
            "amount": Decimal("500.00"),
            "retry_count": 0,
            "has_existing_capture": False,
        }
        result = asyncio.run(analyze(intent))
        self.assertEqual(result.hypothesis, "gateway_timeout_or_pending_capture")
        self.assertEqual(result.recommended_action, ActionType.CAPTURE)

    def test_evidence_list_populated(self):
        result = asyncio.run(analyze(self.uncertain_upi_intent))
        self.assertGreater(len(result.evidence), 0)


class TestNegotiator(unittest.TestCase):
    def setUp(self):
        self.uncertain_upi_intent = {
            "payment_intent_id": "aaaaaaaa-1111-2222-3333-444444444444",
            "order_id": "ORD_TEST",
            "amount": Decimal("1500.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "rail": "UPI_HDFC",
            "retry_count": 0,
            "has_existing_capture": False,
        }

    def test_verify_returns_structured(self):
        result = asyncio.run(verify(self.uncertain_upi_intent, idempotency_key="idem_test_neg"))
        self.assertIsInstance(result, NegotiatorResult)
        self.assertEqual(result.amount, Decimal("1500.00"))

    def test_verify_returns_valid_status(self):
        result = asyncio.run(verify(self.uncertain_upi_intent, idempotency_key="idem_test_neg2"))
        self.assertIn(result.external_status, ExternalStatus)


class TestFinOpsExecutor(unittest.TestCase):
    def test_execute_capture(self):
        cmd = AuthorizedAction(
            payment_intent_id="test-finops-001",
            action=ActionType.CAPTURE,
            amount=Decimal("1000.00"),
            target_rail="UPI_HDFC",
            policy_decision_id="pol_001",
            idempotency_key="idem_finops_test",
        )
        result = asyncio.run(execute(cmd, trace_id="test_trace"))
        self.assertIsInstance(result, FinOpsResult)
        self.assertEqual(result.action_taken, ActionType.CAPTURE)

    def test_expired_command_rejected(self):
        cmd = AuthorizedAction(
            payment_intent_id="test-finops-002",
            action=ActionType.CAPTURE,
            amount=Decimal("1000.00"),
            target_rail="UPI_HDFC",
            policy_decision_id="pol_002",
            idempotency_key="idem_finops_expired",
            expires_at=datetime.datetime(2020, 1, 1, tzinfo=datetime.timezone.utc),
        )
        result = asyncio.run(execute(cmd))
        self.assertEqual(result.execution_status, ExternalStatus.FAILED)
        self.assertIn("expired", (result.error or "").lower())

    def test_zero_amount_rejected(self):
        cmd = AuthorizedAction(
            payment_intent_id="test-finops-003",
            action=ActionType.CAPTURE,
            amount=Decimal("0"),
            target_rail="UPI_HDFC",
            policy_decision_id="pol_003",
            idempotency_key="idem_finops_zero",
        )
        result = asyncio.run(execute(cmd))
        self.assertEqual(result.execution_status, ExternalStatus.FAILED)


if __name__ == "__main__":
    unittest.main()
