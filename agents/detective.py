# FILE: agents/detective.py
"""Detective Agent — Analyzes payment state and produces a hypothesis (§19, 25)."""
import os
from decimal import Decimal
from typing import Any, Dict, Optional

from agents.schemas import ActionType, DetectiveResult


AI_MODE = os.getenv("AI_MODE", "DETERMINISTIC")


async def analyze(
    payment_intent: Dict[str, Any],
    trace_id: Optional[str] = None,
) -> DetectiveResult:
    """
    Deterministic rule-based analysis (AI_MODE=DETERMINISTIC).
    Returns structured DetectiveResult with hypothesis, confidence, and recommended action.
    """
    state = payment_intent.get("current_state", "")
    rail = payment_intent.get("rail", "")
    amount = Decimal(str(payment_intent.get("amount", "0")))
    retry_count = payment_intent.get("retry_count", 0)
    has_capture = payment_intent.get("has_existing_capture", False)
    intent_id = payment_intent.get("payment_intent_id", "unknown")

    # Scenario: Duplicate suspected — existing capture exists
    if has_capture or state == "DUPLICATE_SUSPECTED":
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="duplicate_capture_detected",
            confidence=0.95,
            evidence=[
                f"State is {state}",
                f"Existing capture found: {has_capture}",
                f"Rail: {rail}",
            ],
            recommended_action=ActionType.VOID,
            recommended_verification="VERIFY_DUPLICATE_THEN_VOID",
        )

    # Scenario: UNCERTAIN state on UPI rail — likely late auth
    if state == "UNCERTAIN" and rail.startswith("UPI"):
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="late_authorization_suspected",
            confidence=0.85,
            evidence=[
                f"State is UNCERTAIN on UPI rail {rail}",
                f"UPI rails frequently have delayed authorization",
                f"Amount: {amount}",
            ],
            recommended_action=ActionType.CAPTURE,
            recommended_verification="CHECK_EXTERNAL_STATUS",
        )

    # Scenario: UNCERTAIN on card rail — may need reroute
    if state == "UNCERTAIN" and rail.startswith("CARD"):
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="card_timeout_suspected",
            confidence=0.70,
            evidence=[
                f"State is UNCERTAIN on CARD rail {rail}",
                f"Card rails have higher failure rates",
                f"Retry count: {retry_count}",
            ],
            recommended_action=ActionType.REROUTE if retry_count < 2 else ActionType.MANUAL_REVIEW,
            recommended_verification="CHECK_EXTERNAL_STATUS",
        )

    # Scenario: UNCERTAIN on netbanking — slowest rail
    if state == "UNCERTAIN" and rail.startswith("NETBANKING"):
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="netbanking_slow_response",
            confidence=0.60,
            evidence=[
                f"State is UNCERTAIN on NETBANKING rail {rail}",
                f"Netbanking has highest latency variance",
            ],
            recommended_action=ActionType.CAPTURE,
            recommended_verification="CHECK_EXTERNAL_STATUS",
        )

    # Default: unknown ambiguity
    return DetectiveResult(
        payment_intent_id=intent_id,
        trace_id=trace_id or "",
        hypothesis="unknown_ambiguity",
        confidence=0.40,
        evidence=[f"State: {state}", f"Rail: {rail}", f"No matching pattern"],
        recommended_action=ActionType.MANUAL_REVIEW,
        recommended_verification="MANUAL_INSPECTION",
    )
