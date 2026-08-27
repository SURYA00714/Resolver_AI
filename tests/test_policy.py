# FILE: tests/test_policy.py
"""Tests for the 5-rule deterministic Policy Engine."""
import unittest
from decimal import Decimal

from agents.schemas import (
    ActionType, DecisionType, DetectiveResult,
    ExternalStatus, NegotiatorResult,
)
from core.policy_engine import PolicyEngine


def make_intent(state="UNCERTAIN", amount="1000.00", currency="INR", has_capture=False):
    return {
        "payment_intent_id": "test-intent-001",
        "order_id": "ORD_TEST",
        "amount": Decimal(amount),
        "currency": currency,
        "current_state": state,
        "rail": "UPI_HDFC",
        "has_existing_capture": has_capture,
        "retry_count": 0,
    }


def make_detective(action=ActionType.CAPTURE):
    return DetectiveResult(
        payment_intent_id="test-intent-001",
        hypothesis="test",
        confidence=0.9,
        recommended_action=action,
    )


def make_negotiator(status=ExternalStatus.SUCCESS, amount="1000.00", currency="INR"):
    return NegotiatorResult(
        payment_intent_id="test-intent-001",
        external_status=status,
        amount=Decimal(amount),
        currency=currency,
        rail="UPI_HDFC",
    )


class TestPolicyEngine(unittest.TestCase):
    def setUp(self):
        self.engine = PolicyEngine()

    def test_all_rules_pass(self):
        result = self.engine.evaluate(make_intent(), make_negotiator(), make_detective())
        self.assertEqual(result.decision, DecisionType.APPROVE)
        self.assertEqual(result.rule, "ALL_PASSED")

    def test_rule1_wrong_state(self):
        result = self.engine.evaluate(
            make_intent(state="CAPTURED"), make_negotiator(), make_detective()
        )
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertEqual(result.rule, "RULE_1_STATE")

    def test_rule2_unknown_evidence(self):
        result = self.engine.evaluate(
            make_intent(), make_negotiator(status=ExternalStatus.UNKNOWN), make_detective()
        )
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertEqual(result.rule, "RULE_2_VERIFIED_EVIDENCE")

    def test_rule3_amount_mismatch(self):
        result = self.engine.evaluate(
            make_intent(amount="1000.00"), make_negotiator(amount="999.00"), make_detective()
        )
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertEqual(result.rule, "RULE_3_ECONOMIC_IDENTITY")

    def test_rule3_currency_mismatch(self):
        result = self.engine.evaluate(
            make_intent(), make_negotiator(currency="USD"), make_detective()
        )
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertEqual(result.rule, "RULE_3_ECONOMIC_IDENTITY")

    def test_rule4_existing_capture(self):
        result = self.engine.evaluate(
            make_intent(has_capture=True), make_negotiator(), make_detective()
        )
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertEqual(result.rule, "RULE_4_DUPLICATE_PROTECTION")

    def test_rule5_invalid_action(self):
        result = self.engine.evaluate(
            make_intent(), make_negotiator(), make_detective(action=ActionType.REFUND)
        )
        self.assertEqual(result.decision, DecisionType.REJECT)
        self.assertEqual(result.rule, "RULE_5_BOUNDED_ACTION")

    def test_duplicate_suspected_allows_void(self):
        result = self.engine.evaluate(
            make_intent(state="DUPLICATE_SUSPECTED", has_capture=True),
            make_negotiator(status=ExternalStatus.DUPLICATE),
            make_detective(action=ActionType.VOID),
        )
        self.assertEqual(result.decision, DecisionType.APPROVE)

    def test_create_authorized_action(self):
        decision = self.engine.evaluate(make_intent(), make_negotiator(), make_detective())
        action = self.engine.create_authorized_action(
            decision, make_intent(), make_detective(), make_negotiator(), "idem_test"
        )
        self.assertIsNotNone(action)
        self.assertEqual(action.action, ActionType.CAPTURE)
        self.assertEqual(action.idempotency_key, "idem_test")

    def test_no_action_on_reject(self):
        decision = self.engine.evaluate(
            make_intent(state="CAPTURED"), make_negotiator(), make_detective()
        )
        action = self.engine.create_authorized_action(
            decision, make_intent(), make_detective(), make_negotiator(), "idem_test"
        )
        self.assertIsNone(action)


if __name__ == "__main__":
    unittest.main()
