"""
apps/agents-service/run_manager.py

In-memory run registry and background execution for LangGraph analysis runs.
"""

from __future__ import annotations

import asyncio
import json
import os
import queue
import threading
import time
import uuid
from collections import deque
from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager, suppress
from dataclasses import dataclass, field
from typing import Any

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(usecwd=True))
load_dotenv(find_dotenv(".env.enterprise", usecwd=True), override=False)

from provider_credentials import (
    active_provider_api_key,
    credentials_to_env_updates,
)
from stream_processor import StreamProcessor, format_sse

from cli.stats_handler import StatsCallbackHandler
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.trade_check import build_trade_check

ANALYST_ORDER = ["market", "social", "news", "fundamentals"]

HEARTBEAT_INTERVAL_SECONDS = 4
MISSED_EVENTS_MAX_COUNT = 256
MISSED_EVENTS_MAX_BYTES = 1_048_576


@dataclass
class MissedEventBuffer:
    """Bounded replay buffer for SSE clients that connect after events start."""

    max_count: int = MISSED_EVENTS_MAX_COUNT
    max_bytes: int = MISSED_EVENTS_MAX_BYTES
    _events: deque[tuple[str, dict[str, Any]]] = field(default_factory=deque)
    _byte_size: int = 0

    @staticmethod
    def _event_byte_size(event_type: str, data: dict[str, Any]) -> int:
        return len(event_type) + len(json.dumps(data, separators=(",", ":")))

    def append(self, event_type: str, data: dict[str, Any]) -> None:
        event_size = self._event_byte_size(event_type, data)
        if event_size > self.max_bytes:
            return

        while self._events and (
            len(self._events) >= self.max_count
            or self._byte_size + event_size > self.max_bytes
        ):
            dropped_type, dropped_data = self._events.popleft()
            self._byte_size -= self._event_byte_size(dropped_type, dropped_data)

        self._events.append((event_type, data))
        self._byte_size += event_size

    def drain(self) -> list[tuple[str, dict[str, Any]]]:
        drained = list(self._events)
        self._events.clear()
        self._byte_size = 0
        return drained


def error_hint(message: str) -> str:
    """Return a user-facing hint based on the error message."""
    lower = message.lower()
    if any(token in lower for token in ("api key", "api_key", "authentication", "401", "403")):
        return "Verify your provider API key on the setup screen and try again."
    if any(token in lower for token in ("rate limit", "429", "too many requests")):
        return "Provider rate limit reached. Wait a minute before starting a new run."
    if any(token in lower for token in ("timeout", "timed out", "deadline")):
        return "The model took too long to respond. Try a faster model or shallower research depth."
    if any(token in lower for token in ("connection", "network", "unreachable")):
        return "Could not reach the LLM provider. Check your network and provider status."
    if "insufficient" in lower and "credit" in lower:
        return "Your provider account may be out of credits or quota."
    return "Remaining agents were stopped to save tokens. Fix the issue and start a new run."


@contextmanager
def temporary_env(updates: dict[str, str]) -> Iterator[None]:
    """Apply credential env vars for the duration of a single analysis run."""
    previous: dict[str, str | None] = {}
    try:
        for key, value in updates.items():
            previous[key] = os.environ.get(key)
            os.environ[key] = value
        yield
    finally:
        for key, old_value in previous.items():
            if old_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old_value


@dataclass
class RunRecord:
    run_id: str
    session_id: str
    status: str = "pending"
    subscribers: list[queue.Queue] = field(default_factory=list)
    missed_events: MissedEventBuffer = field(default_factory=MissedEventBuffer)
    final_state: dict[str, Any] | None = None
    decision: str | None = None
    trade_check: dict[str, Any] | None = None
    tool_events: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)


