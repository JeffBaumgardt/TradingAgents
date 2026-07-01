"""
apps/agents-service/stream_processor.py

Extracted LangGraph stream processing from cli/main.py (lines 1093-1190).
Converts graph chunks into SSE-ready events using MessageBuffer patterns.
"""

from __future__ import annotations

import ast
import datetime
from collections import deque
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

EventEmitter = Callable[[str, dict[str, Any]], None]

ANALYST_ORDER = ["market", "social", "news", "fundamentals"]
ANALYST_AGENT_NAMES = {
    "market": "Market Analyst",
    "social": "Social Analyst",
    "news": "News Analyst",
    "fundamentals": "Fundamentals Analyst",
}
ANALYST_REPORT_MAP = {
    "market": "market_report",
    "social": "sentiment_report",
    "news": "news_report",
    "fundamentals": "fundamentals_report",
}


def extract_content_string(content: Any) -> str | None:
    """Extract string content from various message formats."""

    def is_empty(val: Any) -> bool:
        if val is None or val == "":
            return True
        if isinstance(val, str):
            stripped = val.strip()
            if not stripped:
                return True
            try:
                return not bool(ast.literal_eval(stripped))
            except (ValueError, SyntaxError):
                return False
        return not bool(val)

    if is_empty(content):
        return None

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, dict):
        text = content.get("text", "")
        return text.strip() if not is_empty(text) else None

    if isinstance(content, list):
        text_parts = [
            item.get("text", "").strip()
            if isinstance(item, dict) and item.get("type") == "text"
            else (item.strip() if isinstance(item, str) else "")
            for item in content
        ]
        result = " ".join(part for part in text_parts if part and not is_empty(part))
        return result or None

    rendered = str(content).strip()
    return rendered if not is_empty(rendered) else None


def classify_message_type(message: Any) -> tuple[str, str | None]:
    content = extract_content_string(getattr(message, "content", None))

    if isinstance(message, HumanMessage):
        if content and content.strip() == "Continue":
            return ("Control", content)
        return ("User", content)

    if isinstance(message, ToolMessage):
        return ("Data", content)

    if isinstance(message, AIMessage):
        return ("Agent", content)

    return ("System", content)


@dataclass
class StreamBuffer:
    """In-memory buffer mirroring cli/main.py MessageBuffer for SSE emission."""

    FIXED_AGENTS: dict[str, list[str]] = field(
        default_factory=lambda: {
            "Research Team": ["Bull Researcher", "Bear Researcher", "Research Manager"],
            "Trading Team": ["Trader"],
            "Risk Management": [
                "Aggressive Analyst",
                "Neutral Analyst",
                "Conservative Analyst",
            ],
            "Portfolio Management": ["Portfolio Manager"],
        }
    )
    ANALYST_MAPPING: dict[str, str] = field(
        default_factory=lambda: {
            "market": "Market Analyst",
            "social": "Social Analyst",
            "news": "News Analyst",
            "fundamentals": "Fundamentals Analyst",
        }
    )
    REPORT_SECTIONS: dict[str, tuple[str | None, str]] = field(
        default_factory=lambda: {
            "market_report": ("market", "Market Analyst"),
            "sentiment_report": ("social", "Social Analyst"),
            "news_report": ("news", "News Analyst"),
            "fundamentals_report": ("fundamentals", "Fundamentals Analyst"),
            "investment_plan": (None, "Research Manager"),
            "trader_investment_plan": (None, "Trader"),
            "final_trade_decision": (None, "Portfolio Manager"),
        }
    )

    messages: deque[tuple[str, str, str]] = field(default_factory=lambda: deque(maxlen=100))
    tool_calls: deque[tuple[str, str, dict]] = field(default_factory=lambda: deque(maxlen=100))
    agent_status: dict[str, str] = field(default_factory=dict)
    report_sections: dict[str, str | None] = field(default_factory=dict)
    selected_analysts: list[str] = field(default_factory=list)
    final_report: str | None = None
    _processed_message_ids: set[str] = field(default_factory=set)
    _last_agent_status: dict[str, str] = field(default_factory=dict)

    def init_for_analysis(self, selected_analysts: Iterable[str]) -> None:
        self.selected_analysts = [a.lower() for a in selected_analysts]
        self.agent_status = {}

        for analyst_key in self.selected_analysts:
            mapped = self.ANALYST_MAPPING.get(analyst_key)
            if mapped:
                self.agent_status[mapped] = "pending"

        for team_agents in self.FIXED_AGENTS.values():
            for agent in team_agents:
                self.agent_status[agent] = "pending"

        self.report_sections = {}
        for section, (analyst_key, _) in self.REPORT_SECTIONS.items():
            if analyst_key is None or analyst_key in self.selected_analysts:
                self.report_sections[section] = None

        self.messages.clear()
        self.tool_calls.clear()
        self._processed_message_ids.clear()
        self._last_agent_status.clear()
        self.final_report = None

    def add_message(self, message_type: str, content: str) -> None:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.messages.append((timestamp, message_type, content))

    def add_tool_call(self, tool_name: str, args: dict) -> None:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.tool_calls.append((timestamp, tool_name, args))

    def update_agent_status(self, agent: str, status: str) -> None:
        if agent in self.agent_status:
            self.agent_status[agent] = status

    def update_report_section(self, section_name: str, content: str) -> None:
        if section_name in self.report_sections:
            self.report_sections[section_name] = content
            self._update_final_report()

    def _update_final_report(self) -> None:
        report_parts: list[str] = []
        analyst_sections = [
            "market_report",
            "sentiment_report",
            "news_report",
            "fundamentals_report",
        ]

        if any(self.report_sections.get(section) for section in analyst_sections):
            report_parts.append("## Analyst Team Reports")
            for section, title in [
                ("market_report", "Market Analysis"),
                ("sentiment_report", "Social Sentiment"),
                ("news_report", "News Analysis"),
                ("fundamentals_report", "Fundamentals Analysis"),
            ]:
                content = self.report_sections.get(section)
                if content:
                    report_parts.append(f"### {title}\n{content}")

        if self.report_sections.get("investment_plan"):
            report_parts.append("## Research Team Decision")
            report_parts.append(str(self.report_sections["investment_plan"]))

        if self.report_sections.get("trader_investment_plan"):
            report_parts.append("## Trading Team Plan")
            report_parts.append(str(self.report_sections["trader_investment_plan"]))

        if self.report_sections.get("final_trade_decision"):
            report_parts.append("## Portfolio Management Decision")
            report_parts.append(str(self.report_sections["final_trade_decision"]))

        self.final_report = "\n\n".join(report_parts) if report_parts else None


