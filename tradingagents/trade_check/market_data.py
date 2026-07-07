"""Market data helpers for Trade Check charts and quick metrics."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf
from dateutil.relativedelta import relativedelta

from tradingagents.dataflows.stockstats_utils import yf_retry
from tradingagents.dataflows.symbol_utils import normalize_symbol

from .schemas import ChartLevelLine, OhlcvBar, ProjectedPathPoint, TradeCheckChart

logger = logging.getLogger(__name__)

CHART_LOOKBACK_DAYS = 90
PROJECTION_DAYS = 10


def _safe_float(value) -> float | None:
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_market_snapshot(ticker: str, analysis_date: str) -> dict:
    """Fetch price snapshot and quick metrics from Yahoo Finance."""
    canonical = normalize_symbol(ticker)
    end_dt = datetime.strptime(analysis_date, "%Y-%m-%d")
    start_dt = end_dt - relativedelta(days=CHART_LOOKBACK_DAYS + 30)

    try:
        history = yf_retry(
            lambda: yf.Ticker(canonical).history(
                start=start_dt.strftime("%Y-%m-%d"),
                end=(end_dt + timedelta(days=1)).strftime("%Y-%m-%d"),
            )
        )
    except Exception as exc:  # noqa: BLE001 - best-effort market data
        logger.warning("Trade Check market snapshot failed for %s: %s", ticker, exc)
        return {}

    if history is None or history.empty:
        return {}

    if history.index.tz is not None:
        history.index = history.index.tz_localize(None)

    history = history.sort_index()
    analysis_ts = pd.Timestamp(analysis_date)
    on_or_before = history[history.index <= analysis_ts]
    if on_or_before.empty:
        on_or_before = history

    latest = on_or_before.iloc[-1]
    prev = on_or_before.iloc[-2] if len(on_or_before) > 1 else latest

    current = _safe_float(latest.get("Close"))
    previous_close = _safe_float(prev.get("Close"))
    change_amount = None
    change_pct = None
    if current is not None and previous_close not in (None, 0):
        change_amount = round(current - previous_close, 2)
        change_pct = round((change_amount / previous_close) * 100, 2)

    day_low = _safe_float(latest.get("Low"))
    day_high = _safe_float(latest.get("High"))
    volume = _safe_float(latest.get("Volume"))

    avg_volume = None
    if "Volume" in on_or_before.columns and len(on_or_before) >= 20:
        avg_volume = _safe_float(on_or_before["Volume"].tail(20).mean())

    rsi = _compute_rsi(on_or_before["Close"]) if len(on_or_before) >= 15 else None

    beta = None
    fifty_two_week = None
    earnings_date = None
    company_name = None
    exchange = None
    try:
        info = yf.Ticker(canonical).info or {}
        beta = _safe_float(info.get("beta"))
        low52 = info.get("fiftyTwoWeekLow")
        high52 = info.get("fiftyTwoWeekHigh")
        if low52 is not None and high52 is not None:
            fifty_two_week = f"${float(low52):,.2f} – ${float(high52):,.2f}"
        earnings_date = info.get("earningsDate")
        if isinstance(earnings_date, list) and earnings_date:
            earnings_date = str(earnings_date[0])[:10]
        company_name = info.get("shortName") or info.get("longName")
        exchange = info.get("exchange")
    except Exception:  # noqa: BLE001
        pass

    return {
        "canonical_symbol": canonical,
        "company_name": company_name,
        "exchange": exchange,
        "current_price": current,
        "change_amount": change_amount,
        "change_pct": change_pct,
        "day_low": day_low,
        "day_high": day_high,
        "volume": volume,
        "avg_volume": avg_volume,
        "rsi": rsi,
        "beta": beta,
        "fifty_two_week_range": fifty_two_week,
        "earnings_date": earnings_date,
        "history": on_or_before,
    }


def _compute_rsi(closes: pd.Series, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    delta = closes.diff()
    gain = delta.clip(lower=0).rolling(window=period).mean()
    loss = (-delta.clip(upper=0)).rolling(window=period).mean()
    last_gain = gain.iloc[-1]
    last_loss = loss.iloc[-1]
    if pd.isna(last_gain) or pd.isna(last_loss) or last_loss == 0:
        return None
    rs = last_gain / last_loss
    return round(float(100 - (100 / (1 + rs))), 2)


def build_chart_payload(
    history: pd.DataFrame | None,
    analysis_date: str,
    levels: list[tuple[str, float, str]],
) -> TradeCheckChart:
    """Build OHLCV bars, level overlays, and a simple volatility projection."""
    if history is None or history.empty:
        return TradeCheckChart(
            legend=[
                "Historical OHLCV (daily)",
                "Dashed lines = actionable levels",
                "Shaded band = statistical p90 range (not a forecast guarantee)",
            ]
        )

    end_dt = datetime.strptime(analysis_date, "%Y-%m-%d")
    start_dt = end_dt - relativedelta(days=CHART_LOOKBACK_DAYS)
    window = history[history.index >= pd.Timestamp(start_dt.date())]
    if window.empty:
        window = history.tail(CHART_LOOKBACK_DAYS)

    bars: list[OhlcvBar] = []
    for ts, row in window.iterrows():
        bars.append(
            OhlcvBar(
                time=str(ts.date()),
                open=round(float(row["Open"]), 2),
                high=round(float(row["High"]), 2),
                low=round(float(row["Low"]), 2),
                close=round(float(row["Close"]), 2),
                volume=_safe_float(row.get("Volume")),
            )
        )

    chart_levels = [
        ChartLevelLine(label=label, price=price, color=color, style="dashed")
        for label, price, color in levels
        if price is not None
    ]

    projection = _build_projection(window, analysis_date)

    return TradeCheckChart(
        bars=bars,
        levels=chart_levels,
        projection=projection,
        legend=[
            "Candles = daily OHLCV",
            "Green/red dashed = support/resistance & trade levels",
            "Dotted path = median (p50) projection; band = p90 range",
        ],
    )


def _build_projection(history: pd.DataFrame, analysis_date: str) -> list[ProjectedPathPoint]:
    """Simple ATR-based forward projection for visual context."""
    if history is None or len(history) < 5:
        return []

    closes = history["Close"].astype(float)
    returns = closes.pct_change().dropna()
    if returns.empty:
        return []

    daily_vol = float(returns.tail(20).std() or returns.std() or 0.01)
    last_close = float(closes.iloc[-1])
    start = datetime.strptime(analysis_date, "%Y-%m-%d")

    points: list[ProjectedPathPoint] = []
    price = last_close
    for offset in range(1, PROJECTION_DAYS + 1):
        day = start + timedelta(days=offset)
        # Skip weekends for equity-like symbols
        while day.weekday() >= 5:
            day += timedelta(days=1)
        move = daily_vol * (offset ** 0.5)
        p50 = round(price, 2)
        p90_high = round(price * (1 + move * 1.65), 2)
        p90_low = round(price * (1 - move * 1.65), 2)
        points.append(
            ProjectedPathPoint(
                time=day.strftime("%Y-%m-%d"),
                p50=p50,
                p90_high=p90_high,
                p90_low=p90_low,
            )
        )
    return points


def level_color(kind: str) -> str:
    """Map level kind to chart color."""
    mapping = {
        "support": "#22c55e",
        "resistance": "#ef4444",
        "entry": "#3b82f6",
        "stop": "#f97316",
        "target": "#a855f7",
        "current": "#94a3b8",
    }
    return mapping.get(kind, "#64748b")
