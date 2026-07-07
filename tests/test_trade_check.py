"""Tests for Trade Check distillation and normalization."""

from __future__ import annotations

from tradingagents.trade_check.distiller import build_rule_based_report
from tradingagents.trade_check.normalize import (
    normalize_ticker,
    parse_price,
    parse_price_range,
    source_from_url,
)
from tradingagents.trade_check.schemas import TradeCheckReport


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
