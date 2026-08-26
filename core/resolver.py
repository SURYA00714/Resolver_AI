# FILE: core/resolver.py
"""Central resolution algorithm — the heartbeat of ResolverAI (§62-64)."""
import datetime
import json
import sys
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional

import asyncpg

from agents.detective import analyze
from agents.finops_executor import execute
from agents.negotiator import verify
from agents.schemas import (
    ActionType,
    AuthorizedAction,
    DecisionType,
    DetectiveResult,
    ExternalStatus,
    NegotiatorResult,
    PolicyDecision,
)
from core.idempotency import acquire_intent_lock, release_intent_lock
from core.policy_engine import PolicyEngine
from core.state_machine import UNCERTAIN, is_terminal, transition
from db.connection import get_pool
from ledger.evidence import record_evidence
from ledger.financial_effects import record_financial_effect


async def resolve(payment_intent_id: uuid.UUID, trace_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Full resolution pipeline:
    1. Lock intent
    2. Verify state is resolvable
    3. Detective analyzes
    4. Negotiator verifies externally
    5. Policy Engine gates decision
    6. FinOps Executor acts (if approved)
    7. Record evidence + financial effects
    8. Update state
    """
    intent_id_str = str(payment_intent_id)
    if trace_id is None:
        trace_id = uuid.uuid4().hex[:16]

    # Step 1: Acquire distributed lock
    locked = await acquire_intent_lock(intent_id_str)
    if not locked:
        return {"status": "SKIPPED", "reason": "Intent already being processed"}

    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            # Step 2: Load intent and verify state
            row = await conn.fetchrow(
                """SELECT payment_intent_id, order_id, merchant_id, amount, currency,
                          current_state, active_rail, retry_count, version
                   FROM payment_intents WHERE payment_intent_id = $1""",
                payment_intent_id,
            )
            if not row:
                return {"status": "ERROR", "reason": "Intent not found"}

            intent_data = {
                "payment_intent_id": str(row["payment_intent_id"]),
                "order_id": row["order_id"],
                "merchant_id": row["merchant_id"],
                "amount": Decimal(str(row["amount"])),
                "currency": row["currency"],
                "current_state": row["current_state"],
                "rail": row["active_rail"] or "UPI_HDFC",
                "retry_count": row["retry_count"] or 0,
                "version": row["version"],
                "has_existing_capture": False,
            }

            if is_terminal(intent_data["current_state"]):
                return {"status": "SKIPPED", "reason": f"Intent in terminal state: {intent_data['current_state']}"}

            # Check for existing captures
            existing = await conn.fetchval(
                """SELECT COUNT(*) FROM external_executions
                   WHERE payment_intent_id = $1 AND status = 'SUCCESS' AND operation = 'CAPTURE'""",
                payment_intent_id,
            )
            intent_data["has_existing_capture"] = (existing or 0) > 0

            # Ensure we're in a resolvable state
            if intent_data["current_state"] not in ("UNCERTAIN", "DUPLICATE_SUSPECTED", "VERIFYING"):
                # Transition to UNCERTAIN for processing
                new_state = transition(intent_data["current_state"], "TIMEOUT")
                await conn.execute(
                    "UPDATE payment_intents SET current_state = $1, updated_at = NOW() WHERE payment_intent_id = $2",
                    new_state, payment_intent_id,
                )
                intent_data["current_state"] = new_state

            # Step 3: Detective analyzes
            detective_result: DetectiveResult = await analyze(intent_data, trace_id=trace_id)
            print(f"[DETECTIVE] {intent_id_str[:8]} → hypothesis={detective_result.hypothesis}, confidence={detective_result.confidence}", file=sys.stderr)

            # Step 4: Negotiator verifies externally
            idempotency_key = f"idem_{intent_id_str}_{row['version']}"
            negotiator_result: NegotiatorResult = await verify(
                intent_data, idempotency_key=idempotency_key, trace_id=trace_id
            )
            print(f"[NEGOTIATOR] {intent_id_str[:8]} → status={negotiator_result.external_status.value}", file=sys.stderr)

            # Record external execution
            try:
                await conn.execute(
                    """INSERT INTO external_executions
                       (payment_intent_id, rail_id, external_txn_id, operation, amount, status, idempotency_key)
                       VALUES ($1, $2, $3, 'VERIFY', $4, $5, $6)
                       ON CONFLICT (idempotency_key) DO NOTHING""",
                    payment_intent_id,
                    negotiator_result.rail,
                    negotiator_result.external_transaction_id,
                    intent_data["amount"],
                    negotiator_result.external_status.value,
                    idempotency_key,
                )
            except Exception as e:
                print(f"[RESOLVER] External execution log error: {e}", file=sys.stderr)

            # Step 5: Policy Engine gates
            engine = PolicyEngine()
            policy_decision: PolicyDecision = engine.evaluate(
                intent_data, negotiator_result, detective_result
            )
            print(f"[POLICY] {intent_id_str[:8]} → decision={policy_decision.decision.value}, rule={policy_decision.rule}", file=sys.stderr)

            # Step 6: FinOps Executor (only if approved)
            finops_result = None
            final_state = intent_data["current_state"]
            action_taken = "NO_ACTION"

            if policy_decision.decision == DecisionType.APPROVE:
                authorized = engine.create_authorized_action(
                    policy_decision, intent_data, detective_result, idempotency_key
                )
                if authorized:
                    finops_result = await execute(authorized, trace_id=trace_id)
                    action_taken = finops_result.action_taken.value
                    print(f"[FINOPS] {intent_id_str[:8]} → action={action_taken}, status={finops_result.execution_status.value}", file=sys.stderr)

                    # Determine final state
                    if finops_result.execution_status == ExternalStatus.SUCCESS:
                        if authorized.action in (ActionType.CAPTURE, ActionType.NO_ACTION):
                            final_state = transition(intent_data["current_state"], "VERIFIED_SUCCESS")
                        elif authorized.action in (ActionType.VOID, ActionType.REFUND):
                            final_state = transition(intent_data["current_state"], "COMPENSATE")
                    else:
                        final_state = transition(intent_data["current_state"], "VERIFIED_FAILED")
            else:
                # Policy rejected — determine appropriate state
                if negotiator_result.external_status == ExternalStatus.FAILED:
                    final_state = transition(intent_data["current_state"], "VERIFIED_FAILED")
                elif negotiator_result.external_status == ExternalStatus.DUPLICATE:
                    final_state = transition(intent_data["current_state"], "DUPLICATE_DETECTED")
                else:
                    final_state = "MANUAL_REVIEW"

            # Step 7: Record evidence (immutable)
            decision_chain = {
                "trace_id": trace_id,
                "detective": detective_result.model_dump(mode="json"),
                "negotiator": negotiator_result.model_dump(mode="json"),
                "policy": policy_decision.model_dump(mode="json"),
                "finops": finops_result.model_dump(mode="json") if finops_result else None,
            }

            await record_evidence(
                conn=conn,
                payment_intent_id=payment_intent_id,
                action=action_taken,
                amount=intent_data["amount"],
                currency=intent_data["currency"],
                decision=policy_decision.decision.value,
                policy_reason=policy_decision.reason,
                agent_evidence=detective_result.model_dump(mode="json"),
                external_evidence=negotiator_result.model_dump(mode="json"),
                execution_result=finops_result.model_dump(mode="json") if finops_result else None,
                decision_chain=decision_chain,
                trace_id=trace_id,
            )

            # Record financial effect
            if finops_result and finops_result.execution_status == ExternalStatus.SUCCESS:
                await record_financial_effect(
                    conn=conn,
                    payment_intent_id=payment_intent_id,
                    action=action_taken,
                    amount=intent_data["amount"],
                    currency=intent_data["currency"],
                )

            # Step 8: Update state
            await conn.execute(
                """UPDATE payment_intents
                   SET current_state = $1, version = version + 1,
                       resolution_status = $2, updated_at = NOW()
                   WHERE payment_intent_id = $3""",
                final_state,
                "RESOLVED" if is_terminal(final_state) else "IN_PROGRESS",
                payment_intent_id,
            )

            return {
                "status": "RESOLVED",
                "final_state": final_state,
                "decision": policy_decision.decision.value,
                "action": action_taken,
                "trace_id": trace_id,
            }

    except Exception as e:
        print(f"[RESOLVER] Error resolving {intent_id_str}: {e}", file=sys.stderr)
        return {"status": "ERROR", "reason": str(e)}
    finally:
        await release_intent_lock(intent_id_str)
