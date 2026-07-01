"""
apps/agents-service/routes_config.py

Internal configuration routes for analysts, providers, and model catalogs.
Supports credential-aware filtering so users only see providers/models they
can actually use with the API keys they supply for the current browser session.
"""

from __future__ import annotations

from config_options import (
    get_config_options,
    get_credentials_schema,
    get_provider_models,
    resolve_config,
)
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/internal/config", tags=["config"])


class ProviderCredentialsBody(BaseModel):
    providerCredentials: dict[str, dict[str, str]] = Field(default_factory=dict)


class ProviderModelsBody(BaseModel):
    mode: str = Field(..., pattern="^(quick|deep)$")
    providerCredentials: dict[str, dict[str, str]] = Field(default_factory=dict)


@router.get("/credentials/schema")
def read_credentials_schema():
    return get_credentials_schema()


@router.post("/resolve")
def resolve_user_config(body: ProviderCredentialsBody):
    return resolve_config(body.providerCredentials)


@router.get("/options")
def read_config_options():
    """Legacy unfiltered options (all providers). Prefer POST /resolve."""
    return get_config_options()


@router.post("/providers/{provider}/models")
def read_provider_models_with_credentials(provider: str, body: ProviderModelsBody):
    try:
        return get_provider_models(provider, body.mode, body.providerCredentials)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}") from exc


@router.get("/providers/{provider}/models")
def read_provider_models(provider: str, mode: str = Query(..., pattern="^(quick|deep)$")):
    try:
        return get_provider_models(provider, mode)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}") from exc
