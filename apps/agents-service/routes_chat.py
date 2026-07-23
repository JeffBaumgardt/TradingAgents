"""
apps/agents-service/routes_chat.py

Internal HTTP routes for Portfolio Manager follow-up chat turns.
"""

from __future__ import annotations

from typing import Any

from chat_manager import chat_manager
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/internal/chat", tags=["chat"])


class StartChatTurnRequest(BaseModel):
    sessionId: str
    assistantMessageId: str
    userMessage: str = Field(min_length=1, max_length=20_000)
    ticker: str
    analysisDate: str
    userContext: str | None = None
    decision: str | None = None
    reportSections: dict[str, str | None] = Field(default_factory=dict)
    tradeCheck: dict[str, Any] | None = None
    priorMessages: list[dict[str, Any]] = Field(default_factory=list)
    llmProvider: str
    backendUrl: str | None = None
    thinkLlm: str
    googleThinkingLevel: str | None = None
    openaiReasoningEffort: str | None = None
    anthropicEffort: str | None = None
    providerCredentials: dict[str, dict[str, str]] | None = None
    quickThinkLlm: str | None = None
    deepThinkLlm: str | None = None


@router.post("/turns")
def start_chat_turn(body: StartChatTurnRequest) -> dict[str, str]:
    turn_id = chat_manager.create_turn(body.model_dump())
    return {"turnId": turn_id}


@router.get("/turns/{turn_id}")
def get_chat_turn(turn_id: str) -> dict[str, Any]:
    record = chat_manager.get_turn(turn_id)
    if not record:
        raise HTTPException(status_code=404, detail="Turn not found")
    return {
        "turnId": record.turn_id,
        "sessionId": record.session_id,
        "assistantMessageId": record.assistant_message_id,
        "status": record.status,
        "error": record.error,
        "decisionExcerpt": record.decision_excerpt,
        "contentMarkdown": record.final_markdown,
        "parts": record.parts,
    }


@router.get("/turns/{turn_id}/stream")
async def stream_chat_turn(turn_id: str) -> StreamingResponse:
    record = chat_manager.get_turn(turn_id)
    if not record:
        raise HTTPException(status_code=404, detail="Turn not found")

    return StreamingResponse(
        chat_manager.subscribe(turn_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/turns/{turn_id}")
async def cancel_chat_turn(turn_id: str, request: Request) -> dict[str, bool]:
    reason: dict[str, Any] | None = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            reason = body
    except Exception:
        reason = None

    ok = chat_manager.cancel_turn(turn_id, reason)
    if not ok:
        raise HTTPException(status_code=404, detail="Turn not found")
    return {"ok": True}
