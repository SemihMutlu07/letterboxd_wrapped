from unittest.mock import MagicMock, AsyncMock, patch
import pytest

from app.routes.watchlist import _mirror_watchlist_to_supabase
from app.routes.recommend import _mirror_date_night_to_supabase
from app.admin import (
    _load_watchlist_runs_supabase,
    _load_date_night_runs_supabase,
    _load_runs_supabase,
    _load_run_supabase,
)
from app import supabase_ops
from app.config import settings

def _mock_insert_client():
    mock_response = MagicMock()
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.mark.asyncio
async def test_mirror_watchlist_to_supabase():
    payload = {
        "usernames": ["user1", "user2"],
        "ok": True,
        "match_score": 85,
        "extra_field": "some_extra"
    }
    mock_client = _mock_insert_client()
    with patch("httpx.AsyncClient", return_value=mock_client) as mock_client_cls, \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        await _mirror_watchlist_to_supabase(payload)

    assert mock_client_cls.call_args.kwargs["headers"]["apikey"] == "mock_key"
    mock_client.post.assert_called_once()
    args, kwargs = mock_client.post.call_args
    assert args[0] == "https://mock.supabase.co/rest/v1/ops_watchlist_runs"
    assert kwargs["json"]["usernames"] == ["user1", "user2"]
    assert kwargs["json"]["match_score"] == 85
    assert kwargs["json"]["payload"] == payload


@pytest.mark.asyncio
async def test_mirror_date_night_to_supabase():
    payload = {
        "usernames": ["user1", "user2"],
        "ok": False,
        "extra_field": "some_extra"
    }
    mock_client = _mock_insert_client()
    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        await _mirror_date_night_to_supabase(payload)

    mock_client.post.assert_called_once()
    args, kwargs = mock_client.post.call_args
    assert args[0] == "https://mock.supabase.co/rest/v1/ops_date_night_runs"
    assert kwargs["json"]["usernames"] == ["user1", "user2"]
    assert kwargs["json"]["ok"] is False
    assert kwargs["json"]["payload"] == payload


@pytest.mark.asyncio
async def test_load_watchlist_runs_supabase():
    mock_response = MagicMock()
    mock_response.json.return_value = [
        {
            "created_at": "2026-06-23T12:00:00Z",
            "payload": {
                "usernames": ["user1", "user2"],
                "ok": True,
                "match_score": 85
            }
        }
    ]
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        runs = await _load_watchlist_runs_supabase(limit=5)
        
    assert len(runs) == 1
    assert runs[0]["usernames"] == ["user1", "user2"]
    assert runs[0]["_mtime"] == "2026-06-23T12:00:00Z"


def _mock_async_client(rows):
    mock_response = MagicMock()
    mock_response.json.return_value = rows
    mock_response.raise_for_status = MagicMock()
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.mark.asyncio
async def test_load_runs_supabase_sets_filename_link():
    # The dashboard list links to /admin/run/{_filename}; on Supabase that key
    # must be the row id so the detail view can be fetched back by it.
    mock_client = _mock_async_client([
        {"id": "abc-123", "created_at": "2026-06-23T12:00:00Z",
         "payload": {"username": "semihmutsuz", "ok": True}},
    ])
    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        runs = await _load_runs_supabase(limit=5)

    assert runs[0]["_filename"] == "abc-123"  # links the detail view back to this row


@pytest.mark.asyncio
async def test_load_run_supabase_returns_payload_with_trace():
    mock_client = _mock_async_client([
        {"created_at": "2026-06-23T12:00:00Z",
         "payload": {"username": "semihmutsuz", "ok": True,
                     "trace_events": [{"stage": "scrape"}]}},
    ])
    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        run = await _load_run_supabase("abc-123")

    assert run is not None
    assert run["trace_events"] == [{"stage": "scrape"}]  # detail view can render trace
    # queried by id, not a scan
    _, kwargs = mock_client.get.call_args
    assert kwargs["params"]["id"] == "eq.abc-123"


@pytest.mark.asyncio
async def test_load_date_night_runs_supabase():
    mock_response = MagicMock()
    mock_response.json.return_value = [
        {
            "created_at": "2026-06-23T12:00:00Z",
            "payload": {
                "usernames": ["user1", "user2"],
                "ok": True,
            }
        }
    ]
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        runs = await _load_date_night_runs_supabase(limit=5)
        
    assert len(runs) == 1
    assert runs[0]["usernames"] == ["user1", "user2"]
    assert runs[0]["_mtime"] == "2026-06-23T12:00:00Z"


@pytest.mark.asyncio
async def test_upsert_dashboard_setting_uses_on_conflict():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client), \
         patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        ok = await supabase_ops.upsert(
            "ops_dashboard_settings",
            {"key": "worker_control", "value": {"desired_state": "pause"}},
            on_conflict="key",
        )

    assert ok is True
    _, kwargs = mock_client.post.call_args
    assert kwargs["params"] == {"on_conflict": "key"}
    assert kwargs["headers"]["Prefer"] == "resolution=merge-duplicates,return=minimal"
    assert kwargs["json"]["key"] == "worker_control"
