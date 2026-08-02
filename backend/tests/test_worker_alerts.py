"""Worker health alerting tests (worker_alerts service).

Conditions and cooldown logic are pure functions — tests exercise them
directly with monkeypatched task_manager state and a fake HTTP layer.
"""
import time

import pytest
from unittest.mock import patch

from app import task_manager
from app.config import settings
from app.services import worker_alerts


def _reset_alerts():
    worker_alerts._last_alert_at.clear()


def test_no_condition_fires_when_worker_online_and_queue_empty(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: True)
    monkeypatch.setattr(
        task_manager,
        "get_worker_queue_stats",
        lambda: {"queue_depth": 0, "oldest_queued_age_seconds": 0},
    )
    assert worker_alerts._condition_messages() == []


def test_offline_worker_fires_condition(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: False)
    monkeypatch.setattr(
        task_manager,
        "get_worker_queue_stats",
        lambda: {"queue_depth": 0, "oldest_queued_age_seconds": 0},
    )
    conditions = worker_alerts._condition_messages()
    assert [c for c, _ in conditions] == [worker_alerts.CONDITION_NO_WORKER]


def test_deep_queue_fires_depth_condition(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: True)
    monkeypatch.setattr(
        task_manager,
        "get_worker_queue_stats",
        lambda: {"queue_depth": 25, "oldest_queued_age_seconds": 0},
    )
    conditions = worker_alerts._condition_messages()
    assert worker_alerts.CONDITION_QUEUE_DEPTH in [c for c, _ in conditions]
    message = dict(conditions)[worker_alerts.CONDITION_QUEUE_DEPTH]
    assert "25" in message


def test_stale_oldest_job_fires_stale_condition(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: True)
    monkeypatch.setattr(
        task_manager,
        "get_worker_queue_stats",
        lambda: {"queue_depth": 1, "oldest_queued_age_seconds": 1200},
    )
    conditions = worker_alerts._condition_messages()
    assert worker_alerts.CONDITION_QUEUE_STALE in [c for c, _ in conditions]


def test_cooldown_blocks_repeat_alert_same_condition(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: False)
    monkeypatch.setattr(
        task_manager,
        "get_worker_queue_stats",
        lambda: {"queue_depth": 0, "oldest_queued_age_seconds": 0},
    )
    # First check: fires.
    assert worker_alerts._condition_messages() != []
    worker_alerts._mark_sent(worker_alerts.CONDITION_NO_WORKER)
    # Second check within cooldown: suppressed.
    assert worker_alerts._cooldown_ok(worker_alerts.CONDITION_NO_WORKER) is False
    # After cooldown elapses: allowed again.
    worker_alerts._last_alert_at[worker_alerts.CONDITION_NO_WORKER] = time.monotonic() - settings.ntfy_cooldown_seconds - 1
    assert worker_alerts._cooldown_ok(worker_alerts.CONDITION_NO_WORKER) is True


@pytest.mark.asyncio
async def test_send_alert_posts_to_ntfy_topic(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(settings, "ntfy_topic", "test-topic")
    posted = []

    class FakeResp:
        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, content, headers):
            posted.append((url, content, headers))
            return FakeResp()

    monkeypatch.setattr(worker_alerts.httpx, "AsyncClient", FakeClient)
    assert await worker_alerts.send_alert("test message") is True
    assert posted and posted[0][0] == "https://ntfy.sh/test-topic"
    assert posted[0][1] == "test message"


@pytest.mark.asyncio
async def test_send_alert_swallows_http_failure(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(settings, "ntfy_topic", "test-topic")

    class BoomResp:
        def raise_for_status(self):
            raise RuntimeError("ntfy down")

    class BoomClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, content, headers):
            return BoomResp()

    monkeypatch.setattr(worker_alerts.httpx, "AsyncClient", BoomClient)
    # Must return False, never raise — the monitor loop must survive.
    assert await worker_alerts.send_alert("boom") is False
