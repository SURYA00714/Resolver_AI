# FILE: core/ai_test_lab/schema.py
"""Pydantic schema definitions for the AI Test Lab (§2-11)."""
import datetime
import uuid
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScenarioCategory(str, Enum):
    BASELINE = "BASELINE"
    ADVERSARIAL = "ADVERSARIAL"
    AI_GENERATED = "AI_GENERATED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TestStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"


class RunStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    STOPPED = "STOPPED"
    FAILED = "FAILED"


class SyntheticEvent(BaseModel):
    event_type: str
    delay_ms: int = 0
    payload: Dict[str, Any] = Field(default_factory=dict)
    headers: Dict[str, str] = Field(default_factory=dict)
    override_signature: Optional[str] = None  # None for valid, "INVALID" for bad signature, etc.


class ExpectedResult(BaseModel):
    expected_state: str
    expected_http_status: int = 200
    expected_policy_decision: Optional[str] = None  # "APPROVE", "REJECT", "MANUAL_REVIEW"
    expected_outbox_event: Optional[str] = None
    expected_evidence_action: Optional[str] = None
    expected_security_alert: bool = False
    expected_idempotent: bool = True
    expected_financial_mutation: bool = False


class Observation(BaseModel):
    actual_state: Optional[str] = None
    actual_http_status: int = 200
    actual_policy_decision: Optional[str] = None
    actual_outbox_event: Optional[str] = None
    actual_evidence_action: Optional[str] = None
    actual_security_alert: bool = False
    actual_idempotent: bool = True
    actual_financial_mutation: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)


class Scenario(BaseModel):
    scenario_id: str
    scenario_type: str
    title: str
    description: str
    category: ScenarioCategory = ScenarioCategory.BASELINE
    risk_level: RiskLevel = RiskLevel.MEDIUM
    initial_amount: Decimal = Decimal("1000.00")
    currency: str = "INR"
    initial_state: str = "CREATED"
    events: List[SyntheticEvent] = Field(default_factory=list)
    expected_result: ExpectedResult
    reason: Optional[str] = None


class AIAnalysis(BaseModel):
    hypothesis: str
    severity: RiskLevel
    confidence: float = Field(ge=0.0, le=1.0)
    likely_root_cause: str
    affected_component: str
    evidence_references: List[str] = Field(default_factory=list)
    recommended_investigation: str


class TraceStep(BaseModel):
    step_number: int
    timestamp: str
    phase: str
    description: str
    data: Dict[str, Any] = Field(default_factory=dict)


class TestResult(BaseModel):
    result_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_id: str
    scenario_id: str
    scenario_type: str
    category: ScenarioCategory
    risk_level: RiskLevel
    status: TestStatus
    expected_result: ExpectedResult
    actual_result: Observation
    trace: List[TraceStep] = Field(default_factory=list)
    ai_analysis: Optional[AIAnalysis] = None
    provenance: str = "LOCAL_AI_SIMULATION"
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class TestRun(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    run_type: str = "BASELINE"  # "BASELINE", "ADVERSARIAL", "GENERATED", "DEMO"
    status: RunStatus = RunStatus.PENDING
    scenarios_total: int = 0
    scenarios_passed: int = 0
    scenarios_failed: int = 0
    scenarios_warning: int = 0
    risk_level: RiskLevel = RiskLevel.LOW
    started_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    completed_at: Optional[str] = None
    created_by: str = "SYSTEM"
    provenance: str = "AI_TEST_LAB"
    results: List[TestResult] = Field(default_factory=list)
