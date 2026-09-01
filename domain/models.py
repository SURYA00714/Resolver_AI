# FILE: domain/models.py
"""Domain models for ResolverAI entities (§8)."""
import datetime
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from domain.enums import CaseSeverity, CaseStatus, DivergenceType, PaymentState


class PaymentIntentModel(BaseModel):
    payment_intent_id: uuid.UUID
    merchant_id: str = "default_merchant"
    merchant_reference: Optional[str] = None
    order_id: str
    razorpay_order_id: Optional[str] = None
    active_payment_id: Optional[str] = None
    amount: Decimal
    currency: str = "INR"
    current_state: PaymentState = PaymentState.CREATED
    active_rail: Optional[str] = None
    retry_count: int = 0
    resolution_status: str = "PENDING"
    version: int = 1
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class PaymentEventModel(BaseModel):
    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    payment_intent_id: uuid.UUID
    merchant_id: str = "default_merchant"
    source: str = "RAZORPAY"
    external_event_id: str
    external_transaction_id: Optional[str] = None
    event_type: str
    payload: Dict[str, Any]
    payload_hash: Optional[str] = None
    trace_id: Optional[str] = None
    received_at: Optional[datetime.datetime] = None


class ExternalExecutionModel(BaseModel):
    execution_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    payment_intent_id: uuid.UUID
    merchant_id: str = "default_merchant"
    provider: str = "RAZORPAY"
    rail_id: str = "RAZORPAY_TEST"
    external_txn_id: Optional[str] = None
    operation: str = "AUTHORIZE"
    amount: Decimal
    status: str
    idempotency_key: str
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None


class ReconciliationCaseModel(BaseModel):
    case_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    payment_intent_id: uuid.UUID
    merchant_id: str = "default_merchant"
    case_type: str
    divergence_type: DivergenceType = DivergenceType.NONE
    severity: CaseSeverity = CaseSeverity.MEDIUM
    status: CaseStatus = CaseStatus.OPEN
    reason: str
    evidence_refs: Optional[Dict[str, Any]] = None
    opened_at: Optional[datetime.datetime] = None
    resolved_at: Optional[datetime.datetime] = None
    assigned_operator: Optional[str] = None
    resolution_notes: Optional[str] = None


class ImmutableEvidenceModel(BaseModel):
    evidence_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    payment_intent_id: uuid.UUID
    merchant_id: str = "default_merchant"
    event_id: Optional[uuid.UUID] = None
    action: str
    amount: Decimal
    currency: str = "INR"
    decision: str
    policy_reason: Optional[str] = None
    agent_evidence: Optional[Dict[str, Any]] = None
    external_evidence: Optional[Dict[str, Any]] = None
    execution_result: Optional[Dict[str, Any]] = None
    decision_chain: Dict[str, Any]
    trace_id: Optional[str] = None
    created_at: Optional[datetime.datetime] = None

