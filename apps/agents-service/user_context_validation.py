"""
apps/agents-service/user_context_validation.py

Shared validation for free-text investing context passed to internal runs.
"""

from __future__ import annotations

MAX_USER_CONTEXT_LENGTH = 8192


def validate_user_context(value: str | None) -> str | None:
    """Return cleaned context, or None when empty. Raise ValueError when invalid."""
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if "\0" in cleaned or any(
        (ord(ch) < 32 and ch not in "\t\n\r") or ord(ch) == 0x7F
        for ch in cleaned
    ):
        raise ValueError("userContext contains invalid characters")
    if len(cleaned) > MAX_USER_CONTEXT_LENGTH:
        raise ValueError(
            f"userContext must be at most {MAX_USER_CONTEXT_LENGTH} characters"
        )
    return cleaned
