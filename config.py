# FILE: config.py
"""ResolverAI Configuration (§6, 11)."""
import os
from dotenv import load_dotenv

load_dotenv()

# Database & Redis
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://resolver:resolver@localhost:5432/resolverai")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# JWT Authentication
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "resolverai_production_jwt_secret_key_change_me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_SECONDS = int(os.getenv("JWT_EXPIRE_SECONDS", "86400"))

# RBAC — Operator credentials (single-tenant merchant control plane)
OPERATOR_USERNAME = os.getenv("OPERATOR_USERNAME", "admin")
OPERATOR_PASSWORD = os.getenv("OPERATOR_PASSWORD", "admin123")

# RBAC — Role definitions
RBAC_ROLES = {
    "viewer": {
        "description": "Read-only access to dashboards, webhooks, audit trail",
        "permissions": ["read:dashboard", "read:payments", "read:webhooks", "read:audit", "read:cases", "read:integration"],
    },
    "operator": {
        "description": "Viewer + reconcile payments, resolve cases, verify with Razorpay",
        "permissions": ["read:dashboard", "read:payments", "read:webhooks", "read:audit", "read:cases", "read:integration",
                        "write:reconcile", "write:resolve_case", "write:verify_razorpay"],
    },
    "admin": {
        "description": "Operator + create orders, manage integrations, view dead letters",
        "permissions": ["read:dashboard", "read:payments", "read:webhooks", "read:audit", "read:cases", "read:integration",
                        "write:reconcile", "write:resolve_case", "write:verify_razorpay",
                        "write:create_order", "write:replay_webhook", "write:manage_integration"],
    },
}

# AI Settings
AI_MODE = os.getenv("AI_MODE", "DETERMINISTIC").upper()  # DETERMINISTIC or ENABLED
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Razorpay Integration Settings
RAZORPAY_MODE = os.getenv("RAZORPAY_MODE", "TEST").upper()  # TEST, LIVE
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
RAZORPAY_BASE_URL = os.getenv("RAZORPAY_BASE_URL", "https://api.razorpay.com/v1")

# System & Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
CHAOS_SEED = int(os.getenv("CHAOS_SEED", "42"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Rate Limiting
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "120"))
RATE_LIMIT_WEBHOOK_MAX = int(os.getenv("RATE_LIMIT_WEBHOOK_MAX", "300"))

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
