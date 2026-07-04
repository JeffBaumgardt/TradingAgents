"""Tests for provider credential schema exposed to the credentials UI."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

AGENTS_SERVICE_DIR = Path(__file__).resolve().parents[1] / "apps" / "agents-service"
sys.path.insert(0, str(AGENTS_SERVICE_DIR))

from provider_credentials import (  # noqa: E402
    PROVIDER_API_KEY_URLS,
    PROVIDER_DEFINITIONS,
    get_credentials_schema,
)


@pytest.mark.parametrize("provider_id", list(PROVIDER_API_KEY_URLS))
def test_each_provider_exposes_api_key_url(provider_id: str) -> None:
    definition = next(item for item in PROVIDER_DEFINITIONS if item["id"] == provider_id)
    assert definition["apiKeyUrl"] == PROVIDER_API_KEY_URLS[provider_id]
    assert definition["apiKeyUrl"].startswith("https://")


def test_credentials_schema_includes_api_key_urls() -> None:
    schema = get_credentials_schema()
    providers = {item["id"]: item for item in schema["providers"]}

    assert providers["xai"]["apiKeyUrl"] == "https://console.x.ai/team/default/api-keys"
    assert providers["openai"]["apiKeyUrl"] == "https://platform.openai.com/api-keys"
