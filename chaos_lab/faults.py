# FILE: chaos_lab/faults.py
"""Deterministic Chaos Scenario Fault Injection (§22)."""
import json
import time
import uuid
from decimal import Decimal
from typing import Any, Dict

import asyncpg


async def inject_late_authorization(conn: asyncpg.Connection) -> Dict[str, Any]:
    """
    Scenario 1: Late Authorization
    Payment times out at gateway, but authorization webhook arrives later.
    """
    ts = int(time.time())
    intent_id = uuid.uuid4()
    order_id = f"ORD_LATE_{ts}"
    amount = Decimal("1499.00")
    rail = "UPI_HDFC"

    await conn.execute(
        """INSERT INTO payment_intents
           (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
           VALUES ($1, $2, 'demo_merchant', $3, 'INR', 'UNCERTAIN', $4)
           ON CONFLICT (payment_intent_id) DO NOTHING""",
        intent_id, order_id, amount, rail,
    )

    ext_evt = f"evt_late_{ts}"
    await conn.execute(
        """INSERT INTO payment_events
           (payment_intent_id, source, external_event_id, event_type, payload, trace_id)
           VALUES ($1, 'SIMULATOR', $2, 'payment.captured', $3, $4)""",
        intent_id, ext_evt,
        json.dumps({"event": "payment.captured", "scenario": "LATE_AUTH", "amount": str(amount)}),
        f"trace_late_{ts}",
    )

    await conn.execute(
        """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
           VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
        str(intent_id),
        json.dumps({"payment_intent_id": str(intent_id), "scenario": "LATE_AUTH"}),
    )

    return {"scenario": "LATE_AUTH", "payment_intent_id": str(intent_id), "amount": str(amount), "rail": rail}


async def inject_cross_rail_duplicate(conn: asyncpg.Connection) -> Dict[str, Any]:
    """
    Scenario 2: Duplicate Execution Attempt
    Same intent triggers multiple captures.
    """
    ts = int(time.time())
    intent_id = uuid.uuid4()
    order_id = f"ORD_DUP_{ts}"
    amount = Decimal("2999.00")

    await conn.execute(
        """INSERT INTO payment_intents
           (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
           VALUES ($1, $2, 'demo_merchant', $3, 'INR', 'DUPLICATE_SUSPECTED', 'UPI_HDFC')
           ON CONFLICT (payment_intent_id) DO NOTHING""",
        intent_id, order_id, amount,
    )

    # First capture
    await conn.execute(
        """INSERT INTO external_executions
           (payment_intent_id, provider, rail_id, external_txn_id, operation, amount, status, idempotency_key)
           VALUES ($1, 'RAZORPAY', 'UPI_HDFC', $2, 'CAPTURE', $3, 'SUCCESS', $4)
           ON CONFLICT (idempotency_key) DO NOTHING""",
        intent_id, f"TXN_HDFC_{ts}", amount, f"idem_hdfc_{intent_id}",
    )

    ext_evt = f"evt_dup_{ts}"
    await conn.execute(
        """INSERT INTO payment_events
           (payment_intent_id, source, external_event_id, event_type, payload, trace_id)
           VALUES ($1, 'SIMULATOR', $2, 'DUPLICATE_CAPTURE', $3, $4)""",
        intent_id, ext_evt,
        json.dumps({"event": "payment.captured", "scenario": "CROSS_RAIL_DUPLICATE", "amount": str(amount)}),
        f"trace_dup_{ts}",
    )

    await conn.execute(
        """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
           VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
        str(intent_id),
        json.dumps({"payment_intent_id": str(intent_id), "scenario": "CROSS_RAIL_DUPLICATE"}),
    )

    return {"scenario": "CROSS_RAIL_DUPLICATE", "payment_intent_id": str(intent_id), "amount": str(amount)}


async def inject_out_of_order_webhook(conn: asyncpg.Connection) -> Dict[str, Any]:
    """
    Scenario 3: Out-of-Order Webhook
    'payment.captured' arrives before 'payment.authorized'.
    """
    ts = int(time.time())
    intent_id = uuid.uuid4()
    order_id = f"ORD_OOO_{ts}"
    amount = Decimal("749.00")
    rail = "CARD_AXIS"

    await conn.execute(
        """INSERT INTO payment_intents
           (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
           VALUES ($1, $2, 'demo_merchant', $3, 'INR', 'CREATED', $4)
           ON CONFLICT (payment_intent_id) DO NOTHING""",
        intent_id, order_id, amount, rail,
    )

    # Captured event arrives first (out of order)
    await conn.execute(
        """INSERT INTO payment_events
           (payment_intent_id, source, external_event_id, event_type, payload, trace_id)
           VALUES ($1, 'SIMULATOR', $2, 'payment.captured', $3, $4)""",
        intent_id, f"evt_ooo_cap_{ts}",
        json.dumps({"event": "payment.captured", "scenario": "OUT_OF_ORDER", "amount": str(amount)}),
        f"trace_ooo_{ts}",
    )

    await conn.execute(
        """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
           VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
        str(intent_id),
        json.dumps({"payment_intent_id": str(intent_id), "scenario": "OUT_OF_ORDER"}),
    )

    return {"scenario": "OUT_OF_ORDER", "payment_intent_id": str(intent_id), "amount": str(amount), "rail": rail}
