"""Rule-based and LLM-assisted distillation of agent reports into Trade Check."""

from __future__ import annotations

import logging
import re
from typing import Any

from pydantic import BaseModel

from tradingagents.agents.utils.structured import bind_structured

from .normalize import extract_urls_from_text, normalize_ticker, parse_price
from .schemas import (
    AgentSectionSummary,
    CatalystRow,
    PriceLevel,
    PriceLevelKind,
    QuickMetric,
    SourceKind,
    TradeCheckHeader,
    TradeCheckReport,
    TradeCheckSource,
    TradeScenario,
    VerdictBadge,
    VerdictBadgeTone,
)

logger = logging.getLogger(__name__)

_AGENT_SECTION_MAP = [
    ("market_report", "Market Analyst", "market"),
    ("sentiment_report", "Social Analyst", "social"),
    ("news_report", "News Analyst", "news"),
    ("fundamentals_report", "Fundamentals Analyst", "fundamentals"),
    ("investment_plan", "Research Manager", "research"),
    ("trader_investment_plan", "Trader", "trader"),
    ("final_trade_decision", "Portfolio Manager", "portfolio"),
]

_RATING_RE = re.compile(
    r"\*\*(?:Rating|Recommendation|Action)\*\*:\s*(Buy|Overweight|Hold|Underweight|Sell)",
    re.IGNORECASE,
)
_ENTRY_RE = re.compile(r"\*\*Entry Price\*\*:\s*([\d.,$]+)", re.IGNORECASE)
_STOP_RE = re.compile(r"\*\*Stop Loss\*\*:\s*([\d.,$]+)", re.IGNORECASE)
_TARGET_RE = re.compile(r"\*\*Price Target\*\*:\s*([\d.,$]+)", re.IGNORECASE)
_SENTIMENT_SCORE_RE = re.compile(r"Score:\s*([\d.]+)/10", re.IGNORECASE)
_SENTIMENT_BAND_RE = re.compile(r"\*\*Overall Sentiment:\*\*\s*\*\*([^*]+)\*\*", re.IGNORECASE)
_CONFIDENCE_RE = re.compile(r"\*\*Confidence:\*\*\s*(Low|Medium|High)", re.IGNORECASE)


class DistilledTradeCheck(BaseModel):
    """LLM structured output for Trade Check distillation."""

    company_name: str | None = None
    tags: list[str] = []
    strategy: str | None = None
    bottom_line: str
    now_guidance: str
    long_trigger: str | None = None
    short_trigger: str | None = None
    size_warning: str | None = None
    catalysts: list[dict[str, str | None]] = []
    resistance_levels: list[dict[str, str | float | bool | None]] = []
    support_levels: list[dict[str, str | float | bool | None]] = []
    long_scenario: dict[str, Any] | None = None
    short_scenario: dict[str, Any] | None = None


def _tone_from_pct(pct: float | None) -> VerdictBadgeTone:
    if pct is None:
        return VerdictBadgeTone.NEUTRAL
    if pct >= 2:
        return VerdictBadgeTone.BULLISH
    if pct <= -2:
        return VerdictBadgeTone.BEARISH
    return VerdictBadgeTone.NEUTRAL


def _extract_decision(sections: dict[str, Any]) -> str | None:
    for key in ("final_trade_decision", "investment_plan", "trader_investment_plan"):
        content = sections.get(key) or ""
        match = _RATING_RE.search(content)
        if match:
            return match.group(1).title()
    return None


def _extract_trader_levels(sections: dict[str, Any]) -> tuple[float | None, float | None]:
    trader = sections.get("trader_investment_plan") or ""
    entry = parse_price(_ENTRY_RE.search(trader).group(1) if _ENTRY_RE.search(trader) else None)
    stop = parse_price(_STOP_RE.search(trader).group(1) if _STOP_RE.search(trader) else None)
    return entry, stop


def _first_sentences(text: str, count: int = 2) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return "No summary available."
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return " ".join(parts[:count]).strip() or cleaned[:240]


