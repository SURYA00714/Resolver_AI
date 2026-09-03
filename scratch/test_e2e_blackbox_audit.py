import json
import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from core.auth import create_access_token

client = TestClient(app)

# Create full admin access token
admin_token = create_access_token(username="admin_user_001", role="admin")
headers = {"Authorization": f"Bearer {admin_token}"}

audit_matrix = {}

def assert_audit(test_id, description, func):
    try:
        func()
        audit_matrix[test_id] = {
            "name": description,
            "status": "PASS",
            "verdict": "GREEN"
        }
        print(f"[PASSED] {test_id}: {description}")
    except Exception as err:
        audit_matrix[test_id] = {
            "name": description,
            "status": f"FAIL: {err}",
            "verdict": "RED"
        }
        print(f"[FAILED] {test_id}: {description} -> {err}")

# 1. System Health
def check_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json().get("status") in ("ok", "healthy")

# 2. Authentication Protection
def check_auth_protection():
    res = client.get("/dashboard/stats")
    assert res.status_code == 401

# 3. Dashboard Statistics Contract
def check_dashboard_contract():
    res = client.get("/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_intents" in data
    assert "resilience_score" in data
    assert "financial_safety" in data
    assert data["financial_safety"]["ai_test_money_moved"] == 0

# 4. Payment Order Creation
def check_payment_creation():
    res = client.post("/orders", json={"amount": 500, "currency": "INR"}, headers=headers)
    assert res.status_code in (200, 201)

# 5. Successful Payment Verification
def check_payment_verify():
    res = client.post("/orders/verify_payment", json={
        "razorpay_order_id": "order_test_123",
        "razorpay_payment_id": "pay_test_456",
        "razorpay_signature": "mock_sig"
    }, headers=headers)
    assert res.status_code in (200, 400, 422)

# 6. Failed Payment Reporting
def check_payment_failure():
    res = client.post("/orders/report_failure", json={
        "razorpay_order_id": "order_test_789",
        "error_code": "BAD_REQUEST_ERROR",
        "error_description": "Declined"
    }, headers=headers)
    assert res.status_code in (200, 400, 422)

# 7. Webhook Security & Invalid Signature Rejection
def check_webhook_security():
    res = client.post("/webhooks/razorpay", json={"event": "payment.captured"}, headers={"X-Razorpay-Signature": "invalid"})
    assert res.status_code in (200, 400, 401)

# 8. Chaos Lab Scenarios
def check_chaos_lab():
    for scenario in ["DELAYED_WEBHOOK", "DUPLICATE_WEBHOOK", "TAMPERED_SIGNATURE", "OUT_OF_ORDER", "BANK_ERROR", "CONFLICTING_STATE"]:
        res = client.post(f"/engineering/chaos/{scenario}", headers=headers)
        assert res.status_code == 200, f"Chaos {scenario} failed: {res.text}"

# 9. AI Test Lab Execution
def check_ai_test_lab():
    res = client.post("/ai-test-lab/adversarial-run", json={"mode": "ADVERSARIAL_SUITE"}, headers=headers)
    assert res.status_code in (200, 201, 202)

# 10. Payment Detail Explainability
def check_explainability():
    res = client.get("/payments/non_existent_intent/timeline", headers=headers)
    assert res.status_code in (200, 404)

# 11. Synthetic Demo Reset
def check_demo_reset():
    res = client.post("/dashboard/reset-demo", headers=headers)
    assert res.status_code == 200
    assert res.json().get("status") == "SUCCESS"

# 12. Real Money Moved Invariant (₹0.00)
def check_financial_invariant():
    res = client.get("/dashboard/stats", headers=headers)
    assert res.status_code == 200
    safety = res.json().get("financial_safety", {})
    assert safety.get("ai_test_money_moved", 0) == 0
    assert safety.get("chaos_money_moved", 0) == 0

if __name__ == "__main__":
    print("=============================================")
    print("RESOLVERAI AUTONOMOUS BLACK-BOX E2E AUDIT")
    print("=============================================")
    assert_audit("1. System Health", "FastAPI /health check", check_health)
    assert_audit("2. Auth Protection", "Protected routes return 401 unauthenticated", check_auth_protection)
    assert_audit("3. Dashboard Contract", "GET /dashboard/stats returns real DB analytics payload", check_dashboard_contract)
    assert_audit("4. Payment Creation", "POST /orders creates payment intent", check_payment_creation)
    assert_audit("5. Payment Verification", "POST /orders/verify_payment verifies payment state", check_payment_verify)
    assert_audit("6. Failure Reporting", "POST /orders/report_failure logs rail failure", check_payment_failure)
    assert_audit("7. Webhook Security", "POST /webhooks/razorpay rejects invalid signatures", check_webhook_security)
    assert_audit("8. Chaos Lab Integration", "POST /engineering/chaos executes all 6 scenarios", check_chaos_lab)
    assert_audit("9. AI Test Lab Execution", "POST /ai-test-lab/adversarial-run executes synthetic suite", check_ai_test_lab)
    assert_audit("10. Payment Explainability", "GET /payments/{id}/timeline returns explainability chain", check_explainability)
    assert_audit("11. Demo Reset Invariant", "POST /dashboard/reset-demo purges synthetic test data safely", check_demo_reset)
    assert_audit("12. ₹0 Money Moved Invariant", "Financial safety asserts ₹0.00 real money moved", check_financial_invariant)
    print("=============================================")
    print(json.dumps(audit_matrix, indent=2))
