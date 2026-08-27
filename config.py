# FILE: config.py
"""ResolverAI Configuration (§6, 11)."""
import os
from dotenv import load_dotenv

load_dotenv()

# Database & Redis
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://resolver:resolver@localhost:5432/resolverai")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# AI Settings
AI_MODE = os.getenv("AI_MODE", "DETERMINISTIC").upper()  # DETERMINISTIC or ENABLED
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Razorpay Integration Settings
RAZORPAY_MODE = os.getenv("RAZORPAY_MODE", "TEST").upper()  # SYNTHETIC, TEST, LIVE
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
RAZORPAY_BASE_URL = os.getenv("RAZORPAY_BASE_URL", "https://api.razorpay.com/v1")

# System & Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
CHAOS_SEED = int(os.getenv("CHAOS_SEED", "42"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
