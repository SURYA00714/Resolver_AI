# FILE: tests/test_chaos_routes.py
"""Test Chaos Lab endpoints API contract."""
import unittest
from fastapi.testclient import TestClient
from app import app
import config


class TestChaosLabRoutesContract(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)
        self.original_env = config.ENVIRONMENT
        config.ENVIRONMENT = "development"

    def tearDown(self):
        config.ENVIRONMENT = self.original_env

    def test_chaos_late_auth_route(self):
        """Test late-auth endpoint contract (route exists, not 404)."""
        response = self.client.post("/engineering/chaos/late-auth")
        self.assertNotEqual(response.status_code, 404)

    def test_chaos_delayed_webhook_route_alias(self):
        """Test delayed_webhook alias endpoint contract (route exists, not 404)."""
        response = self.client.post("/engineering/chaos/delayed_webhook")
        self.assertNotEqual(response.status_code, 404)

    def test_chaos_duplicate_webhook_route_alias(self):
        """Test duplicate_webhook alias endpoint contract (route exists, not 404)."""
        response = self.client.post("/engineering/chaos/duplicate_webhook")
        self.assertNotEqual(response.status_code, 404)

    def test_chaos_tampered_signature_route_alias(self):
        """Test tampered_signature alias endpoint contract (route exists, not 404)."""
        response = self.client.post("/engineering/chaos/tampered_signature")
        self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
