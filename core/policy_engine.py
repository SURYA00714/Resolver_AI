# FILE: core/policy_engine.py
"""Deterministic 5-rule Policy Gate — AI is NOT the financial authority (§17, 22-23)."""
from decimal import Decimal
from typing import Any, Dict, Optional

from agents.schemas import (
    ActionType,
    AuthorizedAction,
    DecisionType,
    DetectiveResult,
    NegotiatorResult,
    PolicyDecision,
)


class PolicyEngine:
    """
    Five mandatory deterministic rules. ALL must pass for APPROVE.
    AI proposal can NEVER bypass this gate.
    """

    def evaluate(
        self,
        intent_data: Dict[str, Any],
        negotiator_result: NegotiatorResult,
        detective_result: DetectiveResult,
    ) -> PolicyDecision:
        trace_id = detective_result.trace_id

        # Rule 1 — STATE: Intent must be in a resolvable state
        state = intent_data.get("current_state", "")
        if state not in ("UNCERTAIN", "DUPLICATE_SUSPECTED", "VERIFYING", "PENDING_RAIL", "AUTHORIZED"):
            return PolicyDecision(
                decision=DecisionType.REJECT,
                rule="RULE_1_STATE",
                reason=f"State '{state}' is not resolvable by policy gate",
                trace_id=trace_id,
            )

        # Rule 2 — VERIFIED EVIDENCE: External status must be definitive (never UNKNOWN)
        ext_status = negotiator_result.external_status.value
        if ext_status == "UNKNOWN":
            return PolicyDecision(
                decision=DecisionType.REJECT,
                rule="RULE_2_VERIFIED_EVIDENCE",
                reason="External evidence status is UNKNOWN — cannot authorize financial action",
                trace_id=trace_id,
            )

        # Rule 3 — ECONOMIC IDENTITY: Amount and currency must match authoritative intent
        intent_amount = Decimal(str(intent_data.get("amount", "0")))
        intent_currency = intent_data.get("currency", "INR")
        if negotiator_result.amount != intent_amount:
            return PolicyDecision(
                decision=DecisionType.REJECT,
                rule="RULE_3_ECONOMIC_IDENTITY",
                reason=f"Amount mismatch: intent={intent_amount}, external={negotiator_result.amount}",
                trace_id=trace_id,
            )
        if negotiator_result.currency != intent_currency:
            return PolicyDecision(
                decision=DecisionType.REJECT,
                rule="RULE_3_ECONOMIC_IDENTITY",
                reason=f"Currency mismatch: intent={intent_currency}, external={negotiator_result.currency}",
                trace_id=trace_id,
            )

        # Rule 4 — DUPLICATE PROTECTION: No existing successful capture unless resolving duplicate
        has_existing_capture = intent_data.get("has_existing_capture", False)
        if has_existing_capture and state != "DUPLICATE_SUSPECTED" and detective_result.recommended_action not in (ActionType.REFUND, ActionType.VOID):
            return PolicyDecision(
                decision=DecisionType.REJECT,
                rule="RULE_4_DUPLICATE_PROTECTION",
                reason="Existing successful capture detected and action is not REFUND/VOID",
                trace_id=trace_id,
            )

        # Rule 5 — BOUNDED ACTION: Proposed action must be allowed for verified state
        action = detective_result.recommended_action
        allowed_actions = self._allowed_actions_for(state, ext_status)
        if action not in allowed_actions:
            return PolicyDecision(
                decision=DecisionType.REJECT,
                rule="RULE_5_BOUNDED_ACTION",
                reason=f"Action {action.value} not allowed for state={state}, ext_status={ext_status}. Allowed: {[a.value for a in allowed_actions]}",
                trace_id=trace_id,
            )

        # ALL 5 MANDATORY RULES PASSED
        return PolicyDecision(
            decision=DecisionType.APPROVE,
            rule="ALL_PASSED",
            reason="All 5 policy rules satisfied",
            trace_id=trace_id,
        )

    def create_authorized_action(
        self,
        policy_decision: PolicyDecision,
        intent_data: Dict[str, Any],
        detective_result: DetectiveResult,
        negotiator_result: NegotiatorResult,
        idempotency_key: str,
    ) -> Optional[AuthorizedAction]:
        """Create typed AuthorizedAction command ONLY from an APPROVED policy decision."""
        if policy_decision.decision != DecisionType.APPROVE:
            return None
        return AuthorizedAction(
            payment_intent_id=str(intent_data["payment_intent_id"]),
            action=detective_result.recommended_action,
            amount=Decimal(str(intent_data.get("amount", "0"))),
            currency=intent_data.get("currency", "INR"),
            target_rail=intent_data.get("rail"),
            razorpay_payment_id=negotiator_result.external_transaction_id or intent_data.get("active_payment_id"),
            razorpay_order_id=negotiator_result.razorpay_order_id or intent_data.get("razorpay_order_id"),
            policy_decision_id=policy_decision.policy_decision_id,
            idempotency_key=idempotency_key,
            trace_id=policy_decision.trace_id,
        )

    @staticmethod
    def _allowed_actions_for(state: str, ext_status: str) -> list[ActionType]:
        """Return allowed actions given state and external verification status."""
        if state in ("UNCERTAIN", "VERIFYING", "PENDING_RAIL", "AUTHORIZED"):
            if ext_status in ("SUCCESS", "CAPTURED"):
                return [ActionType.CAPTURE, ActionType.NO_ACTION]
            elif ext_status == "AUTHORIZED":
                return [ActionType.CAPTURE, ActionType.NO_ACTION]
            elif ext_status == "FAILED":
                return [ActionType.REROUTE, ActionType.NO_ACTION]
            elif ext_status in ("VOIDED", "REFUNDED"):
                return [ActionType.REROUTE, ActionType.NO_ACTION]
        elif state == "DUPLICATE_SUSPECTED":
            if ext_status in ("SUCCESS", "CAPTURED", "DUPLICATE"):
                return [ActionType.VOID, ActionType.REFUND]
        return [ActionType.MANUAL_REVIEW, ActionType.NO_ACTION]
