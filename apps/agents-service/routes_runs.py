"""
apps/agents-service/routes_runs.py

Internal run execution routes: start runs, stream SSE events, fetch reports.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from run_manager import run_manager

MAX_USER_CONTEXT_LENGTH = 8192

router = APIRouter(prefix="/internal/runs", tags=["runs"])


class StartRunRequest(BaseModel):
    sessionId: str
    ticker: str
    userContext: str | None = None
    analysisDate: str
    outputLanguage: str
    analysts: list[str] = Field(min_length=1)
    researchDepth: int
    llmProvider: str
    backendUrl: str | None = None
    quickThinkLlm: str
    deepThinkLlm: str
    googleThinkingLevel: str | None = None
    openaiReasoningEffort: str | None = None
    anthropicEffort: str | None = None
    checkpointEnabled: bool = False
    providerCredentials: dict[str, dict[str, str]] | None = None

    @field_validator("userContext")
    @classmethod
    def validate_user_context(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if "\0" in cleaned or any(
            (ord(ch) < 32 and ch not in "\t\n\r") or ord(ch) == 0x7F
            for ch in cleaned
        ):
            raise ValueError("userContext contains invalid characters")
        if len(cleaned) > MAX_USER_CONTEXT_LENGTH:
            raise ValueError(
                f"userContext must be at most {MAX_USER_CONTEXT_LENGTH} characters"
            )
        return cleaned


@router.post("")
def start_run(body: StartRunRequest) -> dict[str, str]:
    run_id = run_manager.create_run(body.sessionId, body.model_dump())
    return {"runId": run_id}


@router.get("/{run_id}/stream")
async def stream_run(run_id: str):
    record = run_manager.get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_generator():
        async for frame in run_manager.subscribe(run_id):
            yield frame

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/{run_id}/report")
def get_run_report(run_id: str) -> dict[str, Any]:
    try:
        return run_manager.get_report(run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Run not found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/{run_id}")
def cancel_run(run_id: str) -> dict[str, bool]:
    if not run_manager.cancel_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"ok": True}
