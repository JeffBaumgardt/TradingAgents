"""
apps/agents-service/service_auth.py

Shared-secret authentication for /internal/* routes.

The API gateway and agents-service share AGENTS_SERVICE_TOKEN. Requests must
send Authorization: Bearer <token> (or X-Agents-Service-Token).

When the token is unset:
  - non-production: allow (local DX; network isolation only)
  - production: reject (fail closed)
"""

from __future__ import annotations

import hmac
import os
from typing import Final

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

AUTH_HEADER: Final = "authorization"
ALT_HEADER: Final = "x-agents-service-token"
BEARER_PREFIX: Final = "bearer "


def agents_service_token() -> str:
    return os.getenv("AGENTS_SERVICE_TOKEN", "").strip()


def is_production_runtime() -> bool:
    """True when running in a deployed/production-like environment."""
    for name in ("ENV", "ENVIRONMENT", "RAILWAY_ENVIRONMENT", "NODE_ENV"):
        value = (os.getenv(name) or "").strip().lower()
        if value in ("production", "prod"):
            return True
    require = (os.getenv("AGENTS_SERVICE_REQUIRE_AUTH") or "").strip().lower()
    return require in ("1", "true", "yes")


def extract_presented_token(request: Request) -> str | None:
    alt = (request.headers.get(ALT_HEADER) or "").strip()
    if alt:
        return alt

    authorization = (request.headers.get(AUTH_HEADER) or "").strip()
    if authorization.lower().startswith(BEARER_PREFIX):
        return authorization[len(BEARER_PREFIX) :].strip()
    return None


def tokens_match(expected: str, presented: str | None) -> bool:
    if not presented:
        return False
    if len(expected) != len(presented):
        # compare_digest requires equal length; still run a dummy compare
        # against expected to keep timing closer to the success path.
        hmac.compare_digest(expected, expected)
        return False
    return hmac.compare_digest(expected, presented)


class ServiceAuthMiddleware(BaseHTTPMiddleware):
    """Require service token on /internal/*; leave /health and docs open."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        if not path.startswith("/internal"):
            return await call_next(request)

        expected = agents_service_token()
        if not expected:
            if is_production_runtime():
                return JSONResponse(
                    status_code=503,
                    content={
                        "detail": "AGENTS_SERVICE_TOKEN is not configured",
                        "code": "SERVICE_AUTH_NOT_CONFIGURED",
                    },
                )
            return await call_next(request)

        presented = extract_presented_token(request)
        if not tokens_match(expected, presented):
            return JSONResponse(
                status_code=401,
                content={
                    "detail": "Invalid or missing agents service token",
                    "code": "SERVICE_AUTH_FAILED",
                },
            )

        return await call_next(request)
