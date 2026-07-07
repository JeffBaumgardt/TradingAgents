"""Trade Check distillation: structured, citation-backed quick-view reports."""

from .builder import build_trade_check
from .schemas import TradeCheckReport

__all__ = ["TradeCheckReport", "build_trade_check"]