class RunManager:
    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}
        self._lock = threading.Lock()

    def create_run(self, session_id: str, payload: dict[str, Any]) -> str:
        run_id = str(uuid.uuid4())
        record = RunRecord(run_id=run_id, session_id=session_id)
        with self._lock:
            self._runs[run_id] = record

        thread = threading.Thread(
            target=self._execute_run,
            args=(run_id, payload),
            daemon=True,
        )
        thread.start()
        return run_id

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def cancel_run(self, run_id: str) -> bool:
        record = self.get_run(run_id)
        if not record:
            return False
        record.cancel_event.set()
        record.status = "cancelled"
        self._broadcast(
            record,
            "run.error",
            {
                "message": "Run cancelled",
                "hint": "You cancelled this analysis.",
                "stoppedAgents": 0,
            },
        )
        return True

    def _fail_run(
        self,
        record: RunRecord,
        processor: StreamProcessor | None,
        message: str,
        failed_agent: str | None = None,
    ) -> None:
        stopped = 0
        if processor:
            stopped = processor.mark_run_stopped(failed_agent)
            failed_agent = failed_agent or processor.get_active_agent()

        record.status = "error"
        record.error = message
        self._emit(
            record,
            "run.error",
            {
                "message": message,
                "failedAgent": failed_agent,
                "hint": error_hint(message),
                "stoppedAgents": stopped,
            },
        )

    def _start_heartbeat(
        self,
        record: RunRecord,
        heartbeat_state: dict[str, Any],
        started_at: float,
    ) -> threading.Thread:
        def loop() -> None:
            while heartbeat_state.get("running"):
                time.sleep(HEARTBEAT_INTERVAL_SECONDS)
                if not heartbeat_state.get("running"):
                    break
                stats = heartbeat_state.get("stats") or {}
                self._emit(
                    record,
                    "run.heartbeat",
                    {
                        "activeAgent": heartbeat_state.get("active_agent"),
                        "elapsedSeconds": round(time.time() - started_at, 1),
                        "llmCalls": stats.get("llm_calls", 0),
                        "toolCalls": stats.get("tool_calls", 0),
                    },
                )

        thread = threading.Thread(target=loop, daemon=True)
        thread.start()
        return thread

    def _broadcast(self, record: RunRecord, event_type: str, data: dict[str, Any]) -> None:
        frame = format_sse(event_type, data)
        if not record.subscribers:
            record.missed_events.append(event_type, data)
        for subscriber in record.subscribers:
            with suppress(queue.Full):
                subscriber.put_nowait(frame)

    def _emit(self, record: RunRecord, event_type: str, data: dict[str, Any]) -> None:
        self._broadcast(record, event_type, data)

    def _execute_run(self, run_id: str, payload: dict[str, Any]) -> None:
        record = self.get_run(run_id)
        if not record:
            return

        record.status = "running"
        self._emit(record, "run.started", {"runId": run_id, "sessionId": record.session_id})

        processor: StreamProcessor | None = None
        try:
            selected_set = set(payload["analysts"])
            selected_analyst_keys = [a for a in ANALYST_ORDER if a in selected_set]

            config = DEFAULT_CONFIG.copy()
            config["max_debate_rounds"] = payload["researchDepth"]
            config["max_risk_discuss_rounds"] = payload["researchDepth"]
            config["quick_think_llm"] = payload["quickThinkLlm"]
            config["deep_think_llm"] = payload["deepThinkLlm"]
            config["backend_url"] = payload.get("backendUrl")
            config["llm_provider"] = payload["llmProvider"].lower()
            config["google_thinking_level"] = payload.get("googleThinkingLevel")
            config["openai_reasoning_effort"] = payload.get("openaiReasoningEffort")
            config["anthropic_effort"] = payload.get("anthropicEffort")
            config["output_language"] = payload.get("outputLanguage", "English")
            config["checkpoint_enabled"] = payload.get("checkpointEnabled", False)

            provider_credentials = payload.get("providerCredentials") or {}
            config["provider_api_keys"] = provider_credentials

            env_updates = credentials_to_env_updates(provider_credentials)
            active_key = active_provider_api_key(
                payload["llmProvider"],
                provider_credentials,
            )
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
                    }.get(payload["llmProvider"].lower(), "OPENAI_API_KEY"),
                    active_key,
                )

            with temporary_env(env_updates):
                stats_handler = StatsCallbackHandler()
                graph = TradingAgentsGraph(
                    selected_analyst_keys,
                    config=config,
                    debug=True,
                    callbacks=[stats_handler],
                )

                def emit_event(event_type: str, data: dict[str, Any]) -> None:
                    if event_type == "tool.call":
                        record.tool_events.append(data)
                    self._emit(record, event_type, data)

                processor = StreamProcessor(
                    selected_analyst_keys,
                    emit=emit_event,
                )

                started_at = time.time()
                heartbeat_state: dict[str, Any] = {
                    "running": True,
                    "active_agent": None,
                    "stats": {},
                }
                heartbeat_thread = self._start_heartbeat(record, heartbeat_state, started_at)

                init_state = graph.propagator.create_initial_state(
                    payload["ticker"],
                    payload["analysisDate"],
                    user_context=payload.get("userContext") or "",
                )
                args = graph.propagator.get_graph_args(callbacks=[stats_handler])

                trace: list[dict[str, Any]] = []
                try:
                    for chunk in graph.graph.stream(init_state, **args):
                        if record.cancel_event.is_set():
                            heartbeat_state["running"] = False
                            self._fail_run(record, processor, "Run cancelled by user")
                            return

                        processor.process_chunk(chunk)
                        stats = stats_handler.get_stats()
                        processor.emit_stats(stats)
                        heartbeat_state["stats"] = stats
                        heartbeat_state["active_agent"] = processor.get_active_agent()
                        trace.append(chunk)

                    final_state = processor.finalize_state(trace)
                    decision = graph.process_signal(final_state.get("final_trade_decision", ""))
                finally:
                    heartbeat_state["running"] = False
                    heartbeat_thread.join(timeout=0.1)

            record.final_state = final_state
            record.decision = decision
            record.status = "completed"

            try:
                record.trade_check = build_trade_check(
                    config=config,
                    final_state=final_state,
                    tool_events=record.tool_events,
                    payload=payload,
                )
                self._emit(
                    record,
                    "trade.check",
                    {"tradeCheck": record.trade_check},
                )
            except Exception as exc:  # noqa: BLE001 - report still completes
                record.trade_check = None
                self._emit(
                    record,
                    "message",
                    {
                        "messageType": "System",
                        "content": f"Trade Check distillation skipped: {exc}",
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    },
                )

            self._emit(
                record,
                "run.completed",
                {
                    "sessionId": record.session_id,
                    "decision": decision,
                },
            )
        except Exception as exc:  # noqa: BLE001 - surface run errors to clients
            self._fail_run(record, processor, str(exc))

    async def subscribe(self, run_id: str) -> AsyncIterator[str]:
        record = self.get_run(run_id)
        if not record:
            raise KeyError(run_id)

        subscriber: queue.Queue[str] = queue.Queue(maxsize=256)
        record.subscribers.append(subscriber)
        terminal = {"completed", "error", "cancelled"}

        try:
            for event_type, data in record.missed_events.drain():
                yield format_sse(event_type, data)

            while True:
                try:
                    frame = await asyncio.to_thread(subscriber.get, True, 0.5)
                except queue.Empty:
                    if record.status in terminal and subscriber.empty():
                        break
                    continue

                yield frame
                if record.status in terminal and subscriber.empty():
                    break
        finally:
            if subscriber in record.subscribers:
                record.subscribers.remove(subscriber)

    def get_report(self, run_id: str) -> dict[str, Any]:
        record = self.get_run(run_id)
        if not record:
            raise KeyError(run_id)
        if record.status != "completed" or not record.final_state:
            raise RuntimeError("Report not ready")

        sections = {
            key: record.final_state.get(key)
            for key in [
                "market_report",
                "sentiment_report",
                "news_report",
                "fundamentals_report",
                "investment_plan",
                "trader_investment_plan",
                "final_trade_decision",
            ]
        }

        markdown_parts: list[str] = []
        if any(sections.get(k) for k in ["market_report", "sentiment_report", "news_report", "fundamentals_report"]):
            markdown_parts.append("## Analyst Team Reports")
        for section, title in [
            ("market_report", "Market Analysis"),
            ("sentiment_report", "Social Sentiment"),
            ("news_report", "News Analysis"),
            ("fundamentals_report", "Fundamentals Analysis"),
        ]:
            if sections.get(section):
                markdown_parts.append(f"### {title}\n{sections[section]}")

        if sections.get("investment_plan"):
            markdown_parts.extend(["## Research Team Decision", str(sections["investment_plan"])])
        if sections.get("trader_investment_plan"):
            markdown_parts.extend(["## Trading Team Plan", str(sections["trader_investment_plan"])])
        if sections.get("final_trade_decision"):
            markdown_parts.extend(
                ["## Portfolio Management Decision", str(sections["final_trade_decision"])]
            )

        return {
            "markdown": "\n\n".join(markdown_parts),
            "sections": sections,
            "decision": record.decision,
            "tradeCheck": record.trade_check,
        }


run_manager = RunManager()
