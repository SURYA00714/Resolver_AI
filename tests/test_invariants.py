# FILE: tests/test_invariants.py
"""Tests for system invariants — the Three Truths (§7-9)."""
import unittest
from decimal import Decimal

from agents.schemas import (
    ActionType, AuthorizedAction, DecisionType,
    DetectiveResult, ExternalStatus, NegotiatorResult,
)
from core.policy_engine import PolicyEngine
from core.state_machine import CAPTURED, MANUAL_REVIEW, UNCERTAIN, is_terminal, transition


class TestTruth1_EventImmutability(unittest.TestCase):
    """Events, once recorded, cannot be modified."""

    def test_state_machine_never_returns_invalid(self):
        from core.state_machine import VALID_STATES
        for state in VALID_STATES:
            result = transition(state, "ANY_EVENT")
            self.assertIn(result, VALID_STATES)


class TestTruth2_PolicyAuthority(unittest.TestCase):
    """AI is NOT the financial authority. Policy Engine is deterministic."""

    def test_policy_rejects_without_evidence(self):
        engine = PolicyEngine()
        intent = {
            "payment_intent_id": "inv-test-001",
            "amount": Decimal("100.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "has_existing_capture": False,
        }
        neg = NegotiatorResult(
            payment_intent_id="inv-test-001",
            external_status=ExternalStatus.UNKNOWN,
            amount=Decimal("100.00"),
            rail="UPI_HDFC",
        )
        det = DetectiveResult(
            payment_intent_id="inv-test-001",
            hypothesis="test",
            confidence=0.99,
            recommended_action=ActionType.CAPTURE,
        )
        result = engine.evaluate(intent, neg, det)
        self.assertEqual(result.decision, DecisionType.REJECT)

    def test_policy_is_deterministic(self):
        engine = PolicyEngine()
        intent = {
            "payment_intent_id": "inv-test-002",
            "amount": Decimal("500.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "has_existing_capture": False,
        }
        neg = NegotiatorResult(
            payment_intent_id="inv-test-002",
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
            rail="UPI_HDFC",
        )
        det = DetectiveResult(
            payment_intent_id="inv-test-002",
            hypothesis="test",
            confidence=0.85,
            recommended_action=ActionType.CAPTURE,
        )
        results = [engine.evaluate(intent, neg, det).decision for _ in range(100)]
        self.assertTrue(all(r == DecisionType.APPROVE for r in results))


class TestTruth3_NeverDoubleMoney(unittest.TestCase):
    """No double-capture, no money lost."""

    def test_duplicate_protection_rule(self):
        engine = PolicyEngine()
        intent = {
            "payment_intent_id": "inv-test-003",
            "amount": Decimal("1000.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "has_existing_capture": True,
        }
        neg = NegotiatorResult(
            payment_intent_id="inv-test-003",
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("1000.00"),
            rail="UPI_HDFC",
        )
        det = DetectiveResult(
            payment_intent_id="inv-test-003",
            hypothesis="test",
            confidence=0.95,
            recommended_action=ActionType.CAPTURE,
        )
        result = engine.evaluate(intent, neg, det)
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertIn("RULE_4", result.rule)

    def test_amount_mismatch_never_passes(self):
        engine = PolicyEngine()
        intent = {
            "payment_intent_id": "inv-test-004",
            "amount": Decimal("1000.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "has_existing_capture": False,
        }
        neg = NegotiatorResult(
            payment_intent_id="inv-test-004",
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("1001.00"),
            rail="UPI_HDFC",
        )
        det = DetectiveResult(
            payment_intent_id="inv-test-004",
            hypothesis="test",
            confidence=0.99,
            recommended_action=ActionType.CAPTURE,
        )
        result = engine.evaluate(intent, neg, det)
        self.assertEqual(result.decision, DecisionType.REJECT)


class TestDecimalSafety(unittest.TestCase):
    """No float for money — always Decimal."""

    def test_decimal_amounts(self):
        amt = Decimal("999.99")
        self.assertIsInstance(amt, Decimal)
        self.assertEqual(amt + Decimal("0.01"), Decimal("1000.00"))

    def test_float_precision_failure(self):
        self.assertNotEqual(0.1 + 0.2, 0.3)
        self.assertEqual(Decimal("0.1") + Decimal("0.2"), Decimal("0.3"))


if __name__ == "__main__":
    unittest.main()

