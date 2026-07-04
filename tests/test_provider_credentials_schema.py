"""Tests for provider credential schema exposed to the credentials UI."""

from __future__ import annotations

import pytest

from provider_credentials import (
    PROVIDER_API_KEY_URLS,
    PROVIDER_DEFINITIONS,
    get_credentials_schema,
)


@pytest.mark.parametrize("provider_id", list(PROVIDER_API_KEY_URLS))
def test_each_provider_exposes_api_key_url(provider_id: str) -> None:
    definition = next(item for item in PROVIDER_DEFINITIONS if item["id"] == provider_id)
    assert definition["apiKeyUrl"] == PROVIDER_API_KEY_URLS[provider_id]
    assert definition["apiKeyUrl"].startswith("https://")


def test_every_keyed_provider_has_https_api_key_url() -> None:
    definition_ids = {item["id"] for item in PROVIDER_DEFINITIONS}
    url_ids = set(PROVIDER_API_KEY_URLS)

    assert definition_ids == url_ids

    for definition in PROVIDER_DEFINITIONS:
        assert definition["requiresApiKey"] is True
        assert definition["apiKeyUrl"]
        assert definition["apiKeyUrl"].startswith("https://")


def test_credentials_schema_returns_provider_api_key_urls() -> None:
    schema = get_credentials_schema()
    schema_urls = {
        item["id"]: item["apiKeyUrl"]
        for item in schema["providers"]
    }

    for provider_id, url in PROVIDER_API_KEY_URLS.items():
        assert schema_urls[provider_id] == url
