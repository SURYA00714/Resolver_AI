#!/usr/bin/env bash
# ResolverAI — Smoke Test Suite
# Tests backend health, readiness, integration health, and webhook receiver.

set -e

API_URL="${API_URL:-http://localhost:8000}"

echo "========================================================"
echo "ResolverAI — Running System Smoke Tests"
echo "Target API: ${API_URL}"
echo "========================================================"

echo "[1/5] Testing GET /health..."
HEALTH=$(curl -sf "${API_URL}/health")
echo "  Response: ${HEALTH}"

echo "[2/5] Testing GET /ready..."
READY=$(curl -sf "${API_URL}/ready")
echo "  Response: ${READY}"

echo "[3/5] Testing GET /integrations/health..."
INT_HEALTH=$(curl -sf "${API_URL}/integrations/health")
echo "  Response: ${INT_HEALTH}"

echo "[4/5] Testing GET /dashboard/stats..."
STATS=$(curl -sf "${API_URL}/dashboard/stats")
echo "  Response: ${STATS:0:150}..."

echo "[5/5] Testing POST /webhook legacy route rejection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/webhook")
if [ "${HTTP_CODE}" -eq 400 ]; then
  echo "  ✅ Legacy /webhook route safely rejected with 400 as expected."
else
  echo "  ❌ Legacy /webhook returned ${HTTP_CODE} (expected 400)."
  exit 1
fi

echo "========================================================"
echo "✅ ALL SMOKE TESTS PASSED"
echo "========================================================"
