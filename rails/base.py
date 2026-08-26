# FILE: rails/base.py
"""Abstract base for all payment rails (§26)."""
import abc
from decimal import Decimal
from typing import Any, Dict


class PaymentRailBase(abc.ABC):
    """Every rail must implement these 5 operations."""

    def __init__(self, rail_name: str):
        self.rail_name = rail_name

    @abc.abstractmethod
    async def authorize(self, amount: Decimal, idempotency_key: str) -> Dict[str, Any]:
        ...

    @abc.abstractmethod
    async def status(self, external_txn_id: str) -> Dict[str, Any]:
        ...

    @abc.abstractmethod
    async def capture(self, external_txn_id: str, amount: Decimal) -> Dict[str, Any]:
        ...

    @abc.abstractmethod
    async def void(self, external_txn_id: str) -> Dict[str, Any]:
        ...

    @abc.abstractmethod
    async def refund(self, external_txn_id: str, amount: Decimal) -> Dict[str, Any]:
        ...
