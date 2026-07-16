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
from app.services import dashboard_settings
from app.worker.desktop_scrape_worker import WorkerConfig, _worker_meta

WORKER_TOKEN = "test-worker-secret"
AUTH = {"X-Worker-Token": WORKER_TOKEN}
ADMIN_KEY = "test-admin-secret-rotated"
ADMIN_AUTH = {"Authorization": f"Bearer {ADMIN_KEY}"}


def test_worker_reports_direct_cloudscraper_transport(monkeypatch):
    monkeypatch.setenv("WORKER_BACKEND_URL", "https://backend.example.com")
    monkeypatch.setenv("WORKER_TOKEN", WORKER_TOKEN)
    cfg = WorkerConfig()
    assert _worker_meta(cfg)["scrape_transport"] == "direct_cloudscraper"


def test_requeue_stale_claims_recovers_dead_worker_jobs():
    """A job claimed then abandoned (desktop offline mid-scrape) must be re-queued,
    not left stuck 'running' until it 404s on the user."""
    from datetime import datetime, timedelta, timezone

    task_manager._tasks.clear()
    tid = task_manager.create_scrape_job("ghost")
    job = task_manager.claim_next_scrape_job()
    assert job.task_id == tid and job.status == "running"
    job.claimed_at = datetime.now(timezone.utc) - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 60)
    assert task_manager.requeue_stale_claims() == 1
    assert job.status == "pending" and job.claimed is False and job.claimed_at is None
    task_manager.claim_next_scrape_job()
    assert task_manager.requeue_stale_claims() == 0
    task_manager._tasks.clear()


def test_watchlist_jobs_use_capacity_owner_and_stale_requeue(monkeypatch):
    from datetime import datetime, timedelta, timezone

    task_manager._tasks.clear()
    monkeypatch.setattr(task_manager, "MAX_ACTIVE_PER_OWNER", 1)
    tid = task_manager.create_watchlist_compare_job(["one", "two"], owner_key="owner")
    with pytest.raises(RuntimeError, match="queue_full"):
        task_manager.create_date_night_job(["one", "three"], owner_key="owner")
    job = task_manager.claim_next_worker_job()
    assert job.task_id == tid
    job.claimed_at = datetime.now(timezone.utc) - timedelta(seconds=task_manager.STALE_CLAIM_SECONDS + 1)
    assert task_manager.requeue_stale_claims() == 1
    assert job.status == "pending" and not job.claimed
    task_manager._tasks.clear()


def test_watchlist_processing_is_not_requeued_as_a_stale_worker_claim():
    from datetime import datetime, timedelta, timezone

    task_manager._tasks.clear()
    tid = task_manager.create_watchlist_compare_job(["one", "two"])
    job = task_manager.claim_next_worker_job()
    assert job is not None
    job.stage = "processing"
    job.claimed_at = datetime.now(timezone.utc) - timedelta(
        seconds=task_manager.STALE_CLAIM_SECONDS + 1
    )

    assert task_manager.requeue_stale_claims() == 0
    assert task_manager.get_task_state(tid).stage == "processing"
    task_manager._tasks.clear()


def test_expired_watchlist_job_fails_instead_of_polling_forever():
    from datetime import datetime, timedelta, timezone

    task_manager._tasks.clear()
    tid = task_manager.create_watchlist_compare_job(["one", "two"])
    task = task_manager.get_task_state(tid)
    task.created_at = datetime.now(timezone.utc) - timedelta(
        seconds=task_manager.ACTIVE_JOB_TIMEOUT_SECONDS + 1
    )

    assert task_manager.fail_expired_worker_jobs() == 1
    assert task.status == "failed"
    assert task.error_code == "worker_timeout"
    task_manager._tasks.clear()


def test_worker_claim_is_oldest_across_scrape_and_watchlist():
    from datetime import datetime, timedelta, timezone

    task_manager._tasks.clear()
    scrape_id = task_manager.create_scrape_job("profile")
    watchlist_id = task_manager.create_watchlist_compare_job(["one", "two"])
    task_manager._tasks[watchlist_id].created_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    assert task_manager.claim_next_worker_job().task_id == watchlist_id
    assert task_manager.claim_next_worker_job().task_id == scrape_id
    task_manager._tasks.clear()