def update_research_team_status(buffer: StreamBuffer, status: str) -> None:
    for agent in ["Bull Researcher", "Bear Researcher", "Research Manager"]:
        buffer.update_agent_status(agent, status)


def update_analyst_statuses(
    buffer: StreamBuffer,
    chunk: dict[str, Any],
    emit: EventEmitter | None = None,
) -> None:
    selected = buffer.selected_analysts
    found_active = False

    for analyst_key in ANALYST_ORDER:
        if analyst_key not in selected:
            continue

        agent_name = ANALYST_AGENT_NAMES[analyst_key]
        report_key = ANALYST_REPORT_MAP[analyst_key]

        if chunk.get(report_key):
            new_content = chunk[report_key]
            if isinstance(new_content, str) and new_content.strip():
                previous = buffer.report_sections.get(report_key)
                buffer.update_report_section(report_key, new_content)
                if emit and previous != new_content:
                    emit(
                        "report.section",
                        {"section": report_key, "content": new_content},
                    )

        has_report = bool(buffer.report_sections.get(report_key))

        if has_report:
            buffer.update_agent_status(agent_name, "completed")
        elif not found_active:
            buffer.update_agent_status(agent_name, "in_progress")
            found_active = True
        else:
            buffer.update_agent_status(agent_name, "pending")

    if (
        not found_active
        and selected
        and buffer.agent_status.get("Bull Researcher") == "pending"
    ):
        buffer.update_agent_status("Bull Researcher", "in_progress")


