"""
apps/agents-service/provider_credentials.py

Maps LLM providers to credential fields and environment variable names.
Used to filter available providers/models based on user-supplied API keys.

Model catalogs are maintained statically in model_catalog.py (manually updated).
OpenRouter additionally supports live model discovery when an API key is provided.
"""

from __future__ import annotations

from typing import Any, TypedDict


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
    credentialFields: list[CredentialField]
    modelSource: str  # "static" | "live" | "static_or_live"
    apiKeyUrl: str | None


# Maps provider id -> env var names for each credential field name
PROVIDER_ENV_VARS: dict[str, dict[str, str]] = {
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
}


PROVIDER_API_KEY_URLS: dict[str, str] = {
    "openai": "https://platform.openai.com/api-keys",
    "google": "https://aistudio.google.com/apikey",
    "anthropic": "https://console.anthropic.com/settings/keys",
    "xai": "https://console.x.ai/team/default/api-keys",
    "deepseek": "https://platform.deepseek.com/api_keys",
    "qwen": "https://dashscope.console.aliyun.com/apiKey",
    "glm": "https://open.bigmodel.cn/usercenter/apikeys",
    "openrouter": "https://openrouter.ai/keys",
    "azure": "https://portal.azure.com/#create/Microsoft.CognitiveServicesOpenAI",
}


PROVIDER_DEFINITIONS: list[ProviderDefinition] = [
    {
        "id": "openai",
        "label": "OpenAI",
        "backendUrl": "https://api.openai.com/v1",
        "requiresApiKey": True,
        "modelSource": "static",
        "apiKeyUrl": PROVIDER_API_KEY_URLS["openai"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["google"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["anthropic"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["xai"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["deepseek"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["qwen"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["glm"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["openrouter"],
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
        "apiKeyUrl": PROVIDER_API_KEY_URLS["azure"],
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
]


def get_credentials_schema() -> dict[str, Any]:
    """Return provider credential field definitions for the setup UI."""
    return {
        "providers": PROVIDER_DEFINITIONS,
        "modelCatalogNote": (
            "Most providers use a curated static model list (model_catalog.py) "
            "updated with releases. OpenRouter fetches live models when a key "
            "is provided."
        ),
    }


def _normalize_credentials(
    provider_credentials: dict[str, dict[str, str]] | None,
) -> dict[str, dict[str, str]]:
    if not provider_credentials:
        return {}
    normalized: dict[str, dict[str, str]] = {}
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
    provider_credentials: dict[str, dict[str, str]],
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

    if not definition["requiresApiKey"]:
        return True

    for field in definition["credentialFields"]:
        if field["required"] and not creds.get(field["name"]):
            return False

    return bool(creds.get("apiKey"))


def list_available_provider_ids(
    provider_credentials: dict[str, dict[str, str]] | None,
) -> list[str]:
    creds = _normalize_credentials(provider_credentials)
    return [
        item["id"]
        for item in PROVIDER_DEFINITIONS
        if is_provider_available(item["id"], creds)
    ]


def credentials_to_env_updates(
    provider_credentials: dict[str, dict[str, str]] | None,
) -> dict[str, str]:
    """Flatten user credentials into environment variable updates for a run."""
    creds = _normalize_credentials(provider_credentials)
    env_updates: dict[str, str] = {}

    for provider_id, fields in creds.items():
        env_map = PROVIDER_ENV_VARS.get(provider_id, {})
        for field_name, env_var in env_map.items():
            value = fields.get(field_name)
            if value:
                env_updates[env_var] = value

    return env_updates


def active_provider_api_key(
    llm_provider: str,
    provider_credentials: dict[str, dict[str, str]] | None,
) -> str | None:
    creds = _normalize_credentials(provider_credentials)
    return creds.get(llm_provider.lower(), {}).get("apiKey")
