#!/usr/bin/env bash
# ResolverAI — Single Command Startup Script
set -e

# Export PYTHONPATH to ensure all python packages (uvicorn, redis, asyncpg, fastapi, etc.) are resolved
export PYTHONPATH="/usr/lib/python3/dist-packages:/home/jai/.local/lib/python3.12/site-packages:$PYTHONPATH"

echo "=== 1. Checking PostgreSQL & Redis services ==="
docker compose up -d 2>/dev/null || echo "[INFO] Using running PostgreSQL/Redis services."

echo "=== 2. Starting FastAPI Backend (Port 8000) ==="
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "=== 3. Starting Durable Outbox Worker ==="
python3 worker.py &
WORKER_PID=$!

echo "=== 4. Starting Next.js Merchant Control Plane (Port 3000) ==="
(cd frontend && npm install --legacy-peer-deps && npm run dev -- -p 3000) &
FRONTEND_PID=$!

echo "========================================================"
echo "ResolverAI Control Plane is live!"
echo "Next.js Frontend: http://localhost:3000"
echo "FastAPI OpenAPI:  http://localhost:8000/docs"
echo "========================================================"

wait $BACKEND_PID $WORKER_PID $FRONTEND_PID
