"""Provider-specific model capability checks for optional API parameters."""

from __future__ import annotations


def _normalize_model_id(model: str) -> str:
    return model.lower().strip()


def supports_anthropic_effort(model: str) -> bool:
    """Return True when the Anthropic model accepts the ``effort`` parameter.

    Effort is supported on Opus 4.5+, Sonnet 4.6+, and newer frontier models.
    Haiku and Sonnet 4.5 reject the parameter with a 400 error.
    """
    model_id = _normalize_model_id(model)
    if not model_id or model_id == "custom":
        return False

    if "haiku" in model_id:
        return False

    if "sonnet" in model_id:
        # Sonnet 4.5 rejects effort; Sonnet 4.6+ and Sonnet 5+ accept it.
        if "4-5" in model_id or "4.5" in model_id:
            return False
        return (
            "4-6" in model_id
            or "4.6" in model_id
            or "sonnet-5" in model_id
            or "sonnet-5-" in model_id
        )

    if "opus" in model_id:
        for marker in ("4-5", "4.5", "4-6", "4.6", "4-7", "4.7", "4-8", "4.8"):
            if marker in model_id:
                return True
        return False

    return "fable" in model_id or "mythos" in model_id


def supports_openai_reasoning_effort(model: str) -> bool:
    """Return True when an OpenAI model accepts ``reasoning_effort``.

    Reasoning effort applies to GPT-5.x, GPT-4.1, and o-series models via the
    Responses API. Legacy chat models (GPT-4o, GPT-4, GPT-3.5) reject it.
    """
    model_id = _normalize_model_id(model)
    if not model_id or model_id == "custom":
        return False

    if model_id.startswith("gpt-5") or model_id.startswith(("o1", "o3", "o4")):
        return True

    return "gpt-4.1" in model_id


def supports_google_thinking_level(model: str) -> bool:
    """Return True when Gemini thinking configuration should be sent."""
    model_id = _normalize_model_id(model)
    if not model_id or model_id == "custom":
        return False
    return "gemini" in model_id


def get_model_capabilities(provider: str, model: str) -> dict[str, bool]:
    """Return capability flags exposed to the config API and wizard."""
    provider_key = provider.lower()
    capabilities: dict[str, bool] = {}

    if provider_key == "anthropic":
        capabilities["anthropicEffort"] = supports_anthropic_effort(model)
    elif provider_key == "openai":
        capabilities["openaiReasoningEffort"] = supports_openai_reasoning_effort(model)
    elif provider_key == "google":
        capabilities["googleThinkingLevel"] = supports_google_thinking_level(model)

    return capabilities
