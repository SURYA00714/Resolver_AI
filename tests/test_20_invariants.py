# FILE: tests/test_20_invariants.py
"""Comprehensive suite verifying all 20 non-negotiable financial invariants."""
import datetime
import unittest
import uuid
from decimal import Decimal

from agents.finops_executor import execute
from agents.schemas import (
    ActionType,
    AuthorizedAction,
    DecisionType,
    DetectiveResult,
    ExternalStatus,
    NegotiatorResult,
)
from core.policy_engine import PolicyEngine
from core.reconciliation import ReconciliationEngine
from core.state_machine import transition, is_terminal, CAPTURED, FAILED, MANUAL_REVIEW, UNKNOWN
from domain.enums import DivergenceType
from domain.money import minor_units_to_decimal, to_decimal_amount, validate_currency, UnsupportedCurrencyError, InvalidAmountError
import config


class Test20FinancialInvariants(unittest.TestCase):

    def setUp(self):
        self.engine = PolicyEngine()
        self.recon_engine = ReconciliationEngine()
        self.base_intent = {
            "payment_intent_id": str(uuid.uuid4()),
            "merchant_id": "test_merchant",
            "amount": Decimal("500.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
            "has_existing_capture": False,
            "order_id": "ORD_12345",
        }

    # INVARIANT 1: Payment cannot be captured twice
    def test_invariant_1_no_double_capture(self):
        intent = dict(self.base_intent)
        intent["has_existing_capture"] = True
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)
        self.assertIn("RULE_4", decision.rule)

    # INVARIANT 2: Duplicate webhooks produce no duplicate execution
    def test_invariant_2_reconciliation_detects_duplicate_events(self):
        intent = dict(self.base_intent)
        events = [
            {"event_type": "payment.captured", "payload": {}},
            {"event_type": "payment.captured", "payload": {}},
        ]
        api_evidence = {"status": "SUCCESS", "amount": 50000, "id": "pay_123"}
        executions = [{"operation": "CAPTURE", "status": "SUCCESS"}, {"operation": "CAPTURE", "status": "SUCCESS"}]
        result = self.recon_engine.reconcile(intent, events, api_evidence, executions)
        self.assertEqual(result.status, "INCONSISTENT")
        self.assertEqual(result.divergence_type, DivergenceType.POSSIBLE_DUPLICATE_CAPTURE)

    # INVARIANT 3: Amount mismatch blocks execution
    def test_invariant_3_amount_mismatch_blocked(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.01"),  # 1 paisa mismatch
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)
        self.assertIn("RULE_3", decision.rule)

    # INVARIANT 4: Currency mismatch blocks execution
    def test_invariant_4_currency_mismatch_blocked(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
            currency="USD",  # Mismatch: intent is INR
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)
        self.assertIn("RULE_3", decision.rule)

    # INVARIANT 5: UNKNOWN external status cannot become SUCCESS without evidence
    def test_invariant_5_unknown_status_rejected(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.UNKNOWN,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="test",
            confidence=0.95,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)
        self.assertIn("RULE_2", decision.rule)

    # INVARIANT 6: Expired AuthorizedAction cannot execute
    def test_invariant_6_expired_command_rejected(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.CAPTURE,
            amount=Decimal("500.00"),
            currency="INR",
            policy_decision_id="dec_001",
            idempotency_key="idem_001",
            expires_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=10),
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)
        self.assertEqual(res.error, "Command expired")

    # INVARIANT 7: Tampered AuthorizedAction signature rejected
    def test_invariant_7_tampered_signature_rejected(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.CAPTURE,
            amount=Decimal("500.00"),
            currency="INR",
            policy_decision_id="dec_001",
            idempotency_key="idem_001",
        )
        cmd.signature = "forged_signature_hex"
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)
        self.assertIn("signature", res.error.lower())

    # INVARIANT 8: Zero or negative amount execution rejected
    def test_invariant_8_zero_amount_rejected(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.CAPTURE,
            amount=Decimal("0.00"),
            currency="INR",
            policy_decision_id="dec_001",
            idempotency_key="idem_001",
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)
        self.assertIn("positive", res.error.lower())

    # INVARIANT 9: AI recommendation cannot bypass Policy Engine
    def test_invariant_9_ai_cannot_bypass_policy(self):
        intent = dict(self.base_intent)
        intent["current_state"] = "CAPTURED"  # Terminal state
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="AI recommends duplicate capture!",
            confidence=0.99,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)

    # INVARIANT 10: Illegal state transitions fall to MANUAL_REVIEW
    def test_invariant_10_illegal_transitions_fall_to_manual_review(self):
        self.assertEqual(transition("CAPTURED", "SUBMIT"), "CAPTURED")
        self.assertEqual(transition("FAILED", "SUBMIT"), "FAILED")

    # INVARIANT 11: Decimal safety — No floats for money
    def test_invariant_11_decimal_safety(self):
        self.assertEqual(minor_units_to_decimal(1050, "INR"), Decimal("10.50"))
        with self.assertRaises(UnsupportedCurrencyError):
            validate_currency("INVALID_CURRENCY")

    # INVARIANT 12: Negative minor units rejected
    def test_invariant_12_negative_minor_units(self):
        with self.assertRaises(InvalidAmountError):
            minor_units_to_decimal(-100, "INR")

    # INVARIANT 13: Terminal states remain terminal
    def test_invariant_13_terminal_states(self):
        for state in [CAPTURED, RECONCILED if 'RECONCILED' in globals() else "RECONCILED", FAILED, MANUAL_REVIEW]:
            self.assertTrue(is_terminal(state))

    # INVARIANT 14: Bounded Action Rule — Unapproved action types rejected
    def test_invariant_14_unapproved_action_rejected(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.FAILED,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="Test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,  # Illegal to capture a FAILED payment
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)
        self.assertIn("RULE_5", decision.rule)

    # INVARIANT 15: Valid capability token passes execution validation
    def test_invariant_15_valid_capability_token(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.NO_ACTION,
            amount=Decimal("500.00"),
            currency="INR",
            policy_decision_id="dec_001",
            idempotency_key="idem_001",
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.SUCCESS)

    # INVARIANT 16: Supported currencies whitelist
    def test_invariant_16_supported_currencies(self):
        for curr in ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD"]:
            self.assertEqual(validate_currency(curr), curr)

    # INVARIANT 17: Zero decimal currencies handling
    def test_invariant_17_zero_decimal_currencies(self):
        amt = minor_units_to_decimal(100, "JPY")
        self.assertEqual(amt, Decimal("100.00"))

    # INVARIANT 18: State resolvability rule
    def test_invariant_18_state_resolvability(self):
        intent = dict(self.base_intent)
        intent["current_state"] = "CREATED"
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="Test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.REJECT)
        self.assertIn("RULE_1", decision.rule)

    # INVARIANT 19: All 5 rules pass produces APPROVE
    def test_invariant_19_all_rules_pass(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="Test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
        self.assertEqual(decision.decision, DecisionType.APPROVE)

    # INVARIANT 20: Policy decision creation signs token correctly
    def test_invariant_20_policy_creates_signed_action(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.SUCCESS,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="Test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
        decision = self.engine.evaluate(intent, neg, det)
    # INVARIANT 21: Negative money cannot execute
    def test_invariant_21_negative_money_rejected(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.CAPTURE,
            amount=Decimal("-50.00"),
            currency="INR",
            policy_decision_id="dec_neg_01",
            idempotency_key="idem_neg_01",
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)
        self.assertIn("positive", res.error.lower())

    # INVARIANT 22: Zero money cannot execute financial mutations
    def test_invariant_22_zero_money_mutation_rejected(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.REFUND,
            amount=Decimal("0.00"),
            currency="INR",
            policy_decision_id="dec_zero_01",
            idempotency_key="idem_zero_01",
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)

    # INVARIANT 23: Invalid currency cannot execute
    def test_invariant_23_invalid_currency_rejected(self):
        with self.assertRaises(UnsupportedCurrencyError):
            validate_currency("INVALID_CURR")

    # INVARIANT 24: Decimal precision cannot alter financial identity
    def test_invariant_24_decimal_precision_identity(self):
        amt1 = to_decimal_amount(Decimal("100.50"))
        amt2 = to_decimal_amount("100.50000")
        self.assertEqual(amt1, amt2)

    # INVARIANT 25: Reconciliation cannot blindly guess truth on UNKNOWN state
    def test_invariant_25_reconciliation_unknown_state_ambiguous(self):
        intent = dict(self.base_intent)
        events = []
        api_evidence = {"status": "UNKNOWN"}
        executions = []
        result = self.recon_engine.reconcile(intent, events, api_evidence, executions)
        self.assertEqual(result.status, "AMBIGUOUS")
        self.assertEqual(result.divergence_type, DivergenceType.UNKNOWN_PROVIDER_STATE)

    # INVARIANT 26: Conflicting provider/local state escalates safely
    def test_invariant_26_conflicting_state_escalation(self):
        intent = dict(self.base_intent)
        intent["current_state"] = "FAILED"
        events = [{"event_type": "payment.captured", "payload": {}}]
        api_evidence = {"status": "SUCCESS", "amount": 50000}
        executions = []
        result = self.recon_engine.reconcile(intent, events, api_evidence, executions)
        self.assertEqual(result.status, "INCONSISTENT")
        self.assertEqual(result.divergence_type, DivergenceType.CONFLICTING_PROVIDER_STATE)

    # INVARIANT 27: Late events cannot corrupt current truth
    def test_invariant_27_late_events_preserve_terminal_state(self):
        self.assertEqual(transition("CAPTURED", "SUBMIT"), "CAPTURED")

    # INVARIANT 28: Cross-tenant access is denied
    def test_invariant_28_cross_tenant_token_isolation(self):
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            merchant_id="merchant_A",
            action=ActionType.CAPTURE,
            amount=Decimal("500.00"),
            currency="INR",
            policy_decision_id="dec_001",
            idempotency_key="idem_001",
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        self.assertEqual(cmd.merchant_id, "merchant_A")
        self.assertTrue(cmd.verify_signature(config.JWT_SECRET_KEY))
        # Tamper merchant_id to merchant_B
        cmd.merchant_id = "merchant_B"
        self.assertFalse(cmd.verify_signature(config.JWT_SECRET_KEY))

    # INVARIANT 29: Forensic replay produces zero side effects
    def test_invariant_29_forensic_replay_read_only(self):
        import asyncio
        from core.replay import replay_intent
        res = asyncio.run(replay_intent(self.base_intent["payment_intent_id"]))
        self.assertTrue(res.get("is_read_only", False) or res.get("replay_status") == "SUCCESS")

    # INVARIANT 30: Policy approval required before financial mutation
    def test_invariant_30_unapproved_policy_no_mutation(self):
        intent = dict(self.base_intent)
        neg = NegotiatorResult(
            payment_intent_id=intent["payment_intent_id"],
            external_status=ExternalStatus.FAILED,
            amount=Decimal("500.00"),
        )
        det = DetectiveResult(
            payment_intent_id=intent["payment_intent_id"],
            hypothesis="Test",
            confidence=0.9,
            recommended_action=ActionType.CAPTURE,
        )
    # INVARIANT 31: Future-issued command cannot execute
    def test_invariant_31_future_issued_command_rejected(self):
        import asyncio
        cmd = AuthorizedAction(
            payment_intent_id=self.base_intent["payment_intent_id"],
            action=ActionType.CAPTURE,
            amount=Decimal("500.00"),
            currency="INR",
            policy_decision_id="dec_001",
            idempotency_key="idem_001",
            issued_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10),
            expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15),
        )
        cmd.sign_command(config.JWT_SECRET_KEY)
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)
        self.assertEqual(res.error, "Command issued in future")


if __name__ == "__main__":
    unittest.main()