def test_supervisor_verifies_branch_and_venv_interpreter():
    from pathlib import Path

    script = (Path(__file__).parents[1] / "start-worker-supervisor.ps1").read_text(encoding="utf-8")
    assert '.venv\\Scripts\\python.exe' in script
    assert "fetch origin desktop_server" in script
    assert "checkout desktop_server" in script
    assert "pull --ff-only origin desktop_server" in script
    assert "branch --show-current" in script and "rev-parse HEAD" in script


@pytest.fixture
async def client(tmp_path):
    """ASGI client with desktop-worker mode ENABLED (worker_token set)."""
    task_manager._tasks.clear()
    task_manager._last_worker_heartbeat = None
    task_manager._last_worker_started_at = None
    task_manager._last_worker_shutdown_at = None
    task_manager._last_worker_meta = {}
    task_manager._last_worker_self_test = None
    task_manager._worker_desired_state = "run"
    task_manager._worker_restart_token = 0
    task_manager._worker_restart_requested_at = None
    dashboard_settings.reset_cache_for_tests()
    task_manager._last_supervisor_poll_at = None
    task_manager._last_supervisor_report_at = None
    task_manager._last_supervisor_status = {}
    task_manager._supervisor_log_tail = []
    original_token = settings.worker_token
    settings.worker_token = WORKER_TOKEN
    from app.services import run_log  # noqa: PLC0415
    from app import admin  # noqa: PLC0415

    original_runs_dir = run_log.RUNS_DIR
    original_admin_runs_dir = admin.RUNS_DIR
    run_log.RUNS_DIR = tmp_path / "runs"
    admin.RUNS_DIR = run_log.RUNS_DIR
    with patch.dict("os.environ", {"TMDB_API_KEY": "test-key", "ADMIN_SECRET": ADMIN_KEY}):
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
    task_manager._worker_desired_state = "run"
    task_manager._worker_restart_token = 0
    task_manager._worker_restart_requested_at = None
    dashboard_settings.reset_cache_for_tests()
    task_manager._last_supervisor_poll_at = None
    task_manager._last_supervisor_report_at = None
    task_manager._last_supervisor_status = {}
    task_manager._supervisor_log_tail = []


