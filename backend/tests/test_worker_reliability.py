from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app import task_manager
from app.services.watchlist_jobs import finalize_watchlist_job


@pytest.fixture(autouse=True)
def _clear_tasks():
    task_manager._tasks.clear()
    yield
    task_manager._tasks.clear()


@pytest.fixture
async def client(monkeypatch):
    from app.config import settings
    from app.main import create_app

    monkeypatch.setattr(settings, "worker_token", "test-worker-token-rotated")
    app = create_app()
    app.state.aiohttp_session = object()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def test_unified_claimer_uses_oldest_job_across_kinds():
    scrape_id = task_manager.create_scrape_job("alice")
    watchlist_id = task_manager.create_watchlist_compare_job(["alice", "bob"])
    task_manager._tasks[watchlist_id].created_at -= timedelta(seconds=10)
    claimed = task_manager.claim_next_worker_job()
    assert claimed.task_id == watchlist_id
    assert claimed.kind == "watchlist"
    assert task_manager._tasks[scrape_id].status == "pending"


def test_expired_worker_job_becomes_terminal_failure():
    task_id = task_manager.create_date_night_job(["alice", "bob"])
    task = task_manager._tasks[task_id]
    task.created_at = datetime.now(timezone.utc) - timedelta(seconds=task_manager.ACTIVE_JOB_TIMEOUT_SECONDS + 1)
    assert task_manager.fail_worker_job_if_expired(task) is True
    assert task.status == "failed"
    assert task.error_code == "worker_timeout"


def test_cleanup_never_removes_old_active_job_before_terminalizing():
    task_id = task_manager.create_watchlist_compare_job(["alice", "bob"])
    task = task_manager._tasks[task_id]
    task.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
    task_manager.fail_expired_worker_jobs()
    assert task_manager.get_task_state(task_id) is task
    assert task.status == "failed"


@pytest.mark.asyncio
async def test_finalizer_preserves_newer_terminal_state():
    task_id = task_manager.create_watchlist_compare_job(["alice", "bob"])
    task = task_manager._tasks[task_id]
    task.status = "running"
    task.stage = "processing"
    task.result = {"first_watchlist": [], "second_watchlist": []}

    async def enrich_and_fail_task(session, films, limit=50):
        task_manager.set_task_failed(task_id, "expired", {"error_code": "worker_timeout"})
        return []

    with patch("app.services.watchlist_jobs.enrich_films_concurrent", side_effect=enrich_and_fail_task):
        await finalize_watchlist_job(task_id, object())
    assert task.status == "failed"
    assert task.error_code == "worker_timeout"


@pytest.mark.asyncio
async def test_raw_only_completion_stays_available_to_waiting_consumer(client):
    task_id = task_manager.create_watchlist_compare_job(["alice", "bob"], options={"raw_only": True})
    response = await client.post(
        f"/api/worker/watchlist/{task_id}/complete",
        headers={"X-Worker-Token": "test-worker-token-rotated"},
        json={"first_watchlist": [{"title": "Heat"}], "second_watchlist": []},
    )
    assert response.status_code == 200
    task = task_manager.get_task_state(task_id)
    assert task.status == "done"
    assert task.result["first_watchlist"][0]["title"] == "Heat"
