# FILE: core/state_machine.py
"""Payment state machine with 10 states and deterministic transitions (§17)."""

# --- States ---
CREATED = "CREATED"
PENDING_RAIL = "PENDING_RAIL"
UNCERTAIN = "UNCERTAIN"
VERIFYING = "VERIFYING"
CAPTURED = "CAPTURED"
FAILED = "FAILED"
DUPLICATE_SUSPECTED = "DUPLICATE_SUSPECTED"
COMPENSATING = "COMPENSATING"
RECONCILED = "RECONCILED"
MANUAL_REVIEW = "MANUAL_REVIEW"

VALID_STATES = {
    CREATED, PENDING_RAIL, UNCERTAIN, VERIFYING, CAPTURED,
    FAILED, DUPLICATE_SUSPECTED, COMPENSATING, RECONCILED, MANUAL_REVIEW,
}

TERMINAL_STATES = {CAPTURED, RECONCILED, MANUAL_REVIEW, FAILED}

# --- Transition Table ---
# (current_state, event) → next_state
TRANSITIONS = {
    (CREATED, "SUBMIT"):              PENDING_RAIL,
    (PENDING_RAIL, "RAIL_ACK"):       VERIFYING,
    (PENDING_RAIL, "TIMEOUT"):        UNCERTAIN,
    (PENDING_RAIL, "RAIL_REJECT"):    FAILED,
    (VERIFYING, "VERIFIED_SUCCESS"):  CAPTURED,
    (VERIFYING, "VERIFIED_FAILED"):   FAILED,
    (UNCERTAIN, "VERIFIED_SUCCESS"):  CAPTURED,
    (UNCERTAIN, "VERIFIED_FAILED"):   FAILED,
    (UNCERTAIN, "DUPLICATE_DETECTED"):DUPLICATE_SUSPECTED,
    (UNCERTAIN, "TIMEOUT"):           UNCERTAIN,  # stay uncertain
    (CAPTURED, "LATE_DUPLICATE"):     DUPLICATE_SUSPECTED,
    (DUPLICATE_SUSPECTED, "COMPENSATE"):         COMPENSATING,
    (COMPENSATING, "COMPENSATION_CONFIRMED"):    RECONCILED,
    (COMPENSATING, "COMPENSATION_FAILED"):       MANUAL_REVIEW,
}


def transition(state: str, event: str) -> str:
    """Return the next state for (state, event). Falls back to MANUAL_REVIEW."""
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
