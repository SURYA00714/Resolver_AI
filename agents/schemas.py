# FILE: agents/schemas.py
"""Pydantic contracts for structured agent communication (§15-18)."""
import datetime
import uuid
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from domain.enums import ActionType, DecisionType, ExternalStatus


class AgentId(str, Enum):
    DETECTIVE = "DETECTIVE"
    NEGOTIATOR = "NEGOTIATOR"
    FINOPS_EXECUTOR = "FINOPS_EXECUTOR"
    POLICY_ENGINE = "POLICY_ENGINE"


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
    provider_name: str = "Deterministic Rule Engine"  # Set by detective.py — displayed in UI



# --- Negotiator Output ---

class NegotiatorResult(AgentMessage):
    agent_id: AgentId = AgentId.NEGOTIATOR
    external_status: ExternalStatus
    external_transaction_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    amount: Decimal
    currency: str = "INR"
    rail: str = "RAZORPAY_TEST"
    verification_details: Optional[dict] = None


# --- Policy Decision ---

class PolicyDecision(BaseModel):
    decision: DecisionType
    rule: Optional[str] = None
    reason: str
    policy_decision_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    trace_id: Optional[str] = None
    timestamp: datetime.datetime = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))


# --- Authorized Action (bridge between Policy Engine and FinOps Executor) ---

class AuthorizedAction(BaseModel):
    command_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    payment_intent_id: str
    merchant_id: str = "default_merchant"
    action: ActionType
    amount: Decimal
    currency: str = "INR"
    target_rail: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    policy_decision_id: str
    idempotency_key: str
    issued_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    expires_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)
    )
    trace_id: Optional[str] = None
    signature: Optional[str] = None

    def compute_signature(self, secret_key: str) -> str:
        """Compute cryptographic HMAC-SHA256 signature for financial capability verification."""
        import hashlib
        import hmac
        issued_str = self.issued_at.isoformat() if self.issued_at else ""
        expires_str = self.expires_at.isoformat() if self.expires_at else ""
        payload = (
            f"{self.command_id}|{self.payment_intent_id}|{self.merchant_id}|"
            f"{self.action.value}|{self.amount}|{self.currency}|{self.idempotency_key}|"
            f"{self.policy_decision_id}|{issued_str}|{expires_str}"
        )
        return hmac.new(
            key=secret_key.encode("utf-8"),
            msg=payload.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).hexdigest()

    def sign_command(self, secret_key: str) -> None:
        """Sign the command with system secret key."""
        self.signature = self.compute_signature(secret_key)

    def verify_signature(self, secret_key: str) -> bool:
        """Verify the capability token signature in constant time."""
        import hmac
        if not self.signature:
            return False
        expected = self.compute_signature(secret_key)
        return hmac.compare_digest(self.signature.lower(), expected.lower())



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
