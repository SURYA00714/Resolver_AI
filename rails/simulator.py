# FILE: rails/simulator.py
"""4 synthetic payment rails with configurable fault injection (§26-28)."""
import asyncio
import os
import random
import uuid
from decimal import Decimal
from typing import Any, Dict, Optional, Set

from rails.base import PaymentRailBase

CHAOS_SEED = int(os.getenv("CHAOS_SEED", "42"))


class SyntheticRail(PaymentRailBase):
    """Configurable synthetic rail with deterministic chaos injection."""

    _processed_keys: Set[str] = set()
    _transactions: Dict[str, Dict[str, Any]] = {}

    def __init__(
        self,
        rail_name: str,
        latency_ms: int = 200,
        success_rate: float = 0.95,
        chaos_mode: Optional[str] = None,
    ):
        super().__init__(rail_name)
        self.latency_ms = latency_ms
        self.success_rate = success_rate
        self.chaos_mode = chaos_mode
        self._rng = random.Random(CHAOS_SEED)

    async def _simulate_latency(self) -> None:
        await asyncio.sleep(self.latency_ms / 1000.0)

    async def authorize(self, amount: Decimal, idempotency_key: str) -> Dict[str, Any]:
        await self._simulate_latency()

        # Idempotency check
        if idempotency_key in self._processed_keys:
            return {"status": "DUPLICATE", "txn_id": None}

        # Chaos injection
        if self.chaos_mode == "TIMEOUT":
            self._processed_keys.add(idempotency_key)
            return {"status": "UNKNOWN", "txn_id": None}

        if self.chaos_mode == "LATE_AUTH":
            txn_id = f"LATE_{uuid.uuid4().hex[:8]}"
            self._processed_keys.add(idempotency_key)
            self._transactions[txn_id] = {"status": "SUCCESS", "amount": amount, "rail": self.rail_name}
            return {"status": "SUCCESS", "txn_id": txn_id}

        if self.chaos_mode == "DUPLICATE":
            txn_id = f"DUP_{uuid.uuid4().hex[:8]}"
            self._processed_keys.add(idempotency_key)
            self._transactions[txn_id] = {"status": "DUPLICATE", "amount": amount, "rail": self.rail_name}
            return {"status": "DUPLICATE", "txn_id": txn_id}

        # Normal flow — deterministic based on seed
        if self._rng.random() < self.success_rate:
            txn_id = f"TXN_{uuid.uuid4().hex[:8]}"
            self._processed_keys.add(idempotency_key)
            self._transactions[txn_id] = {"status": "SUCCESS", "amount": amount, "rail": self.rail_name}
            return {"status": "SUCCESS", "txn_id": txn_id}
        else:
            self._processed_keys.add(idempotency_key)
            return {"status": "FAILED", "txn_id": None}

    async def status(self, external_txn_id: str) -> Dict[str, Any]:
        await self._simulate_latency()
        txn = self._transactions.get(external_txn_id)
        if txn:
            return {"status": txn["status"], "amount": txn["amount"]}
        return {"status": "NOT_FOUND"}

    async def capture(self, external_txn_id: str, amount: Decimal) -> Dict[str, Any]:
        await self._simulate_latency()
        txn = self._transactions.get(external_txn_id)
        if txn and txn["status"] == "SUCCESS":
            txn["status"] = "CAPTURED"
            return {"status": "SUCCESS", "captured_amount": amount}
        return {"status": "FAILED", "reason": "Transaction not in capturable state"}

    async def void(self, external_txn_id: str) -> Dict[str, Any]:
        await self._simulate_latency()
        txn = self._transactions.get(external_txn_id)
        if txn and txn["status"] in ("SUCCESS", "CAPTURED", "DUPLICATE"):
            txn["status"] = "VOIDED"
            return {"status": "VOIDED"}
        return {"status": "FAILED", "reason": "Cannot void"}

    async def refund(self, external_txn_id: str, amount: Decimal) -> Dict[str, Any]:
        await self._simulate_latency()
        txn = self._transactions.get(external_txn_id)
        if txn and txn["status"] in ("CAPTURED", "SUCCESS"):
            txn["status"] = "REFUNDED"
            return {"status": "REFUNDED", "refunded_amount": amount}
        return {"status": "FAILED", "reason": "Cannot refund"}


# --- 4 Pre-configured Rails ---

def get_rail(rail_name: str, chaos_mode: Optional[str] = None) -> SyntheticRail:
    """Factory to get a configured rail instance."""
    configs = {
        "UPI_HDFC": {"latency_ms": 200, "success_rate": 0.95},
        "UPI_ICICI": {"latency_ms": 300, "success_rate": 0.90},
        "CARD_AXIS": {"latency_ms": 500, "success_rate": 0.85},
        "NETBANKING_SBI": {"latency_ms": 800, "success_rate": 0.80},
    }
    config = configs.get(rail_name, {"latency_ms": 300, "success_rate": 0.90})
    return SyntheticRail(
        rail_name=rail_name,
        latency_ms=config["latency_ms"],
        success_rate=config["success_rate"],
        chaos_mode=chaos_mode,
    )
