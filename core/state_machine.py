# FILE: core/state_machine.py
"""Payment state machine with 15 states, deterministic transitions, and terminal protection (§10)."""

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
# Every legal transition is explicit. Illegal transitions fall to MANUAL_REVIEW.
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
    (AUTHORIZED, "PAYMENT_FAILED"):         FAILED,

    (UNCERTAIN, "VERIFIED_SUCCESS"):        CAPTURED,
    (UNCERTAIN, "VERIFIED_AUTHORIZED"):     AUTHORIZED,
    (UNCERTAIN, "VERIFIED_FAILED"):         FAILED,
    (UNCERTAIN, "DUPLICATE_DETECTED"):      DUPLICATE_SUSPECTED,
    (UNCERTAIN, "TIMEOUT"):                 UNCERTAIN,
    (UNCERTAIN, "UNKNOWN_RESPONSE"):        UNKNOWN,
    (UNCERTAIN, "ESCALATE"):                MANUAL_REVIEW,

    (CAPTURED, "LATE_DUPLICATE"):           DUPLICATE_SUSPECTED,
    (CAPTURED, "REFUND_INITIATED"):         ACTION_EXECUTING,
    (CAPTURED, "REFUND_COMPLETED"):         RECONCILED,

    (DUPLICATE_SUSPECTED, "ACTION_START"):  ACTION_PENDING,
    (DUPLICATE_SUSPECTED, "ESCALATE"):      MANUAL_REVIEW,

    (ACTION_PENDING, "EXECUTE"):            ACTION_EXECUTING,
    (ACTION_PENDING, "ESCALATE"):           MANUAL_REVIEW,

    (ACTION_EXECUTING, "CONFIRM"):          ACTION_CONFIRMED,
    (ACTION_EXECUTING, "FAIL"):             RECONCILIATION_REQUIRED,
    (ACTION_EXECUTING, "ESCALATE"):         MANUAL_REVIEW,

    (ACTION_CONFIRMED, "RESOLVED"):         RECONCILED,
    (ACTION_CONFIRMED, "ESCALATE"):         MANUAL_REVIEW,

    (RECONCILIATION_REQUIRED, "ESCALATE"):  MANUAL_REVIEW,
    (RECONCILIATION_REQUIRED, "RECONCILE_SUCCESS"): CAPTURED,
    (RECONCILIATION_REQUIRED, "RECONCILE_FAILED"): FAILED,

    (UNKNOWN, "ESCALATE"):                  MANUAL_REVIEW,
    (UNKNOWN, "VERIFIED_SUCCESS"):          CAPTURED,
    (UNKNOWN, "VERIFIED_FAILED"):           FAILED,
    (UNKNOWN, "VERIFIED_AUTHORIZED"):       AUTHORIZED,

    (MANUAL_REVIEW, "OPERATOR_RECONCILE"):  RECONCILED,
    (MANUAL_REVIEW, "OPERATOR_FORCE_CAPTURE"): CAPTURED,
    (MANUAL_REVIEW, "OPERATOR_FORCE_FAILED"): FAILED,
}


def transition(state: str, event: str) -> str:
    """Return the next state for (state, event).

    Critical rule: TIMEOUT never equals FAILED. Unknown events fall to MANUAL_REVIEW.
    Terminal states do not allow outgoing transitions except specific terminal-bound events.
    """
    if state not in VALID_STATES:
        raise ValueError(f"Invalid state: {state}")

    # Terminal states: prevent rewind
    if state in TERMINAL_STATES:
        next_state = TRANSITIONS.get((state, event))
        if next_state is None:
            return state  # terminal states stay terminal
        return next_state

    next_state = TRANSITIONS.get((state, event))
    if next_state is None:
        return MANUAL_REVIEW
    return next_state


def is_terminal(state: str) -> bool:
    """Check if a state is terminal (no further automated transitions)."""
    return state in TERMINAL_STATES


def is_transition_allowed(current_state: str, event: str) -> bool:
    """Check if a specific transition is explicitly defined (not a fallback)."""
    if current_state not in VALID_STATES:
        return False
    return (current_state, event) in TRANSITIONS


def allowed_events(state: str) -> list[str]:
    """Return the list of events valid from a given state (explicit transitions only)."""
    if state not in VALID_STATES:
        return []
    return [event for (s, event) in TRANSITIONS if s == state]
