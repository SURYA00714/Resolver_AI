# FILE: api/ai_test_lab_routes.py
"""API endpoints for the AI Test Lab (§12).

Prefix: /ai-test-lab
"""
import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

import asyncpg
import config
from agents.ai_providers import get_provider
from core.ai_test_lab.generator import generate_ai_scenarios
from core.ai_test_lab.isolation import (
    ProductionEnvironmentLockedError,
    check_test_environment_safety,
)
from core.ai_test_lab.runner import (
    request_stop_run,
    run_demo_suite,
    run_scenario,
    run_test_suite,
)
from core.ai_test_lab.scenarios import get_baseline_scenarios, get_scenario_by_type
from core.ai_test_lab.schema import RiskLevel, ScenarioCategory, TestStatus
from core.rbac import require_permission
from db.connection import get_pool

router = APIRouter(prefix="/ai-test-lab", tags=["ai-test-lab"])

ENGINEERING_BANNER = {
    "test_mode": True,
    "isolated_environment": True,
    "no_real_money": True,
    "provenance": "LOCAL_AI_SIMULATION",
}


def _check_test_lab_environment():
    """Refuse execution if environment is production."""
    try:
        check_test_environment_safety()
    except ProductionEnvironmentLockedError as e:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "production_environment_locked",
                "message": str(e),
                "banner": "AI TEST LAB LOCKED — LIVE ENVIRONMENT DETECTED",
            },
        )


@router.get("/status", summary="Get AI Test Lab Engine Status")
async def get_test_lab_status(user: dict = Depends(require_permission("read:dashboard"))):
    """
    Get current AI Test Lab operational status, mode, active provider, and summary metrics.
    """
    is_locked = (str(config.ENVIRONMENT).lower() == "production")
    provider = get_provider()

    pool = await get_pool()
    async with pool.acquire() as conn:
        latest_run = await conn.fetchrow(
            """SELECT run_id, run_type, status, scenarios_total, scenarios_passed,
                      scenarios_failed, scenarios_warning, risk_level, started_at, completed_at
               FROM ai_test_runs ORDER BY started_at DESC LIMIT 1"""
        )
        totals = await conn.fetchrow(
            """SELECT COUNT(*) as total_runs,
                      COALESCE(SUM(scenarios_total), 0) as total_scenarios,
                      COALESCE(SUM(scenarios_passed), 0) as total_passed,
                      COALESCE(SUM(scenarios_failed), 0) as total_failed,
                      COALESCE(SUM(scenarios_warning), 0) as total_warning
               FROM ai_test_runs"""
        )

    latest_data = None
    if latest_run:
        latest_data = {
            "run_id": str(latest_run["run_id"]),
            "run_type": latest_run["run_type"],
            "status": latest_run["status"],
            "scenarios_total": latest_run["scenarios_total"],
            "scenarios_passed": latest_run["scenarios_passed"],
            "scenarios_failed": latest_run["scenarios_failed"],
            "scenarios_warning": latest_run["scenarios_warning"],
            "risk_level": latest_run["risk_level"],
            "started_at": latest_run["started_at"].isoformat() if latest_run["started_at"] else None,
            "completed_at": latest_run["completed_at"].isoformat() if latest_run["completed_at"] else None,
        }

    return {
        "_banner": ENGINEERING_BANNER,
        "test_mode": True,
        "isolated_environment": True,
        "locked": is_locked,
        "environment": config.ENVIRONMENT,
        "ai_tester_status": "IDLE",
        "active_ai_provider": provider.provider_name,
        "razorpay_mode": config.RAZORPAY_MODE,
        "totals": {
            "total_runs": totals["total_runs"] if totals else 0,
            "total_scenarios": totals["total_scenarios"] if totals else 0,
            "total_passed": totals["total_passed"] if totals else 0,
            "total_failed": totals["total_failed"] if totals else 0,
            "total_warning": totals["total_warning"] if totals else 0,
        },
        "latest_run": latest_data,
    }


@router.get("/scenarios", summary="Get Scenario Library")
async def get_scenarios(user: dict = Depends(require_permission("read:dashboard"))):
    """
    Get list of all baseline and predefined test scenarios.
    """
    baselines = get_baseline_scenarios()
    return {
        "count": len(baselines),
        "scenarios": [
            {
                "scenario_id": s.scenario_id,
                "scenario_type": s.scenario_type,
                "title": s.title,
                "description": s.description,
                "category": s.category.value,
                "risk_level": s.risk_level.value,
                "initial_amount": str(s.initial_amount),
                "currency": s.currency,
                "initial_state": s.initial_state,
                "expected_state": s.expected_result.expected_state,
                "events_count": len(s.events),
            }
            for s in baselines
        ],
    }


