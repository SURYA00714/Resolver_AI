# FILE: agents/detective.py
"""Detective Agent — Analyzes payment timeline and produces hypothesis (§15, 21, 32).

CRITICAL INVARIANT: The Detective is purely advisory and CANNOT move money or call mutation APIs.
"""
import json
import os
import sys
from decimal import Decimal
from typing import Any, Dict, Optional

import config
from agents.schemas import ActionType, DetectiveResult


async def analyze(
    payment_intent: Dict[str, Any],
    events_history: Optional[list] = None,
    trace_id: Optional[str] = None,
) -> DetectiveResult:
    """
    Detective analysis pipeline:
    1. Try AI provider (Gemini or Groq) if enabled and configured
    2. Fall back to DETERMINISTIC_AI_FALLBACK if AI is disabled/fails
    """
    if config.AI_MODE == "ENABLED" and (config.GEMINI_API_KEY or config.GROQ_API_KEY):
        try:
            ai_result = await _analyze_with_llm(payment_intent, events_history, trace_id)
            if ai_result:
                return ai_result
        except Exception as e:
            print(f"[DETECTIVE] AI provider error, invoking DETERMINISTIC_AI_FALLBACK: {e}", file=sys.stderr)

    return _deterministic_fallback(payment_intent, trace_id)


async def _analyze_with_llm(
    payment_intent: Dict[str, Any],
    events_history: Optional[list],
    trace_id: Optional[str],
) -> Optional[DetectiveResult]:
    """Call external LLM provider (Groq/Gemini) if configured."""
    # Stub for external LLM call — parses structured JSON output
    # If LLM produces malformed response or invalid confidence, returns None to trigger fallback
    return None


def _deterministic_fallback(
    payment_intent: Dict[str, Any],
    trace_id: Optional[str] = None,
) -> DetectiveResult:
    """
    DETERMINISTIC_AI_FALLBACK engine (§6, 21).
    Rule-based diagnostic rules operating without external API keys.
    """
    state = payment_intent.get("current_state", "")
    rail = payment_intent.get("rail", payment_intent.get("active_rail", "RAZORPAY_TEST"))
    amount = Decimal(str(payment_intent.get("amount", "0")))
    retry_count = payment_intent.get("retry_count", 0)
    has_capture = payment_intent.get("has_existing_capture", False)
    intent_id = str(payment_intent.get("payment_intent_id", "unknown"))

    # Scenario 1: Duplicate suspected — existing capture exists
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
            recommended_action=ActionType.REFUND,
            recommended_verification="VERIFY_DUPLICATE_THEN_REFUND",
        )

    # Scenario 2: UNCERTAIN state on UPI rail — likely late auth
    if state in ("UNCERTAIN", "PENDING_RAIL") and "UPI" in rail:
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="late_authorization_suspected",
            confidence=0.85,
            evidence=[
                f"State is {state} on UPI rail {rail}",
                f"UPI webhooks/authorizations frequently experience network delay",
                f"Amount: INR {amount}",
            ],
            recommended_action=ActionType.CAPTURE,
            recommended_verification="FETCH_RAZORPAY_STATUS",
        )

    # Scenario 3: UNCERTAIN on Card / Netbanking rail
    if state in ("UNCERTAIN", "PENDING_RAIL"):
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="gateway_timeout_or_pending_capture",
            confidence=0.75,
            evidence=[
                f"State is {state} on rail {rail}",
                f"Retry count: {retry_count}",
                f"Amount: INR {amount}",
            ],
            recommended_action=ActionType.CAPTURE,
            recommended_verification="FETCH_RAZORPAY_STATUS",
        )

    # Default fallback: unknown ambiguity
    return DetectiveResult(
        payment_intent_id=intent_id,
        trace_id=trace_id or "",
        hypothesis="unknown_ambiguity",
        confidence=0.40,
        evidence=[f"State: {state}", f"Rail: {rail}", "No matching deterministic rule"],
        recommended_action=ActionType.MANUAL_REVIEW,
        recommended_verification="MANUAL_INSPECTION",
    )
