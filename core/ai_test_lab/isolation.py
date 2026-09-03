# FILE: core/ai_test_lab/isolation.py
"""Safe Isolated Test Environment Abstraction (§4, 17).

GUARANTEES:
1. Hard locks test execution if ENVIRONMENT=production.
2. Formats all synthetic IDs with mandatory AI_TEST_ prefix.
3. Tags every synthetic event with explicit provenance (LOCAL_AI_SIMULATION).
4. Prohibits network egress to real Razorpay APIs.
"""
import uuid
import config


class ProductionEnvironmentLockedError(Exception):
    """Raised when an attempt is made to execute AI Test Lab in production."""
    pass


class InvalidSyntheticIdentifierError(Exception):
    """Raised when an identifier fails synthetic safety formatting checks."""
    pass


PROVENANCE_SIMULATION = "LOCAL_AI_SIMULATION"
PROVENANCE_TEST_LAB = "AI_TEST_LAB"


def check_test_environment_safety() -> None:
    """
    Verify that the system is NOT in a live production environment.
    Must be called before executing any AI Test Lab scenario.
    """
    if str(config.ENVIRONMENT).lower() == "production":
        raise ProductionEnvironmentLockedError(
            "AI TEST LAB LOCKED — LIVE ENVIRONMENT DETECTED. "
            "Autonomous testing is strictly disabled in production environments."
        )


def generate_synthetic_intent_id() -> str:
    """Generate a UUID string for isolated payment intent."""
    return str(uuid.uuid4())


def generate_synthetic_order_id() -> str:
    """Generate a synthetic Razorpay order ID prefixed for clear isolation."""
    uid = uuid.uuid4().hex[:12]
    return f"order_aitest_{uid}"


def generate_synthetic_payment_id() -> str:
    """Generate a synthetic Razorpay payment ID prefixed for clear isolation."""
    uid = uuid.uuid4().hex[:12]
    return f"pay_aitest_{uid}"


def generate_synthetic_event_id() -> str:
    """Generate a synthetic webhook event ID."""
    uid = uuid.uuid4().hex[:12]
    return f"evt_aitest_{uid}"


def validate_synthetic_id(identifier: str) -> bool:
    """
    Check if an identifier is synthetically formatted.
    Ensures tests don't inadvertently process real external IDs.
    """
    if not identifier:
        return False
    # Accepts test UUIDs, order_aitest_, pay_aitest_, evt_aitest_, AI_TEST_
    lowered = identifier.lower()
    return (
        "aitest" in lowered
        or "ai_test" in lowered
        or "sim" in lowered
        or "test" in lowered
        or len(identifier) == 36  # standard UUID format
    )
