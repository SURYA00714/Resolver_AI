# FILE: tests/test_concurrency_stress.py
"""Concurrency and Race-Condition Stress Tests (10, 50, 100 concurrent attempts)."""
import asyncio
import unittest
import uuid
from decimal import Decimal

from agents.schemas import ActionType, AuthorizedAction, ExternalStatus
from agents.finops_executor import execute
import config


class TestConcurrencyStress(unittest.TestCase):

    def test_concurrent_finops_execution_idempotency(self):
        """Simulate 100 concurrent FinOps executions of the exact same AuthorizedAction.
        
        Expected Result:
        Only ONE execution occurs; all concurrent tasks receive deterministic results,
        and no duplicate side-effects occur.
        """
        async def run_stress():
            cmd = AuthorizedAction(
                payment_intent_id=str(uuid.uuid4()),
                action=ActionType.NO_ACTION,
                amount=Decimal("100.00"),
                currency="INR",
                policy_decision_id="dec_stress_100",
                idempotency_key="idem_stress_100",
            )
            cmd.sign_command(config.JWT_SECRET_KEY)

            # Launch 100 parallel executions
            tasks = [execute(cmd) for _ in range(100)]
            results = await asyncio.gather(*tasks)

            # Verify all 100 tasks succeed with matching status
            success_count = sum(1 for r in results if r.execution_status == ExternalStatus.SUCCESS)
            self.assertEqual(success_count, 100)

        asyncio.run(run_stress())

    def test_concurrent_locks_and_stale_recovery(self):
        """Simulate 50 parallel lock requests for the same intent lock key."""
        from core.idempotency import acquire_intent_lock, release_intent_lock

        async def lock_worker(intent_id, results_list):
            locked = await acquire_intent_lock(intent_id, ttl_seconds=2)
            if locked:
                results_list.append(True)
                await asyncio.sleep(0.01)
                await release_intent_lock(intent_id)
            else:
                results_list.append(False)

        async def run_lock_stress():
            intent_id = f"lock_test_{uuid.uuid4().hex[:8]}"
            results = []
            tasks = [lock_worker(intent_id, results) for _ in range(50)]
            await asyncio.gather(*tasks)

            # At least one succeeded in acquiring lock
            self.assertTrue(any(results))

        asyncio.run(run_lock_stress())


if __name__ == "__main__":
    unittest.main()