@router.post("/run", summary="Execute Test Suite / Buildathon Demo")
async def execute_test_run(
    payload: Optional[Dict[str, Any]] = None,
    user: dict = Depends(require_permission("write:reconcile")),
):
    """
    Execute a single scenario, a selection of scenarios, or the official BUILDATHON DEMO suite.
    """
    _check_test_lab_environment()

    payload = payload or {}
    run_mode = payload.get("mode", "BASELINE").upper()
    scenario_type = payload.get("scenario_type")

    if run_mode == "DEMO" or payload.get("demo") is True:
        test_run = await run_demo_suite()
        return {
            "_banner": ENGINEERING_BANNER,
            "run": test_run.dict(),
            "message": "BUILDATHON DEMO RUN executed successfully.",
        }

    baselines = get_baseline_scenarios()

    if scenario_type:
        selected = [s for s in baselines if s.scenario_type == scenario_type or s.scenario_id == scenario_type]
        if not selected:
            raise HTTPException(status_code=404, detail=f"Scenario type '{scenario_type}' not found.")
    elif "scenario_ids" in payload:
        s_ids = set(payload["scenario_ids"])
        selected = [s for s in baselines if s.scenario_id in s_ids or s.scenario_type in s_ids]
    else:
        selected = baselines

    test_run = await run_test_suite(selected, run_type=run_mode, created_by=user.get("sub", "OPERATOR"))
    return {
        "_banner": ENGINEERING_BANNER,
        "run": test_run.dict(),
    }


@router.post("/run/{run_id}/stop", summary="Stop Ongoing Test Run")
async def stop_test_run(
    run_id: str,
    user: dict = Depends(require_permission("write:reconcile")),
):
    """Gracefully request stopping an active test run."""
    _check_test_lab_environment()
    request_stop_run(run_id)
    return {"status": "STOP_REQUESTED", "run_id": run_id}


@router.get("/runs", summary="Get Historical Test Runs")
async def get_test_runs(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_permission("read:dashboard")),
):
    """List historical test runs."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT run_id, run_type, status, scenarios_total, scenarios_passed,
                      scenarios_failed, scenarios_warning, risk_level, started_at, completed_at, created_by, provenance
               FROM ai_test_runs ORDER BY started_at DESC LIMIT $1""",
            limit
        )

    runs = [
        {
            "run_id": str(r["run_id"]),
            "run_type": r["run_type"],
            "status": r["status"],
            "scenarios_total": r["scenarios_total"],
            "scenarios_passed": r["scenarios_passed"],
            "scenarios_failed": r["scenarios_failed"],
            "scenarios_warning": r["scenarios_warning"],
            "risk_level": r["risk_level"],
            "started_at": r["started_at"].isoformat() if r["started_at"] else None,
            "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            "created_by": r["created_by"],
            "provenance": r["provenance"],
        }
        for r in rows
    ]

    return {"runs": runs}


