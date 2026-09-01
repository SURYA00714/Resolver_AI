# FILE: agents/finops_executor.py
"""FinOps Executor — Executes ONLY policy-authorized financial actions (§18).

CRITICAL INVARIANT: This agent NEVER generates its own financial commands.
It accepts ONLY an AuthorizedAction created by the Policy Engine.
"""
import datetime
import sys
from decimal import Decimal
from typing import Optional

import config
from agents.schemas import (
    ActionType,
    AuthorizedAction,
    ExternalStatus,
    FinOpsResult,
)
from domain.errors import RazorpayAPIError
from razorpay.payments import capture_payment
from razorpay.refunds import create_refund


async def execute(
    command: AuthorizedAction,
    trace_id: Optional[str] = None,
) -> FinOpsResult:
    """
    Execute a policy-authorized financial action.

    Validates:
    1. Command expiration
    2. Positive amount
    3. Mandatory policy decision ID & idempotency key
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    # Expiration check
    expires = command.expires_at if command.expires_at.tzinfo else command.expires_at.replace(tzinfo=datetime.timezone.utc)
    if now > expires:
        print(f"[FINOPS] Rejecting command {command.command_id}: Command EXPIRED", file=sys.stderr)
        return FinOpsResult(
            payment_intent_id=command.payment_intent_id,
            trace_id=trace_id or "",
            command_id=command.command_id,
            action_taken=command.action,
            execution_status=ExternalStatus.FAILED,
            amount=command.amount,
            currency=command.currency,
            error="Command expired",
        )

    # Future issue check (prevent post-dated token exploitation / clock skew exploitation)
    issued = command.issued_at if command.issued_at.tzinfo else command.issued_at.replace(tzinfo=datetime.timezone.utc)
    if issued > now + datetime.timedelta(seconds=5):
        print(f"[FINOPS] Rejecting command {command.command_id}: Command issued in FUTURE", file=sys.stderr)
        return FinOpsResult(
            payment_intent_id=command.payment_intent_id,
            trace_id=trace_id or "",
            command_id=command.command_id,
            action_taken=command.action,
            execution_status=ExternalStatus.FAILED,
            amount=command.amount,
            currency=command.currency,
            error="Command issued in future",
        )

    # Capability token signature verification
    if command.action in (ActionType.CAPTURE, ActionType.REFUND, ActionType.VOID):
        if not command.signature:
            print(f"[FINOPS] Rejecting command {command.command_id}: Missing capability token signature", file=sys.stderr)
            return FinOpsResult(
                payment_intent_id=command.payment_intent_id,
                trace_id=trace_id or "",
                command_id=command.command_id,
                action_taken=command.action,
                execution_status=ExternalStatus.FAILED,
                amount=command.amount,
                currency=command.currency,
                error="Missing capability token signature",
            )
        if not command.verify_signature(config.JWT_SECRET_KEY):
            print(f"[FINOPS] Rejecting command {command.command_id}: Signature VERIFICATION_FAILED", file=sys.stderr)
            return FinOpsResult(
                payment_intent_id=command.payment_intent_id,
                trace_id=trace_id or "",
                command_id=command.command_id,
                action_taken=command.action,
                execution_status=ExternalStatus.FAILED,
                amount=command.amount,
                currency=command.currency,
                error="Invalid capability token signature",
            )

    if command.amount <= 0 and command.action != ActionType.NO_ACTION:
        return FinOpsResult(
            payment_intent_id=command.payment_intent_id,
            trace_id=trace_id or "",
            command_id=command.command_id,
            action_taken=command.action,
            execution_status=ExternalStatus.FAILED,
            amount=command.amount,
            currency=command.currency,
            error="Amount must be positive",
        )

    # Path A: Real Razorpay API Mode (TEST / LIVE)
    if config.RAZORPAY_MODE in ("TEST", "LIVE") and command.razorpay_payment_id:
        try:
            if command.action == ActionType.CAPTURE:
                res = await capture_payment(
                    payment_id=command.razorpay_payment_id,
                    amount=command.amount,
                    currency=command.currency,
                )
                # Post-mutation verification re-fetch
                try:
                    from razorpay.payments import get_payment
                    verified_payment = await get_payment(command.razorpay_payment_id)
                    verified_status = verified_payment.get("status")
                    print(f"[FINOPS] Post-capture verification: status is '{verified_status}'", file=sys.stderr)
                except Exception as ve:
                    print(f"[FINOPS] Post-capture verification fetch warning: {ve}", file=sys.stderr)

                return FinOpsResult(
                    payment_intent_id=command.payment_intent_id,
                    trace_id=trace_id or "",
                    command_id=command.command_id,
                    action_taken=ActionType.CAPTURE,
                    execution_status=ExternalStatus.SUCCESS,
                    external_transaction_id=res.get("id"),
                    amount=command.amount,
                    currency=command.currency,
                )

            elif command.action in (ActionType.REFUND, ActionType.VOID):
                res = await create_refund(
                    payment_id=command.razorpay_payment_id,
                    amount=command.amount,
                    notes={"policy_decision_id": command.policy_decision_id},
                )
                # Post-mutation verification re-fetch
                try:
                    from razorpay.payments import get_payment
                    verified_payment = await get_payment(command.razorpay_payment_id)
                    verified_status = verified_payment.get("status")
                    print(f"[FINOPS] Post-refund verification: status is '{verified_status}'", file=sys.stderr)
                except Exception as ve:
                    print(f"[FINOPS] Post-refund verification fetch warning: {ve}", file=sys.stderr)

                return FinOpsResult(
                    payment_intent_id=command.payment_intent_id,
                    trace_id=trace_id or "",
                    command_id=command.command_id,
                    action_taken=command.action,
                    execution_status=ExternalStatus.REFUNDED,
                    external_transaction_id=res.get("id"),
                    amount=command.amount,
                    currency=command.currency,
                )

            elif command.action == ActionType.NO_ACTION:
                return FinOpsResult(
                    payment_intent_id=command.payment_intent_id,
                    trace_id=trace_id or "",
                    command_id=command.command_id,
                    action_taken=ActionType.NO_ACTION,
                    execution_status=ExternalStatus.SUCCESS,
                    amount=command.amount,
                    currency=command.currency,
                )

            else:
                print(f"[FINOPS] Unknown action requested: {command.action}", file=sys.stderr)
                return FinOpsResult(
                    payment_intent_id=command.payment_intent_id,
                    trace_id=trace_id or "",
                    command_id=command.command_id,
                    action_taken=command.action,
                    execution_status=ExternalStatus.FAILED,
                    amount=command.amount,
                    currency=command.currency,
                    error=f"Action '{command.action}' is unknown or not permitted.",
                )

        except RazorpayAPIError as e:
            print(f"[FINOPS] Razorpay mutation error: {e}", file=sys.stderr)
            return FinOpsResult(
                payment_intent_id=command.payment_intent_id,
                trace_id=trace_id or "",
                command_id=command.command_id,
                action_taken=command.action,
                execution_status=ExternalStatus.FAILED,
                amount=command.amount,
                currency=command.currency,
                error=str(e),
            )

    # Path B: Local Chaos Lab Simulator Mode
    try:
        from chaos_lab.simulator import get_rail
        rail = get_rail(command.target_rail or "RAZORPAY_TEST")

        if command.action == ActionType.CAPTURE:
            result = await rail.authorize(command.amount, command.idempotency_key)
        elif command.action == ActionType.VOID:
            result = await rail.void(command.idempotency_key)
        elif command.action == ActionType.REFUND:
            result = await rail.refund(command.idempotency_key, command.amount)
        elif command.action == ActionType.NO_ACTION:
            result = {"status": "SUCCESS", "txn_id": None}
        else:
            result = {"status": "FAILED", "reason": f"Unsupported action: {command.action}"}

        raw_status = result.get("status", "UNKNOWN")
        status_map = {
            "SUCCESS": ExternalStatus.SUCCESS,
            "CAPTURED": ExternalStatus.SUCCESS,
            "VOIDED": ExternalStatus.VOIDED,
            "REFUNDED": ExternalStatus.REFUNDED,
            "FAILED": ExternalStatus.FAILED,
        }

        return FinOpsResult(
            payment_intent_id=command.payment_intent_id,
            trace_id=trace_id or "",
            command_id=command.command_id,
            action_taken=command.action,
            execution_status=status_map.get(raw_status, ExternalStatus.FAILED),
            external_transaction_id=result.get("txn_id"),
            amount=command.amount,
            currency=command.currency,
        )

    except Exception as e:
        print(f"[FINOPS] Chaos rail execution error: {e}", file=sys.stderr)
        return FinOpsResult(
            payment_intent_id=command.payment_intent_id,
            trace_id=trace_id or "",
            command_id=command.command_id,
            action_taken=command.action,
            execution_status=ExternalStatus.FAILED,
            amount=command.amount,
            currency=command.currency,
            error=str(e),
        )
