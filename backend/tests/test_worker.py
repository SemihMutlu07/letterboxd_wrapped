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
async def client(tmp_path):
    """ASGI client with desktop-worker mode ENABLED (worker_token set)."""
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None
    task_manager._last_worker_started_at = None
    task_manager._last_worker_shutdown_at = None
    task_manager._last_worker_meta = {}
    task_manager._last_worker_self_test = None
    original_token = settings.worker_token
    settings.worker_token = WORKER_TOKEN
    from app.services import run_log  # noqa: PLC0415
    from app import admin  # noqa: PLC0415

    original_runs_dir = run_log.RUNS_DIR
    original_admin_runs_dir = admin.RUNS_DIR
    run_log.RUNS_DIR = tmp_path / "runs"
    admin.RUNS_DIR = run_log.RUNS_DIR

    with patch.dict("os.environ", {"TMDB_API_KEY": "test-key"}):
        from app.main import create_app  # noqa: PLC0415

        app = create_app()
        app.state.aiohttp_session = object()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    settings.worker_token = original_token
    run_log.RUNS_DIR = original_runs_dir
    admin.RUNS_DIR = original_admin_runs_dir
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None
    task_manager._last_worker_started_at = None
    task_manager._last_worker_shutdown_at = None
    task_manager._last_worker_meta = {}
    task_manager._last_worker_self_test = None


async def _beat(client: AsyncClient):
    r = await client.post(
        "/api/worker/heartbeat",
        headers=AUTH,
        json={"worker_protocol_version": settings.worker_protocol_version, "worker_git_sha": "test-worker"},
    )
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
    assert (await client.post("/api/worker/scrape/abc/event", json={})).status_code == 401
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
    assert "version" in body["status"]


@pytest.mark.asyncio
async def test_admin_dashboard_renders_worker_panel(client: AsyncClient):
    await client.post("/api/worker/startup", headers=AUTH, json={"self_test_username": "semihmutsuz"})
    r = await client.get("/admin/dashboard?key=mw3169305")
    assert r.status_code == 200
    html = r.text
    assert "Desktop Worker" in html
    assert "Worker live" in html
    assert "Startup Self-Test" in html
    assert "refreshAnalysisRuns" in html
    assert "/admin/api/runs" in html


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


@pytest.mark.asyncio
async def test_worker_version_mismatch_blocks_claim(client: AsyncClient):
    await client.post("/api/worker/heartbeat", headers=AUTH, json={"worker_protocol_version": 0, "worker_git_sha": "old"})
    submit = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    assert submit.status_code == 202

    r = await client.get("/api/worker/scrape/next", headers=AUTH)
    assert r.status_code == 409
    assert r.json()["detail"]["error_code"] == "worker_version_mismatch"


# ---- completion / failure ----------------------------------------------------

@pytest.mark.asyncio
async def test_worker_completion_makes_progress_done(client: AsyncClient):
    await _beat(client)
    task_id = (await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})).json()["task_id"]
    await client.get("/api/worker/scrape/next", headers=AUTH)

    stats = {"total_films": 394, "scraped_username": "semihmutsuz"}
    event = await client.post(
        f"/api/worker/scrape/{task_id}/event",
        headers=AUTH,
        json={"stage": "scrape_started", "message": "Scrape started", "elapsed_seconds": 1.0},
    )
    assert event.status_code == 200
    done = await client.post(
        f"/api/worker/scrape/{task_id}/complete",
        headers=AUTH,
        json={
            "stats": stats,
            "telemetry": {"duration_seconds": 12.3, "scrape_seconds": 8.1, "analysis_seconds": 3.2},
            "trace_events": [{"stage": "analysis_done", "message": "Analysis completed", "elapsed_seconds": 12.0}],
        },
    )
    assert done.status_code == 200

    prog = await client.get(f"/api/progress/{task_id}")
    body = prog.json()
    assert body["status"] == "done"
    assert body["result"]["status"] == "success"
    assert body["result"]["stats"]["total_films"] == 394
    assert body["trace_events"][0]["stage"] == "queued"
    assert task_manager.get_task_state(task_id).duration_seconds == 12.3
    assert task_manager.get_task_state(task_id).scrape_seconds == 8.1

    runs = await client.get("/admin/api/runs?key=mw3169305")
    assert runs.status_code == 200
    run = runs.json()["runs"][0]
    assert run["task_id"] == task_id
    assert run["source"] == "desktop-worker"
    assert run["duration_seconds"] == 12.3
    assert run["scrape_seconds"] == 8.1
    assert run["bottleneck_stage"] == "scrape"
    assert run["bottleneck_seconds"] == 8.1
    assert run["duration_seconds_per_film"] == 0.031
    assert [event["stage"] for event in run["trace_events"]][-1] == "persisted"


@pytest.mark.asyncio
async def test_worker_failure_makes_progress_failed(client: AsyncClient):
    await _beat(client)
    task_id = (await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})).json()["task_id"]
    await client.get("/api/worker/scrape/next", headers=AUTH)

    fail = await client.post(
        f"/api/worker/scrape/{task_id}/failed",
        headers=AUTH,
        json={
            "error_code": "scrape_failed",
            "message": "Letterboxd blocked the desktop worker.",
            "telemetry": {
                "duration_seconds": 7.8,
                "error_type": "ValueError",
                "error_stage": "letterboxd_or_scrape",
            },
        },
    )
    assert fail.status_code == 200

    prog = await client.get(f"/api/progress/{task_id}")
    body = prog.json()
    assert body["status"] == "failed"
    assert body["error"] == "Letterboxd blocked the desktop worker."
    task = task_manager.get_task_state(task_id)
    assert task.duration_seconds == 7.8
    assert task.error_type == "ValueError"
    assert task.error_stage == "letterboxd_or_scrape"

    runs = await client.get("/admin/api/runs?key=mw3169305")
    assert runs.status_code == 200
    run = runs.json()["runs"][0]
    assert run["ok"] is False
    assert run["error_stage"] == "letterboxd_or_scrape"
    assert run["error_message"] == "Letterboxd blocked the desktop worker."

    dashboard = await client.get("/admin/dashboard?key=mw3169305")
    assert dashboard.status_code == 200
    assert "letterboxd_or_scrape" in dashboard.text


@pytest.mark.asyncio
async def test_worker_complete_unknown_task_404(client: AsyncClient):
    await _beat(client)
    r = await client.post("/api/worker/scrape/does-not-exist/complete", headers=AUTH, json={"stats": {}})
    assert r.status_code == 200
    assert r.json()["orphan"] is True

    runs = await client.get("/admin/api/runs?key=mw3169305")
    assert runs.status_code == 200
    assert runs.json()["runs"][0]["task_id"] == "does-not-exist"


@pytest.mark.asyncio
async def test_worker_fail_unknown_task_persists_orphan_run(client: AsyncClient):
    await _beat(client)
    r = await client.post(
        "/api/worker/scrape/missing-task/failed",
        headers=AUTH,
        json={
            "username": "semihmutsuz",
            "message": "Lost during redeploy",
            "telemetry": {"duration_seconds": 3.4, "error_stage": "postback"},
        },
    )
    assert r.status_code == 200
    assert r.json()["orphan"] is True

    runs = await client.get("/admin/api/runs?key=mw3169305")
    run = runs.json()["runs"][0]
    assert run["ok"] is False
    assert run["username"] == "semihmutsuz"
    assert run["error_stage"] == "postback"