async def _beat(client: AsyncClient):
    r = await client.post(
        "/api/worker/heartbeat",
        headers=AUTH,
        json={"worker_protocol_version": settings.worker_protocol_version, "worker_git_sha": "test-worker"},
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_watchlist_compare_enqueue_complete_and_secure_poll(client: AsyncClient, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import watchlist_jobs
    from app.routes import watchlist

    await _beat(client)
    monkeypatch.setattr(watchlist, "_persist_watchlist_run", lambda *args, **kwargs: None)
    monkeypatch.setattr(watchlist_jobs, "enrich_films_concurrent", AsyncMock(side_effect=lambda session, films, **kw: films))
    queued = await client.post("/api/watchlist-compare", json={"usernames": ["one", "two"]})
    assert queued.status_code == 202
    body = queued.json()
    assert (await client.get(f"/api/progress/{body['task_id']}")).status_code == 403
    claim = await client.get("/api/worker/next", headers=AUTH)
    assert claim.json()["job"]["task_id"] == body["task_id"]
    raw = {"first_watchlist": [{"title": "Film", "year": "2024", "slug": "film"}], "second_watchlist": [{"title": "Film", "year": "2024", "slug": "film"}]}
    complete = await client.post(f"/api/worker/watchlist/{body['task_id']}/complete", headers=AUTH, json=raw)
    assert complete.status_code == 200
    await __import__("asyncio").sleep(0)
    poll = await client.get(f"/api/progress/{body['task_id']}", headers={"X-Task-Token": body["poll_token"]})
    assert poll.status_code == 200 and poll.json()["status"] == "done"
    assert poll.json()["result"]["counts"]["common"] == 1
    duplicate = await client.post(f"/api/worker/watchlist/{body['task_id']}/complete", headers=AUTH, json=raw)
    assert duplicate.status_code == 200 and duplicate.json()["duplicate"] is True


@pytest.mark.asyncio
async def test_watchlist_finalization_failure_surfaces_stable_poll_error_code(client: AsyncClient, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import watchlist_jobs
    from app.routes import watchlist

    await _beat(client)
    monkeypatch.setattr(watchlist, "_persist_watchlist_run", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        watchlist_jobs,
        "enrich_films_concurrent",
        AsyncMock(side_effect=RuntimeError("tmdb unavailable")),
    )
    queued = await client.post("/api/watchlist-compare", json={"usernames": ["one", "two"]})
    body = queued.json()
    await client.get("/api/worker/next", headers=AUTH)
    raw = {"first_watchlist": [], "second_watchlist": []}
    await client.post(f"/api/worker/watchlist/{body['task_id']}/complete", headers=AUTH, json=raw)
    await __import__("asyncio").sleep(0)

    poll = await client.get(
        f"/api/progress/{body['task_id']}",
        headers={"X-Task-Token": body["poll_token"]},
    )
    assert poll.json()["status"] == "failed"
    assert poll.json()["error_code"] == "watchlist_processing_failed"


@pytest.mark.asyncio
async def test_late_failed_watchlist_postback_does_not_override_processing_or_done(client: AsyncClient):
    await _beat(client)
    task_id = task_manager.create_watchlist_compare_job(["one", "two"])
    task = task_manager.get_task_state(task_id)
    task.status = "running"
    task.stage = "processing"

    late = await client.post(
        f"/api/worker/watchlist/{task_id}/failed",
        headers=AUTH,
        json={"message": "late worker failure"},
    )
    assert late.json() == {"ok": True, "duplicate": True}
    assert task.status == "running" and task.stage == "processing"

    task_manager.set_task_done(task_id, {"status": "success"})
    later = await client.post(
        f"/api/worker/watchlist/{task_id}/failed",
        headers=AUTH,
        json={"message": "even later worker failure"},
    )
    assert later.json() == {"ok": True, "duplicate": True}
    assert task.status == "done"


@pytest.mark.asyncio
async def test_finalizer_does_not_overwrite_terminal_state_changed_during_await(monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import watchlist_jobs
    from app.routes import watchlist

    task_manager._tasks.clear()
    task_id = task_manager.create_watchlist_compare_job(["one", "two"])
    task = task_manager.get_task_state(task_id)
    task.status = "running"
    task.stage = "processing"
    task.result = {"first_watchlist": [], "second_watchlist": []}

    async def terminal_during_enrichment(session, films, **kwargs):
        task_manager.set_task_failed(
            task_id,
            "cancelled elsewhere",
            {"error_code": "conflicting_terminal_state"},
        )
        return films

    monkeypatch.setattr(watchlist, "_persist_watchlist_run", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        watchlist_jobs,
        "enrich_films_concurrent",
        AsyncMock(side_effect=terminal_during_enrichment),
    )
    await watchlist_jobs.finalize_watchlist_job(task_id, object())

    assert task.status == "failed"
    assert task.error_code == "conflicting_terminal_state"
    assert task.error == "cancelled elsewhere"
    task_manager._tasks.clear()


@pytest.mark.asyncio
async def test_date_night_enqueue_complete_and_final_poll(client: AsyncClient, monkeypatch):
    from unittest.mock import AsyncMock
    from app.services import watchlist_jobs
    from app.routes import recommend

    await _beat(client)
    monkeypatch.setattr(recommend, "_persist_date_night_run", lambda *args, **kwargs: None)
    monkeypatch.setattr(watchlist_jobs, "enrich_films", AsyncMock(side_effect=lambda session, films, **kw: films))
    monkeypatch.setattr(watchlist_jobs, "build_mutual_profile", lambda a, b: {"top_genres": [], "top_directors": [], "era_overlap": "modern"})
    monkeypatch.setattr(watchlist_jobs, "discover_date_night_recommendations", AsyncMock(return_value=[{"title": "Film", "year": "2024", "reason": "Shared", "poster_path": ""}]))
    queued = await client.post("/api/date-night", json={"usernames": ["one", "two"]})
    assert queued.status_code == 202
    body = queued.json()
    assert (await client.get("/api/worker/next", headers=AUTH)).json()["job"]["job_type"] == "date_night"
    raw = {"first_diary": [], "first_grid": [], "second_diary": [], "second_grid": [], "first_watchlist": [], "second_watchlist": []}
    assert (await client.post(f"/api/worker/watchlist/{body['task_id']}/complete", headers=AUTH, json=raw)).status_code == 200
    await __import__("asyncio").sleep(0.01)
    poll = await client.get(f"/api/progress/{body['task_id']}", headers={"X-Task-Token": body["poll_token"]})
    assert poll.json()["status"] == "done"
    assert poll.json()["result"]["recommendations"][0]["title"] == "Film"


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
    from datetime import datetime, timedelta, timezone
    task_manager._last_worker_heartbeat = datetime.now(timezone.utc) - timedelta(
        seconds=settings.worker_heartbeat_max_age_seconds + 5
    )
    r = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    assert r.status_code == 503
    assert r.json()["detail"]["error_code"] == "desktop_worker_offline"


@pytest.mark.asyncio
async def test_scrape_profile_paused_blocks_new_job_even_when_worker_online(client: AsyncClient):
    await _beat(client)
    pause = await client.post("/admin/api/worker/control", headers=ADMIN_AUTH, json={"desired_state": "pause"})
    assert pause.status_code == 200
    assert pause.json()["control"]["desired_state"] == "pause"

    r = await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})
    assert r.status_code == 503
    assert r.json()["detail"]["error_code"] == "desktop_worker_paused"
    assert task_manager._tasks == {}


# ---- worker auth -------------------------------------------------------------

@pytest.mark.asyncio
async def test_worker_endpoints_require_token(client: AsyncClient):
    assert (await client.get("/api/worker/scrape/next")).status_code == 401
    assert (await client.get("/api/worker/control")).status_code == 401
    assert (await client.post("/api/worker/supervisor", json={})).status_code == 401
    assert (await client.post("/api/worker/heartbeat")).status_code == 401
    assert (await client.post("/api/worker/startup", json={})).status_code == 401
    assert (await client.post("/api/worker/self-test", json={})).status_code == 401
    assert (await client.post("/api/worker/scrape/abc/event", json={})).status_code == 401
    assert (await client.get("/api/worker/scrape/next", headers={"X-Worker-Token": "wrong"})).status_code == 401


@pytest.mark.asyncio
async def test_admin_worker_control_requires_admin_key(client: AsyncClient):
    assert (await client.post("/admin/api/worker/control", json={"desired_state": "pause"})).status_code == 403
    assert (await client.post("/admin/api/worker/restart")).status_code == 403


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
    r = await client.get("/admin/api/worker", headers=ADMIN_AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is True
    assert body["status"]["online"] is True
    assert body["status"]["meta"]["self_test_username"] == "semihmutsuz"
    assert "version" in body["status"]
    assert body["status"]["control"]["desired_state"] == "run"
    assert body["status"]["supervisor"]["child_status"] == "unknown"
    assert body["settings_store"]["source"] == "memory"


@pytest.mark.asyncio
async def test_worker_control_defaults_to_run_and_records_supervisor_poll(client: AsyncClient):
    r = await client.get("/api/worker/control", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["desired_state"] == "run"
    assert body["restart_token"] == 0
    assert body["should_restart"] is False

    status = task_manager.get_worker_status(settings.worker_heartbeat_max_age_seconds)
    assert status["control"]["desired_state"] == "run"
    assert status["supervisor"]["last_poll_at"] is not None


@pytest.mark.asyncio
async def test_admin_worker_control_persists_to_supabase_settings(client: AsyncClient):
    with patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock-key"), \
         patch("app.supabase_ops.upsert", return_value=True) as mock_upsert:
        pause = await client.post("/admin/api/worker/control", headers=ADMIN_AUTH, json={"desired_state": "pause"})

    assert pause.status_code == 200
    body = pause.json()
    assert body["control"]["desired_state"] == "pause"
    assert body["settings_store"]["source"] == "supabase"
    assert body["settings_store"]["last_save_ok"] is True
    mock_upsert.assert_awaited_once()
    _, row = mock_upsert.await_args.args
    assert row["key"] == "worker_control"
    assert row["value"]["desired_state"] == "pause"


@pytest.mark.asyncio
async def test_worker_control_loads_persisted_pause_after_memory_reset(client: AsyncClient):
    task_manager._worker_desired_state = "run"
    task_manager._worker_restart_token = 0
    dashboard_settings.reset_cache_for_tests()

    persisted_rows = [{
        "value": {
            "desired_state": "pause",
            "restart_token": 3,
            "restart_requested_at": "2026-07-02T09:00:00+00:00",
        },
        "updated_at": "2026-07-02T09:00:00+00:00",
    }]
    with patch.object(settings, "supabase_url", "https://mock.supabase.co"), \
         patch.object(settings, "supabase_anon_key", "mock-key"), \
         patch("app.supabase_ops.select", return_value=persisted_rows) as mock_select:
        control = await client.get("/api/worker/control?last_seen_restart_token=2", headers=AUTH)
        status = await client.get("/admin/api/worker", headers=ADMIN_AUTH)

    assert control.status_code == 200
    assert control.json()["desired_state"] == "pause"
    assert control.json()["restart_token"] == 3
    assert control.json()["should_restart"] is True
    assert status.json()["status"]["control"]["desired_state"] == "pause"
    assert status.json()["settings_store"]["persistent"] is True
    mock_select.assert_awaited_once()


@pytest.mark.asyncio
async def test_worker_restart_token_comparison(client: AsyncClient):
    initial = await client.get("/api/worker/control", headers=AUTH)
    assert initial.json()["restart_token"] == 0

    restart = await client.post("/admin/api/worker/restart", headers=ADMIN_AUTH)
    assert restart.status_code == 200
    new_token = restart.json()["control"]["restart_token"]
    assert new_token == 1

    pending = await client.get("/api/worker/control?last_seen_restart_token=0", headers=AUTH)
    assert pending.status_code == 200
    assert pending.json()["should_restart"] is True

    seen = await client.get(f"/api/worker/control?last_seen_restart_token={new_token}", headers=AUTH)
    assert seen.status_code == 200
    assert seen.json()["should_restart"] is False

    # Backend restart resets the in-memory token to 0 while the supervisor still holds
    # last_seen=1. A stale token must NOT trigger a restart (regression: bug_006).
    task_manager._worker_restart_token = 0
    stale = await client.get("/api/worker/control?last_seen_restart_token=1", headers=AUTH)
    assert stale.status_code == 200
    assert stale.json()["should_restart"] is False


@pytest.mark.asyncio
async def test_supervisor_report_does_not_pollute_worker_heartbeat(client: AsyncClient):
    lines = [f"line {i}" for i in range(100)]
    report = await client.post(
        "/api/worker/supervisor",
        headers=AUTH,
        json={
            "child_status": "running",
            "child_pid": 4242,
            "child_started_at": "2026-06-28T10:00:00Z",
            "last_restart_token_seen": 0,
            "log_tail": lines,
        },
    )
    assert report.status_code == 200

    status = task_manager.get_worker_status(settings.worker_heartbeat_max_age_seconds)
    assert status["online"] is False
    assert status["last_heartbeat"] is None
    assert status["supervisor"]["child_status"] == "running"
    assert status["supervisor"]["child_pid"] == 4242
    assert status["supervisor"]["log_tail"][0] == "line 20"
    assert len(status["supervisor"]["log_tail"]) == task_manager.SUPERVISOR_LOG_TAIL_MAX_LINES


@pytest.mark.asyncio
async def test_admin_dashboard_renders_worker_panel(client: AsyncClient):
    await client.post("/api/worker/startup", headers=AUTH, json={"self_test_username": "semihmutsuz"})
    r = await client.get("/admin/dashboard", headers=ADMIN_AUTH)
    assert r.status_code == 200
    html = r.text
    assert "Desktop Worker" in html
    assert "Worker live" in html
    assert "Startup Self-Test" in html
    assert "Pause Jobs" in html
    assert "Restart Worker" in html
    assert "Settings Store" in html
    assert "Durable ops dashboard" in html
    assert "Supervisor Log Tail" in html
    assert "refreshAnalysisRuns" in html
    assert "/admin/api/runs" in html


@pytest.mark.asyncio
async def test_admin_login_uses_http_only_session_cookie(client: AsyncClient):
    login = await client.post(
        "/admin/session", data={"key": "test-admin-secret-rotated"}, follow_redirects=False
    )
    assert login.status_code == 303
    cookie = login.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=strict" in cookie
    dashboard = await client.get("/admin/dashboard")
    assert dashboard.status_code == 200


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
async def test_paused_worker_claims_no_new_jobs(client: AsyncClient):
    await _beat(client)
    task_id = task_manager.create_scrape_job("semihmutsuz")
    task_manager.create_watchlist_compare_job(["semihmutsuz", "mertefesenturk"])
    await client.post("/admin/api/worker/control", headers=ADMIN_AUTH, json={"desired_state": "pause"})

    scrape = await client.get("/api/worker/scrape/next", headers=AUTH)
    assert scrape.status_code == 200
    assert scrape.json()["job"] is None
    assert scrape.json()["paused"] is True
    assert task_manager.get_task_state(task_id).status == "pending"

    watchlist = await client.get("/api/worker/watchlist/next", headers=AUTH)
    assert watchlist.status_code == 200
    assert watchlist.json()["job"] is None
    assert watchlist.json()["paused"] is True


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
    submitted = (await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})).json()
    task_id, poll_token = submitted["task_id"], submitted["poll_token"]
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

    prog = await client.get(f"/api/progress/{task_id}", headers={"X-Task-Token": poll_token})
    body = prog.json()
    assert body["status"] == "done"
    assert body["result"]["status"] == "success"
    assert body["result"]["stats"]["total_films"] == 394
    assert body["trace_events"][0]["stage"] == "queued"
    assert task_manager.get_task_state(task_id).duration_seconds == 12.3
    assert task_manager.get_task_state(task_id).scrape_seconds == 8.1

    runs = await client.get("/admin/api/runs", headers=ADMIN_AUTH)
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
    submitted = (await client.post("/api/scrape-profile", json={"username": "semihmutsuz"})).json()
    task_id, poll_token = submitted["task_id"], submitted["poll_token"]
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

    prog = await client.get(f"/api/progress/{task_id}", headers={"X-Task-Token": poll_token})
    body = prog.json()
    assert body["status"] == "failed"
    assert body["error"] == "Letterboxd blocked the desktop worker."
    task = task_manager.get_task_state(task_id)
    assert task.duration_seconds == 7.8
    assert task.error_type == "ValueError"
    assert task.error_stage == "letterboxd_or_scrape"

    runs = await client.get("/admin/api/runs", headers=ADMIN_AUTH)
    assert runs.status_code == 200
    run = runs.json()["runs"][0]
    assert run["ok"] is False
    assert run["error_stage"] == "letterboxd_or_scrape"
    assert run["error_message"] == "Letterboxd blocked the desktop worker."

    dashboard = await client.get("/admin/dashboard", headers=ADMIN_AUTH)
    assert dashboard.status_code == 200
    assert "letterboxd_or_scrape" in dashboard.text


@pytest.mark.asyncio
async def test_worker_complete_unknown_task_404(client: AsyncClient):
    await _beat(client)
    r = await client.post("/api/worker/scrape/does-not-exist/complete", headers=AUTH, json={"stats": {}})
    assert r.status_code == 200
    assert r.json()["orphan"] is True

    runs = await client.get("/admin/api/runs", headers=ADMIN_AUTH)
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

    runs = await client.get("/admin/api/runs", headers=ADMIN_AUTH)
    run = runs.json()["runs"][0]
    assert run["ok"] is False
    assert run["username"] == "semihmutsuz"
    assert run["error_stage"] == "postback"
