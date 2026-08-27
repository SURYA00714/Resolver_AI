# FILE: domain/errors.py
"""Domain exceptions for ResolverAI (§1, 20)."""


class ResolverError(Exception):
    """Base exception for ResolverAI."""
    pass


class StateTransitionError(ResolverError):
    """Invalid state transition attempted."""
    pass


class PolicyViolationError(ResolverError):
    """Policy engine rule evaluation failure."""
    pass


class RazorpayAPIError(ResolverError):
    """Failure communicating with Razorpay API."""
    def __init__(self, message: str, status_code: int = 500, response_body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class WebhookSignatureError(ResolverError):
    """Webhook signature verification failed."""
    pass


class IdempotencyError(ResolverError):
    """Duplicate execution attempt blocked by idempotency key."""
    pass


class ReconciliationError(ResolverError):
    """Reconciliation conflict or ambiguity error."""
    pass
