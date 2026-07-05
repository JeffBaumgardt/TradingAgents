"""Tests for user-provided context injection into agent state and prompts."""

from unittest.mock import MagicMock

from tradingagents.agents.managers.portfolio_manager import create_portfolio_manager
from tradingagents.agents.managers.research_manager import create_research_manager
from tradingagents.agents.schemas import PortfolioDecision, PortfolioRating, ResearchPlan
from tradingagents.agents.utils.agent_utils import (
    build_initial_user_message,
    format_user_context_block,
)
from tradingagents.graph.propagation import Propagator


class TestUserContextHelpers:

    def test_build_initial_user_message_ticker_only(self):
        assert build_initial_user_message("MU") == "MU"

    def test_build_initial_user_message_with_context(self):
        msg = build_initial_user_message(
            "MU",
            "I own 1 share. Should I add before earnings?",
        )
        assert "Analyze MU." in msg
        assert "I own 1 share" in msg
        assert "User context and questions:" in msg

    def test_format_user_context_block_empty(self):
        assert format_user_context_block("") == ""
        assert format_user_context_block("   ") == ""
        assert format_user_context_block(None) == ""

    def test_build_initial_user_message_none_context(self):
        assert build_initial_user_message("MU", None) == "MU"

    def test_format_user_context_block_includes_guidance(self):
        block = format_user_context_block("SPY 1-week expiration put")
        assert "SPY 1-week expiration put" in block
        assert "User Context & Questions" in block


class TestUserContextState:

    def test_user_context_in_initial_state(self):
        propagator = Propagator()
        state = propagator.create_initial_state(
            "MU",
            "2026-06-24",
            user_context="I own 1 share",
        )
        assert state["user_context"] == "I own 1 share"
        assert "I own 1 share" in state["messages"][0][1]

    def test_user_context_defaults_to_empty(self):
        propagator = Propagator()
        state = propagator.create_initial_state("MU", "2026-06-24")
        assert state["user_context"] == ""
        assert state["messages"] == [("human", "MU")]

    def test_user_context_none_is_normalized_to_empty(self):
        propagator = Propagator()
        state = propagator.create_initial_state("MU", "2026-06-24", user_context=None)
        assert state["user_context"] == ""
        assert state["messages"] == [("human", "MU")]


class TestUserContextInAgentPrompts:

    def test_research_manager_prompt_includes_user_context(self):
        captured = {}
        plan = ResearchPlan(
            recommendation=PortfolioRating.HOLD,
            rationale="Balanced debate.",
            strategic_actions="Wait for clarity.",
        )
        structured = MagicMock()
        structured.invoke.side_effect = lambda prompt: (
            captured.__setitem__("prompt", prompt) or plan
        )
        llm = MagicMock()
        llm.with_structured_output.return_value = structured

        node = create_research_manager(llm)
        node(
            {
                "company_of_interest": "MU",
                "user_context": "Should I buy a call before earnings?",
                "investment_debate_state": {
                    "history": "debate",
                    "count": 1,
                },
            }
        )
        assert "Should I buy a call before earnings?" in captured["prompt"]

    def test_portfolio_manager_prompt_includes_user_context(self):
        captured = {}
        decision = PortfolioDecision(
            rating=PortfolioRating.HOLD,
            executive_summary="Hold existing share.",
            investment_thesis="One-share position does not warrant adding risk.",
        )
        structured = MagicMock()
        structured.invoke.side_effect = lambda prompt: (
            captured.__setitem__("prompt", prompt) or decision
        )
        llm = MagicMock()
        llm.with_structured_output.return_value = structured

        node = create_portfolio_manager(llm)
        node(
            {
                "company_of_interest": "MU",
                "user_context": "I own 1 share at $85",
                "investment_plan": "Hold",
                "trader_investment_plan": "Hold",
                "past_context": "",
                "risk_debate_state": {
                    "history": "risk debate",
                    "aggressive_history": "",
                    "conservative_history": "",
                    "neutral_history": "",
                    "current_aggressive_response": "",
                    "current_conservative_response": "",
                    "current_neutral_response": "",
                    "count": 1,
                },
            }
        )
        assert "I own 1 share at $85" in captured["prompt"]
