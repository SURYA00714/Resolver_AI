# RESOLVERAI — FINANCIAL SAFETY INVARIANTS & FORMAL CONSTRAINTS

---

### Invariant Catalog

#### F1: No Unauthorized Financial Mutation
- **Why It Matters**: Financial mutations (`CAPTURE`, `REFUND`, `VOID`) must never execute without explicit Policy Engine authorization.
- **Attack Vector**: Direct API invocation of FinOps executor or forgery of `AuthorizedAction`.
- **Enforcement Layer**: `agents/finops_executor.py` validates cryptographic HMAC signature on `AuthorizedAction` using constant-time comparison before executing any mutation.
- **Test**: `test_invariant_7_tampered_signature_rejected`, `test_invariant_30_unapproved_policy_no_mutation`.
- **Failure Behavior**: FinOps Executor aborts execution with `ExternalStatus.FAILED` ("Invalid capability token signature").

#### F2: Zero Double-Capture Guarantee
- **Why It Matters**: Capturing a payment twice leads to double-charge merchant liability and customer balance degradation.
- **Attack Vector**: Concurrent webhook ingestion or replayed capture commands.
- **Enforcement Layer**: `PolicyEngine` (Rule 4), database state machine transitions (`CAPTURED` state is terminal), and `external_executions` unique constraints.
- **Test**: `test_invariant_1_no_double_capture`, `test_concurrent_finops_execution_idempotency`.
- **Failure Behavior**: Policy Engine returns `DecisionType.REJECT` with `RULE_4_DUPLICATE_PROTECTION`.

#### F3: Economic Identity Preservation (Amount & Currency Match)
- **Why It Matters**: A payment intent created for ₹500.00 INR must not be captured for ₹5,000.00 or $500.00 USD.
- **Attack Vector**: Webhook parameter tampering, currency injection, or floating-point precision abuse.
- **Enforcement Layer**: `domain/money.py` enforces `Decimal` quantization and ISO-4217 currency whitelisting; `PolicyEngine` (Rule 3) compares exact values.
- **Test**: `test_invariant_3_amount_mismatch_blocked`, `test_invariant_4_currency_mismatch_blocked`.
- **Failure Behavior**: Policy Engine returns `DecisionType.REJECT` with `RULE_3_ECONOMIC_IDENTITY`.

#### F4: Multi-Tenant Tenant Isolation Boundary
- **Why It Matters**: Merchant A must never be able to inspect, reconcile, or trigger actions on Merchant B's payment intents or reconciliation cases.
- **Attack Vector**: Insecure Direct Object Reference (IDOR/BOLA) via payment intent or case UUID manipulation in REST APIs.
- **Enforcement Layer**: `api/payment_routes.py`, `api/orders_routes.py`, and `api/reconciliation_routes.py` enforce `verify_merchant_access(user, row["merchant_id"])`.
- **Test**: `test_invariant_28_cross_tenant_token_isolation`.
- **Failure Behavior**: Returns `HTTP 403 Forbidden` ("Cross-tenant access forbidden").

#### F5: Terminal State Immutability
- **Why It Matters**: Operational states (`CAPTURED`, `FAILED`, `RECONCILED`) represent settled truth and must never rewind to pending states.
- **Attack Vector**: Late, delayed, or out-of-order webhook delivery.
- **Enforcement Layer**: `core/state_machine.py` transition matrix defines terminal state self-loops for late events.
- **Test**: `test_invariant_10_illegal_transitions_fall_to_manual_review`, `test_invariant_27_late_events_preserve_terminal_state`.
- **Failure Behavior**: Transition function returns current terminal state without modifying intent truth.

#### F6: Durable Outbox Worker Crash Recovery
- **Why It Matters**: A worker process dying (SIGKILL/OOM) while processing an outbox resolution task must not leave outbox tasks permanently stuck in `PROCESSING`.
- **Attack Vector**: Process crash during outbox task processing.
- **Enforcement Layer**: `worker.py` executes `reclaim_stuck_tasks()` to reset tasks stuck >60s to `PENDING` with exponential backoff retry.
- **Test**: `test_outbox_lease_recovery`.
- **Failure Behavior**: Task is safely reclaimed and retried by active workers.

#### F7: 100% Read-Only Forensic Replay Engine
- **Why It Matters**: Incident analysis and forensic simulation must never mutate database state or trigger external Razorpay financial calls.
- **Attack Vector**: Replay endpoint execution during post-mortem analysis.
- **Enforcement Layer**: `core/replay.py` executes in simulation mode with zero DB mutation statements or external mutation calls.
- **Test**: `test_invariant_29_forensic_replay_read_only`.
- **Failure Behavior**: Replay returns simulation result object with `is_read_only: True`.
