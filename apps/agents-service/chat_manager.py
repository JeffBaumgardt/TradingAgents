"""
apps/agents-service/chat_manager.py

In-memory Portfolio Manager follow-up chat turns. Grounded in persisted
research — does not re-run the full multi-agent pipeline.
"""

from __future__ import annotations

import json
import re
import threading
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from cli.stats_handler import StatsCallbackHandler
from provider_credentials import (
    active_provider_api_key,
    credentials_to_env_updates,
    resolve_provider_backend_url,
)
from run_manager import error_hint, temporary_env
from stream_processor import format_sse
from tradingagents.agents.utils.agent_utils import (
    get_balance_sheet,
    get_cashflow,
    get_fundamentals,
    get_global_news,
    get_income_statement,
    get_indicators,
    get_insider_transactions,
    get_macro_indicators,
    get_news,
    get_prediction_markets,
    get_stock_data,
    get_verified_market_snapshot,
)
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.llm_clients import create_llm_client

CHAT_TOOLS = [
    get_stock_data,
    get_indicators,
    get_verified_market_snapshot,
    get_news,
    get_global_news,
    get_insider_transactions,
    get_macro_indicators,
    get_prediction_markets,
    get_fundamentals,
    get_balance_sheet,
    get_cashflow,
    get_income_statement,
]

MAX_CONTEXT_CHARS = 120_000
MAX_PRIOR_CHAT_CHARS = 24_000
HEARTBEAT_INTERVAL_SECONDS = 4


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                if block.get("type") == "text" and isinstance(block.get("text"), str):
                    parts.append(block["text"])
                elif isinstance(block.get("thinking"), str):
                    parts.append(block["thinking"])
                elif isinstance(block.get("text"), str):
                    parts.append(block["text"])
        return "\n".join(parts)
    return str(content)