class StreamProcessor:
    """Processes LangGraph stream chunks and emits structured SSE events."""

    def __init__(self, selected_analysts: list[str], emit: EventEmitter):
        self.buffer = StreamBuffer()
        self.buffer.init_for_analysis(selected_analysts)
        self.emit = emit
        self._last_stats: dict[str, int] | None = None

    def _emit_agent_status_changes(self) -> None:
        for agent, status in self.buffer.agent_status.items():
            if self.buffer._last_agent_status.get(agent) != status:
                self.buffer._last_agent_status[agent] = status
                self.emit("agent.status", {"agent": agent, "status": status})

    def process_chunk(self, chunk: dict[str, Any]) -> None:
        for message in chunk.get("messages", []):
            msg_id = getattr(message, "id", None)
            if msg_id is not None:
                if msg_id in self.buffer._processed_message_ids:
                    continue
                self.buffer._processed_message_ids.add(msg_id)

            msg_type, content = classify_message_type(message)
            if content and content.strip():
                self.buffer.add_message(msg_type, content)
                self.emit(
                    "message",
                    {
                        "messageType": msg_type,
                        "content": content,
                        "timestamp": datetime.datetime.now().isoformat(),
                    },
                )

            if hasattr(message, "tool_calls") and message.tool_calls:
                for tool_call in message.tool_calls:
                    if isinstance(tool_call, dict):
                        name = tool_call["name"]
                        args = tool_call["args"]
                    else:
                        name = tool_call.name
                        args = tool_call.args
                    self.buffer.add_tool_call(name, args)
                    self.emit(
                        "tool.call",
                        {
                            "toolName": name,
                            "args": args,
                            "timestamp": datetime.datetime.now().isoformat(),
                        },
                    )

        update_analyst_statuses(self.buffer, chunk, emit=self.emit)
        self._emit_agent_status_changes()

        if chunk.get("investment_debate_state"):
            debate_state = chunk["investment_debate_state"]
            bull_hist = debate_state.get("bull_history", "").strip()
            bear_hist = debate_state.get("bear_history", "").strip()
            judge = debate_state.get("judge_decision", "").strip()

            if bull_hist or bear_hist:
                update_research_team_status(self.buffer, "in_progress")
                self._emit_agent_status_changes()

            if bull_hist:
                content = f"### Bull Researcher Analysis\n{bull_hist}"
                self.buffer.update_report_section("investment_plan", content)
                self.emit("report.section", {"section": "investment_plan", "content": content})

            if bear_hist:
                content = f"### Bear Researcher Analysis\n{bear_hist}"
                self.buffer.update_report_section("investment_plan", content)
                self.emit("report.section", {"section": "investment_plan", "content": content})

            if judge:
                content = f"### Research Manager Decision\n{judge}"
                self.buffer.update_report_section("investment_plan", content)
                self.emit("report.section", {"section": "investment_plan", "content": content})
                update_research_team_status(self.buffer, "completed")
                self.buffer.update_agent_status("Trader", "in_progress")
                self._emit_agent_status_changes()

        if chunk.get("trader_investment_plan"):
            content = chunk["trader_investment_plan"]
            self.buffer.update_report_section("trader_investment_plan", content)
            self.emit(
                "report.section",
                {"section": "trader_investment_plan", "content": content},
            )
            if self.buffer.agent_status.get("Trader") != "completed":
                self.buffer.update_agent_status("Trader", "completed")
                self.buffer.update_agent_status("Aggressive Analyst", "in_progress")
                self._emit_agent_status_changes()

        if chunk.get("risk_debate_state"):
            risk_state = chunk["risk_debate_state"]
            agg_hist = risk_state.get("aggressive_history", "").strip()
            con_hist = risk_state.get("conservative_history", "").strip()
            neu_hist = risk_state.get("neutral_history", "").strip()
            judge = risk_state.get("judge_decision", "").strip()

            if agg_hist:
                if self.buffer.agent_status.get("Aggressive Analyst") != "completed":
                    self.buffer.update_agent_status("Aggressive Analyst", "in_progress")
                content = f"### Aggressive Analyst Analysis\n{agg_hist}"
                self.buffer.update_report_section("final_trade_decision", content)
                self.emit("report.section", {"section": "final_trade_decision", "content": content})

            if con_hist:
                if self.buffer.agent_status.get("Conservative Analyst") != "completed":
                    self.buffer.update_agent_status("Conservative Analyst", "in_progress")
                content = f"### Conservative Analyst Analysis\n{con_hist}"
                self.buffer.update_report_section("final_trade_decision", content)
                self.emit("report.section", {"section": "final_trade_decision", "content": content})

            if neu_hist:
                if self.buffer.agent_status.get("Neutral Analyst") != "completed":
                    self.buffer.update_agent_status("Neutral Analyst", "in_progress")
                content = f"### Neutral Analyst Analysis\n{neu_hist}"
                self.buffer.update_report_section("final_trade_decision", content)
                self.emit("report.section", {"section": "final_trade_decision", "content": content})

            if judge:
                if self.buffer.agent_status.get("Portfolio Manager") != "completed":
                    self.buffer.update_agent_status("Portfolio Manager", "in_progress")
                    content = f"### Portfolio Manager Decision\n{judge}"
                    self.buffer.update_report_section("final_trade_decision", content)
                    self.emit("report.section", {"section": "final_trade_decision", "content": content})
                    self.buffer.update_agent_status("Aggressive Analyst", "completed")
                    self.buffer.update_agent_status("Conservative Analyst", "completed")
                    self.buffer.update_agent_status("Neutral Analyst", "completed")
                    self.buffer.update_agent_status("Portfolio Manager", "completed")
                self._emit_agent_status_changes()

    def emit_stats(self, stats: dict[str, int]) -> None:
        if stats != self._last_stats:
            self._last_stats = dict(stats)
            self.emit("stats", stats)

    def get_active_agent(self) -> str | None:
        for agent, status in self.buffer.agent_status.items():
            if status == "in_progress":
                return agent
        return None

    def mark_run_stopped(self, failed_agent: str | None = None) -> int:
        """Mark pending agents cancelled and in-progress as error. Returns stopped count."""
        stopped = 0
        for agent, status in list(self.buffer.agent_status.items()):
            if status == "pending":
                self.buffer.update_agent_status(agent, "cancelled")
                stopped += 1
            elif status == "in_progress":
                self.buffer.update_agent_status(agent, "error")
                if not failed_agent:
                    failed_agent = agent
        self._emit_agent_status_changes()
        return stopped

    def finalize_state(self, trace: list[dict[str, Any]]) -> dict[str, Any]:
        final_state: dict[str, Any] = {}
        for chunk in trace:
            final_state.update(chunk)

        for agent in self.buffer.agent_status:
            self.buffer.update_agent_status(agent, "completed")
        self._emit_agent_status_changes()

        for section in self.buffer.report_sections:
            if section in final_state:
                self.buffer.update_report_section(section, final_state[section])
                content = self.buffer.report_sections.get(section)
                if content:
                    self.emit("report.section", {"section": section, "content": content})

        return final_state


def format_sse(event_type: str, data: dict[str, Any]) -> str:
    import json

    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
