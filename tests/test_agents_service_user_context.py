"""Tests for agents-service userContext validation."""

import pytest
from user_context_validation import MAX_USER_CONTEXT_LENGTH, validate_user_context


def test_validate_user_context_accepts_normal_text():
    assert validate_user_context("I own 100 shares.") == "I own 100 shares."


def test_validate_user_context_rejects_null_bytes():
    with pytest.raises(ValueError, match="invalid characters"):
        validate_user_context("bad\x00value")


def test_validate_user_context_rejects_del_character():
    with pytest.raises(ValueError, match="invalid characters"):
        validate_user_context("bad\x7Fvalue")


def test_validate_user_context_rejects_oversized_context():
    with pytest.raises(ValueError, match="at most"):
        validate_user_context("x" * (MAX_USER_CONTEXT_LENGTH + 1))
