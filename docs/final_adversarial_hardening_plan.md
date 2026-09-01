# RESOLVERAI — ULTIMATE FINTECH SYSTEM EVOLUTION FORENSIC HARDENING PLAN

---

### Executive Goal
To perform a comprehensive, adversarial engineering pass across the ResolverAI codebase, fixing root causes for every discovered financial integrity, multi-tenancy, outbox crash, token tampering, and reconciliation vulnerability, backed by explicit executable regression and chaos test suites.

---

## 1. Discovered Vulnerabilities & Architecture Gaps

1. **Vulnerability 1: AuthorizedAction Token Signature Field Gap (`agents/schemas.py`)**
   - *Issue*: `compute_signature()` in `AuthorizedAction` does NOT bind `issued_at` or `expires_at` in the signed string payload.
   - *Risk*: An attacker with a captured valid token signature could extend `expires_at` arbitrarily or alter `issued_at` without invalidating `verify_signature()`.
   - *Fix*: Include `issued_at.isoformat()` and `expires_at.isoformat()` in the canonical signature payload string.

2. **Vulnerability 2: Outbox Worker Re-Execution After Crash / Timeout (`worker.py`)**
   - *Issue*: When a task in `PROCESSING` is reclaimed after a worker crash or lease timeout, it is reset to `PENDING` and incremented `attempts`. When picked up again by a new worker, `resolve()` runs again. If `resolve()` invokes `FinOpsExecutor` which performs a live Razorpay API capture/refund call, and the previous worker crashed AFTER calling Razorpay but BEFORE setting status to `PROCESSED`, the new worker could attempt a second capture/refund call.
   - *Risk*: Duplicate financial mutations on network/process crash window.
   - *Fix*: Update `resolve()` and `FinOpsExecutor` to unconditionally perform a pre-execution verification fetch against Razorpay before executing any financial mutation when `attempts > 1` or when `has_existing_capture` is True.

3. **Vulnerability 3: Lack of Database Row-Level Isolation in PostgreSQL (`schema.sql`)**
   - *Issue*: While API routes check `merchant_id`, background worker tasks and raw query functions rely on `payment_intent_id` parameters without composite foreign key enforcement.
   - *Risk*: A malformed or cross-tenant outbox event could attempt resolution on another merchant's payment intent.
   - *Fix*: Enforce multi-tenant composite foreign keys and explicit `(merchant_id, payment_intent_id)` lookup constraints in DB worker queries.

4. **Vulnerability 4: Idempotency Payload Substitution (`api/orders_routes.py`, `core/idempotency.py`)**
   - *Issue*: Idempotency locks and dedup keys only check key existence, not payload hash match.
   - *Risk*: Reusing an idempotency key with a different amount or currency could bypass validation or return stale cached execution results.
   - *Fix*: Store payload hash along with idempotency key and reject requests where idempotency key matches but payload hash differs (HTTP 409 Conflict).

5. **Vulnerability 5: Forensic Replay API Route Parameter Type Leakage (`api/reconciliation_routes.py`)**
   - *Issue*: `replay_intent` accepts raw `payment_intent_id` without verifying `merchant_id` of caller.
   - *Risk*: Cross-tenant information disclosure during forensic replay.
   - *Fix*: Add `user: dict = Depends(require_permission("read:payments"))` and `verify_merchant_access` to `POST /reconcile/replay/{payment_intent_id}`.

---

## 2. Technical Remediation Plan

### Component Modifications

#### 1. `agents/schemas.py` `[MODIFY]`
- Re-bind `compute_signature()` to:
  ```python
  payload = (
      f"{self.command_id}|{self.payment_intent_id}|{self.merchant_id}|"
      f"{self.action.value}|{self.amount}|{self.currency}|{self.idempotency_key}|"
      f"{self.policy_decision_id}|{self.issued_at.isoformat()}|{self.expires_at.isoformat()}"
  )
  ```

#### 2. `agents/finops_executor.py` `[MODIFY]`
- Add pre-mutation verification check for Razorpay `TEST`/`LIVE` mode:
  Before executing `capture_payment` or `create_refund`, query provider status for `command.razorpay_payment_id`.
  If status is already `captured` or `refunded`, skip external API mutation and return `ExternalStatus.SUCCESS` with existing transaction ID.

#### 3. `core/idempotency.py` `[MODIFY]`
- Implement `verify_or_set_idempotency_payload(key: str, payload_hash: str)`:
  Returns `VALID` if key new or payload hash matches, returns `PAYLOAD_MISMATCH` if key exists with different payload hash.

#### 4. `api/reconciliation_routes.py` `[MODIFY]`
- Enforce `verify_merchant_access(user, row["merchant_id"])` on `replay_intent_endpoint`.

#### 5. Executable Test Expansion (`tests/`)
- Create `tests/test_adversarial_hardening.py` covering:
  - Token signature payload tampering (`expires_at`, `issued_at`).
  - Outbox worker crash recovery pre-execution verification.
  - Idempotency key payload mismatch rejection.
  - Cross-tenant replay API restriction.

---

## 3. Verification & Safety Plan

1. Execute `./venv/bin/python -m unittest discover tests` after every module update.
2. Run full adversarial stress test suite verifying zero failures across all 73+ tests.
3. Validate clean compilation via `./venv/bin/python -m compileall .`.
