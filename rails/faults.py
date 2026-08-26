# FILE: rails/faults.py
"""3 exact chaos scenarios per directive §27-28."""
import json
import time
import uuid
from decimal import Decimal
from typing import Any, Dict

import asyncpg


async def inject_late_authorization(conn: asyncpg.Connection) -> Dict[str, Any]:
    """
    Scenario 1: Late Authorization
    Payment times out at rail, but auth arrives later.
    Creates an UNCERTAIN intent + a SUCCESS event that arrives "late".
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
           VALUES ($1, 'SIMULATOR', $2, 'LATE_AUTH_RECEIVED', $3, $4)""",
        intent_id, ext_evt,
        json.dumps({"status": "SUCCESS", "scenario": "LATE_AUTH", "amount": str(amount)}),
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
    Scenario 2: Cross-Rail Duplicate
    Same order gets two captures on different rails (UPI_HDFC and UPI_ICICI).
    Creates a CAPTURED intent, then a duplicate event arrives.
    """
    ts = int(time.time())
    intent_id = uuid.uuid4()
    order_id = f"ORD_DUP_{ts}"
    amount = Decimal("2999.00")

    await conn.execute(
        """INSERT INTO payment_intents
           (payment_intent_id, order_id, merchant_id, amount, currency, current_state, active_rail)
           VALUES ($1, $2, 'demo_merchant', $3, 'INR', 'CAPTURED', 'UPI_HDFC')
           ON CONFLICT (payment_intent_id) DO NOTHING""",
        intent_id, order_id, amount,
    )

    # First capture on HDFC
    await conn.execute(
        """INSERT INTO external_executions
           (payment_intent_id, rail_id, external_txn_id, operation, amount, status, idempotency_key)
           VALUES ($1, 'UPI_HDFC', $2, 'CAPTURE', $3, 'SUCCESS', $4)
           ON CONFLICT (idempotency_key) DO NOTHING""",
        intent_id, f"TXN_HDFC_{ts}", amount, f"idem_hdfc_{intent_id}",
    )

    # Duplicate capture event arrives from ICICI
    ext_evt = f"evt_dup_{ts}"
    await conn.execute(
        """INSERT INTO payment_events
           (payment_intent_id, source, external_event_id, event_type, payload, trace_id)
           VALUES ($1, 'SIMULATOR', $2, 'DUPLICATE_CAPTURE', $3, $4)""",
        intent_id, ext_evt,
        json.dumps({"status": "SUCCESS", "scenario": "CROSS_RAIL_DUPLICATE", "duplicate_rail": "UPI_ICICI", "amount": str(amount)}),
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
    A 'CAPTURED' webhook arrives before the 'AUTHORIZED' webhook.
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
           VALUES ($1, 'SIMULATOR', $2, 'PAYMENT_CAPTURED', $3, $4)""",
        intent_id, f"evt_ooo_cap_{ts}",
        json.dumps({"status": "SUCCESS", "scenario": "OUT_OF_ORDER", "amount": str(amount)}),
        f"trace_ooo_{ts}",
    )

    # Authorized event arrives second (but was supposed to be first)
    await conn.execute(
        """INSERT INTO payment_events
           (payment_intent_id, source, external_event_id, event_type, payload, trace_id)
           VALUES ($1, 'SIMULATOR', $2, 'PAYMENT_AUTHORIZED', $3, $4)""",
        intent_id, f"evt_ooo_auth_{ts}",
        json.dumps({"status": "SUCCESS", "scenario": "OUT_OF_ORDER_LATE", "amount": str(amount)}),
        f"trace_ooo_{ts}",
    )

    await conn.execute(
        """INSERT INTO outbox_events (event_type, aggregate_id, payload, status)
           VALUES ('RESOLVE_INTENT', $1, $2, 'PENDING')""",
        str(intent_id),
        json.dumps({"payment_intent_id": str(intent_id), "scenario": "OUT_OF_ORDER"}),
    )

    return {"scenario": "OUT_OF_ORDER", "payment_intent_id": str(intent_id), "amount": str(amount), "rail": rail}
