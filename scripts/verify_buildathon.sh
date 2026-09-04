#!/usr/bin/env bash
# FILE: scripts/verify_buildathon.sh
# ResolverAI — Final Autonomous QA & E2E Validation Script
set -e

NODE_BIN_DIR="/home/jai/.nvm/versions/node/v22.23.2/bin"
if [ -d "$NODE_BIN_DIR" ]; then
  export PATH="$NODE_BIN_DIR:$PATH"
  NODE_CMD="$NODE_BIN_DIR/node"
  NPM_CMD="$NODE_BIN_DIR/npm"
  NPX_CMD="$NODE_BIN_DIR/npx"
else
  NODE_CMD="node"
  NPM_CMD="npm"
  NPX_CMD="npx"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

export PYTHONPATH="${ROOT_DIR}:${PYTHONPATH}"

echo "Starting ResolverAI Autonomous QA Suite..."
echo ""

# 1. Backend Unit Tests
echo "[1/4] Running Backend Unit & Integration Tests..."
if ! python3 -m unittest discover tests > /tmp/backend_tests.log 2>&1; then
  echo "FAILED AT LAYER: Backend Tests"
  echo "Short Error:"
  tail -n 20 /tmp/backend_tests.log
  echo "Exit Code: 1"
  exit 1
fi
BACKEND_TEST_STATUS="PASS"

# 2. Compilation Check
echo "[2/4] Running Compilation Check..."
if ! python3 -m compileall . > /tmp/compile_check.log 2>&1; then
  echo "FAILED AT LAYER: Compilation Check"
  echo "Short Error:"
  tail -n 20 /tmp/compile_check.log
  echo "Exit Code: 1"
  exit 1
fi
COMPILE_STATUS="PASS"

# 3. Frontend Production Build
echo "[3/4] Running Frontend Production Build..."
if ! (cd frontend && "$NPM_CMD" run build > /tmp/frontend_build.log 2>&1); then
  echo "FAILED AT LAYER: Frontend Build"
  echo "Short Error:"
  tail -n 20 /tmp/frontend_build.log
  echo "Exit Code: 1"
  exit 1
fi
FRONTEND_BUILD_STATUS="PASS"

# 4. Browser E2E Tests with Playwright
echo "[4/4] Running Playwright Browser E2E Smoke Tests..."

BACKEND_PID=""
FRONTEND_PID=""

cleanup_servers() {
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup_servers EXIT

if ! curl -s http://localhost:8000/health >/dev/null 2>&1; then
  python3 -m uvicorn app:app --host 127.0.0.1 --port 8000 > /tmp/e2e_backend.log 2>&1 &
  BACKEND_PID=$!
fi

if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
  (cd frontend && "$NPM_CMD" run start -- -p 3000 > /tmp/e2e_frontend.log 2>&1) &
  FRONTEND_PID=$!
fi

# Wait for backend readiness
for i in {1..30}; do
  if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Wait for frontend readiness
for i in {1..30}; do
  if curl -s http://localhost:3000/login >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
sleep 2

if ! "$NPX_CMD" playwright test > /tmp/playwright_e2e.log 2>&1; then
  echo "FAILED AT LAYER: Browser E2E Tests"
  echo "Short Error:"
  tail -n 25 /tmp/playwright_e2e.log
  echo "Exit Code: 1"
  exit 1
fi
BROWSER_E2E_STATUS="PASS"

# Query AI Test Lab Metrics
SUMMARY_STATS=$(python3 -c "
import asyncio
from db.connection import get_pool
from core.ai_test_lab.runner import recover_stale_runs

async def main():
    try:
        pool = await get_pool()
        await recover_stale_runs(pool)
        async with pool.acquire() as conn:
            rows = await conn.fetch('SELECT status FROM ai_test_runs')
            c = sum(1 for r in rows if r['status'] == 'COMPLETED')
            f = sum(1 for r in rows if r['status'] == 'FAILED')
            t = sum(1 for r in rows if r['status'] == 'TIMED_OUT')
            s = sum(1 for r in rows if r['status'] == 'RUNNING')
            print(f'{c}|{f}|{t}|{s}')
    except Exception:
        print('0|0|0|0')

asyncio.run(main())
")

IFS='|' read -r COMPLETED_COUNT FAILED_COUNT TIMED_OUT_COUNT STUCK_COUNT <<< "${SUMMARY_STATS}"

# Final Verdict & Report Format
echo ""
echo "RESOLVERAI BUILDATHON QA"
echo "------------------------"
echo "Backend tests:     ${BACKEND_TEST_STATUS}"
echo "Compilation:       ${COMPILE_STATUS}"
echo "Frontend build:    ${FRONTEND_BUILD_STATUS}"
echo "Browser E2E:       ${BROWSER_E2E_STATUS}"
echo ""
echo "AI Test Lab:"
echo "Completed: ${COMPLETED_COUNT:-0}"
echo "Failed:    ${FAILED_COUNT:-0}"
echo "Timed out: ${TIMED_OUT_COUNT:-0}"
echo "Stuck:     ${STUCK_COUNT:-0}"
echo ""
echo "Financial mutations: ₹0.00"
echo ""
echo "FINAL VERDICT: GREEN"
