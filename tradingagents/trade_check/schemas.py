"""Pydantic schemas for the Trade Check distilled report."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class TradeCheckModel(BaseModel):
    """Base model serializing to camelCase for the TypeScript API."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class VerdictBadgeTone(str, Enum):
    NEUTRAL = "neutral"
    BULLISH = "bullish"
    BEARISH = "bearish"
    WARNING = "warning"


class PriceLevelKind(str, Enum):
    CURRENT = "current"
    RESISTANCE = "resistance"
    SUPPORT = "support"
    STOP = "stop"
    TARGET = "target"
    ENTRY = "entry"


class SourceKind(str, Enum):
    NEWS = "news"
    SOCIAL = "social"
    SEC = "sec"
    MARKET_DATA = "market_data"
    FUNDAMENTALS = "fundamentals"
    OTHER = "other"


class TradeCheckSource(TradeCheckModel):
    """A citable source referenced in the distilled report."""

    id: str = Field(description="Stable id for linking claims to evidence, e.g. src-1")
    title: str
    url: str | None = None
    provider: str | None = None
    kind: SourceKind = SourceKind.OTHER
    published_at: str | None = None
    excerpt: str | None = None


class PriceLevel(TradeCheckModel):
    """An actionable price level with optional range bounds."""

    label: str
    kind: PriceLevelKind
    price: float | None = None
    low: float | None = None
    high: float | None = None
    note: str | None = None
    is_key: bool = False


class QuickMetric(TradeCheckModel):
    """Header strip metric (today move, RSI, volume, etc.)."""

    label: str
    value: str
    tone: VerdictBadgeTone = VerdictBadgeTone.NEUTRAL
    note: str | None = None


class TradeScenario(TradeCheckModel):
    """Conditional trade setup (long or short)."""

    id: str
    direction: Literal["long", "short"]
    title: str
    trigger: str
    stop: float | None = None
    stop_label: str | None = None
    risk_per_share: str | None = None
    targets: list[str] = Field(default_factory=list)
    note: str | None = None
    source_ids: list[str] = Field(default_factory=list)


class CatalystRow(TradeCheckModel):
    """Row in the catalyst / context table."""

    metric: str
    value: str
    note: str | None = None
    source_ids: list[str] = Field(default_factory=list)


class VerdictBadge(TradeCheckModel):
    """Status badge in the verdict section."""

    id: str
    label: str
    tone: VerdictBadgeTone
    headline: str
    detail: str | None = None


class AgentSectionSummary(TradeCheckModel):
    """Per-agent distilled findings with top sources."""

    agent_key: str
    agent_name: str
    headline: str
    confidence: Literal["low", "medium", "high"] | None = None
    score: float | None = Field(default=None, ge=0.0, le=10.0)
    top_sources: list[TradeCheckSource] = Field(default_factory=list)
    key_points: list[str] = Field(default_factory=list)
    data_bucket: dict[str, str | float | int | None] = Field(default_factory=dict)


class OhlcvBar(TradeCheckModel):
    """Single OHLCV candle for chart rendering."""

    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None


class ChartLevelLine(TradeCheckModel):
    """Horizontal level overlay on the price chart."""

    label: str
    price: float
    color: str
    style: Literal["solid", "dashed", "dotted"] = "dashed"


class ProjectedPathPoint(TradeCheckModel):
    """Forward-looking projected price point (statistical, not a guarantee)."""

    time: str
    p50: float
    p90_high: float | None = None
    p90_low: float | None = None


class TradeCheckChart(TradeCheckModel):
    """Chart payload: historical candles, levels, optional projection."""

    bars: list[OhlcvBar] = Field(default_factory=list)
    levels: list[ChartLevelLine] = Field(default_factory=list)
    projection: list[ProjectedPathPoint] = Field(default_factory=list)
    legend: list[str] = Field(default_factory=list)


class TradeCheckHeader(TradeCheckModel):
    """Report header metadata."""

    ticker: str
    company_name: str | None = None
    tags: list[str] = Field(default_factory=list)
    exchange: str | None = None
    analysis_date: str
    strategy: str | None = None


class PriceSummary(TradeCheckModel):
    """Current price block in the header."""

    current_price: float | None = None
    change_pct: float | None = None
    change_amount: float | None = None
    after_hours_note: str | None = None
    fifty_two_week_range: str | None = None
    beta: float | None = None
    earnings_date: str | None = None


class TradeCheckReport(TradeCheckModel):
    """Full distilled Trade Check artifact."""

    schema_version: str = "1.0"
    header: TradeCheckHeader
    price_summary: PriceSummary
    quick_metrics: list[QuickMetric] = Field(default_factory=list)
    actionable_levels: list[PriceLevel] = Field(default_factory=list)
    scenarios: list[TradeScenario] = Field(default_factory=list)
    catalysts: list[CatalystRow] = Field(default_factory=list)
    verdict: list[VerdictBadge] = Field(default_factory=list)
    bottom_line: str | None = None
    agent_sections: list[AgentSectionSummary] = Field(default_factory=list)
    sources: list[TradeCheckSource] = Field(default_factory=list)
    chart: TradeCheckChart = Field(default_factory=TradeCheckChart)
    decision: str | None = None
    distillation_notes: str | None = None

    def to_api_dict(self) -> dict:
        """Serialize for JSON API responses (camelCase keys)."""
        return self.model_dump(mode="json", by_alias=True)
