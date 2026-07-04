"""Tests for agents-service userContext validation on internal run requests."""

import pytest
from pydantic import ValidationError
from routes_runs import MAX_USER_CONTEXT_LENGTH, StartRunRequest


def _base_payload(**overrides):
    payload = {
        "sessionId": "session-1",
        "ticker": "SPY",
        "analysisDate": "2026-06-26",
        "outputLanguage": "English",
        "analysts": ["market"],
        "researchDepth": 1,
        "llmProvider": "openai",
        "quickThinkLlm": "gpt-4o-mini",
        "deepThinkLlm": "gpt-4o",
    }
    payload.update(overrides)
    return payload


def test_start_run_request_accepts_normal_user_context():
    body = StartRunRequest(**_base_payload(userContext="I own 100 shares."))
    assert body.userContext == "I own 100 shares."


def test_start_run_request_rejects_null_bytes():
    with pytest.raises(ValidationError, match="invalid characters"):
        StartRunRequest(**_base_payload(userContext="bad\x00value"))


def test_start_run_request_rejects_del_character():
    with pytest.raises(ValidationError, match="invalid characters"):
        StartRunRequest(**_base_payload(userContext="bad\x7Fvalue"))


def test_start_run_request_rejects_oversized_context():
    with pytest.raises(ValidationError, match="at most"):
        StartRunRequest(**_base_payload(userContext="x" * (MAX_USER_CONTEXT_LENGTH + 1)))
