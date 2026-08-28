# FILE: core/rbac.py
"""Role-Based Access Control (RBAC) enforcement for ResolverAI."""
from typing import Optional
from fastapi import Depends, HTTPException, Header

from core.auth import decode_access_token, has_permission


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency: Extract and validate JWT from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"error": "missing_token", "message": "Authorization header with Bearer token required."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_token", "message": "Token is invalid or expired."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def require_permission(permission: str):
    """Dependency factory: Require a specific permission."""
    async def _check(authorization: Optional[str] = Header(None)) -> dict:
        payload = await get_current_user(authorization)
        if not has_permission(payload, permission):
            role = payload.get("role", "unknown")
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_permissions",
                    "message": f"Role '{role}' does not have permission '{permission}'.",
                    "required_permission": permission,
                    "your_role": role,
                },
            )
        return payload
    return _check


def require_role(role: str):
    """Dependency factory: Require a specific role or higher."""
    role_hierarchy = {"viewer": 0, "operator": 1, "admin": 2}
    async def _check(authorization: Optional[str] = Header(None)) -> dict:
        payload = await get_current_user(authorization)
        user_role = payload.get("role", "viewer")
        if role_hierarchy.get(user_role, 0) < role_hierarchy.get(role, 0):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_role",
                    "message": f"Role '{user_role}' cannot access this resource. Required: '{role}'.",
                    "required_role": role,
                    "your_role": user_role,
                },
            )
        return payload
    return _check
