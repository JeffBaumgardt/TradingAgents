"""Normalize symbols, prices, and source metadata across data providers."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from tradingagents.dataflows.symbol_utils import normalize_symbol

from .schemas import SourceKind, TradeCheckSource

_URL_RE = re.compile(r"https?://[^\s\)\]>]+", re.IGNORECASE)
_PRICE_RE = re.compile(r"\$?\s*([\d,]+(?:\.\d{1,2})?)")
_MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\)]+)\)")

_PROVIDER_ALIASES = {
    "yfinance": "Yahoo Finance",
    "yahoo": "Yahoo Finance",
    "reddit": "Reddit",
    "google": "Google News",
    "rss": "RSS",
    "sec": "SEC EDGAR",
    "stocktwits": "Stocktwits",
    "finviz": "Finviz",
    "alpha_vantage": "Alpha Vantage",
    "alpaca": "Alpaca",
}


def normalize_ticker(raw: str) -> str:
    """Map user/broker ticker to canonical uppercase symbol."""
    if not raw or not raw.strip():
        return raw
    return normalize_symbol(raw.strip()).upper()


def parse_price(value: str | float | int | None) -> float | None:
    """Parse a price from prose, currency strings, or numeric values."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    match = _PRICE_RE.search(text.replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def parse_price_range(text: str) -> tuple[float | None, float | None]:
    """Parse ranges like '$270 – $275' or '270-275'."""
    if not text:
        return None, None
    cleaned = text.replace("$", "").replace("–", "-").replace("—", "-")
    parts = [part.strip() for part in cleaned.split("-") if part.strip()]
    if len(parts) >= 2:
        return parse_price(parts[0]), parse_price(parts[1])
    single = parse_price(cleaned)
    return single, single


def infer_provider(url: str | None, tool_name: str | None = None) -> str | None:
    """Infer human-readable provider name from URL or tool name."""
    if tool_name:
        key = tool_name.lower().replace("-", "_")
        for alias, label in _PROVIDER_ALIASES.items():
            if alias in key:
                return label
    if not url:
        return None
    host = urlparse(url).netloc.lower()
    if "reddit.com" in host:
        return "Reddit"
    if "sec.gov" in host:
        return "SEC EDGAR"
    if "yahoo" in host:
        return "Yahoo Finance"
    if "google" in host:
        return "Google News"
    if "stocktwits" in host:
        return "Stocktwits"
    return host.removeprefix("www.") or None


def infer_source_kind(url: str | None, tool_name: str | None = None) -> SourceKind:
    """Classify a source for UI grouping."""
    combined = f"{url or ''} {tool_name or ''}".lower()
    if any(token in combined for token in ("news", "rss", "google")):
        return SourceKind.NEWS
    if any(token in combined for token in ("reddit", "stocktwits", "social")):
        return SourceKind.SOCIAL
    if "sec" in combined:
        return SourceKind.SEC
    if any(token in combined for token in ("fundamental", "balance", "income", "cashflow")):
        return SourceKind.FUNDAMENTALS
    if any(token in combined for token in ("stock", "indicator", "market", "yfinance", "ohlcv")):
        return SourceKind.MARKET_DATA
    return SourceKind.OTHER


def extract_urls_from_text(text: str) -> list[tuple[str, str]]:
    """Return (title, url) pairs from markdown links and bare URLs."""
    found: list[tuple[str, str]] = []
    seen: set[str] = set()

    for title, url in _MARKDOWN_LINK_RE.findall(text or ""):
        if url not in seen:
            found.append((title.strip() or url, url.strip()))
            seen.add(url)

    for url in _URL_RE.findall(text or ""):
        cleaned = url.rstrip(".,)")
        if cleaned not in seen:
            found.append((cleaned, cleaned))
            seen.add(cleaned)

    return found


def source_from_url(
    source_id: str,
    title: str,
    url: str,
    *,
    tool_name: str | None = None,
    excerpt: str | None = None,
) -> TradeCheckSource:
    """Build a normalized TradeCheckSource from a URL."""
    return TradeCheckSource(
        id=source_id,
        title=title[:200],
        url=url,
        provider=infer_provider(url, tool_name),
        kind=infer_source_kind(url, tool_name),
        excerpt=(excerpt[:400] if excerpt else None),
    )


def normalize_tool_event_source(
    index: int,
    tool_name: str,
    args: dict[str, Any],
    content: str | None = None,
) -> list[TradeCheckSource]:
    """Extract citable sources from a tool.call event."""
    sources: list[TradeCheckSource] = []
    base_id = f"tool-{index}"

    query = args.get("query") or args.get("symbol") or args.get("ticker")
    title_bits = [tool_name.replace("_", " ").title()]
    if query:
        title_bits.append(str(query))

    for idx, (link_title, url) in enumerate(extract_urls_from_text(content or "")):
        sources.append(
            source_from_url(
                f"{base_id}-url-{idx}",
                link_title,
                url,
                tool_name=tool_name,
                excerpt=content[:200] if content and idx == 0 else None,
            )
        )

    if not sources and query:
        sources.append(
            TradeCheckSource(
                id=base_id,
                title=" · ".join(title_bits),
                provider=infer_provider(None, tool_name),
                kind=infer_source_kind(None, tool_name),
                excerpt=(content[:400] if content else None),
            )
        )

    return sources
