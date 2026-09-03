# FILE: tests/test_ai_test_lab.py
"""Automated Unit & Integration Tests for AI Test Lab (§18)."""
import asyncio
import os
import unittest
from decimal import Decimal

import config
from db.connection import check_db
from core.ai_test_lab.generator import (
    SecurityValidationError,
    validate_ai_scenario_schema,
)
from core.ai_test_lab.isolation import (
    ProductionEnvironmentLockedError,
    check_test_environment_safety,
    generate_synthetic_intent_id,
    generate_synthetic_order_id,
    generate_synthetic_payment_id,
    validate_synthetic_id,
)
from core.ai_test_lab.oracle import evaluate_scenario_result
from core.ai_test_lab.runner import run_demo_suite, run_scenario
from core.ai_test_lab.scenarios import get_baseline_scenarios, get_scenario_by_type
from core.ai_test_lab.schema import (
    ExpectedResult,
    Observation,
    RiskLevel,
    TestStatus,
)


class TestAITestLabIsolation(unittest.TestCase):

    def test_production_environment_blocking(self):
        """Verify that live production environment blocks AI Test Lab execution."""
        original_env = config.ENVIRONMENT
        try:
            config.ENVIRONMENT = "production"
            with self.assertRaises(ProductionEnvironmentLockedError):
                check_test_environment_safety()
        finally:
            config.ENVIRONMENT = original_env

    def test_synthetic_id_enforcement(self):
        """Verify synthetic ID formatting and validation."""
        intent_id = generate_synthetic_intent_id()
        order_id = generate_synthetic_order_id()
        payment_id = generate_synthetic_payment_id()

        self.assertTrue(validate_synthetic_id(intent_id))
        self.assertTrue(validate_synthetic_id(order_id))
        self.assertTrue(validate_synthetic_id(payment_id))
        self.assertIn("order_aitest_", order_id)
        self.assertIn("pay_aitest_", payment_id)

        # Non-synthetic real IDs must fail validation if formatted without test tag
        self.assertFalse(validate_synthetic_id("order_real_9999999"))


class TestDeterministicOracle(unittest.TestCase):

    def test_oracle_pass_evaluation(self):
        """Verify deterministic oracle returns PASS on matching expected vs actual."""
        expected = ExpectedResult(
            expected_state="CAPTURED",
            expected_http_status=200,
            expected_idempotent=True,
            expected_financial_mutation=False,
        )
        actual = Observation(
            actual_state="CAPTURED",
            actual_http_status=200,
            actual_idempotent=True,
            actual_financial_mutation=False,
        )
        res = evaluate_scenario_result(expected, actual)
        self.assertEqual(res.status, TestStatus.PASS)
        self.assertEqual(len(res.discrepancies), 0)

    def test_oracle_fail_on_state_mismatch(self):
        """Verify deterministic oracle returns FAIL on state mismatch."""
        expected = ExpectedResult(
            expected_state="CAPTURED",
            expected_http_status=200,
        )
        actual = Observation(
            actual_state="FAILED",
            actual_http_status=200,
        )
        res = evaluate_scenario_result(expected, actual)
        self.assertEqual(res.status, TestStatus.FAIL)
        self.assertIn("State mismatch", res.discrepancies[0])

    def test_oracle_fail_on_unexpected_financial_mutation(self):
        """Verify deterministic oracle returns FAIL if unexpected financial mutation occurs."""
        expected = ExpectedResult(
            expected_state="CAPTURED",
            expected_financial_mutation=False,
        )
        actual = Observation(
            actual_state="CAPTURED",
            actual_financial_mutation=True,  # Safety Violation!
        )
        res = evaluate_scenario_result(expected, actual)
        self.assertEqual(res.status, TestStatus.FAIL)
        self.assertIn("Financial safety violation", res.discrepancies[0])


class TestAIScenarioGeneratorSecurity(unittest.TestCase):

    def test_valid_ai_scenario_accepted(self):
        """Verify clean scenario dictionary passes security validation."""
        valid_dict = {
            "scenario_type": "ADV_DOUBLE_CAPTURE",
            "title": "Double capture test",
            "events": [{"event_type": "payment.captured"}],
        }
        # Should not raise exception
        validate_ai_scenario_schema(valid_dict)

    def test_sql_injection_rejected(self):
        """Verify AI scenario containing SQL commands is rejected."""
        bad_dict = {
            "scenario_type": "SQL_TEST",
            "title": "Drop database attempt",
            "description": "SELECT * FROM payment_intents; DROP TABLE payment_intents;",
        }
        with self.assertRaises(SecurityValidationError):
            validate_ai_scenario_schema(bad_dict)

    def test_shell_command_rejected(self):
        """Verify AI scenario containing shell commands is rejected."""
        bad_dict = {
            "scenario_type": "SHELL_TEST",
            "title": "Shell execution",
            "description": "exec(os.system('rm -rf /'))",
        }
        with self.assertRaises(SecurityValidationError):
            validate_ai_scenario_schema(bad_dict)

    def test_live_key_pattern_rejected(self):
        """Verify scenario containing real Razorpay key pattern is rejected."""
        bad_dict = {
            "scenario_type": "KEY_TEST",
            "title": "Live Key Exposure",
            "description": "Using key rzp_live_998877665544",
        }
        with self.assertRaises(SecurityValidationError):
            validate_ai_scenario_schema(bad_dict)


class TestBaselineScenarioLibrary(unittest.TestCase):

    def test_scenario_library_count(self):
        """Verify baseline library contains all 20 required scenarios."""
        scenarios = get_baseline_scenarios()
        self.assertGreaterEqual(len(scenarios), 20)

    def test_scenario_retrieval(self):
        """Verify retrieval by scenario type."""
        scen = get_scenario_by_type("SUCCESS_FLOW")
        self.assertEqual(scen.scenario_type, "SUCCESS_FLOW")
        self.assertEqual(scen.expected_result.expected_state, "CAPTURED")


class TestAITestLabExecution(unittest.TestCase):

    def setUp(self):
        try:
            db_ok = asyncio.run(check_db())
            if not db_ok:
                self.skipTest("Database not ready")
        except Exception:
            self.skipTest("PostgreSQL server offline — skipping DB integration test")

    def test_run_single_scenario(self):
        """Integration test executing single scenario through pipeline."""
        scen = get_scenario_by_type("SUCCESS_FLOW")
        result = asyncio.run(run_scenario(scen, run_id="test_run_001", include_ai_analysis=True))
        self.assertEqual(result.status, TestStatus.PASS)
        self.assertEqual(result.actual_result.actual_state, "CAPTURED")
        self.assertEqual(result.actual_result.actual_financial_mutation, False)
        self.assertGreater(len(result.trace), 0)

    def test_run_demo_suite(self):
        """Integration test executing official Buildathon Demo suite."""
        test_run = asyncio.run(run_demo_suite())
        self.assertEqual(test_run.status.value, "COMPLETED")
        self.assertEqual(test_run.scenarios_total, 8)
        self.assertEqual(len(test_run.results), 8)
        for res in test_run.results:
            self.assertFalse(res.actual_result.actual_financial_mutation)


if __name__ == "__main__":
    unittest.main()
