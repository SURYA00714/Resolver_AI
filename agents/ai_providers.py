# FILE: agents/ai_providers.py
"""AI Provider abstraction for the Detective agent.

ARCHITECTURE:
- AIProvider is the abstract interface.
- DeterministicProvider: rule-based engine — honest name, NOT called "AI".
- GeminiProvider / GroqProvider: real LLM integrations (enabled when API key is set).

SAFETY CONTRACT (INVARIANT):
- AI providers are ADVISORY ONLY.
- They CANNOT execute payments.
- They CANNOT call capture or refund.
- They CANNOT create AuthorizedAction objects.
- They CANNOT modify evidence or audit trails.
- Their output is a DetectiveResult Pydantic object — structured advisory.
- The Deterministic Policy Engine makes the final decision.

DISPLAY:
- DeterministicProvider: displayed as "Deterministic Rule Engine"
- GeminiProvider: displayed as "Gemini AI Advisory"
- GroqProvider: displayed as "Groq AI Advisory"
- NEVER displayed as just "AI" without naming the provider.
"""
import json
import os
import sys
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any, Dict, List, Optional

import config
from agents.schemas import ActionType, DetectiveResult


class AIProvider(ABC):
    """Abstract base class for Detective evidence analysis providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider name for display in the UI."""
        ...

    @abstractmethod
    async def analyze(
        self,
        payment_intent: Dict[str, Any],
        events_history: Optional[List[Dict]] = None,
        trace_id: Optional[str] = None,
    ) -> DetectiveResult:
        """Analyze payment context and return an advisory DetectiveResult."""
        ...


class DeterministicProvider(AIProvider):
    """
    Deterministic Rule-Based Evidence Analyzer.

    This is NOT an AI model. It uses explicit, auditable rules to classify
    payment anomalies based on state, rail type, and evidence.

    It is the safe, always-available fallback when no AI provider is configured.
    Displayed to the user as: "Deterministic Rule Engine"
    """

    @property
    def provider_name(self) -> str:
        return "Deterministic Rule Engine"

    async def analyze(
        self,
        payment_intent: Dict[str, Any],
        events_history: Optional[List[Dict]] = None,
        trace_id: Optional[str] = None,
    ) -> DetectiveResult:
        """Rule-based anomaly classification."""
        state = payment_intent.get("current_state", "")
        rail = payment_intent.get("rail", payment_intent.get("active_rail", "RAZORPAY"))
        amount = Decimal(str(payment_intent.get("amount", "0")))
        retry_count = payment_intent.get("retry_count", 0)
        has_capture = payment_intent.get("has_existing_capture", False)
        intent_id = str(payment_intent.get("payment_intent_id", "unknown"))
        razorpay_payment_id = payment_intent.get("active_payment_id")

        evidence_context = []
        if razorpay_payment_id:
            evidence_context.append(f"Razorpay payment ID: {razorpay_payment_id}")
        if events_history:
            event_types = [e.get("event_type", "unknown") for e in events_history]
            evidence_context.append(f"Webhook events received: {', '.join(event_types)}")

        # Rule 1: Duplicate capture detected
        if has_capture or state == "DUPLICATE_SUSPECTED":
            return DetectiveResult(
                payment_intent_id=intent_id,
                trace_id=trace_id or "",
                hypothesis="duplicate_capture_detected",
                confidence=0.95,
                evidence=[
                    f"State is {state}",
                    f"Existing capture flag: {has_capture}",
                    f"Rail: {rail}",
                    *evidence_context,
                ],
                recommended_action=ActionType.REFUND,
                recommended_verification="VERIFY_DUPLICATE_THEN_REFUND",
            )

        # Rule 2: UNCERTAIN state on UPI rail — likely late authorization
        if state in ("UNCERTAIN", "PENDING_RAIL") and "UPI" in rail.upper():
            return DetectiveResult(
                payment_intent_id=intent_id,
                trace_id=trace_id or "",
                hypothesis="late_authorization_suspected",
                confidence=0.85,
                evidence=[
                    f"State is {state} on UPI rail ({rail})",
                    "UPI authorizations frequently experience 30–300 second network delays at the bank switch",
                    f"Amount: INR {amount}",
                    *evidence_context,
                ],
                recommended_action=ActionType.CAPTURE,
                recommended_verification="FETCH_RAZORPAY_STATUS",
            )

        # Rule 3: UNCERTAIN on Card / Netbanking rail
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
                    *evidence_context,
                ],
                recommended_action=ActionType.CAPTURE,
                recommended_verification="FETCH_RAZORPAY_STATUS",
            )

        # Rule 4: Already reconciled — no action
        if state in ("CAPTURED", "RECONCILED"):
            return DetectiveResult(
                payment_intent_id=intent_id,
                trace_id=trace_id or "",
                hypothesis="already_resolved",
                confidence=0.99,
                evidence=[f"State is terminal: {state}", *evidence_context],
                recommended_action=ActionType.MANUAL_REVIEW,
                recommended_verification="NO_ACTION_REQUIRED",
            )

        # Default: unknown — escalate to manual review
        return DetectiveResult(
            payment_intent_id=intent_id,
            trace_id=trace_id or "",
            hypothesis="unknown_anomaly",
            confidence=0.40,
            evidence=[f"State: {state}", f"Rail: {rail}", "No deterministic rule matched", *evidence_context],
            recommended_action=ActionType.MANUAL_REVIEW,
            recommended_verification="MANUAL_INSPECTION",
        )


