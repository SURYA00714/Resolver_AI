# FILE: core/ai_test_lab/scenarios.py
"""Deterministic Baseline Test Scenario Library (§5).

Contains 20 predefined payment-state edge cases with deterministic expected results.
"""
from decimal import Decimal
from typing import Dict, List
from core.ai_test_lab.schema import (
    ExpectedResult,
    RiskLevel,
    Scenario,
    ScenarioCategory,
    SyntheticEvent,
)


def get_baseline_scenarios() -> List[Scenario]:
    """Return the complete library of 20 baseline deterministic test scenarios."""
    scenarios = [
        # 1. SUCCESS_FLOW
        Scenario(
            scenario_id="scen_01_success_flow",
            scenario_type="SUCCESS_FLOW",
            title="Standard Checkout Success Flow",
            description="Normal payment authorization followed by capture webhook",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.LOW,
            initial_amount=Decimal("1500.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured", "method": "upi"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",
                expected_http_status=200,
                expected_outbox_event="RESOLVE_INTENT",
                expected_idempotent=True,
            ),
        ),
        # 2. PAYMENT_FAILED_USER_DECLINED
        Scenario(
            scenario_id="scen_02_user_declined",
            scenario_type="PAYMENT_FAILED_USER_DECLINED",
            title="Payment Failed — User Declined",
            description="Customer explicitly cancels or declines authorization on bank UPI screen",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.LOW,
            initial_amount=Decimal("499.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.failed",
                    payload={"error_code": "BAD_REQUEST_ERROR", "error_description": "User cancelled payment"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="FAILED",
                expected_http_status=200,
                expected_idempotent=True,
            ),
        ),
        # 3. PAYMENT_FAILED_BANK_ERROR
        Scenario(
            scenario_id="scen_03_bank_error",
            scenario_type="PAYMENT_FAILED_BANK_ERROR",
            title="Payment Failed — Bank Switch Downtime",
            description="Issuing bank NPCI switch timed out or returned technical failure",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("2499.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.failed",
                    payload={"error_code": "GATEWAY_ERROR", "error_description": "Bank switch timed out"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="FAILED",
                expected_http_status=200,
                expected_idempotent=True,
            ),
        ),
        # 4. INVALID_WEBHOOK_SIGNATURE
        Scenario(
            scenario_id="scen_04_invalid_signature",
            scenario_type="INVALID_WEBHOOK_SIGNATURE",
            title="Adversarial Invalid Webhook Signature",
            description="Untrusted or tampered webhook payload with invalid Razorpay HMAC signature",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("5000.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                    override_signature="INVALID_HMAC_SIGNATURE_HASH",
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CREATED",  # State must remain UNCHANGED
                expected_http_status=401,
                expected_security_alert=True,
                expected_idempotent=True,
                expected_financial_mutation=False,
            ),
        ),
        # 5. DUPLICATE_WEBHOOK
        Scenario(
            scenario_id="scen_05_duplicate_webhook",
            scenario_type="DUPLICATE_WEBHOOK",
            title="Duplicate Webhook Delivery",
            description="Same payment.captured webhook delivered twice by network retry",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("1200.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                ),
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                    delay_ms=100,
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",
                expected_http_status=200,
                expected_idempotent=True,
                expected_financial_mutation=False,  # No duplicate capture!
            ),
        ),
        # 6. DUPLICATE_CHECKOUT_VERIFICATION
        Scenario(
            scenario_id="scen_06_duplicate_checkout_verify",
            scenario_type="DUPLICATE_CHECKOUT_VERIFICATION",
            title="Duplicate Checkout Verification Attempt",
            description="Client submits frontend razorpay_verify twice concurrently",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("899.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="checkout_verify",
                    payload={"verify_attempt": 1},
                ),
                SyntheticEvent(
                    event_type="checkout_verify",
                    payload={"verify_attempt": 2},
                    delay_ms=50,
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",
                expected_http_status=200,
                expected_idempotent=True,
            ),
        ),
        # 7. CHECKOUT_SIGNATURE_MISMATCH
        Scenario(
            scenario_id="scen_07_checkout_sig_mismatch",
            scenario_type="CHECKOUT_SIGNATURE_MISMATCH",
            title="Invalid Checkout Verification Signature",
            description="Frontend submits manipulated razorpay_signature during checkout verify",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("3500.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="checkout_verify",
                    payload={"status": "captured"},
                    override_signature="BAD_FRONTEND_SIGNATURE",
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CREATED",  # Protected against fake payment verification
                expected_http_status=401,
                expected_security_alert=True,
                expected_financial_mutation=False,
            ),
        ),
        # 8. MISSING_WEBHOOK
        Scenario(
            scenario_id="scen_08_missing_webhook",
            scenario_type="MISSING_WEBHOOK",
            title="Missing Webhook (Gateway Timeout)",
            description="Payment state remains UNCERTAIN due to missing payment.captured webhook",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("1999.00"),
            initial_state="UNCERTAIN",
            events=[],  # No webhook arrives!
            expected_result=ExpectedResult(
                expected_state="UNCERTAIN",
                expected_http_status=200,
                expected_policy_decision="REJECT",  # Policy Engine rejects authorization without verified evidence
            ),
        ),
        # 9. DELAYED_WEBHOOK
        Scenario(
            scenario_id="scen_09_delayed_webhook",
            scenario_type="DELAYED_WEBHOOK",
            title="Delayed Webhook Arrival (Late Authorization)",
            description="Webhook arrives after 120s delay while intent is in UNCERTAIN state",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("1499.00"),
            initial_state="UNCERTAIN",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                    delay_ms=200,
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",
                expected_http_status=200,
                expected_outbox_event="RESOLVE_INTENT",
                expected_idempotent=True,
            ),
        ),
        # 10. WEBHOOK_AFTER_TIMEOUT
        Scenario(
            scenario_id="scen_10_webhook_after_timeout",
            scenario_type="WEBHOOK_AFTER_TIMEOUT",
            title="Late Webhook After Timeout Reconcile",
            description="Webhook arrives for intent already marked UNCERTAIN/VERIFYING",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("2999.00"),
            initial_state="UNCERTAIN",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured", "scenario": "LATE_AUTH"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",
                expected_http_status=200,
                expected_idempotent=True,
            ),
        ),
        # 11. CONFLICTING_PAYMENT_STATE
        Scenario(
            scenario_id="scen_11_conflicting_state",
            scenario_type="CONFLICTING_PAYMENT_STATE",
            title="Conflicting Payment Events (Failed then Captured)",
            description="payment.failed event followed by payment.captured event for same intent",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.CRITICAL,
            initial_amount=Decimal("4999.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.failed",
                    payload={"error_code": "BAD_REQUEST_ERROR"},
                ),
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                    delay_ms=100,
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="DUPLICATE_SUSPECTED",  # Escalated or set to duplicate/manual review by state machine
                expected_http_status=200,
                expected_policy_decision="REJECT",
            ),
        ),
        # 12. DUPLICATE_PAYMENT
        Scenario(
            scenario_id="scen_12_duplicate_payment",
            scenario_type="DUPLICATE_PAYMENT",
            title="Duplicate Payment Attempt (Cross-Rail)",
            description="Two separate payments created for the same merchant order",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("2999.00"),
            initial_state="DUPLICATE_SUSPECTED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured", "duplicate": True},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="DUPLICATE_SUSPECTED",
                expected_http_status=200,
                expected_policy_decision="APPROVE",  # Policy Engine approves REFUND for duplicate capture
                expected_financial_mutation=False,
            ),
        ),
        # 13. MISSING_PAYMENT_ID
        Scenario(
            scenario_id="scen_13_missing_payment_id",
            scenario_type="MISSING_PAYMENT_ID",
            title="Malformed Event — Missing Payment ID",
            description="Incoming webhook payload lacks required razorpay_payment_id",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("750.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},  # Missing payment ID field!
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CREATED",
                expected_http_status=400,
                expected_idempotent=True,
            ),
        ),
        # 14. MALFORMED_WEBHOOK
        Scenario(
            scenario_id="scen_14_malformed_webhook",
            scenario_type="MALFORMED_WEBHOOK",
            title="Malformed JSON Webhook Payload",
            description="Webhook body contains broken non-JSON content",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("1000.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="raw_malformed",
                    payload={},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CREATED",
                expected_http_status=400,
                expected_idempotent=True,
            ),
        ),
        # 15. UNKNOWN_EVENT_TYPE
        Scenario(
            scenario_id="scen_15_unknown_event",
            scenario_type="UNKNOWN_EVENT_TYPE",
            title="Unsupported / Custom Event Type",
            description="Webhook with unrecognized event type (e.g. custom.provider.event)",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.LOW,
            initial_amount=Decimal("500.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="custom.unknown_event",
                    payload={"info": "test"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CREATED",
                expected_http_status=200,
                expected_idempotent=True,
            ),
        ),
        # 16. OUT_OF_ORDER_EVENTS
        Scenario(
            scenario_id="scen_16_out_of_order",
            scenario_type="OUT_OF_ORDER_EVENTS",
            title="Out-of-Order Webhook Delivery",
            description="payment.captured arrives before payment.authorized",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("749.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                ),
                SyntheticEvent(
                    event_type="payment.authorized",
                    payload={"status": "authorized"},
                    delay_ms=100,
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",  # Must remain CAPTURED (terminal protection)
                expected_http_status=200,
                expected_idempotent=True,
            ),
        ),
        # 17. REPEATED_RESOLUTION
        Scenario(
            scenario_id="scen_17_repeated_resolution",
            scenario_type="REPEATED_RESOLUTION",
            title="Repeated Resolution Trigger",
            description="Attempt to resolve an intent that is already terminal CAPTURED or RECONCILED",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.MEDIUM,
            initial_amount=Decimal("1999.00"),
            initial_state="CAPTURED",
            events=[
                SyntheticEvent(
                    event_type="resolve_request",
                    payload={"action": "RECONCILE"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",  # Terminal protection prevents state rewind
                expected_http_status=200,
                expected_policy_decision="REJECT",
                expected_idempotent=True,
            ),
        ),
        # 18. OUTBOX_DUPLICATION_ATTEMPT
        Scenario(
            scenario_id="scen_18_outbox_duplication",
            scenario_type="OUTBOX_DUPLICATION_ATTEMPT",
            title="Outbox Event Duplication Attempt",
            description="Enqueuing duplicate outbox key for single resolution task",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("1500.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="payment.captured",
                    payload={"status": "captured"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="CAPTURED",
                expected_http_status=200,
                expected_outbox_event="RESOLVE_INTENT",
                expected_idempotent=True,
            ),
        ),
        # 19. IMPOSSIBLE_STATE_TRANSITION
        Scenario(
            scenario_id="scen_19_impossible_transition",
            scenario_type="IMPOSSIBLE_STATE_TRANSITION",
            title="Impossible State Transition Attempt",
            description="Attempt to directly jump from CREATED to RECONCILED without verification",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.CRITICAL,
            initial_amount=Decimal("10000.00"),
            initial_state="CREATED",
            events=[
                SyntheticEvent(
                    event_type="illegal_state_jump",
                    payload={"target_state": "RECONCILED"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="MANUAL_REVIEW",  # State machine intercepts illegal transition to MANUAL_REVIEW
                expected_http_status=200,
                expected_policy_decision="REJECT",
                expected_financial_mutation=False,
            ),
        ),
        # 20. MANUAL_REVIEW_REQUIRED_CASE
        Scenario(
            scenario_id="scen_20_manual_review",
            scenario_type="MANUAL_REVIEW_REQUIRED_CASE",
            title="Manual Review Required (High-Value Anomaly)",
            description="High value refund request exceeding autonomous cap ₹1,000",
            category=ScenarioCategory.BASELINE,
            risk_level=RiskLevel.HIGH,
            initial_amount=Decimal("5000.00"),
            initial_state="DUPLICATE_SUSPECTED",
            events=[
                SyntheticEvent(
                    event_type="high_value_refund",
                    payload={"amount": "5000.00"},
                ),
            ],
            expected_result=ExpectedResult(
                expected_state="DUPLICATE_SUSPECTED",
                expected_http_status=200,
                expected_policy_decision="MANUAL_REVIEW",  # Policy Engine Rule 7 triggers MANUAL_REVIEW
                expected_financial_mutation=False,
            ),
        ),
    ]
    return scenarios


def get_scenario_by_type(scenario_type: str) -> Scenario:
    """Find a baseline scenario by scenario_type."""
    for scen in get_baseline_scenarios():
        if scen.scenario_type == scenario_type or scen.scenario_id == scenario_type:
            return scen
    raise KeyError(f"Baseline scenario not found: {scenario_type}")
