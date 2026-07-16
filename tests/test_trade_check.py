"""Tests for Trade Check distillation and normalization."""

from __future__ import annotations

import pandas as pd

from tradingagents.trade_check.builder import _chart_levels_from_report
from tradingagents.trade_check.distiller import build_rule_based_report
from tradingagents.trade_check.market_data import CHART_DISPLAY_TRADING_DAYS, build_chart_payload
from tradingagents.trade_check.normalize import (
    normalize_ticker,
    parse_price,
    parse_price_range,
    source_from_url,
)
from tradingagents.trade_check.schemas import (
    PriceLevel,
    PriceLevelKind,
    PriceSummary,
    TradeCheckHeader,
    TradeCheckReport,
)


class TestNormalization:
    def test_normalize_ticker_equity(self):
        assert normalize_ticker("spy") == "SPY"

    def test_parse_price_currency(self):
        assert parse_price("$289.75") == 289.75

    def test_parse_price_range(self):
        low, high = parse_price_range("$270 – $275")
        assert low == 270.0
        assert high == 275.0

    def test_source_from_url(self):
        src = source_from_url("src-1", "Example News", "https://news.example.com/a")
        assert src.provider == "news.example.com"
        assert src.url == "https://news.example.com/a"


class TestRuleBasedDistillation:
    def test_builds_core_sections(self):
        sections = {
            "market_report": "Trend is bullish with strong volume.",
            "sentiment_report": (
                "**Overall Sentiment:** **Bullish** (Score: 7.2/10)\n"
                "**Confidence:** High\n\nSocial chatter is positive."
            ),
            "news_report": "Major contract announced. See https://example.com/news",
            "fundamentals_report": "Revenue grew 20% YoY.",
            "investment_plan": "**Recommendation**: Overweight",
            "trader_investment_plan": (
                "**Action**: Buy\n\n**Entry Price**: 150\n**Stop Loss**: 140"
            ),
            "final_trade_decision": "**Rating**: Overweight\n\n**Executive Summary**: Accumulate on dips.",
        }
        snapshot = {
            "company_name": "Example Corp",
            "exchange": "NASDAQ",
            "current_price": 155.0,
            "change_pct": 2.5,
            "change_amount": 3.75,
            "day_low": 150.0,
            "day_high": 156.0,
            "volume": 5_000_000,
            "avg_volume": 4_000_000,
            "rsi": 55.0,
            "beta": 1.4,
            "fifty_two_week_range": "$100 – $160",
            "earnings_date": "2026-08-01",
        }

        report = build_rule_based_report(
            ticker="EXMP",
            analysis_date="2026-07-06",
            sections=sections,
            snapshot=snapshot,
            sources=[
                source_from_url("n1", "Example News", "https://example.com/news", tool_name="get_news"),
            ],
            user_context="Looking for swing entry",
        )

        assert isinstance(report, TradeCheckReport)
        assert report.header.ticker == "EXMP"
        assert report.decision == "Overweight"
        assert len(report.quick_metrics) >= 3
        assert len(report.agent_sections) >= 5
        assert report.scenarios
        assert report.verdict
        assert report.bottom_line

        payload = report.to_api_dict()
        assert payload["schemaVersion"] == "1.0"
        assert payload["header"]["ticker"] == "EXMP"
        assert payload["priceSummary"]["currentPrice"] == 155.0


class TestChartPayload:
    def test_limits_display_to_recent_trading_days(self):
        dates = pd.date_range(end="2026-07-07", periods=60, freq="B")
        history = pd.DataFrame(
            {
                "Open": range(400, 460),
                "High": range(405, 465),
                "Low": range(395, 455),
                "Close": range(402, 462),
                "Volume": [1_000_000] * 60,
            },
            index=dates,
        )

        chart = build_chart_payload(history, "2026-07-07", [])

        assert len(chart.bars) == CHART_DISPLAY_TRADING_DAYS
        assert chart.bars[0].time == str(dates[-CHART_DISPLAY_TRADING_DAYS].date())
        assert chart.bars[-1].time == "2026-07-07"

    def test_projection_dates_are_unique_trading_days(self):
        dates = pd.date_range(end="2026-07-03", periods=30, freq="B")
        history = pd.DataFrame(
            {
                "Open": range(400, 430),
                "High": range(405, 435),
                "Low": range(395, 425),
                "Close": range(402, 432),
                "Volume": [1_000_000] * 30,
            },
            index=dates,
        )

        chart = build_chart_payload(history, "2026-07-03", [])
        projection_times = [point.time for point in chart.projection]

        assert projection_times
        assert len(projection_times) == len(set(projection_times))
        assert projection_times == sorted(projection_times)


class TestChartLevelFiltering:
    def _build_report(self, levels: list[PriceLevel]) -> TradeCheckReport:
        return TradeCheckReport(
            header=TradeCheckHeader(ticker="EXMP", analysis_date="2026-07-06"),
            price_summary=PriceSummary(),
            actionable_levels=levels,
        )

    def test_excludes_trade_management_levels_from_chart(self):
        report = self._build_report(
            [
                PriceLevel(label="Current price", kind=PriceLevelKind.CURRENT, price=100.0),
                PriceLevel(
                    label="Resistance 1 — day high",
                    kind=PriceLevelKind.RESISTANCE,
                    price=110.0,
                ),
                PriceLevel(label="Support 1 — day low", kind=PriceLevelKind.SUPPORT, price=95.0),
                PriceLevel(label="Entry", kind=PriceLevelKind.ENTRY, price=101.0),
                PriceLevel(label="Stop", kind=PriceLevelKind.STOP, price=90.0),
                PriceLevel(
                    label="Risk from entry",
                    kind=PriceLevelKind.STOP,
                    low=90.0,
                    high=101.0,
                ),
                PriceLevel(label="Target", kind=PriceLevelKind.TARGET, price=130.0),
            ]
        )

        labels = [label for label, _price, _color in _chart_levels_from_report(report)]

        assert labels == [
            "Current price",
            "Resistance 1 — day high",
            "Support 1 — day low",
            "Target",
        ]
        assert "Entry" not in labels
        assert "Stop" not in labels
        assert "Risk from entry" not in labels