def _build_agent_sections(
    sections: dict[str, Any],
    sources: list[TradeCheckSource],
) -> list[AgentSectionSummary]:
    summaries: list[AgentSectionSummary] = []
    for section_key, agent_name, agent_key in _AGENT_SECTION_MAP:
        content = sections.get(section_key)
        if not content:
            continue

        confidence = None
        score = None
        conf_match = _CONFIDENCE_RE.search(content)
        if conf_match:
            confidence = conf_match.group(1).lower()  # type: ignore[assignment]
        score_match = _SENTIMENT_SCORE_RE.search(content)
        if score_match:
            score = float(score_match.group(1))

        section_sources = _top_sources_for_section(content, sources, limit=3)
        key_points = _extract_bullet_points(content, limit=5)

        data_bucket: dict[str, str | float | int | None] = {}
        band_match = _SENTIMENT_BAND_RE.search(content)
        if band_match:
            data_bucket["sentiment_band"] = band_match.group(1).strip()
        if score is not None:
            data_bucket["sentiment_score"] = score
        rating_match = _RATING_RE.search(content)
        if rating_match:
            data_bucket["rating"] = rating_match.group(1).title()

        summaries.append(
            AgentSectionSummary(
                agent_key=agent_key,
                agent_name=agent_name,
                headline=_first_sentences(content, 1),
                confidence=confidence,  # type: ignore[arg-type]
                score=score,
                top_sources=section_sources,
                key_points=key_points,
                data_bucket=data_bucket,
            )
        )
    return summaries


def _top_sources_for_section(
    content: str,
    all_sources: list[TradeCheckSource],
    limit: int = 3,
) -> list[TradeCheckSource]:
    urls_in_content = {url for _, url in extract_urls_from_text(content)}
    matched = [src for src in all_sources if src.url and src.url in urls_in_content]
    if matched:
        return matched[:limit]

    # Fall back to kind-matched sources
    kind_hint = SourceKind.OTHER
    lower = content.lower()
    if "news" in lower:
        kind_hint = SourceKind.NEWS
    elif any(token in lower for token in ("reddit", "stocktwits", "social")):
        kind_hint = SourceKind.SOCIAL

    kind_matched = [src for src in all_sources if src.kind == kind_hint]
    return kind_matched[:limit]


def _extract_labeled_points(text: str, limit: int = 5) -> list[str]:
    points: list[str] = []
    for match in re.finditer(r"\*\*([^*]+)\*\*[:\s]+([^\n]+)", text or ""):
        label = match.group(1).strip()
        value = match.group(2).strip()
        if not value or label.lower() in {"rating", "recommendation", "action"}:
            continue
        points.append(f"{label}: {value[:160]}")
        if len(points) >= limit:
            break
    return points


def _extract_bullet_points(text: str, limit: int = 5) -> list[str]:
    points: list[str] = []
    for line in (text or "").splitlines():
        stripped = line.strip()
        if stripped.startswith(("-", "*", "•")):
            points.append(stripped.lstrip("-*• ").strip())
        if len(points) >= limit:
            break
    if len(points) < limit:
        for point in _extract_labeled_points(text, limit):
            if point not in points:
                points.append(point)
            if len(points) >= limit:
                break
    if not points:
        for sentence in re.split(r"(?<=[.!?])\s+", text or ""):
            if len(sentence.strip()) > 30:
                points.append(sentence.strip())
            if len(points) >= limit:
                break
    return points


def _build_quick_metrics(snapshot: dict[str, Any]) -> list[QuickMetric]:
    metrics: list[QuickMetric] = []
    change_pct = snapshot.get("change_pct")
    if change_pct is not None:
        sign = "+" if change_pct >= 0 else ""
        metrics.append(
            QuickMetric(
                label="TODAY",
                value=f"{sign}{change_pct:.2f}%",
                tone=_tone_from_pct(change_pct),
            )
        )

    day_low = snapshot.get("day_low")
    day_high = snapshot.get("day_high")
    if day_low is not None and day_high is not None:
        metrics.append(
            QuickMetric(
                label="DAY RANGE",
                value=f"${day_low:,.2f} – ${day_high:,.2f}",
            )
        )

    rsi = snapshot.get("rsi")
    if rsi is not None:
        tone = VerdictBadgeTone.NEUTRAL
        note = "Neutral"
        if rsi >= 70:
            tone = VerdictBadgeTone.BEARISH
            note = "Overbought"
        elif rsi <= 30:
            tone = VerdictBadgeTone.BULLISH
            note = "Oversold"
        metrics.append(
            QuickMetric(label="RSI", value=f"{rsi:.2f}", tone=tone, note=note)
        )

    volume = snapshot.get("volume")
    avg_volume = snapshot.get("avg_volume")
    if volume is not None:
        vol_text = f"{volume / 1_000_000:.2f}M" if volume >= 1_000_000 else f"{volume:,.0f}"
        note = None
        tone = VerdictBadgeTone.NEUTRAL
        if avg_volume:
            ratio = volume / avg_volume
            note = f"vs {avg_volume / 1_000_000:.1f}M avg"
            tone = VerdictBadgeTone.BULLISH if ratio >= 1.1 else VerdictBadgeTone.NEUTRAL
        metrics.append(QuickMetric(label="VOLUME", value=vol_text, tone=tone, note=note))

    beta = snapshot.get("beta")
    if beta is not None:
        tone = VerdictBadgeTone.WARNING if beta >= 2 else VerdictBadgeTone.NEUTRAL
        note = "Extreme" if beta >= 2 else None
        metrics.append(
            QuickMetric(label="BETA", value=f"{beta:.2f}", tone=tone, note=note)
        )

    return metrics


