# FILE: agents/schemas.py
"""Pydantic contracts for structured agent communication (§20, 74-75)."""
import uuid
import datetime
from decimal import Decimal
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field


class AgentId(str, Enum):
    DETECTIVE = "DETECTIVE"
    NEGOTIATOR = "NEGOTIATOR"
    FINOPS_EXECUTOR = "FINOPS_EXECUTOR"
    POLICY_ENGINE = "POLICY_ENGINE"


class ActionType(str, Enum):
    CAPTURE = "CAPTURE"
    REROUTE = "REROUTE"
    VOID = "VOID"
    REFUND = "REFUND"
    NO_ACTION = "NO_ACTION"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    VERIFY = "VERIFY"


class DecisionType(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class ExternalStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"
    VOIDED = "VOIDED"
    REFUNDED = "REFUNDED"
    DUPLICATE = "DUPLICATE"


# --- Base Agent Message ---

class AgentMessage(BaseModel):
    trace_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    payment_intent_id: str
    agent_id: AgentId
    schema_version: str = "1.0"
    timestamp: datetime.datetime = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))


# --- Detective Output ---

class DetectiveResult(AgentMessage):
    agent_id: AgentId = AgentId.DETECTIVE
    hypothesis: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: List[str] = Field(default_factory=list)
    recommended_action: ActionType = ActionType.VERIFY
    recommended_verification: str = "CHECK_EXTERNAL_STATUS"


# --- Negotiator Output ---

class NegotiatorResult(AgentMessage):
    agent_id: AgentId = AgentId.NEGOTIATOR
    external_status: ExternalStatus
    external_transaction_id: Optional[str] = None
    amount: Decimal
    currency: str = "INR"
    rail: str


# --- Policy Decision ---

class PolicyDecision(BaseModel):
    decision: DecisionType
    rule: Optional[str] = None
    reason: str
    policy_decision_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    trace_id: Optional[str] = None
    timestamp: datetime.datetime = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))


# --- Authorized Action (bridge between Policy and FinOps) ---

class AuthorizedAction(BaseModel):
    command_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    payment_intent_id: str
    action: ActionType
    amount: Decimal
    currency: str = "INR"
    target_rail: Optional[str] = None
    policy_decision_id: str
    idempotency_key: str
    expires_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
    )
    trace_id: Optional[str] = None


# --- FinOps Execution Result ---

class FinOpsResult(AgentMessage):
    agent_id: AgentId = AgentId.FINOPS_EXECUTOR
    command_id: str
    action_taken: ActionType
    execution_status: ExternalStatus
    external_transaction_id: Optional[str] = None
    amount: Decimal
    currency: str = "INR"
    error: Optional[str] = None
