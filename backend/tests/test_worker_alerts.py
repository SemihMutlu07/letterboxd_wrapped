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
    worker_alerts._offline_alert_sent = False


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


# --- Recovery ping ---------------------------------------------------------


def test_no_recovery_when_no_offline_alert_sent(monkeypatch):
    _reset_alerts()
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: True)
    assert worker_alerts._recovery_message() is None


def test_no_recovery_while_still_offline(monkeypatch):
    _reset_alerts()
    worker_alerts._offline_alert_sent = True
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: False)
    assert worker_alerts._recovery_message() is None
    # Flag stays set — recovery must fire when the worker returns.
    assert worker_alerts._offline_alert_sent is True


def test_recovery_fires_once_when_back_online(monkeypatch):
    _reset_alerts()
    worker_alerts._offline_alert_sent = True
    monkeypatch.setattr(task_manager, "is_worker_online", lambda *a, **k: True)
    message = worker_alerts._recovery_message()
    assert message is not None
    assert "back online" in message
    # Exactly once: second call returns None.
    assert worker_alerts._recovery_message() is None


# --- Dead man's switch -----------------------------------------------------


@pytest.mark.asyncio
async def test_dead_mans_switch_pings_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "healthcheck_url", "https://hc-ping.com/abc")
    pings = []

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

        async def get(self, url):
            pings.append(url)
            return FakeResp()

    monkeypatch.setattr(worker_alerts.httpx, "AsyncClient", FakeClient)
    await worker_alerts._ping_dead_mans_switch()
    assert pings == ["https://hc-ping.com/abc"]


@pytest.mark.asyncio
async def test_dead_mans_switch_noop_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "healthcheck_url", "")
    called = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            called.append("constructed")
            raise AssertionError("should not construct a client when URL empty")

    monkeypatch.setattr(worker_alerts.httpx, "AsyncClient", FakeClient)
    await worker_alerts._ping_dead_mans_switch()
    assert called == []


@pytest.mark.asyncio
async def test_dead_mans_switch_failure_logged_not_raised(monkeypatch, caplog):
    monkeypatch.setattr(settings, "healthcheck_url", "https://hc-ping.com/abc")

    class BoomResp:
        def raise_for_status(self):
            raise RuntimeError("hc down")

    class BoomClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url):
            return BoomResp()

    monkeypatch.setattr(worker_alerts.httpx, "AsyncClient", BoomClient)
    # Must not raise.
    await worker_alerts._ping_dead_mans_switch()
