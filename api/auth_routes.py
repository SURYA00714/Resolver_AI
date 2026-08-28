# FILE: api/auth_routes.py
"""Authentication REST API for Merchant Control Plane.

Provides POST /auth/login and GET /auth/me endpoints.
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

import config
from core.auth import (
    OPERATOR_USERNAME,
    OPERATOR_PASSWORD,
    create_access_token,
    decode_access_token,
    VALID_ROLES,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str
    role: str = "operator"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    username: str
    role: str
    permissions: list


@router.post("/login", summary="Merchant operator authentication", response_model=LoginResponse)
async def login(req: LoginRequest):
    """
    Authenticate merchant operator credentials and return a signed JWT token.
    Credentials configured via OPERATOR_USERNAME and OPERATOR_PASSWORD environment variables.
    Supported roles: viewer, operator, admin.
    """
    if req.username != OPERATOR_USERNAME or req.password != OPERATOR_PASSWORD:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_credentials", "message": "Invalid username or password."},
        )

    role = req.role if req.role in VALID_ROLES else "operator"
    token = create_access_token(username=req.username, role=role)
    permissions = []
    for r, perms in config.RBAC_ROLES.items():
        if r == role:
            permissions = perms["permissions"]
            break
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": config.JWT_EXPIRE_SECONDS,
        "username": req.username,
        "role": role,
        "permissions": permissions,
    }


@router.get("/me", summary="Check current auth session")
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Verify session token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"authenticated": False, "username": None, "role": None}

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        return {"authenticated": False, "username": None, "role": None}

    return {
        "authenticated": True,
        "username": payload.get("sub"),
        "role": payload.get("role"),
        "permissions": payload.get("permissions", []),
        "exp": payload.get("exp"),
    }


@router.get("/roles", summary="List available roles and permissions")
async def list_roles():
    """Return available RBAC roles and their permissions."""
    return {
        "roles": [
            {"role": role, "description": data["description"], "permissions": data["permissions"]}
            for role, data in config.RBAC_ROLES.items()
        ]
    }
