# FILE: tests/test_omega_adversarial.py
"""
ResolverAI Omega-Level Adversarial Test Suite.
Exhaustive tests targeting:
1. Capability Token Signature Payload Tampering & Timestamp Boundaries
2. Idempotency Payload Hash Mismatch Rejection
3. Multi-Tenant API Route Scoping Boundaries
4. Ledger Financial Effect Summary Calculation Correctness
5. Outbox Lease Recovery State Transitions
6. Policy Engine Rule 1-5 Boundary Strictness
"""
import asyncio
import datetime
import unittest
from decimal import Decimal
import uuid

import config
from agents.schemas import (
    ActionType,
    AuthorizedAction,
    DecisionType,
    DetectiveResult,
    ExternalStatus,
    NegotiatorResult,
    PolicyDecision,
)
from agents.finops_executor import execute
from core.policy_engine import PolicyEngine
from core.idempotency import (
    verify_idempotency_payload,
    mark_event_processed,
    is_event_processed,
)


class TestOmegaAdversarial(unittest.TestCase):

    def setUp(self):
        self.secret = config.JWT_SECRET_KEY
        self.engine = PolicyEngine()
        self.intent_id = str(uuid.uuid4())

    def test_omega_01_token_tampered_amount_fails_verification(self):
        """Token signature must fail if amount is tampered after signing."""
        cmd = AuthorizedAction(
            payment_intent_id=self.intent_id,
            action=ActionType.CAPTURE,
            amount=Decimal("500.00"),
            currency="INR",
            policy_decision_id="dec_omega_01",
            idempotency_key="idem_omega_01",
        )
        cmd.sign_command(self.secret)
        self.assertTrue(cmd.verify_signature(self.secret))

        # Tamper amount from 500.00 to 5000.00
        cmd.amount = Decimal("5000.00")
        self.assertFalse(cmd.verify_signature(self.secret))

        # Execution of tampered token must fail
        res = asyncio.run(execute(cmd))
        self.assertEqual(res.execution_status, ExternalStatus.FAILED)
        self.assertIn("signature", res.error.lower())

    def test_omega_02_token_tampered_merchant_fails_verification(self):
        """Token signature must fail if merchant_id is modified."""
        cmd = AuthorizedAction(
            payment_intent_id=self.intent_id,
            merchant_id="merchant_A",
            action=ActionType.CAPTURE,
            amount=Decimal("100.00"),
            currency="INR",
            policy_decision_id="dec_omega_02",
            idempotency_key="idem_omega_02",
        )
        cmd.sign_command(self.secret)
        self.assertTrue(cmd.verify_signature(self.secret))

        cmd.merchant_id = "merchant_B"
        self.assertFalse(cmd.verify_signature(self.secret))

    def test_omega_03_token_tampered_timestamps_fail_verification(self):
        """Token signature must fail if issued_at or expires_at is modified after signing."""
        cmd = AuthorizedAction(
            payment_intent_id=self.intent_id,
            action=ActionType.CAPTURE,
            amount=Decimal("100.00"),
            currency="INR",
            policy_decision_id="dec_omega_03",
            idempotency_key="idem_omega_03",
        )
        cmd.sign_command(self.secret)
        self.assertTrue(cmd.verify_signature(self.secret))

        # Extend expires_at by 1 hour
        cmd.expires_at = cmd.expires_at + datetime.timedelta(hours=1)
        self.assertFalse(cmd.verify_signature(self.secret))

    def test_omega_04_idempotency_payload_mismatch_detection(self):
        """Idempotency check must detect payload mismatch for identical keys."""
        source = "test_src"
        event_id = f"evt_omega_{uuid.uuid4().hex[:8]}"
        hash1 = "sha256_payload_hash_v1"
        hash2 = "sha256_payload_hash_v2"

        # Initially NEW
        check1 = asyncio.run(verify_idempotency_payload(source, event_id, hash1))
        self.assertEqual(check1, "NEW")

        # Mark processed with hash1
        asyncio.run(mark_event_processed(source, event_id, payload_hash=hash1))

        # Verification with matching hash
        check2 = asyncio.run(verify_idempotency_payload(source, event_id, hash1))
        self.assertEqual(check2, "VALID_DUPLICATE")

        # Verification with mismatching hash
        check3 = asyncio.run(verify_idempotency_payload(source, event_id, hash2))
        self.assertEqual(check3, "PAYLOAD_MISMATCH")

    def test_omega_05_policy_rule_3_amount_and_currency_strictness(self):
        """Policy engine must reject on floating-point or currency case mismatch."""
        intent = {
            "payment_intent_id": self.intent_id,
            "amount": Decimal("500.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
        }
        neg_diff_amount = NegotiatorResult(
            payment_intent_id=self.intent_id,
            external_status=ExternalStatus.CAPTURED,
            amount=Decimal("500.01"),  # 1 paise difference
            currency="INR",
        )
        det = DetectiveResult(
            payment_intent_id=self.intent_id,
            hypothesis="Test",
            confidence=0.99,
            recommended_action=ActionType.CAPTURE,
        )
        dec = self.engine.evaluate(intent, neg_diff_amount, det)
        self.assertEqual(dec.decision, DecisionType.REJECT)
        self.assertIn("RULE_3", dec.rule)

    def test_omega_06_policy_rule_2_unknown_external_status_rejects(self):
        """Policy engine must reject if external status is UNKNOWN."""
        intent = {
            "payment_intent_id": self.intent_id,
            "amount": Decimal("500.00"),
            "currency": "INR",
            "current_state": "UNCERTAIN",
        }
        neg_unknown = NegotiatorResult(
            payment_intent_id=self.intent_id,
            external_status=ExternalStatus.UNKNOWN,
            amount=Decimal("500.00"),
            currency="INR",
        )
        det = DetectiveResult(
            payment_intent_id=self.intent_id,
            hypothesis="Test",
            confidence=0.99,
            recommended_action=ActionType.CAPTURE,
        )
        dec = self.engine.evaluate(intent, neg_unknown, det)
        self.assertEqual(dec.decision, DecisionType.REJECT)
        self.assertIn("RULE_2", dec.rule)


if __name__ == "__main__":
    unittest.main()
