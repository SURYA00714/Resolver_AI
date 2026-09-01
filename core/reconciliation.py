# FILE: core/reconciliation.py
"""Merchant-side Payment Reconciliation Engine 2.0 (§14)."""
import sys
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from domain.enums import DivergenceType, ExternalStatus
from domain.money import minor_units_to_decimal, to_decimal_amount, validate_currency


class ReconciliationResult(BaseModel):
    status: str  # CONSISTENT, INCONSISTENT, AMBIGUOUS, RESOLVED, MANUAL_REVIEW
    is_reconciled: bool = False
    divergence_type: DivergenceType = DivergenceType.NONE
    anomalies: List[str] = Field(default_factory=list)
    verified_payment_id: Optional[str] = None
    verified_order_id: Optional[str] = None
    verified_amount: Optional[Decimal] = None
    verified_currency: str = "INR"
    razorpay_status: Optional[str] = None
    notes: str = ""


class ReconciliationEngine:
    """
    Deterministic 3-Way Reconciliation Engine 2.0.
    Compares:
    1. Local operational state (Payment Intent)
    2. Immutable event history (Payment Events)
    3. External provider state (Razorpay REST API)
    4. Execution history (External Executions)
    
    Never relies on AI for identity, amount, or currency checks.
    """

    def reconcile(
        self,
        intent_data: Dict[str, Any],
        events_history: List[Dict[str, Any]],
        api_evidence: Dict[str, Any],
        executions_history: List[Dict[str, Any]],
    ) -> ReconciliationResult:
        anomalies = []
        divergence_type = DivergenceType.NONE

        intent_id = intent_data.get("payment_intent_id", "")
        intent_amount = to_decimal_amount(intent_data.get("amount", "0"))
        intent_currency = validate_currency(intent_data.get("currency", "INR"))
        intent_order_id = intent_data.get("order_id", "")

        # API Evidence Fields
        api_status = api_evidence.get("status", "UNKNOWN")
        api_payment_id = api_evidence.get("id") or api_evidence.get("payment_id")
        api_order_id = api_evidence.get("order_id") or intent_data.get("razorpay_order_id")
        api_amount_raw = api_evidence.get("amount")
        api_currency = api_evidence.get("currency")

        if api_currency:
            try:
                api_currency_norm = validate_currency(api_currency)
                if api_currency_norm != intent_currency:
                    anomalies.append(f"Currency mismatch: intent={intent_currency}, api={api_currency_norm}")
                    divergence_type = DivergenceType.CURRENCY_MISMATCH
            except Exception:
                anomalies.append(f"Invalid external currency: {api_currency}")
                divergence_type = DivergenceType.CURRENCY_MISMATCH

        if api_amount_raw is not None:
            # Handle paise int or decimal string
            if isinstance(api_amount_raw, int) and api_amount_raw > 100:
                api_amount = minor_units_to_decimal(api_amount_raw, intent_currency)
            else:
                api_amount = to_decimal_amount(api_amount_raw)
        else:
            api_amount = intent_amount

        # 1. Identity Check
        if api_order_id and intent_order_id and api_order_id != intent_order_id and not intent_data.get("razorpay_order_id"):
            anomalies.append(f"Order ID mismatch: intent={intent_order_id}, api={api_order_id}")
            if divergence_type == DivergenceType.NONE:
                divergence_type = DivergenceType.PAYMENT_ID_MISMATCH

        # 2. Amount Check
        if api_amount != intent_amount:
            anomalies.append(f"Amount mismatch: intent={intent_amount}, api={api_amount}")
            if divergence_type == DivergenceType.NONE:
                divergence_type = DivergenceType.AMOUNT_MISMATCH

        # 3. Check for Duplicate Successful Executions
        successful_captures = [
            e for e in executions_history if e.get("operation") == "CAPTURE" and e.get("status") in ("SUCCESS", "CAPTURED")
        ]
        if len(successful_captures) > 1:
            anomalies.append(f"Duplicate capture executions detected: count={len(successful_captures)}")
            divergence_type = DivergenceType.POSSIBLE_DUPLICATE_CAPTURE

        # 4. Webhook vs REST Divergence & State Conflict Checks
        events_received = [e.get("event_type") for e in events_history]
        if api_status in ("captured", "SUCCESS") and "payment.captured" not in events_received and "authorized" not in events_received:
            if divergence_type == DivergenceType.NONE:
                divergence_type = DivergenceType.LOST_WEBHOOK

        current_state = intent_data.get("current_state", "UNCERTAIN")
        if current_state in ("FAILED", "VOIDED") and api_status in ("captured", "SUCCESS"):
            anomalies.append(f"Local state '{current_state}' conflicts with provider status '{api_status}'")
            if divergence_type in (DivergenceType.NONE, DivergenceType.LOST_WEBHOOK):
                divergence_type = DivergenceType.CONFLICTING_PROVIDER_STATE

        # 5. Consistency Resolution
        if not anomalies:
            if api_status in ("captured", "SUCCESS"):
                return ReconciliationResult(
                    status="CONSISTENT",
                    is_reconciled=True,
                    divergence_type=divergence_type,
                    verified_payment_id=api_payment_id,
                    verified_order_id=api_order_id,
                    verified_amount=api_amount,
                    verified_currency=intent_currency,
                    razorpay_status=api_status,
                    notes="Payment captured and perfectly consistent with merchant record.",
                )
            elif api_status in ("authorized", "PENDING"):
                return ReconciliationResult(
                    status="CONSISTENT",
                    is_reconciled=False,
                    divergence_type=divergence_type,
                    verified_payment_id=api_payment_id,
                    verified_order_id=api_order_id,
                    verified_amount=api_amount,
                    verified_currency=intent_currency,
                    razorpay_status=api_status,
                    notes="Payment authorized, awaiting capture.",
                )
            elif api_status in ("failed", "FAILED"):
                return ReconciliationResult(
                    status="CONSISTENT",
                    is_reconciled=True,
                    divergence_type=divergence_type,
                    verified_payment_id=api_payment_id,
                    verified_order_id=api_order_id,
                    verified_amount=api_amount,
                    verified_currency=intent_currency,
                    razorpay_status=api_status,
                    notes="Payment confirmed failed at provider.",
                )

        if len(successful_captures) > 1:
            return ReconciliationResult(
                status="INCONSISTENT",
                is_reconciled=False,
                divergence_type=DivergenceType.POSSIBLE_DUPLICATE_CAPTURE,
                anomalies=anomalies,
                verified_payment_id=api_payment_id,
                verified_order_id=api_order_id,
                verified_amount=api_amount,
                verified_currency=intent_currency,
                razorpay_status=api_status,
                notes="Multiple capture executions exist for the same payment intent.",
            )

        if api_status == "UNKNOWN":
            return ReconciliationResult(
                status="AMBIGUOUS",
                is_reconciled=False,
                divergence_type=DivergenceType.UNKNOWN_PROVIDER_STATE,
                anomalies=anomalies + ["External provider status is UNKNOWN"],
                verified_payment_id=api_payment_id,
                verified_order_id=api_order_id,
                notes="External state cannot be definitively established.",
            )

        return ReconciliationResult(
            status="INCONSISTENT",
            is_reconciled=False,
            divergence_type=divergence_type if divergence_type != DivergenceType.NONE else DivergenceType.MANUAL_REVIEW_REQUIRED,
            anomalies=anomalies,
            verified_payment_id=api_payment_id,
            verified_order_id=api_order_id,
            verified_amount=api_amount,
            verified_currency=intent_currency,
            razorpay_status=api_status,
            notes="Reconciliation anomalies found. Manual review or policy action required.",
        )

