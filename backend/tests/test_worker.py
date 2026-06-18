"""
Desktop scrape worker — backend API tests.

Covers desktop-worker mode on /api/scrape-profile and the authenticated
/api/worker/* job endpoints. State in app.task_manager is process-global, so
each test resets it.

Run from backend/ directory:
    pytest tests/test_worker.py
"""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch

from app import task_manager
from app.config import settings

WORKER_TOKEN = "test-worker-secret"
AUTH = {"X-Worker-Token": WORKER_TOKEN}


@pytest.fixture
async def client():
    """ASGI client with desktop-worker mode ENABLED (worker_token set)."""
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None
    task_manager._last_worker_started_at = None
    task_manager._last_worker_shutdown_at = None
    task_manager._last_worker_meta = {}
    task_manager._last_worker_self_test = None
    original_token = settings.worker_token
    settings.worker_token = WORKER_TOKEN

    with patch.dict("os.environ", {"TMDB_API_KEY": "test-key"}):
        from app.main import create_app  # noqa: PLC0415

        app = create_app()
        app.state.aiohttp_session = object()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    settings.worker_token = original_token
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None
    task_manager._last_worker_started_at = None
    task_manager._last_worker_shutdown_at = None
    task_manager._last_worker_meta = {}
    task_manager._last_worker_self_test = None


async def _beat(client: AsyncClient):
    r = await client.post("/api/worker/heartbeat", headers=AUTH)
    assert r.status_code == 200


# ---- /api/scrape-profile in desktop-worker mode ------------------------------

@pytest.mark.asyncio
async def test_scrape_profile_queues_202_when_worker_online(client: AsyncClient):
    await _beat(client)
    r = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    assert r.status_code == 202
    body = r.json()
    assert body["status"] == "pending"
    assert "task_id" in body
    task = task_manager.get_task_state(body["task_id"])
    assert task is not None
    assert task.kind == "scrape"
    assert task.username == "semihmutsuz"


@pytest.mark.asyncio
async def test_scrape_profile_offline_when_no_heartbeat(client: AsyncClient):
    r = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    assert r.status_code == 503
    assert r.json()["detail"]["error_code"] == "desktop_worker_offline"


@pytest.mark.asyncio
async def test_scrape_profile_offline_when_heartbeat_stale(client: AsyncClient):
    await _beat(client)
    # Force the heartbeat to look older than the staleness window.
    from datetime import datetime, timedelta
    task_manager._last_worker_heartbeat = datetime.utcnow() - timedelta(
        seconds=settings.worker_heartbeat_max_age_seconds + 5
    )
    r = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    assert r.status_code == 503
    assert r.json()["detail"]["error_code"] == "desktop_worker_offline"


# ---- worker auth -------------------------------------------------------------

@pytest.mark.asyncio
async def test_worker_endpoints_require_token(client: AsyncClient):
    assert (await client.get("/api/worker/scrape/next")).status_code == 401
    assert (await client.post("/api/worker/heartbeat")).status_code == 401
    assert (await client.post("/api/worker/startup", json={})).status_code == 401
    assert (await client.post("/api/worker/self-test", json={})).status_code == 401
    assert (await client.get("/api/worker/scrape/next", headers={"X-Worker-Token": "wrong"})).status_code == 401


@pytest.mark.asyncio
async def test_worker_lifecycle_and_self_test_status(client: AsyncClient):
    startup = await client.post(
        "/api/worker/startup",
        headers=AUTH,
        json={"self_test_on_start": True, "self_test_username": "semihmutsuz"},
    )
    assert startup.status_code == 200

    self_test = await client.post(
        "/api/worker/self-test",
        headers=AUTH,
        json={"username": "semihmutsuz", "ok": True, "total_films": 394, "message": "Startup scrape self-test passed."},
    )
    assert self_test.status_code == 200

    status = task_manager.get_worker_status(settings.worker_heartbeat_max_age_seconds)
    assert status["online"] is True
    assert status["meta"]["self_test_username"] == "semihmutsuz"
    assert status["self_test"]["ok"] is True
    assert status["self_test"]["total_films"] == 394

    shutdown = await client.post("/api/worker/shutdown", headers=AUTH, json={"reason": "test"})
    assert shutdown.status_code == 200
    assert task_manager.get_worker_status(settings.worker_heartbeat_max_age_seconds)["last_shutdown_at"] is not None


@pytest.mark.asyncio
async def test_admin_worker_status_api(client: AsyncClient):
    await client.post("/api/worker/startup", headers=AUTH, json={"self_test_username": "semihmutsuz"})
    r = await client.get("/admin/api/worker?key=mw3169305")
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["status"]["online"] is True
    assert body["status"]["meta"]["self_test_username"] == "semihmutsuz"


@pytest.mark.asyncio
async def test_admin_dashboard_renders_worker_panel(client: AsyncClient):
    await client.post("/api/worker/startup", headers=AUTH, json={"self_test_username": "semihmutsuz"})
    r = await client.get("/admin/dashboard?key=mw3169305")
    assert r.status_code == 200
    html = r.text
    assert "Desktop Worker" in html
    assert "Worker live" in html
    assert "Startup Self-Test" in html


# ---- claiming jobs -----------------------------------------------------------

@pytest.mark.asyncio
async def test_worker_claims_one_job(client: AsyncClient):
    await _beat(client)
    submit = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    task_id = submit.json()["task_id"]

    r = await client.get("/api/worker/scrape/next", headers=AUTH)
    assert r.status_code == 200
    job = r.json()["job"]
    assert job["task_id"] == task_id
    assert job["username"] == "semihmutsuz"

    # A second poll with no other queued jobs returns nothing — the worker does
    # not re-claim a job it already took.
    r2 = await client.get("/api/worker/scrape/next", headers=AUTH)
    assert r2.json()["job"] is None


# ---- completion / failure ----------------------------------------------------

@pytest.mark.asyncio
async def test_worker_completion_makes_progress_done(client: AsyncClient):
    await _beat(client)
    task_id = (await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})).json()["task_id"]
    await client.get("/api/worker/scrape/next", headers=AUTH)

    stats = {"total_films": 394, "scraped_username": "semihmutsuz"}
    done = await client.post(f"/api/worker/scrape/{task_id}/complete", headers=AUTH, json={"stats": stats})
    assert done.status_code == 200

    prog = await client.get(f"/api/progress/{task_id}")
    body = prog.json()
    assert body["status"] == "done"
    assert body["result"]["status"] == "success"
    assert body["result"]["stats"]["total_films"] == 394


@pytest.mark.asyncio
async def test_worker_failure_makes_progress_failed(client: AsyncClient):
    await _beat(client)
    task_id = (await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})).json()["task_id"]
    await client.get("/api/worker/scrape/next", headers=AUTH)

    fail = await client.post(
        f"/api/worker/scrape/{task_id}/failed",
        headers=AUTH,
        json={"error_code": "scrape_failed", "message": "Letterboxd blocked the desktop worker."},
    )
    assert fail.status_code == 200

    prog = await client.get(f"/api/progress/{task_id}")
    body = prog.json()
    assert body["status"] == "failed"
    assert body["error"] == "Letterboxd blocked the desktop worker."


@pytest.mark.asyncio
async def test_worker_complete_unknown_task_404(client: AsyncClient):
    await _beat(client)
    r = await client.post("/api/worker/scrape/does-not-exist/complete", headers=AUTH, json={"stats": {}})
    assert r.status_code == 404
