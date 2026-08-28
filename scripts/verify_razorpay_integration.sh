#!/usr/bin/env bash
# ResolverAI — Razorpay Integration Verifier
# Checks environment variables and validates Razorpay API credentials.

API_URL="${API_URL:-http://localhost:8000}"

echo "========================================================"
echo "ResolverAI — Razorpay Integration Diagnostic"
echo "========================================================"

# Check local backend response
if ! curl -sf "${API_URL}/health" > /dev/null; then
  echo "❌ Backend at ${API_URL} is NOT reachable."
  echo "   Start backend first: python3 -m uvicorn app:app --port 8000"
  exit 1
fi

echo "[1/2] Fetching integration health snapshot from backend..."
RESPONSE=$(curl -sf "${API_URL}/integrations/health")
echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"

echo ""
echo "[2/2] Mode & Credentials Summary:"
RAZORPAY_STATUS=$(echo "${RESPONSE}" | grep -o '"status": "[^"]*"' | head -1)
echo "  Razorpay Status: ${RAZORPAY_STATUS:-UNKNOWN}"

if echo "${RESPONSE}" | grep -q '"NOT_CONFIGURED"'; then
  echo ""
  echo "⚠️ Razorpay credentials are NOT configured."
  echo "   To enable real Razorpay API calls, set in .env:"
  echo "   RAZORPAY_KEY_ID=rzp_test_..."
  echo "   RAZORPAY_KEY_SECRET=..."
elif echo "${RESPONSE}" | grep -q '"CONNECTED"'; then
  echo ""
  echo "✅ Razorpay API connection is LIVE and VERIFIED."
else
  echo ""
  echo "ℹ️ System running in ${RAZORPAY_STATUS:-SYNTHETIC} mode."
fi

echo "========================================================"