def extract_decision_excerpt(markdown: str) -> str | None:
    """Best-effort extract of a revised decision label from PM reply."""
    patterns = [
        r"(?i)\*\*revised\s+decision\*\*[:\s]+([^\n*]+)",
        r"(?i)\*\*decision\*\*[:\s]+([^\n*]+)",
        r"(?i)^decision[:\s]+([^\n]+)",
        r"(?i)\b(buy|sell|hold|overweight|underweight|neutral)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, markdown, re.MULTILINE)
        if match:
            value = (match.group(1) if match.lastindex else match.group(0)).strip()
            if value:
                return value[:120]
    return None


def build_system_prompt(payload: dict[str, Any]) -> str:
    ticker = payload.get("ticker") or "UNKNOWN"
    analysis_date = payload.get("analysisDate") or ""
    user_context = (payload.get("userContext") or "").strip()
    decision = (payload.get("decision") or "").strip()
    sections = payload.get("reportSections") or {}
    trade_check = payload.get("tradeCheck") or {}
    prior = payload.get("priorMessages") or []

    section_order = [
        ("market_report", "Market Analysis"),
        ("sentiment_report", "Social Sentiment"),
        ("news_report", "News Analysis"),
        ("fundamentals_report", "Fundamentals Analysis"),
        ("investment_plan", "Research Team Decision"),
        ("trader_investment_plan", "Trading Team Plan"),
        ("final_trade_decision", "Portfolio Management Decision"),
    ]

    research_chunks: list[str] = []
    budget = MAX_CONTEXT_CHARS
    for key, title in section_order:
        content = sections.get(key)
        if not isinstance(content, str) or not content.strip():
            continue
        block = f"### {title}\n{_truncate(content.strip(), min(18_000, budget))}"
        research_chunks.append(block)
        budget -= len(block)
        if budget < 2_000:
            break

    prior_chunks: list[str] = []
    prior_budget = MAX_PRIOR_CHAT_CHARS
    for msg in prior[-20:]:
        role = msg.get("role") or "user"
        text = (msg.get("content") or "").strip()
        if not text:
            continue
        block = f"{role.upper()}: {_truncate(text, min(4_000, prior_budget))}"
        prior_chunks.append(block)
        prior_budget -= len(block)
        if prior_budget < 200:
            break

    trade_check_summary = ""
    if isinstance(trade_check, dict) and trade_check:
        header = trade_check.get("header") or {}
        trade_check_summary = json.dumps(
            {
                "header": header,
                "priceSummary": trade_check.get("priceSummary"),
                "verdict": trade_check.get("verdict"),
            },
            default=str,
        )[:4_000]

    return f"""You are the Portfolio Manager for TradingAgents follow-up chat.

You already completed a full multi-agent analysis for {ticker} (report date {analysis_date}).
Do NOT re-run the full analyst / bull-bear / risk pipeline. Adjudicate using the research below.
When the user brings new details (horizon, options DTE, size, thesis updates), revise your take.
If research is stale for a time-sensitive question, use tools for fresher data and say what changed.
Prefer markdown. Do not emit raw HTML unless the user asks. If you produce a chart image description, use markdown image syntax only when you have a real URL.

Original user thesis / context:
{user_context or "(none)"}

Original decision signal: {decision or "(none)"}

Trade Check snapshot (chart is frozen — do not claim it updated):
{trade_check_summary or "(none)"}

--- Research dossier ---
{chr(10).join(research_chunks) or "(no sections stored)"}

--- Prior follow-up chat ---
{chr(10).join(prior_chunks) or "(none yet)"}

When you change your recommendation, include a clear line:
**Revised decision:** <Buy|Sell|Hold|Overweight|Underweight|Neutral> — short rationale
"""


@dataclass
class ChatTurnRecord:
    turn_id: str
    session_id: str
    assistant_message_id: str
    status: str = "pending"
    subscribers: list = field(default_factory=list)
    event_history: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    error: str | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    final_markdown: str = ""
    decision_excerpt: str | None = None
    parts: list[dict[str, Any]] = field(default_factory=list)


class ChatManager:
    def __init__(self) -> None:
        self._turns: dict[str, ChatTurnRecord] = {}
        self._lock = threading.Lock()

    def create_turn(self, payload: dict[str, Any]) -> str:
        turn_id = str(uuid.uuid4())
        record = ChatTurnRecord(
            turn_id=turn_id,
            session_id=payload["sessionId"],
            assistant_message_id=payload["assistantMessageId"],
        )
        with self._lock:
            self._turns[turn_id] = record

        thread = threading.Thread(
            target=self._execute_turn,
            args=(turn_id, payload),
            daemon=True,
        )
        thread.start()
        return turn_id

    def get_turn(self, turn_id: str) -> ChatTurnRecord | None:
        with self._lock:
            return self._turns.get(turn_id)

    def cancel_turn(self, turn_id: str, reason: dict[str, Any] | None = None) -> bool:
        record = self.get_turn(turn_id)
        if not record:
            return False
        record.cancel_event.set()
        if record.status in {"pending", "running", "streaming"}:
            message = (reason or {}).get("message") or "Chat turn cancelled"
            hint = (reason or {}).get("hint")
            self._fail_turn(record, message, hint)
        return True

    def _broadcast(self, record: ChatTurnRecord, event_type: str, data: dict[str, Any]) -> None:
        import queue

        frame = format_sse(event_type, data)
        with self._lock:
            record.event_history.append((event_type, data))
            subscribers = list(record.subscribers)
        terminal = event_type in {"chat.completed", "chat.error"}
        for subscriber in subscribers:
            try:
                subscriber.put_nowait(frame)
            except queue.Full:
                if not terminal:
                    # Drop non-terminal frames under backpressure; keep history
                    # so late subscribers can still catch up via event_history.
                    continue
                # Never drop terminal events — block briefly so metering/UI finalize.
                with suppress(Exception):
                    subscriber.put(frame, timeout=5.0)

    def _emit(self, record: ChatTurnRecord, event_type: str, data: dict[str, Any]) -> None:
        self._broadcast(record, event_type, data)

    def _fail_turn(
        self,
        record: ChatTurnRecord,
        message: str,
        hint: str | None = None,
    ) -> None:
        record.status = "error"
        record.error = message
        payload = {
            "turnId": record.turn_id,
            "sessionId": record.session_id,
            "assistantMessageId": record.assistant_message_id,
            "message": message,
            **({"hint": hint} if hint else {"hint": error_hint(message)}),
        }
        self._emit(record, "chat.error", payload)

    def _start_heartbeat(
        self,
        record: ChatTurnRecord,
        heartbeat_state: dict[str, Any],
        started_at: float,
    ) -> threading.Thread:
        def _loop() -> None:
            while heartbeat_state.get("running"):
                time.sleep(HEARTBEAT_INTERVAL_SECONDS)
                if not heartbeat_state.get("running") or record.cancel_event.is_set():
                    break
                stats = heartbeat_state.get("stats") or {}
                self._emit(
                    record,
                    "run.heartbeat",
                    {
                        "activeAgent": "Portfolio Manager",
                        "elapsedSeconds": round(time.time() - started_at, 1),
                        "llmCalls": stats.get("llm_calls", 0),
                        "toolCalls": stats.get("tool_calls", 0),
                    },
                )

        thread = threading.Thread(target=_loop, daemon=True)
        thread.start()
        return thread

    def _execute_turn(self, turn_id: str, payload: dict[str, Any]) -> None:
        record = self.get_turn(turn_id)
        if not record:
            return

        record.status = "streaming"
        self._emit(
            record,
            "chat.started",
            {
                "turnId": turn_id,
                "sessionId": record.session_id,
                "assistantMessageId": record.assistant_message_id,
            },
        )
        self._emit(
            record,
            "agent.status",
            {"agent": "Portfolio Manager", "status": "in_progress"},
        )

        heartbeat_state: dict[str, Any] = {"running": True, "stats": {}}
        started_at = time.time()
        heartbeat_thread = self._start_heartbeat(record, heartbeat_state, started_at)

        try:
            provider = str(payload["llmProvider"]).lower()
            think_llm = (
                payload.get("thinkLlm")
                or payload.get("deepThinkLlm")
                or payload.get("quickThinkLlm")
            )
            backend_url = resolve_provider_backend_url(
                provider,
                payload.get("backendUrl"),
            )
            provider_credentials = payload.get("providerCredentials") or {}

            env_updates = credentials_to_env_updates(provider_credentials)
            active_key = active_provider_api_key(provider, provider_credentials)
            if active_key:
                env_updates.setdefault(
                    {
                        "openai": "OPENAI_API_KEY",
                        "google": "GOOGLE_API_KEY",
                        "anthropic": "ANTHROPIC_API_KEY",
                        "xai": "XAI_API_KEY",
                        "deepseek": "DEEPSEEK_API_KEY",
                        "qwen": "DASHSCOPE_API_KEY",
                        "glm": "ZHIPU_API_KEY",
                        "openrouter": "OPENROUTER_API_KEY",
                        "azure": "AZURE_OPENAI_API_KEY",
                    }.get(provider, "OPENAI_API_KEY"),
                    active_key,
                )

            llm_kwargs: dict[str, Any] = {}
            if active_key:
                llm_kwargs["api_key"] = active_key
            if payload.get("googleThinkingLevel"):
                llm_kwargs["thinking_level"] = payload["googleThinkingLevel"]
            if payload.get("openaiReasoningEffort"):
                llm_kwargs["reasoning_effort"] = payload["openaiReasoningEffort"]
            if payload.get("anthropicEffort"):
                llm_kwargs["effort"] = payload["anthropicEffort"]

            with temporary_env(env_updates):
                stats_handler = StatsCallbackHandler()
                llm_kwargs["callbacks"] = [stats_handler]
                llm = create_llm_client(
                    provider=provider,
                    model=think_llm,
                    base_url=backend_url,
                    **llm_kwargs,
                ).get_llm()

                agent = create_react_agent(llm, CHAT_TOOLS)
                system = build_system_prompt(payload)
                user_message = (payload.get("userMessage") or "").strip()
                if not user_message:
                    raise ValueError("userMessage is required")

                inputs = {
                    "messages": [
                        SystemMessage(content=system),
                        HumanMessage(content=user_message),
                    ]
                }

                final_text_parts: list[str] = []
                seen_tool_ids: set[str] = set()

                for chunk in agent.stream(
                    inputs,
                    config={
                        "recursion_limit": DEFAULT_CONFIG.get("max_recur_limit", 100),
                        "callbacks": [stats_handler],
                    },
                    stream_mode="updates",
                ):
                    if record.cancel_event.is_set():
                        raise RuntimeError("Chat turn cancelled")

                    stats = stats_handler.get_stats()
                    heartbeat_state["stats"] = stats
                    self._emit(
                        record,
                        "stats",
                        {
                            "llm_calls": stats.get("llm_calls", 0),
                            "tool_calls": stats.get("tool_calls", 0),
                            "tokens_in": stats.get("tokens_in", 0),
                            "tokens_out": stats.get("tokens_out", 0),
                        },
                    )

                    if not isinstance(chunk, dict):
                        continue

                    for _node_name, update in chunk.items():
                        if not isinstance(update, dict):
                            continue
                        messages = update.get("messages") or []
                        for msg in messages:
                            if isinstance(msg, AIMessage):
                                text = _content_to_text(msg.content).strip()
                                tool_calls = getattr(msg, "tool_calls", None) or []
                                if tool_calls:
                                    if text:
                                        thinking_part = {
                                            "type": "thinking",
                                            "content": text,
                                        }
                                        record.parts.append(thinking_part)
                                        self._emit(
                                            record,
                                            "thinking",
                                            {
                                                "content": text,
                                                "timestamp": time.strftime("%H:%M:%S"),
                                            },
                                        )
                                    for call in tool_calls:
                                        call_id = str(call.get("id") or uuid.uuid4())
                                        if call_id in seen_tool_ids:
                                            continue
                                        seen_tool_ids.add(call_id)
                                        name = str(call.get("name") or "tool")
                                        args = call.get("args") or {}
                                        if not isinstance(args, dict):
                                            args = {"value": args}
                                        part = {
                                            "type": "tool_call",
                                            "toolName": name,
                                            "args": args,
                                        }
                                        record.parts.append(part)
                                        self._emit(
                                            record,
                                            "tool.call",
                                            {
                                                "toolName": name,
                                                "args": args,
                                                "timestamp": time.strftime("%H:%M:%S"),
                                            },
                                        )
                                elif text:
                                    final_text_parts.append(text)
                                    self._emit(
                                        record,
                                        "message",
                                        {
                                            "messageType": "Agent",
                                            "content": text,
                                            "timestamp": time.strftime("%H:%M:%S"),
                                        },
                                    )
                            elif isinstance(msg, ToolMessage):
                                result_text = _truncate(_content_to_text(msg.content), 8_000)
                                part = {
                                    "type": "tool_result",
                                    "toolName": getattr(msg, "name", None) or "tool",
                                    "content": result_text,
                                }
                                record.parts.append(part)
                                self._emit(
                                    record,
                                    "thinking",
                                    {
                                        "content": f"Tool result ({part['toolName']}): {_truncate(result_text, 400)}",
                                        "timestamp": time.strftime("%H:%M:%S"),
                                    },
                                )

                markdown = "\n\n".join(final_text_parts).strip()
                if not markdown and record.parts:
                    # Fall back to last AI text stored as thinking if model only used tools.
                    for part in reversed(record.parts):
                        if part.get("type") == "thinking" and part.get("content"):
                            markdown = str(part["content"])
                            break

                if markdown:
                    record.parts.append({"type": "text", "content": markdown})

                # Detect markdown images for rich rendering.
                for match in re.finditer(
                    r"!\[([^\]]*)\]\((data:image\/[a-zA-Z+]+;base64,[^)]+|https?:\/\/[^)]+)\)",
                    markdown,
                ):
                    record.parts.append(
                        {
                            "type": "image",
                            "alt": match.group(1) or "chart",
                            "src": match.group(2),
                        }
                    )

                record.final_markdown = markdown
                record.decision_excerpt = extract_decision_excerpt(markdown)
                record.status = "completed"

                stats = stats_handler.get_stats()
                self._emit(
                    record,
                    "stats",
                    {
                        "llm_calls": stats.get("llm_calls", 0),
                        "tool_calls": stats.get("tool_calls", 0),
                        "tokens_in": stats.get("tokens_in", 0),
                        "tokens_out": stats.get("tokens_out", 0),
                    },
                )
                self._emit(
                    record,
                    "agent.status",
                    {"agent": "Portfolio Manager", "status": "completed"},
                )
                self._emit(
                    record,
                    "chat.completed",
                    {
                        "turnId": turn_id,
                        "sessionId": record.session_id,
                        "assistantMessageId": record.assistant_message_id,
                        "decisionExcerpt": record.decision_excerpt,
                        "contentMarkdown": record.final_markdown,
                        "parts": record.parts,
                        "tokensIn": stats.get("tokens_in", 0),
                        "tokensOut": stats.get("tokens_out", 0),
                    },
                )
        except Exception as exc:  # noqa: BLE001
            message = str(exc) or "Chat turn failed"
            self._fail_turn(record, message)
        finally:
            heartbeat_state["running"] = False
            with suppress(Exception):
                if heartbeat_thread.is_alive():
                    heartbeat_thread.join(timeout=0.1)

    async def subscribe(self, turn_id: str) -> AsyncIterator[str]:
        import asyncio
        import queue

        record = self.get_turn(turn_id)
        if not record:
            yield format_sse(
                "chat.error",
                {"message": "Turn not found", "turnId": turn_id, "sessionId": ""},
            )
            return

        subscriber: queue.Queue = queue.Queue(maxsize=256)
        with self._lock:
            history = list(record.event_history)
            record.subscribers.append(subscriber)
        terminal = {"completed", "error", "cancelled"}

        try:
            for event_type, data in history:
                yield format_sse(event_type, data)
                if event_type in {"chat.completed", "chat.error"}:
                    return

            while True:
                try:
                    frame = await asyncio.to_thread(subscriber.get, True, 0.5)
                except queue.Empty:
                    if record.status in terminal and subscriber.empty():
                        # Backstop: if the live queue dropped the terminal frame,
                        # re-yield it from history so metering/UI can finalize.
                        with self._lock:
                            hist = list(record.event_history)
                        for event_type, data in reversed(hist):
                            if event_type in {"chat.completed", "chat.error"}:
                                yield format_sse(event_type, data)
                                return
                        break
                    continue

                yield frame
                if "event: chat.completed" in frame or "event: chat.error" in frame:
                    break
        finally:
            with self._lock:
                if subscriber in record.subscribers:
                    record.subscribers.remove(subscriber)


chat_manager = ChatManager()

