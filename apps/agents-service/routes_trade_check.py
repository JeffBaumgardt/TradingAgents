"""
apps/agents-service/routes_trade_check.py

Rebuild Trade Check artifacts from persisted session report sections.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from tradingagents.trade_check import build_trade_check

router = APIRouter(prefix="/internal/trade-check", tags=["trade-check"])


class RebuildTradeCheckRequest(BaseModel):
    sessionId: str | None = None
    ticker: str
    analysisDate: str
    userContext: str | None = None
    sections: dict[str, str | None]
    toolEvents: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/rebuild")
def rebuild_trade_check(body: RebuildTradeCheckRequest) -> dict[str, Any]:
    """Build Trade Check from stored report sections (backfill / repair)."""
    sections = {key: value for key, value in body.sections.items() if value}
    final_state = {
        **sections,
        "ticker": body.ticker,
        "analysis_date": body.analysisDate,
        "user_context": body.userContext or "",
    }

    tool_events = list(body.toolEvents)
    payload = body.model_dump(exclude={"sections", "toolEvents"})
    trade_check = build_trade_check(
        config={},
        final_state=final_state,
        tool_events=tool_events,
        payload=payload,
        llm_enhance=False,
    )
    return {"tradeCheck": trade_check}