def _default_verdict(
    current_price: float | None,
    entry: float | None,
    stop: float | None,
    decision: str | None,
    user_context: str,
) -> list[VerdictBadge]:
    badges: list[VerdictBadge] = []

    now_detail = "Review actionable levels before entering."
    if current_price is not None and entry is not None:
        diff_pct = abs(current_price - entry) / entry * 100
        if diff_pct <= 1.5:
            now_detail = f"Price ${current_price:,.2f} is near the proposed entry ${entry:,.2f}."
        else:
            now_detail = (
                f"Price ${current_price:,.2f} is mid-range vs proposed entry ${entry:,.2f} "
                f"({diff_pct:.1f}% away) — avoid chasing."
            )
    badges.append(
        VerdictBadge(
            id="now",
            label="NOW",
            tone=VerdictBadgeTone.NEUTRAL,
            headline="Wait for a defined trigger" if decision in {"Hold", None} else "Confirm trigger before entry",
            detail=now_detail,
        )
    )

    if entry is not None:
        badges.append(
            VerdictBadge(
                id="long_trigger",
                label="LONG TRIGGER",
                tone=VerdictBadgeTone.BULLISH,
                headline=f"Pullback hold near ${entry:,.2f}",
                detail=f"Stop below ${stop:,.2f}" if stop else "Define stop below nearest support.",
            )
        )

    badges.append(
        VerdictBadge(
            id="short_trigger",
            label="SHORT TRIGGER",
            tone=VerdictBadgeTone.BEARISH,
            headline="Rejection at resistance",
            detail="Fade only on clear rejection with volume fade; avoid overnight short on high beta.",
        )
    )

    badges.append(
        VerdictBadge(
            id="size_warning",
            label="SIZE WARNING",
            tone=VerdictBadgeTone.WARNING,
            headline="Reduce size on elevated volatility",
            detail="Consider 40–50% of normal size when beta > 2 or after a large catalyst gap.",
        )
    )

    if user_context.strip():
        badges[0].detail = f"{badges[0].detail} User thesis: {user_context.strip()[:160]}"

    return badges


def _rule_based_levels(
    snapshot: dict[str, Any],
    entry: float | None,
    stop: float | None,
    target: float | None,
) -> list[PriceLevel]:
    levels: list[PriceLevel] = []
    current = snapshot.get("current_price")
    if current is not None:
        levels.append(
            PriceLevel(
                label="Current price",
                kind=PriceLevelKind.CURRENT,
                price=current,
                note="Live reference from market data",
            )
        )

    day_high = snapshot.get("day_high")
    if day_high is not None:
        levels.append(
            PriceLevel(
                label="Resistance 1 — day high",
                kind=PriceLevelKind.RESISTANCE,
                price=day_high,
                is_key=True,
            )
        )

    day_low = snapshot.get("day_low")
    if day_low is not None:
        levels.append(
            PriceLevel(
                label="Support 1 — day low",
                kind=PriceLevelKind.SUPPORT,
                price=day_low,
                is_key=True,
            )
        )

    if target is not None:
        levels.append(
            PriceLevel(
                label="Target",
                kind=PriceLevelKind.TARGET,
                price=target,
            )
        )

    return levels


