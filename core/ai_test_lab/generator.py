# FILE: core/ai_test_lab/generator.py
"""AI Scenario Generator & Security Schema Validator (§7, 8, 17).

Uses existing AI infrastructure (Gemini, Groq, or Deterministic fallback)
to generate structured adversarial scenarios safely.
"""
import json
import re
import sys
from decimal import Decimal
from typing import Any, Dict, List, Optional

import config
from agents.ai_providers import get_provider
from core.ai_test_lab.schema import (
    ExpectedResult,
    RiskLevel,
    Scenario,
    ScenarioCategory,
    SyntheticEvent,
)


class SecurityValidationError(ValueError):
    """Raised when AI scenario output violates security schema invariants."""
    pass


FORBIDDEN_KEYWORDS = [
    "SELECT ", "INSERT ", "UPDATE ", "DELETE ", "DROP ", "UNION ",
    "exec(", "eval(", "__import__", "import os", "import sys", "os.system",
    "rm -rf", "curl ", "wget ", "bash -c", "sh -c",
    "api.razorpay.com", "rzp_live_", "rzp_test_"
]


def validate_ai_scenario_schema(raw_dict: Dict[str, Any]) -> None:
    """
    Strict security schema validator for AI-generated scenarios.
    REJECTS:
    - Real Razorpay credentials or live keys
    - Arbitrary SQL keywords
    - Arbitrary Python / Shell code
    - Production endpoints
    - Unrestricted HTTP requests
    """
    raw_str = json.dumps(raw_dict).upper()

    for kw in FORBIDDEN_KEYWORDS:
        if kw.upper() in raw_str:
            raise SecurityValidationError(
                f"AI scenario rejected: prohibited security keyword '{kw}' detected"
            )

    # Check for live Razorpay key patterns
    if re.search(r"RZP_(LIVE|TEST)_[A-Z0-9]+", raw_str):
        raise SecurityValidationError("AI scenario rejected: real Razorpay key pattern detected")


async def generate_ai_scenarios(count: int = 5, category: str = "ADVERSARIAL") -> List[Scenario]:
    """
    Generate structured scenarios using configured AI provider or deterministic fallback.
    """
    scenarios: List[Scenario] = []
    provider = get_provider()

    # If AI provider is available (Gemini/Groq), attempt LLM generation
    if provider.provider_name in ("Gemini AI Advisory", "Groq AI Advisory"):
        try:
            prompt = f"""
Generate {count} distinct adversarial payment test scenarios for a payment state integrity platform.
Output MUST be a JSON list of scenario objects conforming to this schema:
[
  {{
    "scenario_type": "STRING (e.g. ADVERSARIAL_DOUBLE_CAPTURE)",
    "title": "Short title",
    "description": "Description of adversarial timing or state attack",
    "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
    "initial_amount": 2500.00,
    "initial_state": "CREATED | UNCERTAIN | DUPLICATE_SUSPECTED",
    "events": [
      {{
        "event_type": "payment.captured | payment.failed | checkout_verify",
        "delay_ms": 100,
        "payload": {{"status": "captured"}}
      }}
    ],
    "expected_state": "CAPTURED | FAILED | DUPLICATE_SUSPECTED | MANUAL_REVIEW",
    "expected_http_status": 200,
    "expected_policy_decision": "APPROVE | REJECT | MANUAL_REVIEW",
    "reason": "Why this test scenario tests payment state integrity"
  }}
]

IMPORTANT SECURITY RULES:
- Do NOT generate SQL, Python code, shell scripts, or URL endpoints.
- Do NOT use real Razorpay API keys or real IDs.
"""

            raw_text = None
            if provider.provider_name == "Gemini AI Advisory":
                import google.generativeai as genai
                genai.configure(api_key=config.GEMINI_API_KEY)
                model = genai.GenerativeModel("gemini-1.5-flash")
                resp = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
                raw_text = resp.text
            elif provider.provider_name == "Groq AI Advisory":
                from groq import Groq
                client = Groq(api_key=config.GROQ_API_KEY)
                completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama3-8b-8192",
                    response_format={"type": "json_object"},
                )
                raw_text = completion.choices[0].message.content

            if raw_text:
                items = json.loads(raw_text)
                if isinstance(items, dict) and "scenarios" in items:
                    items = items["scenarios"]
                if isinstance(items, list):
                    for idx, item in enumerate(items[:count]):
                        validate_ai_scenario_schema(item)
                        scen = Scenario(
                            scenario_id=f"scen_ai_{idx+1}_{item.get('scenario_type','ADV').lower()}",
                            scenario_type=item.get("scenario_type", f"AI_ADVERSARIAL_{idx+1}"),
                            title=item.get("title", f"AI Adversarial Test #{idx+1}"),
                            description=item.get("description", "AI Generated Adversarial Test"),
                            category=ScenarioCategory.AI_GENERATED,
                            risk_level=RiskLevel.__members__.get(item.get("risk_level", "HIGH"), RiskLevel.HIGH),
                            initial_amount=Decimal(str(item.get("initial_amount", "1500.00"))),
                            initial_state=item.get("initial_state", "CREATED"),
                            events=[
                                SyntheticEvent(
                                    event_type=evt.get("event_type", "payment.captured"),
                                    delay_ms=evt.get("delay_ms", 0),
                                    payload=evt.get("payload", {}),
                                )
                                for evt in item.get("events", [])
                            ],
                            expected_result=ExpectedResult(
                                expected_state=item.get("expected_state", "CAPTURED"),
                                expected_http_status=item.get("expected_http_status", 200),
                                expected_policy_decision=item.get("expected_policy_decision", None),
                            ),
                            reason=item.get("reason"),
                        )
                        scenarios.append(scen)
        except Exception as e:
            print(f"[AI_GENERATOR] LLM generation failed: {e}. Falling back to deterministic adversarial generator.", file=sys.stderr)

    # Fallback / Baseline deterministic adversarial scenario generator
    if len(scenarios) < count:
        adv_baselines = _generate_deterministic_adversarial_scenarios(count - len(scenarios))
        scenarios.extend(adv_baselines)

    return scenarios[:count]


