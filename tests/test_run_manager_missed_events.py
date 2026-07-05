"""Tests for bounded missed-event buffering in agents-service run manager."""

import sys
from pathlib import Path

AGENTS_SERVICE_DIR = Path(__file__).resolve().parents[1] / "apps" / "agents-service"
if str(AGENTS_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_SERVICE_DIR))

from run_manager import (  # noqa: E402
    MISSED_EVENTS_MAX_BYTES,
    MISSED_EVENTS_MAX_COUNT,
    MissedEventBuffer,
    RunManager,
    RunRecord,
)


def _buffer_byte_size(buffer: MissedEventBuffer) -> int:
    return sum(
        MissedEventBuffer._event_byte_size(event_type, data)
        for event_type, data in buffer._events
    )


def test_missed_event_buffer_respects_max_count():
    buffer = MissedEventBuffer(max_count=3, max_bytes=1_048_576)

    for index in range(5):
        buffer.append("run.heartbeat", {"index": index})

    drained = buffer.drain()
    assert [payload["index"] for _, payload in drained] == [2, 3, 4]


def test_missed_event_buffer_respects_max_bytes():
    buffer = MissedEventBuffer(max_count=256, max_bytes=50)

    buffer.append("run.heartbeat", {"index": 1})
    buffer.append("run.heartbeat", {"index": 2})
    buffer.append("run.heartbeat", {"index": 3})

    assert len(buffer._events) == 2
    assert _buffer_byte_size(buffer) <= 50
    assert [payload["index"] for _, payload in buffer._events] == [2, 3]


def test_missed_event_buffer_skips_oversized_event():
    buffer = MissedEventBuffer(max_count=256, max_bytes=50)

    buffer.append("agent.message", {"content": "x" * 100})

    assert buffer.drain() == []


def test_broadcast_without_subscribers_is_bounded_by_count():
    manager = RunManager()
    record = RunRecord(run_id="run-1", session_id="session-1")

    for index in range(MISSED_EVENTS_MAX_COUNT + 25):
        manager._broadcast(record, "run.heartbeat", {"index": index})

    assert len(record.missed_events._events) == MISSED_EVENTS_MAX_COUNT
    assert record.missed_events._events[0][1]["index"] == 25


def test_broadcast_without_subscribers_is_bounded_by_bytes():
    manager = RunManager()
    record = RunRecord(run_id="run-2", session_id="session-2")
    chunk = "x" * (MISSED_EVENTS_MAX_BYTES // 3)

    for index in range(5):
        manager._broadcast(record, "agent.message", {"index": index, "content": chunk})

    assert _buffer_byte_size(record.missed_events) <= MISSED_EVENTS_MAX_BYTES
    assert len(record.missed_events._events) < 5


def test_subscribe_drains_missed_events_once():
    manager = RunManager()
    record = RunRecord(run_id="run-3", session_id="session-3")
    manager._broadcast(record, "run.started", {"runId": "run-3"})

    drained = record.missed_events.drain()

    assert len(drained) == 1
    assert drained[0][0] == "run.started"
    assert record.missed_events.drain() == []