@router.get("/runs/{run_id}", summary="Get Test Run Details")
async def get_test_run_details(
    run_id: str,
    user: dict = Depends(require_permission("read:dashboard")),
):
    """Get details of a specific test run and all scenario results."""
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run_id UUID format.")

    pool = await get_pool()
    async with pool.acquire() as conn:
        run_row = await conn.fetchrow(
            "SELECT * FROM ai_test_runs WHERE run_id = $1", run_uuid
        )
        if not run_row:
            raise HTTPException(status_code=404, detail="Test run not found.")

        result_rows = await conn.fetch(
            "SELECT * FROM ai_test_results WHERE run_id = $1 ORDER BY created_at ASC", run_uuid
        )

    results = []
    for r in result_rows:
        results.append({
            "result_id": str(r["result_id"]),
            "run_id": str(r["run_id"]),
            "scenario_id": r["scenario_id"],
            "scenario_type": r["scenario_type"],
            "category": r["category"],
            "risk_level": r["risk_level"],
            "status": r["status"],
            "expected_result": json.loads(r["expected_result"]) if isinstance(r["expected_result"], str) else r["expected_result"],
            "actual_result": json.loads(r["actual_result"]) if isinstance(r["actual_result"], str) else r["actual_result"],
            "trace": json.loads(r["trace"]) if isinstance(r["trace"], str) else r["trace"],
            "ai_analysis": json.loads(r["ai_analysis"]) if r["ai_analysis"] else None,
            "provenance": r["provenance"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })

    return {
        "run": {
            "run_id": str(run_row["run_id"]),
            "run_type": run_row["run_type"],
            "status": run_row["status"],
            "scenarios_total": run_row["scenarios_total"],
            "scenarios_passed": run_row["scenarios_passed"],
            "scenarios_failed": run_row["scenarios_failed"],
            "scenarios_warning": run_row["scenarios_warning"],
            "risk_level": run_row["risk_level"],
            "started_at": run_row["started_at"].isoformat() if run_row["started_at"] else None,
            "completed_at": run_row["completed_at"].isoformat() if run_row["completed_at"] else None,
            "created_by": run_row["created_by"],
            "provenance": run_row["provenance"],
        },
        "results": results,
    }


@router.get("/results/{result_id}", summary="Get Scenario Result Trace")
async def get_test_result_by_id(
    result_id: str,
    user: dict = Depends(require_permission("read:dashboard")),
):
    """Get single scenario result detail including trace and AI analysis."""
    try:
        res_uuid = uuid.UUID(result_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid result_id UUID format.")

    pool = await get_pool()
    async with pool.acquire() as conn:
        r = await conn.fetchrow(
            "SELECT * FROM ai_test_results WHERE result_id = $1", res_uuid
        )
        if not r:
            raise HTTPException(status_code=404, detail="Test result not found.")

    return {
        "result_id": str(r["result_id"]),
        "run_id": str(r["run_id"]),
        "scenario_id": r["scenario_id"],
        "scenario_type": r["scenario_type"],
        "category": r["category"],
        "risk_level": r["risk_level"],
        "status": r["status"],
        "expected_result": json.loads(r["expected_result"]) if isinstance(r["expected_result"], str) else r["expected_result"],
        "actual_result": json.loads(r["actual_result"]) if isinstance(r["actual_result"], str) else r["actual_result"],
        "trace": json.loads(r["trace"]) if isinstance(r["trace"], str) else r["trace"],
        "ai_analysis": json.loads(r["ai_analysis"]) if r["ai_analysis"] else None,
        "provenance": r["provenance"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


@router.post("/generate", summary="Generate AI Scenarios")
async def generate_scenarios_api(
    payload: Optional[Dict[str, Any]] = None,
    user: dict = Depends(require_permission("write:reconcile")),
):
    """
    Generate new structured scenarios via AI / deterministic generator.
    """
    _check_test_lab_environment()

    payload = payload or {}
    count = int(payload.get("count", 5))
    count = min(max(count, 1), 15)  # bounded between 1 and 15

    scenarios = await generate_ai_scenarios(count=count, category="ADVERSARIAL")
    return {
        "_banner": ENGINEERING_BANNER,
        "count": len(scenarios),
        "scenarios": [
            {
                "scenario_id": s.scenario_id,
                "scenario_type": s.scenario_type,
                "title": s.title,
                "description": s.description,
                "category": s.category.value,
                "risk_level": s.risk_level.value,
                "initial_amount": str(s.initial_amount),
                "currency": s.currency,
                "initial_state": s.initial_state,
                "expected_state": s.expected_result.expected_state,
            }
            for s in scenarios
        ],
    }


@router.post("/adversarial-run", summary="Run AI Adversarial Test Suite")
async def run_adversarial_suite(
    payload: Optional[Dict[str, Any]] = None,
    user: dict = Depends(require_permission("write:reconcile")),
):
    """
    Execute an autonomous AI Adversarial Test Run (10-25 scenarios).
    """
    _check_test_lab_environment()

    payload = payload or {}
    count = int(payload.get("count", 10))
    count = min(max(count, 5), 25)  # max scenario count bounded to 25

    generated_scens = await generate_ai_scenarios(count=count, category="ADVERSARIAL")
    test_run = await run_test_suite(
        generated_scens,
        run_type="ADVERSARIAL",
        created_by=user.get("sub", "AI_ADVERSARIAL_TESTER"),
    )

    return {
        "_banner": ENGINEERING_BANNER,
        "run": test_run.dict(),
    }
