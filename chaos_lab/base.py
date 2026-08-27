# FILE: chaos_lab/base.py
"""Base class for Local Chaos Lab synthetic rails (§22)."""
from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Any, Dict


class PaymentRailBase(ABC):
    """Abstract base class for synthetic payment rails in Local Chaos Test Laboratory."""

    def __init__(self, rail_name: str):
        self.rail_name = rail_name

    @abstractmethod
    async def authorize(self, amount: Decimal, idempotency_key: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def status(self, external_txn_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def capture(self, external_txn_id: str, amount: Decimal) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def void(self, external_txn_id: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def refund(self, external_txn_id: str, amount: Decimal) -> Dict[str, Any]:
        pass
