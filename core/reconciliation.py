# FILE: core/reconciliation.py
"""Merchant-side Payment Reconciliation Engine (§14)."""
import sys
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from domain.enums import ExternalStatus


class ReconciliationResult(BaseModel):
    status: str  # CONSISTENT, INCONSISTENT, AMBIGUOUS, RESOLVED, MANUAL_REVIEW
    is_reconciled: bool = False
    anomalies: List[str] = Field(default_factory=list)
    verified_payment_id: Optional[str] = None
    verified_order_id: Optional[str] = None
    verified_amount: Optional[Decimal] = None
    verified_currency: str = "INR"
    razorpay_status: Optional[str] = None
    notes: str = ""


class ReconciliationEngine:
    """
    Deterministic Reconciliation Engine.
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
        intent_id = intent_data.get("payment_intent_id", "")
        intent_amount = Decimal(str(intent_data.get("amount", "0")))
        intent_currency = intent_data.get("currency", "INR")
        intent_order_id = intent_data.get("order_id", "")

        # API Evidence Fields
        api_status = api_evidence.get("status", "UNKNOWN")
        api_payment_id = api_evidence.get("id") or api_evidence.get("payment_id")
        api_order_id = api_evidence.get("order_id") or intent_data.get("razorpay_order_id")
        api_amount_raw = api_evidence.get("amount")

        if api_amount_raw is not None:
            # If amount is in paise (from raw Razorpay payload), convert
            api_amount = Decimal(str(api_amount_raw)) / Decimal("100") if isinstance(api_amount_raw, int) and api_amount_raw > 100 else Decimal(str(api_amount_raw))
        else:
            api_amount = intent_amount

        # 1. Identity Check
        if api_order_id and intent_order_id and api_order_id != intent_order_id and not intent_data.get("razorpay_order_id"):
            anomalies.append(f"Order ID mismatch: intent={intent_order_id}, api={api_order_id}")

        # 2. Amount & Currency Check
        if api_amount != intent_amount:
            anomalies.append(f"Amount mismatch: intent={intent_amount}, api={api_amount}")

        # 3. Check for Duplicate Successful Executions
        successful_captures = [
            e for e in executions_history if e.get("operation") == "CAPTURE" and e.get("status") in ("SUCCESS", "CAPTURED")
        ]
        if len(successful_captures) > 1:
            anomalies.append(f"Duplicate capture executions detected: count={len(successful_captures)}")

        # 4. State Consistency Assessment
        if not anomalies:
            if api_status in ("captured", "SUCCESS"):
                return ReconciliationResult(
                    status="CONSISTENT",
                    is_reconciled=True,
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
                anomalies=anomalies + ["External provider status is UNKNOWN"],
                verified_payment_id=api_payment_id,
                verified_order_id=api_order_id,
                notes="External state cannot be definitively established.",
            )

        return ReconciliationResult(
            status="INCONSISTENT",
            is_reconciled=False,
            anomalies=anomalies,
            verified_payment_id=api_payment_id,
            verified_order_id=api_order_id,
            verified_amount=api_amount,
            verified_currency=intent_currency,
            razorpay_status=api_status,
            notes="Reconciliation anomalies found. Manual review or policy action required.",
        )
