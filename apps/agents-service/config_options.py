"""
apps/agents-service/config_options.py

Static configuration options mirrored from cli/utils.py and model_catalog.py.
Provider and model lists are filtered by user-supplied credentials.
"""

from __future__ import annotations

from typing import Any

import requests
from provider_credentials import (
    PROVIDER_DEFINITIONS,
    get_credentials_schema,
    is_provider_available,
    list_available_provider_ids,
)

from tradingagents.llm_clients.model_capabilities import get_model_capabilities
from tradingagents.llm_clients.model_catalog import MODEL_OPTIONS, get_model_options

ANALYST_OPTIONS = [
    {"value": "market", "label": "Market Analyst"},
    {"value": "social", "label": "Social Media Analyst"},
    {"value": "news", "label": "News Analyst"},
    {"value": "fundamentals", "label": "Fundamentals Analyst"},
]

RESEARCH_DEPTH_OPTIONS = [
    {
        "value": 1,
        "label": "Shallow - Quick research, few debate and strategy discussion rounds",
    },
    {
        "value": 3,
        "label": "Medium - Middle ground, moderate debate rounds and strategy discussion",
    },
    {
        "value": 5,
        "label": "Deep - Comprehensive research, in depth debate and strategy discussion",
    },
]

LANGUAGE_OPTIONS = [
    {"value": "English", "label": "English (default)"},
    {"value": "Chinese", "label": "Chinese (中文)"},
    {"value": "Japanese", "label": "Japanese (日本語)"},
    {"value": "Korean", "label": "Korean (한국어)"},
    {"value": "Hindi", "label": "Hindi (हिन्दी)"},
    {"value": "Spanish", "label": "Spanish (Español)"},
    {"value": "Portuguese", "label": "Portuguese (Português)"},
    {"value": "French", "label": "French (Français)"},
    {"value": "German", "label": "German (Deutsch)"},
    {"value": "Arabic", "label": "Arabic (العربية)"},
    {"value": "Russian", "label": "Russian (Русский)"},
]

PROVIDER_OPTIONS = [
    {"id": item["id"], "label": item["label"], "backendUrl": item["backendUrl"]}
    for item in PROVIDER_DEFINITIONS
]


def _fetch_openrouter_models(api_key: str) -> list[dict[str, str]]:
    """Fetch live OpenRouter models when the user provides a key."""
    try:
        response = requests.get(
            "https://openrouter.ai/api/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        response.raise_for_status()
        models = response.json().get("data", [])
        return [
            {"id": item.get("id", ""), "label": item.get("name") or item.get("id", "")}
            for item in models
            if item.get("id")
        ]
    except Exception:
        return []


def get_config_options(
    provider_credentials: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    available_ids = set(list_available_provider_ids(provider_credentials))
    providers = [
        option for option in PROVIDER_OPTIONS if option["id"] in available_ids
    ]
    return {
        "analysts": ANALYST_OPTIONS,
        "researchDepths": RESEARCH_DEPTH_OPTIONS,
        "languages": LANGUAGE_OPTIONS,
        "providers": providers,
        "availableProviderIds": sorted(available_ids),
    }


def resolve_config(
    provider_credentials: dict[str, dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Return credential schema plus config filtered to available providers."""
    available_ids = list_available_provider_ids(provider_credentials)
    return {
        **get_config_options(provider_credentials),
        "credentialsSchema": get_credentials_schema(),
        "availableProviderIds": available_ids,
    }


def _model_entry(provider: str, model_id: str, label: str) -> dict[str, Any]:
    entry: dict[str, Any] = {"id": model_id, "label": label}
    capabilities = get_model_capabilities(provider, model_id)
    if capabilities:
        entry["capabilities"] = capabilities
    return entry


def get_provider_models(
    provider: str,
    mode: str,
    provider_credentials: dict[str, dict[str, str]] | None = None,
    *,
    require_credentials: bool = True,
) -> dict[str, Any]:
    provider_key = provider.lower()
    if provider_key not in MODEL_OPTIONS and provider_key not in ("openrouter", "azure"):
        raise KeyError(provider)

    if require_credentials and not is_provider_available(
        provider_key, provider_credentials or {}
    ):
        raise PermissionError(f"No credentials provided for provider: {provider}")

    if mode not in ("quick", "deep"):
        raise ValueError("mode must be quick or deep")

    creds = (provider_credentials or {}).get(provider_key, {})
    models: list[dict[str, str]] = []

    if provider_key == "openrouter" and creds.get("apiKey"):
        live = _fetch_openrouter_models(creds["apiKey"])
        models = [
            _model_entry(provider_key, item["id"], item["label"])
            for item in (live[:25] if live else [{"id": "custom", "label": "Custom model ID"}])
        ]
    elif provider_key == "azure":
        deployment = creds.get("deployment") or creds.get("apiKey", "")
        if deployment:
            models = [
                _model_entry(provider_key, deployment, f"Azure deployment: {deployment}"),
                _model_entry(provider_key, "custom", "Custom deployment name"),
            ]
        else:
            models = [_model_entry(provider_key, "custom", "Custom deployment name")]
    else:
        models = [
            _model_entry(provider_key, model_id, label)
            for label, model_id in get_model_options(provider_key, mode)
        ]

    return {"provider": provider_key, "mode": mode, "models": models}