def _rule_based_scenarios(
    entry: float | None,
    stop: float | None,
    target: float | None,
    resistance: float | None,
    support: float | None,
) -> list[TradeScenario]:
    scenarios: list[TradeScenario] = []

    long_trigger = f"${support:,.2f} holds" if support else "Pullback to support holds"
    long_stop = stop
    long_targets: list[str] = []
    if resistance:
        long_targets.append(f"T1 ${resistance:,.2f}")
    if target:
        long_targets.append(f"T2 ${target:,.2f}")

    scenarios.append(
        TradeScenario(
            id="long",
            direction="long",
            title="Scenario A — Pullback long",
            trigger=long_trigger,
            stop=long_stop,
            stop_label=f"${long_stop:,.2f}" if long_stop else None,
            risk_per_share=(
                f"~${abs((entry or support or 0) - (stop or 0)):,.2f}"
                if stop and (entry or support)
                else None
            ),
            targets=long_targets,
            note="Wait for momentum to fade; do not chase extended moves.",
        )
    )

    short_trigger = f"Rejection at ${resistance:,.2f}" if resistance else "Rejection at resistance"
    scenarios.append(
        TradeScenario(
            id="short",
            direction="short",
            title="Scenario B — Fade the move",
            trigger=short_trigger,
            stop=resistance * 1.02 if resistance else None,
            targets=[f"T1 ${support:,.2f}" if support else "T1 nearest support"],
            note="Volume fade at resistance required; avoid holding short overnight on high beta.",
        )
    )
    return scenarios


def _rule_based_catalysts(sections: dict[str, Any]) -> list[CatalystRow]:
    rows: list[CatalystRow] = []
    news = sections.get("news_report") or ""
    fundamentals = sections.get("fundamentals_report") or ""

    if news.strip():
        rows.append(
            CatalystRow(
                metric="News catalyst",
                value=_first_sentences(news, 1)[:120],
                note="From News Analyst report",
            )
        )
    if fundamentals.strip():
        rows.append(
            CatalystRow(
                metric="Fundamentals",
                value=_first_sentences(fundamentals, 1)[:120],
                note="From Fundamentals Analyst report",
            )
        )

    decision = sections.get("final_trade_decision") or ""
    if decision.strip():
        rows.append(
            CatalystRow(
                metric="Portfolio verdict",
                value=_extract_decision(sections) or "See full report",
                note=_first_sentences(decision, 1)[:120],
            )
        )
    return rows


def distill_with_llm(
    llm: Any,
    sections: dict[str, Any],
    ticker: str,
    user_context: str,
) -> DistilledTradeCheck | None:
    """Optional LLM pass to refine Trade Check fields."""
    structured_llm = bind_structured(llm, DistilledTradeCheck, "TradeCheckDistiller")
    if structured_llm is None:
        return None

    section_blob = "\n\n".join(
        f"## {key}\n{value}" for key, value in sections.items() if value
    )
    prompt = f"""You are a trading desk editor. Distill the following multi-agent equity research
into a concise Trade Check summary for ticker {ticker}.

User thesis (may be empty): {user_context or "None"}

Requirements:
- Extract only claims supported by the reports.
- Provide actionable resistance/support levels as numbers where possible.
- long_scenario and short_scenario should include trigger, stop, targets list.
- bottom_line: 2-3 sentences, direct and actionable.
- now_guidance: what to do RIGHT NOW (wait, enter, avoid chasing).
- size_warning: position sizing guidance when volatility is elevated.

Reports:
{section_blob}
"""

    try:
        result = structured_llm.invoke(prompt)
        if isinstance(result, DistilledTradeCheck):
            return result
    except Exception as exc:  # noqa: BLE001
        logger.warning("Trade Check LLM distillation failed: %s", exc)
    return None


