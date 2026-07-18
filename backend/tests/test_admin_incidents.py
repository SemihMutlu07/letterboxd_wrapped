from __future__ import annotations

from unittest.mock import AsyncMock, PropertyMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app import task_manager
from app.config import settings
from app.main import create_app


@pytest.fixture
async def client(monkeypatch):
    monkeypatch.setenv("ADMIN_SECRET", "test-admin-secret")
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="https://test") as value:
        yield value


@pytest.mark.asyncio
async def test_dashboard_query_key_never_authenticates_or_sets_cookie(client):
    response = await client.get("/admin/dashboard?key=test-admin-secret", follow_redirects=False)

    assert response.status_code == 303
    assert response.headers["location"] == "/admin/dashboard"
    assert "set-cookie" not in response.headers
    assert "test-admin-secret" not in response.text


@pytest.mark.asyncio
async def test_dashboard_without_session_renders_post_login_form(client):
    response = await client.get("/admin/dashboard")

    assert response.status_code == 200
    assert 'method="post"' in response.text
    assert 'action="/admin/session"' in response.text


@pytest.mark.asyncio
async def test_admin_post_session_sets_safe_cookie(client):
    response = await client.post(
        "/admin/session", data={"key": "test-admin-secret"}, follow_redirects=False
    )

    assert response.status_code == 303
    cookie = response.headers["set-cookie"]
    assert "mw_admin_session=" in cookie
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=strict" in cookie
    assert "test-admin-secret" not in cookie


@pytest.mark.asyncio
async def test_admin_reports_setup_error_when_secret_is_missing(client, monkeypatch):
    monkeypatch.delenv("ADMIN_SECRET", raising=False)

    response = await client.get("/admin/dashboard")

    assert response.status_code == 503
    assert response.json()["detail"]["error_code"] == "admin_not_configured"


@pytest.mark.asyncio
async def test_dashboard_renders_durable_and_synthetic_incidents(client, monkeypatch):
    enabled = patch.object(type(settings), "supabase_enabled", new_callable=PropertyMock, return_value=True)
    worker_enabled = patch.object(
        type(settings), "desktop_worker_enabled", new_callable=PropertyMock, return_value=True
    )
    enabled.start()
    worker_enabled.start()
    monkeypatch.setattr("app.admin._load_analysis_runs", AsyncMock(return_value=[]))
    monkeypatch.setattr("app.admin._load_watchlist_runs_supabase", AsyncMock(return_value=[]))
    monkeypatch.setattr("app.admin._load_date_night_runs_supabase", AsyncMock(return_value=[]))
    status = task_manager.get_worker_status(
        settings.worker_heartbeat_max_age_seconds,
        expected_protocol_version=settings.worker_protocol_version,
    )
    status["online"] = False
    status["version"]["mismatch"] = True
    status["recent_failures"] = [
        {"task_id": "abc", "message": "scrape blocked", "error_stage": "scrape"}
    ]
    monkeypatch.setattr("app.admin.task_manager.get_worker_status", lambda *args, **kwargs: status)
    monkeypatch.setattr(
        "app.admin.supabase_ops.select",
        AsyncMock(
            return_value=[
                {
                    "created_at": "2026-07-16T10:00:00Z",
                    "event_type": "backend_error",
                    "meta": {"path": "/api/watchlist-compare", "message": "internal failure"},
                }
            ]
        ),
    )
    try:
        response = await client.get(
            "/admin/dashboard", headers={"Authorization": "Bearer test-admin-secret"}
        )
    finally:
        worker_enabled.stop()
        enabled.stop()

    assert response.status_code == 200
    assert "Operational Incidents" in response.text
    assert "Worker is offline" in response.text
    assert "Worker protocol mismatch" in response.text
    assert "internal failure" in response.text
    assert "scrape blocked" in response.text


@pytest.mark.asyncio
async def test_dashboard_renders_empty_incident_state(client, monkeypatch):
    monkeypatch.setattr("app.admin._load_analysis_runs", AsyncMock(return_value=[]))
    monkeypatch.setattr("app.admin._load_operational_incidents", AsyncMock(return_value=[]))

    response = await client.get(
        "/admin/dashboard", headers={"Authorization": "Bearer test-admin-secret"}
    )

    assert response.status_code == 200
    assert "No operational incidents recorded" in response.text
