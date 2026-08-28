# FILE: agents/detective.py
"""Detective Agent — Analyzes payment timeline and produces hypothesis.

CRITICAL INVARIANT:
- The Detective is ADVISORY ONLY.
- It cannot move money, call capture/refund, or create AuthorizedAction objects.
- The Deterministic Policy Engine makes the final decision.

PROVIDER:
- When AI_MODE=DETERMINISTIC: uses DeterministicProvider (rule engine, no API key needed).
- When AI_MODE=ENABLED + GEMINI_API_KEY: uses GeminiProvider.
- When AI_MODE=ENABLED + GROQ_API_KEY: uses GroqProvider.

The active provider name is included in every DetectiveResult for UI display.
"""
import sys
from typing import Any, Dict, Optional

from agents.ai_providers import DeterministicProvider, get_provider
from agents.schemas import DetectiveResult


async def analyze(
    payment_intent: Dict[str, Any],
    events_history: Optional[list] = None,
    trace_id: Optional[str] = None,
) -> DetectiveResult:
    """
    Run the detective analysis pipeline.

    1. Selects the active AI provider via get_provider().
    2. If the LLM provider fails, falls back to DeterministicProvider.
    3. Returns a DetectiveResult with provider_name set for UI display.
    """
    provider = get_provider()

    # For non-deterministic providers, try and fall back
    if not isinstance(provider, DeterministicProvider):
        try:
            result = await provider.analyze(payment_intent, events_history, trace_id)
            if result:
                result.provider_name = provider.provider_name
                return result
        except Exception as e:
            print(
                f"[DETECTIVE] {provider.provider_name} failed ({e}), falling back to Deterministic Rule Engine",
                file=sys.stderr,
            )

        # Fall back to deterministic
        provider = DeterministicProvider()

    result = await provider.analyze(payment_intent, events_history, trace_id)
    result.provider_name = provider.provider_name
    return result