def _generate_deterministic_adversarial_scenarios(count: int) -> List[Scenario]:
    """
    Deterministic rule-based adversarial scenario generator.
    Produces safe, reproducible adversarial scenarios without needing LLMs.
    """
    templates = [
        {
            "type": "ADV_WEBHOOK_RACE",
            "title": "Adversarial Webhook Race Condition",
            "desc": "Simultaneous arrival of payment.captured and payment.failed webhooks",
            "risk": RiskLevel.CRITICAL,
            "amount": "4999.00",
            "init_state": "CREATED",
            "events": [
                SyntheticEvent(event_type="payment.captured", delay_ms=0, payload={"status": "captured"}),
                SyntheticEvent(event_type="payment.failed", delay_ms=10, payload={"error": "declined"}),
            ],
            "expected": ExpectedResult(expected_state="CAPTURED", expected_http_status=200, expected_idempotent=True),
        },
        {
            "type": "ADV_REPLAY_AFTER_RECONCILE",
            "title": "Adversarial Webhook Replay After Reconciliation",
            "desc": "Stale payment.failed webhook replayed after intent was reconciled",
            "risk": RiskLevel.HIGH,
            "amount": "2999.00",
            "init_state": "RECONCILED",
            "events": [
                SyntheticEvent(event_type="payment.failed", delay_ms=0, payload={"status": "failed"}),
            ],
            "expected": ExpectedResult(expected_state="RECONCILED", expected_http_status=200, expected_idempotent=True),
        },
        {
            "type": "ADV_TRIPLE_WEBHOOK_BURST",
            "title": "Adversarial Triple Webhook Burst",
            "desc": "Three duplicate captured webhooks in a 50ms burst",
            "risk": RiskLevel.MEDIUM,
            "amount": "1250.00",
            "init_state": "CREATED",
            "events": [
                SyntheticEvent(event_type="payment.captured", delay_ms=0),
                SyntheticEvent(event_type="payment.captured", delay_ms=20),
                SyntheticEvent(event_type="payment.captured", delay_ms=40),
            ],
            "expected": ExpectedResult(expected_state="CAPTURED", expected_http_status=200, expected_idempotent=True, expected_financial_mutation=False),
        },
        {
            "type": "ADV_INVALID_SIG_THEN_VALID",
            "title": "Adversarial Tampered Signature Followed by Valid",
            "desc": "Attacker sends forged webhook, then valid webhook arrives",
            "risk": RiskLevel.CRITICAL,
            "amount": "3490.00",
            "init_state": "CREATED",
            "events": [
                SyntheticEvent(event_type="payment.captured", override_signature="FORGED_SIG"),
                SyntheticEvent(event_type="payment.captured", delay_ms=100),
            ],
            "expected": ExpectedResult(expected_state="CAPTURED", expected_http_status=200, expected_security_alert=True),
        },
        {
            "type": "ADV_OUTBOX_DUPLICATION_RETRY",
            "title": "Adversarial Outbox Duplication Task",
            "desc": "Simulate worker processing same outbox resolution task twice",
            "risk": RiskLevel.HIGH,
            "amount": "1999.00",
            "init_state": "UNCERTAIN",
            "events": [
                SyntheticEvent(event_type="payment.captured", delay_ms=0),
            ],
            "expected": ExpectedResult(expected_state="CAPTURED", expected_http_status=200, expected_outbox_event="RESOLVE_INTENT", expected_idempotent=True),
        },
    ]

    scenarios = []
    for idx in range(count):
        tmpl = templates[idx % len(templates)]
        scen = Scenario(
            scenario_id=f"scen_adv_det_{idx+1}",
            scenario_type=f"{tmpl['type']}_{idx+1}",
            title=f"{tmpl['title']} #{idx+1}",
            description=tmpl["desc"],
            category=ScenarioCategory.ADVERSARIAL,
            risk_level=tmpl["risk"],
            initial_amount=Decimal(tmpl["amount"]),
            initial_state=tmpl["init_state"],
            events=tmpl["events"],
            expected_result=tmpl["expected"],
        )
        scenarios.append(scen)
    return scenarios
