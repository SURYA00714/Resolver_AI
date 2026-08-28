# FILE: core/auth.py
"""Pure Python standard-library JWT authentication module with RBAC.

Uses HMAC-SHA256 with base64url encoding.
Zero external dependencies required.
"""
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Dict, Optional, Set

import config

SECRET_KEY = config.JWT_SECRET_KEY
ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = config.JWT_EXPIRE_SECONDS

# Credentials from environment (single-tenant merchant control plane)
OPERATOR_USERNAME = config.OPERATOR_USERNAME
OPERATOR_PASSWORD = config.OPERATOR_PASSWORD

# Default admin user for initial setup
DEFAULT_ADMIN_USERNAME = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
DEFAULT_ADMIN_ROLE = "admin"

# Valid roles
VALID_ROLES: Set[str] = set(config.RBAC_ROLES.keys())


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(username: str, role: str = "operator") -> str:
    """Create a signed JWT access token for a given user and role."""
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role: {role}. Must be one of {VALID_ROLES}")
    header = {"alg": ALGORITHM, "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": username,
        "role": role,
        "permissions": config.RBAC_ROLES[role]["permissions"],
        "iat": now,
        "exp": now + TOKEN_EXPIRE_SECONDS,
        "iss": "resolverai",
    }
    header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[Dict]:
    """Verify signature and expiration of a JWT access token. Returns payload dict or None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _base64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        exp = payload.get("exp")
        if exp and time.time() > exp:
            return None
        return payload
    except Exception:
        return None


def get_role_from_token(payload: Optional[Dict]) -> Optional[str]:
    """Extract role from JWT payload."""
    if not payload:
        return None
    return payload.get("role")


def has_permission(payload: Optional[Dict], permission: str) -> bool:
    """Check if the token holder has a specific permission."""
    if not payload:
        return False
    permissions = payload.get("permissions", [])
    return permission in permissions
