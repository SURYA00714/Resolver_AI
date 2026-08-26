# FILE: agents/finops_executor.py
"""FinOps Executor — Executes ONLY authorized financial actions (§19, 74-76).

CRITICAL INVARIANT: This agent NEVER generates its own commands.
It accepts ONLY an AuthorizedAction from the Policy Engine.
"""
import datetime
import sys
from decimal import Decimal
from typing import Optional

from agents.schemas import (
    ActionType,
    AuthorizedAction,
    ExternalStatus,
    FinOpsResult,
)
from rails.simulator import get_rail


async def execute(
    command: AuthorizedAction,
    trace_id: Optional[str] = None,
) -> FinOpsResult:
    """
    Execute a policy-authorized financial action on the target rail.

    Validates:
    1. Command has not expired
    2. Command has valid action type
    3. Amount is positive

    Then executes via the rail and returns structured FinOpsResult.
    """
    now = datetime.datetime.now(datetime.timezone.utc)

    # Validation 1: Expiration check
    if command.expires_at.tzinfo is None:
        expires = command.expires_at.replace(tzinfo=datetime.timezone.utc)
    else:
        expires = command.expires_at

    if now > expires:
        print(f"[FINOPS] Command {command.command_id} EXPIRED", file=sys.stderr)
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

    # Validation 2: Amount must be positive
    if command.amount <= 0:
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

    rail = get_rail(command.target_rail or "UPI_HDFC")

    try:
        if command.action == ActionType.CAPTURE:
            result = await rail.authorize(command.amount, command.idempotency_key)
        elif command.action == ActionType.VOID:
            # Use idempotency_key as a pseudo-txn reference
            result = await rail.void(command.idempotency_key)
        elif command.action == ActionType.REFUND:
            result = await rail.refund(command.idempotency_key, command.amount)
        elif command.action == ActionType.REROUTE:
            # Reroute = authorize on a different rail
            alt_rail = get_rail("UPI_ICICI")
            result = await alt_rail.authorize(command.amount, f"{command.idempotency_key}_reroute")
        elif command.action == ActionType.NO_ACTION:
            result = {"status": "SUCCESS", "txn_id": None}
        else:
            result = {"status": "FAILED", "reason": f"Unknown action: {command.action}"}

    except Exception as e:
        print(f"[FINOPS] Execution error for {command.command_id}: {e}", file=sys.stderr)
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
