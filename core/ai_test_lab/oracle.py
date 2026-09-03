# FILE: core/ai_test_lab/oracle.py
"""Deterministic Test Oracle (§6, 9).

The Oracle is the sole authority on whether a test scenario PASSES or FAILS.
The AI model CANNOT override the Oracle's evaluation.
"""
from typing import List, Tuple
from core.ai_test_lab.schema import ExpectedResult, Observation, TestStatus


class OracleEvaluationResult:
    def __init__(self, status: TestStatus, discrepancies: List[str], diff_matrix: List[dict]):
        self.status = status
        self.discrepancies = discrepancies
        self.diff_matrix = diff_matrix


def evaluate_scenario_result(
    expected: ExpectedResult,
    actual: Observation,
) -> OracleEvaluationResult:
    """
    Deterministically compare expected vs actual results.
    Produces a status (PASS, FAIL, WARNING), list of discrepancies, and a visual diff matrix.
    """
    discrepancies: List[str] = []
    diff_matrix: List[dict] = []

    # 1. State comparison
    state_match = (expected.expected_state == actual.actual_state)
    diff_matrix.append({
        "field": "Payment State",
        "expected": expected.expected_state,
        "actual": actual.actual_state or "NONE",
        "match": state_match,
        "critical": True,
    })
    if not state_match:
        discrepancies.append(
            f"State mismatch: expected '{expected.expected_state}', got '{actual.actual_state or 'NONE'}'"
        )

    # 2. HTTP Status
    http_match = (expected.expected_http_status == actual.actual_http_status)
    diff_matrix.append({
        "field": "HTTP Response Status",
        "expected": expected.expected_http_status,
        "actual": actual.actual_http_status,
        "match": http_match,
        "critical": False,
    })
    if not http_match:
        discrepancies.append(
            f"HTTP status mismatch: expected {expected.expected_http_status}, got {actual.actual_http_status}"
        )

    # 3. Policy Decision (if checked)
    if expected.expected_policy_decision is not None:
        pol_match = (expected.expected_policy_decision == actual.actual_policy_decision)
        diff_matrix.append({
            "field": "Policy Gate Decision",
            "expected": expected.expected_policy_decision,
            "actual": actual.actual_policy_decision or "NONE",
            "match": pol_match,
            "critical": True,
        })
        if not pol_match:
            discrepancies.append(
                f"Policy decision mismatch: expected '{expected.expected_policy_decision}', got '{actual.actual_policy_decision or 'NONE'}'"
            )

    # 4. Outbox Event (if checked)
    if expected.expected_outbox_event is not None:
        outbox_match = (expected.expected_outbox_event == actual.actual_outbox_event)
        diff_matrix.append({
            "field": "Outbox Task Enqueued",
            "expected": expected.expected_outbox_event,
            "actual": actual.actual_outbox_event or "NONE",
            "match": outbox_match,
            "critical": False,
        })
        if not outbox_match:
            discrepancies.append(
                f"Outbox event mismatch: expected '{expected.expected_outbox_event}', got '{actual.actual_outbox_event or 'NONE'}'"
            )

    # 5. Idempotency Check
    idem_match = (expected.expected_idempotent == actual.actual_idempotent)
    diff_matrix.append({
        "field": "Idempotent Behavior",
        "expected": expected.expected_idempotent,
        "actual": actual.actual_idempotent,
        "match": idem_match,
        "critical": True,
    })
    if not idem_match:
        discrepancies.append(
            f"Idempotency violation: expected idempotent={expected.expected_idempotent}, got {actual.actual_idempotent}"
        )

    # 6. Financial Mutation Check (CRITICAL SAFETY INVARIANT)
    mutation_match = (expected.expected_financial_mutation == actual.actual_financial_mutation)
    diff_matrix.append({
        "field": "Financial Mutation",
        "expected": expected.expected_financial_mutation,
        "actual": actual.actual_financial_mutation,
        "match": mutation_match,
        "critical": True,
    })
    if not mutation_match:
        discrepancies.append(
            f"Financial safety violation! Unexpected mutation: expected {expected.expected_financial_mutation}, got {actual.actual_financial_mutation}"
        )

    # Determine overall status
    has_critical_failure = any(not item["match"] for item in diff_matrix if item["critical"])
    has_any_failure = len(discrepancies) > 0

    if has_critical_failure:
        status = TestStatus.FAIL
    elif has_any_failure:
        status = TestStatus.WARNING
    else:
        status = TestStatus.PASS

    return OracleEvaluationResult(
        status=status,
        discrepancies=discrepancies,
        diff_matrix=diff_matrix,
    )
