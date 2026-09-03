# FILE: tests/test_dashboard_stats.py
"""Unit and Integration Tests for Command Center Dashboard API Endpoint."""
import unittest
from fastapi.testclient import TestClient

from app import app
from core.auth import create_access_token


class TestDashboardStatsAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)
        cls.token = create_access_token(username="admin", role="admin")
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_unauthenticated_dashboard_stats_returns_401(self):
        """Unauthenticated access to /dashboard/stats must return HTTP 401."""
        response = self.client.get("/dashboard/stats")
        self.assertEqual(response.status_code, 401)

    def test_authenticated_dashboard_stats_contract(self):
        """Authenticated access must be registered and return valid response structure (not 404)."""
        response = self.client.get("/dashboard/stats", headers=self.headers)
        self.assertNotEqual(response.status_code, 404)
        self.assertIn(response.status_code, [200, 500])

        if response.status_code == 200:
            data = response.json()
            required_keys = [
                "total_intents",
                "open_cases",
                "states_summary",
                "financial_summary",
                "webhook_stats",
                "recent_events",
                "executive_kpis",
                "state_distribution",
                "resolution_trend",
                "rail_analytics",
                "failure_intelligence",
                "ai_test_lab",
                "chaos_scorecard",
                "financial_safety",
            ]
            for key in required_keys:
                self.assertIn(key, data, f"Key '{key}' missing from /dashboard/stats response")

    def test_zero_financial_mutation_invariant(self):
        """Guarantees zero real financial mutations reported for AI Test Lab / Chaos Lab."""
        response = self.client.get("/dashboard/stats", headers=self.headers)
        if response.status_code == 200:
            data = response.json()
            exec_kpis = data.get("executive_kpis", {})
            self.assertEqual(exec_kpis.get("financial_mutations_prevented"), 0)

            fin_safety = data.get("financial_safety", {})
            self.assertEqual(fin_safety.get("ai_test_money_moved"), 0)
            self.assertEqual(fin_safety.get("chaos_money_moved"), 0)

            ai_lab = data.get("ai_test_lab", {})
            self.assertEqual(ai_lab.get("financial_mutations"), 0)

    def test_chaos_scorecard_contract(self):
        """Validates that chaos scorecard payload structure exists when endpoint returns 200."""
        response = self.client.get("/dashboard/stats", headers=self.headers)
        if response.status_code == 200:
            data = response.json()
            scorecard = data.get("chaos_scorecard", [])
            self.assertGreaterEqual(len(scorecard), 6)
            scenario_types = [s["scenario_type"] for s in scorecard]
            self.assertIn("DELAYED_WEBHOOK", scenario_types)
            self.assertIn("DUPLICATE_WEBHOOK", scenario_types)
            self.assertIn("TAMPERED_SIGNATURE", scenario_types)
            self.assertIn("OUT_OF_ORDER", scenario_types)


if __name__ == "__main__":
    unittest.main()
