from unittest.mock import MagicMock, AsyncMock, patch
import pytest

from app.routes.watchlist import _mirror_watchlist_to_supabase
from app.routes.recommend import _mirror_date_night_to_supabase
from app.admin import _load_watchlist_runs_supabase, _load_date_night_runs_supabase
from app.config import settings

@patch("httpx.post")
def test_mirror_watchlist_to_supabase(mock_post):
    payload = {
        "usernames": ["user1", "user2"],
        "ok": True,
        "match_score": 85,
        "extra_field": "some_extra"
    }
    with patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        _mirror_watchlist_to_supabase(payload)
        
    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert args[0] == "https://mock.supabase.co/rest/v1/ops_watchlist_runs"
    assert kwargs["headers"]["apikey"] == "mock_key"
    assert kwargs["json"]["usernames"] == ["user1", "user2"]
    assert kwargs["json"]["match_score"] == 85
    assert kwargs["json"]["payload"] == payload


@patch("httpx.post")
def test_mirror_date_night_to_supabase(mock_post):
    payload = {
        "usernames": ["user1", "user2"],
        "ok": False,
        "extra_field": "some_extra"
    }
    with patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock_key"):
        _mirror_date_night_to_supabase(payload)
        
    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert args[0] == "https://mock.supabase.co/rest/v1/ops_date_night_runs"
    assert kwargs["headers"]["apikey"] == "mock_key"
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
