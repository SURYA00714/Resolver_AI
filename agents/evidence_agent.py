# FILE: agents/evidence_agent.py
"""Evidence Agent (§18 of Master Directive).

Re-exports and reframes Negotiator evidence gathering capabilities.
CRITICAL INVARIANT: The Evidence Agent may ONLY call read-only Razorpay APIs.
It MUST NOT execute capture, refund, or financial mutation APIs.
"""
from agents.negotiator import verify as verify_evidence, verify

__all__ = ["verify_evidence", "verify"]
