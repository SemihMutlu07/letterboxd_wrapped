"""
Task-queue persistence — backend/app/task_manager.py <-> ops_tasks.

Verifies the write-through hooks that let pending/running desktop-worker
jobs (scrape/watchlist) survive a backend restart, and that CSV-upload
("analyze") tasks are deliberately excluded (see task_manager.PERSISTED_KINDS).

Run from backend/ directory:
    pytest tests/test_task_persistence.py
"""
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

from app import task_manager
from app.config import settings


def _mock_post_client():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


def _mock_get_client(rows):
    mock_response = MagicMock()
    mock_response.json.return_value = rows
    mock_response.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.fixture(autouse=True)
def _clear_tasks():
    task_manager._tasks.clear()
    yield
    task_manager._tasks.clear()


@pytest.fixture
def _supabase_enabled():
    with patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"), \
         patch.object(settings, "supabase_ops_email", "ops@movieswrapped.internal"), \
         patch.object(settings, "supabase_ops_password", "test-password"):
        yield


@pytest.mark.asyncio
async def test_create_scrape_job_upserts_to_ops_tasks(_supabase_enabled):
    mock_client = _mock_post_client()
    with patch("httpx.AsyncClient", return_value=mock_client):
        task_manager.create_scrape_job("semihmutsuz")
        await asyncio.sleep(0)  # let the fire_and_forget background task run

    mock_client.post.assert_called_once()
    args, kwargs = mock_client.post.call_args
    assert args[0] == "https://mock.supabase.co/rest/v1/ops_tasks"
    assert kwargs["params"] == {"on_conflict": "task_id"}
    body = kwargs["json"]
    assert body["kind"] == "scrape"
    assert body["username"] == "semihmutsuz"
    assert body["status"] == "pending"
    assert body["poll_token"]  # must round-trip exactly on reload


@pytest.mark.asyncio
async def test_create_watchlist_job_upserts_to_ops_tasks(_supabase_enabled):
    mock_client = _mock_post_client()
    with patch("httpx.AsyncClient", return_value=mock_client):
        task_manager.create_watchlist_compare_job(["a", "b"], options={"raw_only": True})
        await asyncio.sleep(0)

    mock_client.post.assert_called_once()
    _, kwargs = mock_client.post.call_args
    body = kwargs["json"]
    assert body["kind"] == "watchlist"
    assert body["job_type"] == "watchlist_compare"
    assert body["usernames"] == ["a", "b"]
    assert body["options"] == {"raw_only": True}


@pytest.mark.asyncio
async def test_create_task_state_does_not_write_to_supabase(_supabase_enabled):
    """kind='analyze' (CSV upload) tasks read local disk files a restart also
    wipes, so there's nothing to resume — they must never hit ops_tasks."""
    mock_client = _mock_post_client()
    with patch("httpx.AsyncClient", return_value=mock_client) as mock_cls:
        task_manager.create_task_state()

    mock_cls.assert_not_called()


@pytest.mark.asyncio
async def test_claim_next_scrape_job_persists_running_state(_supabase_enabled):
    mock_client = _mock_post_client()
    with patch("httpx.AsyncClient", return_value=mock_client):
        task_manager.create_scrape_job("semihmutsuz")
        await asyncio.sleep(0)
        mock_client.post.reset_mock()
        task_manager.claim_next_scrape_job()
        await asyncio.sleep(0)

    mock_client.post.assert_called_once()
    _, kwargs = mock_client.post.call_args
    assert kwargs["json"]["status"] == "running"
    assert kwargs["json"]["claimed"] is True


@pytest.mark.asyncio
async def test_set_task_done_and_failed_upsert_terminal_row(_supabase_enabled):
    mock_client = _mock_post_client()
    with patch("httpx.AsyncClient", return_value=mock_client):
        task_id = task_manager.create_scrape_job("semihmutsuz")
        await asyncio.sleep(0)
        mock_client.post.reset_mock()
        task_manager.set_task_done(task_id, {"status": "success"})
        await asyncio.sleep(0)

        _, kwargs = mock_client.post.call_args
        assert kwargs["json"]["status"] == "done"

        task_id2 = task_manager.create_watchlist_compare_job(["a"])
        await asyncio.sleep(0)
        mock_client.post.reset_mock()
        task_manager.set_task_failed(task_id2, "scrape failed")
        await asyncio.sleep(0)

        _, kwargs = mock_client.post.call_args
        assert kwargs["json"]["status"] == "failed"
        assert kwargs["json"]["error"] == "scrape failed"


@pytest.mark.asyncio
async def test_update_task_progress_does_not_write_to_supabase(_supabase_enabled):
    """Progress ticks fire many times per job; only transitions (create/claim/
    terminal/requeue) need to survive a restart, not every intermediate tick."""
    mock_client = _mock_post_client()
    with patch("httpx.AsyncClient", return_value=mock_client) as mock_cls:
        task_id = task_manager.create_scrape_job("semihmutsuz")
        await asyncio.sleep(0)  # let the creation's own persist task finish first
        mock_cls.reset_mock()
        task_manager.update_task_progress(task_id, "scraping", "halfway", 50, 100)
        await asyncio.sleep(0)

    mock_cls.assert_not_called()


@pytest.mark.asyncio
async def test_load_pending_tasks_repopulates_tasks_dict(_supabase_enabled):
    row = {
        "task_id": "restored-1",
        "kind": "watchlist",
        "job_type": "date_night",
        "status": "pending",
        "stage": "queued",
        "message": "Queued on desktop scraper",
        "progress": 0,
        "total": 0,
        "username": None,
        "avatar_only": False,
        "usernames": ["a", "b"],
        "options": {},
        "claimed": False,
        "owner_key": "owner-1",
        "poll_token": "exact-original-token",
        "result": None,
        "created_at": "2026-07-20T12:00:00+00:00",
        "claimed_at": None,
    }
    mock_client = _mock_get_client([row])
    with patch("httpx.AsyncClient", return_value=mock_client):
        loaded = await task_manager.load_pending_tasks()

    assert loaded == 1
    task = task_manager.get_task_state("restored-1")
    assert task is not None
    assert task.poll_token == "exact-original-token"  # must round-trip byte-for-byte
    assert task.status == "pending"
    assert task.usernames == ["a", "b"]
    assert task.job_type == "date_night"


@pytest.mark.asyncio
async def test_load_pending_tasks_noop_when_supabase_disabled():
    with patch.object(settings, "supabase_url", ""):
        loaded = await task_manager.load_pending_tasks()
    assert loaded == 0
    assert task_manager._tasks == {}


@pytest.mark.asyncio
async def test_load_pending_tasks_does_not_clobber_existing_task(_supabase_enabled):
    task_manager.create_scrape_job("already-here")
    existing_id = next(iter(task_manager._tasks.keys()))
    row = {
        "task_id": existing_id,
        "kind": "scrape",
        "status": "pending",
        "poll_token": "should-not-overwrite",
        "created_at": "2026-07-20T12:00:00+00:00",
    }
    mock_client = _mock_get_client([row])
    with patch("httpx.AsyncClient", return_value=mock_client):
        loaded = await task_manager.load_pending_tasks()

    assert loaded == 0
    task = task_manager.get_task_state(existing_id)
    assert task.poll_token != "should-not-overwrite"
