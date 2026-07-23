"""Tests for agents-service shared-secret auth on /internal/* routes."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from starlette.requests import Request
from starlette.responses import JSONResponse

AGENTS_SERVICE_DIR = Path(__file__).resolve().parents[1] / "apps" / "agents-service"
if str(AGENTS_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_SERVICE_DIR))

from service_auth import (  # noqa: E402
    ServiceAuthMiddleware,
    extract_presented_token,
    is_production_runtime,
    tokens_match,
)


def _request_with_headers(headers: dict[str, str], path: str = "/internal/chat/turns") -> Request:
    raw = [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in headers.items()]
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": raw,
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    return Request(scope)


def test_extract_bearer_token():
    request = _request_with_headers({"Authorization": "Bearer secret-token"})
    assert extract_presented_token(request) == "secret-token"


def test_extract_alt_header_token():
    request = _request_with_headers({"X-Agents-Service-Token": "alt-secret"})
    assert extract_presented_token(request) == "alt-secret"


def test_extract_missing_token():
    request = _request_with_headers({})
    assert extract_presented_token(request) is None


def test_tokens_match_constant_time_success():
    assert tokens_match("abc123", "abc123") is True


def test_tokens_match_rejects_mismatch_and_none():
    assert tokens_match("abc123", "abc124") is False
    assert tokens_match("abc123", None) is False
    assert tokens_match("abc123", "short") is False


def test_is_production_runtime_from_env(monkeypatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    monkeypatch.delenv("NODE_ENV", raising=False)
    monkeypatch.delenv("AGENTS_SERVICE_REQUIRE_AUTH", raising=False)
    assert is_production_runtime() is False

    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    assert is_production_runtime() is True

    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    monkeypatch.setenv("AGENTS_SERVICE_REQUIRE_AUTH", "true")
    assert is_production_runtime() is True


def test_middleware_rejects_unauthenticated_when_token_set(monkeypatch):
    monkeypatch.setenv("AGENTS_SERVICE_TOKEN", "expected-secret")
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    monkeypatch.delenv("AGENTS_SERVICE_REQUIRE_AUTH", raising=False)

    async def never_called(_request):
        raise AssertionError("handler should not run")

    middleware = ServiceAuthMiddleware(app=None)

    async def run():
        return await middleware.dispatch(_request_with_headers({}), never_called)

    response = asyncio.run(run())
    assert response.status_code == 401
    assert "SERVICE_AUTH_FAILED" in response.body.decode()


def test_middleware_allows_valid_bearer(monkeypatch):
    monkeypatch.setenv("AGENTS_SERVICE_TOKEN", "expected-secret")

    async def ok(_request):
        return JSONResponse({"ok": True})

    middleware = ServiceAuthMiddleware(app=None)

    async def run():
        return await middleware.dispatch(
            _request_with_headers({"Authorization": "Bearer expected-secret"}),
            ok,
        )

    response = asyncio.run(run())
    assert response.status_code == 200


def test_middleware_fail_closed_in_production_without_token(monkeypatch):
    monkeypatch.delenv("AGENTS_SERVICE_TOKEN", raising=False)
    monkeypatch.setenv("ENV", "production")

    async def never_called(_request):
        raise AssertionError("handler should not run")

    middleware = ServiceAuthMiddleware(app=None)

    async def run():
        return await middleware.dispatch(
            _request_with_headers({"Authorization": "Bearer anything"}),
            never_called,
        )

    response = asyncio.run(run())
    assert response.status_code == 503
    assert "SERVICE_AUTH_NOT_CONFIGURED" in response.body.decode()


def test_middleware_skips_health(monkeypatch):
    monkeypatch.setenv("AGENTS_SERVICE_TOKEN", "expected-secret")

    async def ok(_request):
        return JSONResponse({"status": "ok"})

    middleware = ServiceAuthMiddleware(app=None)

    async def run():
        return await middleware.dispatch(_request_with_headers({}, path="/health"), ok)

    response = asyncio.run(run())
    assert response.status_code == 200


def test_middleware_protects_chat_turns_path(monkeypatch):
    """Regression: newly added /internal/chat must not be open without auth."""
    monkeypatch.setenv("AGENTS_SERVICE_TOKEN", "chat-secret")

    async def never_called(_request):
        raise AssertionError("chat route must require auth")

    middleware = ServiceAuthMiddleware(app=None)
    request = _request_with_headers({})
    assert request.url.path.startswith("/internal/chat")

    async def run():
        return await middleware.dispatch(request, never_called)

    response = asyncio.run(run())
    assert response.status_code == 401
