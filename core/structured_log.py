# FILE: core/structured_log.py
"""Structured JSON logging utility for ResolverAI."""
import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def log_json(level: str, event: str, service: str = "resolverai", **kwargs) -> None:
    """Emit a structured JSON log line to stderr."""
    entry: Dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level.upper(),
        "service": service,
        "event": event,
    }
    entry.update(kwargs)
    try:
        print(json.dumps(entry, default=str), file=sys.stderr)
    except Exception:
        pass


def log_info(event: str, **kwargs) -> None:
    log_json("info", event, **kwargs)


def log_warn(event: str, **kwargs) -> None:
    log_json("warn", event, **kwargs)


def log_error(event: str, **kwargs) -> None:
    log_json("error", event, **kwargs)


def log_debug(event: str, **kwargs) -> None:
    log_json("debug", event, **kwargs)
