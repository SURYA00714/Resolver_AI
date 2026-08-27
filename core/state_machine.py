# FILE: core/state_machine.py
"""Payment state machine with 15 states and deterministic transitions (§10)."""

# --- States ---
CREATED = "CREATED"
PENDING_RAIL = "PENDING_RAIL"
UNCERTAIN = "UNCERTAIN"
VERIFYING = "VERIFYING"
AUTHORIZED = "AUTHORIZED"
CAPTURED = "CAPTURED"
FAILED = "FAILED"
DUPLICATE_SUSPECTED = "DUPLICATE_SUSPECTED"
RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"
ACTION_PENDING = "ACTION_PENDING"
ACTION_EXECUTING = "ACTION_EXECUTING"
ACTION_CONFIRMED = "ACTION_CONFIRMED"
UNKNOWN = "UNKNOWN"
MANUAL_REVIEW = "MANUAL_REVIEW"
RECONCILED = "RECONCILED"

VALID_STATES = {
    CREATED, PENDING_RAIL, UNCERTAIN, VERIFYING, AUTHORIZED, CAPTURED,
    FAILED, DUPLICATE_SUSPECTED, RECONCILIATION_REQUIRED, ACTION_PENDING,
    ACTION_EXECUTING, ACTION_CONFIRMED, UNKNOWN, MANUAL_REVIEW, RECONCILED,
}

TERMINAL_STATES = {CAPTURED, RECONCILED, MANUAL_REVIEW, FAILED}

# --- Transition Table ---
# (current_state, event) → next_state
TRANSITIONS = {
    (CREATED, "SUBMIT"):                    PENDING_RAIL,
    (CREATED, "PAYMENT_AUTHORIZED"):        AUTHORIZED,
    (CREATED, "PAYMENT_CAPTURED"):          CAPTURED,
    (CREATED, "PAYMENT_FAILED"):            FAILED,
    (PENDING_RAIL, "RAIL_ACK"):             VERIFYING,
    (PENDING_RAIL, "TIMEOUT"):              UNCERTAIN,
    (PENDING_RAIL, "RAIL_REJECT"):          FAILED,
    (VERIFYING, "VERIFIED_SUCCESS"):        CAPTURED,
    (VERIFYING, "VERIFIED_AUTHORIZED"):     AUTHORIZED,
    (VERIFYING, "VERIFIED_FAILED"):         FAILED,
    (VERIFYING, "UNKNOWN_STATUS"):          UNKNOWN,
    (AUTHORIZED, "CAPTURE_INITIATED"):      ACTION_EXECUTING,
    (AUTHORIZED, "PAYMENT_CAPTURED"):       CAPTURED,
    (UNCERTAIN, "VERIFIED_SUCCESS"):        CAPTURED,
    (UNCERTAIN, "VERIFIED_AUTHORIZED"):     AUTHORIZED,
    (UNCERTAIN, "VERIFIED_FAILED"):         FAILED,
    (UNCERTAIN, "DUPLICATE_DETECTED"):      DUPLICATE_SUSPECTED,
    (UNCERTAIN, "TIMEOUT"):                 UNCERTAIN,
    (UNCERTAIN, "UNKNOWN_RESPONSE"):        UNKNOWN,
    (CAPTURED, "LATE_DUPLICATE"):           DUPLICATE_SUSPECTED,
    (CAPTURED, "REFUND_INITIATED"):         ACTION_EXECUTING,
    (DUPLICATE_SUSPECTED, "ACTION_START"):  ACTION_PENDING,
    (ACTION_PENDING, "EXECUTE"):            ACTION_EXECUTING,
    (ACTION_EXECUTING, "CONFIRM"):          ACTION_CONFIRMED,
    (ACTION_EXECUTING, "FAIL"):             RECONCILIATION_REQUIRED,
    (ACTION_CONFIRMED, "RESOLVED"):         RECONCILED,
    (RECONCILIATION_REQUIRED, "ESCALATE"):  MANUAL_REVIEW,
    (UNKNOWN, "ESCALATE"):                  MANUAL_REVIEW,
    (UNKNOWN, "VERIFIED_SUCCESS"):          CAPTURED,
    (UNKNOWN, "VERIFIED_FAILED"):           FAILED,
}


def transition(state: str, event: str) -> str:
    """Return the next state for (state, event). Critical rule: TIMEOUT != FAILED. Defaults to MANUAL_REVIEW on invalid transition."""
    if state not in VALID_STATES:
        raise ValueError(f"Invalid state: {state}")
    next_state = TRANSITIONS.get((state, event))
    if next_state is None:
        return MANUAL_REVIEW
    return next_state


def is_terminal(state: str) -> bool:
    """Check if a state is terminal (no further automated transitions)."""
    return state in TERMINAL_STATES


def allowed_events(state: str) -> list[str]:
    """Return the list of events valid from a given state."""
    return [event for (s, event) in TRANSITIONS if s == state]
