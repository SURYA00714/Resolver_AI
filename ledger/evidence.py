# FILE: ledger/evidence.py
"""Immutable financial-action evidence recording (§29)."""
import json
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional

import asyncpg


async def record_evidence(
    conn: asyncpg.Connection,
    payment_intent_id: uuid.UUID,
    action: str,
    amount: Decimal,
    currency: str,
    decision: str,
    policy_reason: str,
    agent_evidence: Optional[Dict[str, Any]],
    external_evidence: Optional[Dict[str, Any]],
    execution_result: Optional[Dict[str, Any]],
    decision_chain: Dict[str, Any],
    trace_id: Optional[str] = None,
    event_id: Optional[uuid.UUID] = None,
) -> uuid.UUID:
    """Record an immutable evidence entry. Once written, it can never be updated or deleted."""
    evidence_id = uuid.uuid4()

    await conn.execute(
        """INSERT INTO immutable_evidence
           (evidence_id, payment_intent_id, event_id, action, amount, currency,
            decision, policy_reason, agent_evidence, external_evidence,
            execution_result, decision_chain, trace_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)""",
        evidence_id,
        payment_intent_id,
        event_id,
        action,
        amount,
        currency,
        decision,
        policy_reason,
        json.dumps(agent_evidence, default=str) if agent_evidence else None,
        json.dumps(external_evidence, default=str) if external_evidence else None,
        json.dumps(execution_result, default=str) if execution_result else None,
        json.dumps(decision_chain, default=str),
        trace_id,
    )

    return evidence_id
