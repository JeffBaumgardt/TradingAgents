"""
apps/agents-service/provider_credentials.py

Maps LLM providers to credential fields and environment variable names.
Used to filter available providers/models based on user-supplied API keys.

Model catalogs are maintained statically in model_catalog.py (manually updated).
OpenRouter additionally supports live model discovery when an API key is provided.
Ollama requires no key — only an optional base URL.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class CredentialField(TypedDict):
    name: str
    label: str
    secret: bool
    required: bool
    placeholder: str | None


class ProviderDefinition(TypedDict):
    id: str
    label: str
    backendUrl: str | None
    requiresApiKey: bool
    credentialFields: List[CredentialField]
    modelSource: str  # "static" | "live" | "static_or_live"


# Maps provider id -> env var names for each credential field name
PROVIDER_ENV_VARS: Dict[str, Dict[str, str]] = {
    "openai": {"apiKey": "OPENAI_API_KEY"},
    "google": {"apiKey": "GOOGLE_API_KEY"},
    "anthropic": {"apiKey": "ANTHROPIC_API_KEY"},
    "xai": {"apiKey": "XAI_API_KEY"},
    "deepseek": {"apiKey": "DEEPSEEK_API_KEY"},
    "qwen": {"apiKey": "DASHSCOPE_API_KEY"},
    "glm": {"apiKey": "ZHIPU_API_KEY"},
    "openrouter": {"apiKey": "OPENROUTER_API_KEY"},
    "azure": {
        "apiKey": "AZURE_OPENAI_API_KEY",
        "endpoint": "AZURE_OPENAI_ENDPOINT",
        "deployment": "AZURE_OPENAI_DEPLOYMENT_NAME",
    },
    "ollama": {"baseUrl": "OLLAMA_BASE_URL"},
}


PROVIDER_DEFINITIONS: List[ProviderDefinition] = [
    {
        "id": "openai",
        "label": "OpenAI",
        "backendUrl": "https://api.openai.com/v1",
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "OpenAI API Key",
                "secret": True,
                "required": True,
                "placeholder": "sk-...",
            },
        ],
    },
    {
        "id": "google",
        "label": "Google (Gemini)",
        "backendUrl": None,
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "Google API Key",
                "secret": True,
                "required": True,
                "placeholder": "AIza...",
            },
        ],
    },
    {
        "id": "anthropic",
        "label": "Anthropic",
        "backendUrl": "https://api.anthropic.com/",
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "Anthropic API Key",
                "secret": True,
                "required": True,
                "placeholder": "sk-ant-...",
            },
        ],
    },
    {
        "id": "xai",
        "label": "xAI",
        "backendUrl": "https://api.x.ai/v1",
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "xAI API Key",
                "secret": True,
                "required": True,
                "placeholder": "xai-...",
            },
        ],
    },
    {
        "id": "deepseek",
        "label": "DeepSeek",
        "backendUrl": "https://api.deepseek.com",
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "DeepSeek API Key",
                "secret": True,
                "required": True,
                "placeholder": None,
            },
        ],
    },
    {
        "id": "qwen",
        "label": "Qwen (DashScope)",
        "backendUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "DashScope API Key",
                "secret": True,
                "required": True,
                "placeholder": None,
            },
        ],
    },
    {
        "id": "glm",
        "label": "GLM (Zhipu)",
        "backendUrl": "https://open.bigmodel.cn/api/paas/v4/",
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "Zhipu API Key",
                "secret": True,
                "required": True,
                "placeholder": None,
            },
        ],
    },
    {
        "id": "openrouter",
        "label": "OpenRouter",
        "backendUrl": "https://openrouter.ai/api/v1",
        "requiresApiKey": True,
        "modelSource": "live",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "OpenRouter API Key",
                "secret": True,
                "required": True,
                "placeholder": "sk-or-...",
            },
        ],
    },
    {
        "id": "azure",
        "label": "Azure OpenAI",
        "backendUrl": None,
        "requiresApiKey": True,
        "modelSource": "static",
        "credentialFields": [
            {
                "name": "apiKey",
                "label": "Azure OpenAI API Key",
                "secret": True,
                "required": True,
                "placeholder": None,
            },
            {
                "name": "endpoint",
                "label": "Azure Endpoint URL",
                "secret": False,
                "required": True,
                "placeholder": "https://your-resource.openai.azure.com/",
            },
            {
                "name": "deployment",
                "label": "Deployment Name",
                "secret": False,
                "required": True,
                "placeholder": "gpt-4o",
            },
        ],
    },
    {
        "id": "ollama",
        "label": "Ollama (local)",
        "backendUrl": "http://localhost:11434/v1",
        "requiresApiKey": False,
        "modelSource": "static_or_live",
        "credentialFields": [
            {
                "name": "enabled",
                "label": "Use local Ollama",
                "secret": False,
                "required": False,
                "placeholder": None,
            },
            {
                "name": "baseUrl",
                "label": "Ollama Base URL (optional)",
                "secret": False,
                "required": False,
                "placeholder": "http://localhost:11434/v1",
            },
        ],
    },
]


def get_credentials_schema() -> Dict[str, Any]:
    """Return provider credential field definitions for the setup UI."""
    return {
        "providers": PROVIDER_DEFINITIONS,
        "modelCatalogNote": (
            "Most providers use a curated static model list (model_catalog.py) "
            "updated with releases. OpenRouter fetches live models when a key "
            "is provided. Ollama can use the static list or query your local "
            "instance when enabled."
        ),
    }


def _normalize_credentials(
    provider_credentials: Dict[str, Dict[str, str]] | None,
) -> Dict[str, Dict[str, str]]:
    if not provider_credentials:
        return {}
    normalized: Dict[str, Dict[str, str]] = {}
    for provider_id, fields in provider_credentials.items():
        key = provider_id.lower().strip()
        cleaned = {
            field_name: value.strip()
            for field_name, value in fields.items()
            if isinstance(value, str) and value.strip()
        }
        if cleaned:
            normalized[key] = cleaned
    return normalized


def is_provider_available(
    provider_id: str,
    provider_credentials: Dict[str, Dict[str, str]],
) -> bool:
    """Return True when the user supplied enough credentials for this provider."""
    provider_key = provider_id.lower()
    creds = provider_credentials.get(provider_key, {})
    definition = next(
        (item for item in PROVIDER_DEFINITIONS if item["id"] == provider_key),
        None,
    )
    if not definition:
        return False

    if provider_key == "ollama":
        return creds.get("enabled", "").lower() in ("true", "1", "yes", "on")

    if not definition["requiresApiKey"]:
        return True

    for field in definition["credentialFields"]:
        if field["required"] and not creds.get(field["name"]):
            return False

    return bool(creds.get("apiKey"))


def list_available_provider_ids(
    provider_credentials: Dict[str, Dict[str, str]] | None,
) -> List[str]:
    creds = _normalize_credentials(provider_credentials)
    return [
        item["id"]
        for item in PROVIDER_DEFINITIONS
        if is_provider_available(item["id"], creds)
    ]


def credentials_to_env_updates(
    provider_credentials: Dict[str, Dict[str, str]] | None,
) -> Dict[str, str]:
    """Flatten user credentials into environment variable updates for a run."""
    creds = _normalize_credentials(provider_credentials)
    env_updates: Dict[str, str] = {}

    for provider_id, fields in creds.items():
        env_map = PROVIDER_ENV_VARS.get(provider_id, {})
        for field_name, env_var in env_map.items():
            value = fields.get(field_name)
            if value:
                env_updates[env_var] = value

    return env_updates


def active_provider_api_key(
    llm_provider: str,
    provider_credentials: Dict[str, Dict[str, str]] | None,
) -> Optional[str]:
    creds = _normalize_credentials(provider_credentials)
    return creds.get(llm_provider.lower(), {}).get("apiKey")