def merge_llm_distillation(
    report: TradeCheckReport,
    distilled: DistilledTradeCheck,
) -> TradeCheckReport:
    """Overlay LLM-refined fields onto the rule-based report."""
    if distilled.company_name:
        report.header.company_name = distilled.company_name
    if distilled.tags:
        report.header.tags = distilled.tags
    if distilled.strategy:
        report.header.strategy = distilled.strategy

    report.bottom_line = distilled.bottom_line
    report.distillation_notes = "LLM-refined distillation applied."

    if report.verdict:
        report.verdict[0].headline = distilled.now_guidance[:120]
        report.verdict[0].detail = distilled.now_guidance

    for badge in report.verdict:
        if badge.id == "long_trigger" and distilled.long_trigger:
            badge.detail = distilled.long_trigger
        if badge.id == "short_trigger" and distilled.short_trigger:
            badge.detail = distilled.short_trigger
        if badge.id == "size_warning" and distilled.size_warning:
            badge.detail = distilled.size_warning

    if distilled.catalysts:
        report.catalysts = [
            CatalystRow(
                metric=str(row.get("metric") or "Catalyst"),
                value=str(row.get("value") or ""),
                note=row.get("note"),
            )
            for row in distilled.catalysts
        ]

    extra_levels: list[PriceLevel] = []
    for idx, row in enumerate(distilled.resistance_levels or [], start=1):
        low = parse_price(row.get("low")) if isinstance(row.get("low"), str) else row.get("low")
        high = parse_price(row.get("high")) if isinstance(row.get("high"), str) else row.get("high")
        price = parse_price(row.get("price")) if isinstance(row.get("price"), str) else row.get("price")
        extra_levels.append(
            PriceLevel(
                label=str(row.get("label") or f"Resistance {idx}"),
                kind=PriceLevelKind.RESISTANCE,
                price=price,
                low=low if isinstance(low, (int, float)) else None,
                high=high if isinstance(high, (int, float)) else None,
                is_key=bool(row.get("is_key")),
                note=row.get("note"),
            )
        )
    for idx, row in enumerate(distilled.support_levels or [], start=1):
        low = parse_price(row.get("low")) if isinstance(row.get("low"), str) else row.get("low")
        high = parse_price(row.get("high")) if isinstance(row.get("high"), str) else row.get("high")
        price = parse_price(row.get("price")) if isinstance(row.get("price"), str) else row.get("price")
        extra_levels.append(
            PriceLevel(
                label=str(row.get("label") or f"Support {idx}"),
                kind=PriceLevelKind.SUPPORT,
                price=price,
                low=low if isinstance(low, (int, float)) else None,
                high=high if isinstance(high, (int, float)) else None,
                is_key=bool(row.get("is_key")),
                note=row.get("note"),
            )
        )
    if extra_levels:
        report.actionable_levels = extra_levels + report.actionable_levels

    scenarios: list[TradeScenario] = []
    if distilled.long_scenario:
        data = distilled.long_scenario
        scenarios.append(
            TradeScenario(
                id="long",
                direction="long",
                title=str(data.get("title") or "Scenario A — Pullback long"),
                trigger=str(data.get("trigger") or ""),
                stop=parse_price(data.get("stop")),
                targets=[str(t) for t in data.get("targets") or []],
                note=data.get("note"),
            )
        )
    if distilled.short_scenario:
        data = distilled.short_scenario
        scenarios.append(
            TradeScenario(
                id="short",
                direction="short",
                title=str(data.get("title") or "Scenario B — Fade the move"),
                trigger=str(data.get("trigger") or ""),
                stop=parse_price(data.get("stop")),
                targets=[str(t) for t in data.get("targets") or []],
                note=data.get("note"),
            )
        )
    if scenarios:
        report.scenarios = scenarios

    return report


def build_rule_based_report(
    *,
    ticker: str,
    analysis_date: str,
    sections: dict[str, Any],
    snapshot: dict[str, Any],
    sources: list[TradeCheckSource],
    user_context: str = "",
    chart=None,
) -> TradeCheckReport:
    """Build a Trade Check report without LLM calls (deterministic)."""
    entry, stop = _extract_trader_levels(sections)
    portfolio = sections.get("final_trade_decision") or ""
    target = parse_price(_TARGET_RE.search(portfolio).group(1) if _TARGET_RE.search(portfolio) else None)
    decision = _extract_decision(sections)

    header = TradeCheckHeader(
        ticker=normalize_ticker(ticker),
        company_name=snapshot.get("company_name"),
        exchange=snapshot.get("exchange"),
        analysis_date=analysis_date,
        strategy="Swing / multi-day",
        tags=[],
    )

    from .schemas import PriceSummary, TradeCheckChart

    price_summary = PriceSummary(
        current_price=snapshot.get("current_price"),
        change_pct=snapshot.get("change_pct"),
        change_amount=snapshot.get("change_amount"),
        fifty_two_week_range=snapshot.get("fifty_two_week_range"),
        beta=snapshot.get("beta"),
        earnings_date=snapshot.get("earnings_date"),
    )

    levels = _rule_based_levels(snapshot, entry, stop, target)
    scenarios = _rule_based_scenarios(
        entry,
        stop,
        target,
        snapshot.get("day_high"),
        snapshot.get("day_low"),
    )

    bottom_line = (
        f"Final rating: {decision or 'See full report'}. "
        "Use defined triggers at support/resistance rather than chasing mid-range price."
    )

    return TradeCheckReport(
        header=header,
        price_summary=price_summary,
        quick_metrics=_build_quick_metrics(snapshot),
        actionable_levels=levels,
        scenarios=scenarios,
        catalysts=_rule_based_catalysts(sections),
        verdict=_default_verdict(
            snapshot.get("current_price"),
            entry,
            stop,
            decision,
            user_context,
        ),
        bottom_line=bottom_line,
        agent_sections=_build_agent_sections(sections, sources),
        sources=sources,
        chart=chart or TradeCheckChart(),
        decision=decision,
        distillation_notes="Rule-based distillation from agent reports and market data.",
    )
