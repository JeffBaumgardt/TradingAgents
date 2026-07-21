"""Orchestrate Trade Check build: sources, market data, distillation."""

from __future__ import annotations

import logging
from typing import Any

from tradingagents.llm_clients import create_llm_client

from .distiller import (
    build_rule_based_report,
    distill_with_llm,
    merge_llm_distillation,
)
from .market_data import build_chart_payload, fetch_market_snapshot, level_color
from .normalize import extract_urls_from_text, normalize_tool_event_source, source_from_url
from .schemas import PriceLevelKind, TradeCheckReport

logger = logging.getLogger(__name__)

# Trade-management levels (entry/stop/risk) add clutter to the price chart and
# are already covered by the actionable-levels table, so keep them off the chart.
CHART_EXCLUDED_LEVEL_KINDS = frozenset({PriceLevelKind.ENTRY, PriceLevelKind.STOP})


def _collect_sources(
    tool_events: list[dict[str, Any]],
    sections: dict[str, Any],
) -> list:
    from .schemas import TradeCheckSource

    sources: list[TradeCheckSource] = []
    seen_urls: set[str] = set()

    for index, event in enumerate(tool_events):
        tool_name = str(event.get("toolName") or event.get("tool_name") or "tool")
        args = event.get("args") or {}
        content = event.get("content")
        for src in normalize_tool_event_source(index, tool_name, args, content):
            if src.url and src.url in seen_urls:
                continue
            if src.url:
                seen_urls.add(src.url)
            sources.append(src)

    source_index = len(sources)
    for section_key, content in sections.items():
        if not content:
            continue
        for title, url in extract_urls_from_text(str(content)):
            if url in seen_urls:
                continue
            seen_urls.add(url)
            sources.append(
                source_from_url(
                    f"section-{section_key}-{source_index}",
                    title,
                    url,
                    tool_name=section_key,
                )
            )
            source_index += 1

    return sources


def _chart_levels_from_report(report: TradeCheckReport) -> list[tuple[str, float, str]]:
    levels: list[tuple[str, float, str]] = []
    for level in report.actionable_levels:
        if level.kind in CHART_EXCLUDED_LEVEL_KINDS:
            continue
        price = level.price
        if price is None and level.low is not None:
            price = level.low
        if price is None:
            continue
        levels.append((level.label, price, level_color(level.kind.value)))
    return levels


def build_trade_check(
    *,
    config: dict[str, Any],
    final_state: dict[str, Any],
    tool_events: list[dict[str, Any]] | None = None,
    payload: dict[str, Any] | None = None,
    llm_enhance: bool = True,
) -> dict[str, Any]:
    """Build the Trade Check artifact from a completed LangGraph run."""
    payload = payload or {}
    tool_events = tool_events or []

    ticker = payload.get("ticker") or final_state.get("ticker") or "UNKNOWN"
    analysis_date = payload.get("analysisDate") or final_state.get("analysis_date") or ""
    user_context = payload.get("userContext") or final_state.get("user_context") or ""

    sections = {
        key: final_state.get(key)
        for key in [
            "market_report",
            "sentiment_report",
            "news_report",
            "fundamentals_report",
            "investment_plan",
            "trader_investment_plan",
            "final_trade_decision",
        ]
    }

    sources = _collect_sources(tool_events, sections)
    snapshot = fetch_market_snapshot(ticker, analysis_date) if analysis_date else {}

    report = build_rule_based_report(
        ticker=ticker,
        analysis_date=analysis_date,
        sections=sections,
        snapshot=snapshot,
        sources=sources,
        user_context=user_context,
    )

    think_llm = (
        payload.get("thinkLlm")
        or payload.get("deepThinkLlm")
        or payload.get("quickThinkLlm")
    )
    if llm_enhance and payload.get("llmProvider") and think_llm:
        try:
            llm_kwargs: dict[str, Any] = {}
            if payload.get("openaiReasoningEffort"):
                llm_kwargs["reasoning_effort"] = payload["openaiReasoningEffort"]
            if payload.get("anthropicEffort"):
                llm_kwargs["effort"] = payload["anthropicEffort"]
            if payload.get("googleThinkingLevel"):
                llm_kwargs["thinking_level"] = payload["googleThinkingLevel"]

            llm = create_llm_client(
                provider=payload["llmProvider"],
                model=think_llm,
                base_url=payload.get("backendUrl"),
                **llm_kwargs,
            ).get_llm()

            distilled = distill_with_llm(llm, sections, ticker, user_context)
            if distilled:
                report = merge_llm_distillation(report, distilled)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Trade Check LLM enhancement skipped: %s", exc)

    history = snapshot.get("history")
    chart_levels = _chart_levels_from_report(report)
    report.chart = build_chart_payload(history, analysis_date, chart_levels)

    return report.to_api_dict()
