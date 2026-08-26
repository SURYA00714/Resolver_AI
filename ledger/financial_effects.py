# FILE: ledger/financial_effects.py
"""Financial effects tracking — captured, refunded, net effect per intent (§30, 50)."""
import uuid
from decimal import Decimal

import asyncpg


async def record_financial_effect(
    conn: asyncpg.Connection,
    payment_intent_id: uuid.UUID,
    action: str,
    amount: Decimal,
    currency: str,
) -> None:
    """
    Record financial effect by updating resolution_status on the intent.
    Financial effects are tracked by querying immutable_evidence + external_executions.
    """
    # This is a lightweight tracker — the authoritative source is immutable_evidence
    await conn.execute(
        """UPDATE payment_intents SET resolution_status = 'RESOLVED', updated_at = NOW()
           WHERE payment_intent_id = $1""",
        payment_intent_id,
    )


async def get_financial_summary(conn: asyncpg.Connection, payment_intent_id: uuid.UUID) -> dict:
    """Compute financial summary from immutable evidence for an intent."""
    rows = await conn.fetch(
        """SELECT action, amount, currency FROM immutable_evidence
           WHERE payment_intent_id = $1 ORDER BY created_at""",
        payment_intent_id,
    )

    captured = Decimal("0")
    refunded = Decimal("0")
    voided = Decimal("0")

    for row in rows:
        act = row["action"]
        amt = Decimal(str(row["amount"]))
        if act in ("CAPTURE", "NO_ACTION"):
            captured += amt
        elif act == "REFUND":
            refunded += amt
        elif act == "VOID":
            voided += amt

    return {
        "payment_intent_id": str(payment_intent_id),
        "captured_amount": str(captured),
        "refunded_amount": str(refunded),
        "voided_amount": str(voided),
        "net_effect": str(captured - refunded),
    }


async def get_system_financial_summary(conn: asyncpg.Connection) -> dict:
    """System-wide financial summary from all evidence."""
    row = await conn.fetchrow(
        """SELECT
             COALESCE(SUM(CASE WHEN action IN ('CAPTURE', 'NO_ACTION') THEN amount ELSE 0 END), 0) as total_captured,
             COALESCE(SUM(CASE WHEN action = 'REFUND' THEN amount ELSE 0 END), 0) as total_refunded,
             COALESCE(SUM(CASE WHEN action = 'VOID' THEN amount ELSE 0 END), 0) as total_voided,
             COUNT(*) as total_actions
           FROM immutable_evidence"""
    )
    captured = Decimal(str(row["total_captured"]))
    refunded = Decimal(str(row["total_refunded"]))
    return {
        "total_captured": str(captured),
        "total_refunded": str(refunded),
        "total_voided": str(row["total_voided"]),
        "net_effect": str(captured - refunded),
        "total_actions": row["total_actions"],
    }