class GeminiProvider(AIProvider):
    """
    Google Gemini AI Advisory Provider.

    Requires GEMINI_API_KEY in environment.
    AI output is ADVISORY ONLY — it cannot authorize financial actions.
    """

    @property
    def provider_name(self) -> str:
        return "Gemini AI Advisory"

    async def analyze(
        self,
        payment_intent: Dict[str, Any],
        events_history: Optional[List[Dict]] = None,
        trace_id: Optional[str] = None,
    ) -> Optional[DetectiveResult]:
        """Call Gemini API for payment anomaly hypothesis."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = _build_detective_prompt(payment_intent, events_history)
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            return _parse_llm_response(response.text, payment_intent, trace_id)
        except ImportError:
            print("[DETECTIVE] Gemini SDK not installed. Run: pip install google-generativeai", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[DETECTIVE] Gemini error: {e}", file=sys.stderr)
            return None


class GroqProvider(AIProvider):
    """
    Groq AI Advisory Provider (llama3-8b-8192).

    Requires GROQ_API_KEY in environment.
    AI output is ADVISORY ONLY — it cannot authorize financial actions.
    """

    @property
    def provider_name(self) -> str:
        return "Groq AI Advisory"

    async def analyze(
        self,
        payment_intent: Dict[str, Any],
        events_history: Optional[List[Dict]] = None,
        trace_id: Optional[str] = None,
    ) -> Optional[DetectiveResult]:
        """Call Groq API for payment anomaly hypothesis."""
        try:
            from groq import Groq
            client = Groq(api_key=config.GROQ_API_KEY)
            prompt = _build_detective_prompt(payment_intent, events_history)
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a payment anomaly detection specialist. Respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                model="llama3-8b-8192",
                response_format={"type": "json_object"},
            )
            return _parse_llm_response(chat_completion.choices[0].message.content, payment_intent, trace_id)
        except ImportError:
            print("[DETECTIVE] Groq SDK not installed. Run: pip install groq", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[DETECTIVE] Groq error: {e}", file=sys.stderr)
            return None


def get_provider() -> AIProvider:
    """
    Factory: returns the active AI provider based on configuration.

    Selection order:
    1. If AI_MODE=ENABLED and GEMINI_API_KEY is set → GeminiProvider
    2. If AI_MODE=ENABLED and GROQ_API_KEY is set → GroqProvider
    3. Otherwise → DeterministicProvider (always available, no external dependencies)
    """
    if config.AI_MODE == "ENABLED":
        if config.GEMINI_API_KEY:
            return GeminiProvider()
        if config.GROQ_API_KEY:
            return GroqProvider()
    return DeterministicProvider()


def _build_detective_prompt(payment_intent: Dict[str, Any], events_history: Optional[List[Dict]]) -> str:
    """Build a structured prompt for LLM providers."""
    return f"""
You are analyzing a payment anomaly for a merchant payment integrity platform.
Your role is ADVISORY ONLY. You cannot execute payments.

Payment context:
{json.dumps(payment_intent, default=str, indent=2)}

Webhook event history (chronological):
{json.dumps(events_history or [], default=str, indent=2)}

Based on this context, produce a payment anomaly hypothesis in the following JSON format:
{{
  "hypothesis": "string — one of: late_authorization_suspected, duplicate_capture_detected, gateway_timeout, already_resolved, unknown_anomaly",
  "confidence": 0.0 to 1.0,
  "evidence": ["list of specific evidence strings from the provided context"],
  "recommended_action": "CAPTURE | REFUND | MANUAL_REVIEW | NO_ACTION",
  "recommended_verification": "string describing what should be verified externally"
}}

IMPORTANT:
- Only reference evidence from the provided context.
- Do not invent payment IDs, amounts, or transaction details.
- Keep confidence below 0.9 unless the evidence is unambiguous.
"""


def _parse_llm_response(
    raw: str,
    payment_intent: Dict[str, Any],
    trace_id: Optional[str],
) -> Optional[DetectiveResult]:
    """Parse LLM JSON output into a DetectiveResult."""
    try:
        data = json.loads(raw)
        action_str = data.get("recommended_action", "MANUAL_REVIEW")
        action = ActionType.__members__.get(action_str, ActionType.MANUAL_REVIEW)
        return DetectiveResult(
            payment_intent_id=str(payment_intent.get("payment_intent_id", "unknown")),
            trace_id=trace_id or "",
            hypothesis=data.get("hypothesis", "unknown"),
            confidence=float(data.get("confidence", 0.5)),
            evidence=data.get("evidence", []),
            recommended_action=action,
            recommended_verification=data.get("recommended_verification", "MANUAL_INSPECTION"),
        )
    except Exception as e:
        print(f"[DETECTIVE] Failed to parse LLM response: {e} | raw: {raw[:200]}", file=sys.stderr)
        return None
