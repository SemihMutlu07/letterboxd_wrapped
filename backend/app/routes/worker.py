"""
Authenticated endpoints for the outbound desktop scrape worker.

The desktop machine is not publicly exposed; it runs a long-lived process that
polls these endpoints to claim queued scrape jobs, runs the local scrape +
analysis pipeline, and posts results back. All endpoints require a shared secret
in the `X-Worker-Token` header matching settings.worker_token.
"""
from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Header, HTTPException, Request

from app import task_manager
from app.task_manager import claim_next_watchlist_job
from app.config import backend_git_sha, settings
from app.services import dashboard_settings
from app.services.run_log import persist_run
from app.services.worker_monitor import log_worker_event

logger = logging.getLogger("letterboxd_wrapped.worker")

router = APIRouter(prefix="/api/worker")


def _require_worker_token(x_worker_token: str | None) -> None:
    """Reject the request unless a worker token is configured and matches."""
    supplied = x_worker_token or ""
    valid = bool(settings.worker_token) and secrets.compare_digest(supplied, settings.worker_token)
    if settings.worker_token_previous:
        valid = valid or secrets.compare_digest(supplied, settings.worker_token_previous)
    if not valid:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "unauthorized", "message": "Invalid or missing worker token."},
        )


def _merge_worker_trace(task_id: str, body: dict) -> None:
    events = body.get("trace_events")
    if isinstance(events, list):
        for event in events:
            if isinstance(event, dict):
                task_manager.append_task_event_payload(task_id, event)


def _task_telemetry(task: task_manager.TaskState) -> dict:
    return {
        "duration_seconds": task.duration_seconds,
        "queue_wait_seconds": task.queue_wait_seconds,
        "worker_seconds": task.worker_seconds,
        "scrape_seconds": task.scrape_seconds,
        "analysis_seconds": task.analysis_seconds,
        "postback_seconds": task.postback_seconds,
        "error_type": task.error_type,
        "error_stage": task.error_stage,
        "error_code": task.error_code,
    }


def _request_telemetry(body: dict) -> dict:
    telemetry = body.get("telemetry")
    return telemetry if isinstance(telemetry, dict) else {}


def _request_trace_events(body: dict) -> list[dict]:
    events = body.get("trace_events")
    return [event for event in events if isinstance(event, dict)] if isinstance(events, list) else []


def _request_username(body: dict, stats: dict | None = None) -> str | None:
    username = body.get("username")
    if isinstance(username, str) and username.strip():
        return username.strip().lower()
    if stats:
        scraped_username = stats.get("scraped_username")
        if isinstance(scraped_username, str) and scraped_username.strip():
            return scraped_username.strip().lower()
    return None


def _worker_version_mismatch() -> dict | None:
    if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
        return None
    version = task_manager.get_worker_version_status(settings.worker_protocol_version, backend_git_sha())
    return version if version.get("mismatch") else None


@router.post("/heartbeat")
async def worker_heartbeat(request: Request, x_worker_token: str | None = Header(default=None)):
    """Worker liveness ping — keeps /api/scrape-profile from reporting offline."""
    _require_worker_token(x_worker_token)
    try:
        body = await request.json()
    except Exception:
        body = {}
    task_manager.record_worker_heartbeat(body if isinstance(body, dict) else {})
    return {"ok": True}


@router.post("/startup")
async def worker_startup(request: Request, x_worker_token: str | None = Header(default=None)):
    """Record a worker process startup so the admin dashboard can show lifecycle."""
    _require_worker_token(x_worker_token)
    try:
        body = await request.json()
    except Exception:
        body = {}
    task_manager.record_worker_startup(body if isinstance(body, dict) else {})
    await log_worker_event("startup", body if isinstance(body, dict) else {})
    return {"ok": True}


@router.post("/shutdown")
async def worker_shutdown(request: Request, x_worker_token: str | None = Header(default=None)):
    """Record graceful worker shutdown. Abrupt power/network loss is inferred by heartbeat expiry."""
    _require_worker_token(x_worker_token)
    try:
        body = await request.json()
    except Exception:
        body = {}
    task_manager.record_worker_shutdown(body if isinstance(body, dict) else {})
    await log_worker_event("shutdown", body if isinstance(body, dict) else {})
    return {"ok": True}


@router.post("/self-test")
async def worker_self_test(request: Request, x_worker_token: str | None = Header(default=None)):
    """Record the result of an optional desktop-side real scrape smoke test."""
    _require_worker_token(x_worker_token)
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error_code": "invalid_body", "message": "Body must be an object."})
    task_manager.record_worker_self_test(body)
    return {"ok": True}


@router.get("/control")
async def worker_control(
    last_seen_restart_token: str | None = None,
    x_worker_token: str | None = Header(default=None),
):
    """Supervisor control poll. Does not update Python worker heartbeat."""
    _require_worker_token(x_worker_token)
    await dashboard_settings.load_worker_control_state()
    return task_manager.record_supervisor_poll(last_seen_restart_token)


@router.post("/supervisor")
async def worker_supervisor_report(request: Request, x_worker_token: str | None = Header(default=None)):
    """Record launcher/supervisor status without marking the scraper child online."""
    _require_worker_token(x_worker_token)
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error_code": "invalid_body", "message": "Body must be an object."})
    return {"ok": True, "supervisor": task_manager.record_supervisor_report(body)}


@router.get("/scrape/next")
async def claim_next_scrape(x_worker_token: str | None = Header(default=None)):
    """Claim the oldest queued scrape job, or return {job: null} if none."""
    _require_worker_token(x_worker_token)
    await dashboard_settings.load_worker_control_state()
    if task_manager.is_worker_paused():
        return {"job": None, "paused": True, "desired_state": "pause"}
    mismatch = _worker_version_mismatch()
    if mismatch:
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "worker_version_mismatch",
                "message": "Desktop worker must be updated before claiming new jobs.",
                "version": mismatch,
            },
        )
    job = task_manager.claim_next_scrape_job()
    if job is None:
        return {"job": None}
    logger.info("Worker claimed scrape job %s for @%s", job.task_id, job.username)
    return {"job": {"task_id": job.task_id, "username": job.username, "avatar_only": job.avatar_only}}


@router.post("/scrape/{task_id}/event")
async def record_scrape_event(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Append worker/scraper timeline events to the backend task state."""
    _require_worker_token(x_worker_token)
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "scrape":
        raise HTTPException(status_code=404, detail={"error_code": "task_not_found", "message": "Scrape job not found or expired."})
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error_code": "invalid_body", "message": "Body must be an object."})

    events = body.get("events")
    if isinstance(events, list):
        for event in events:
            if isinstance(event, dict):
                task_manager.append_task_event_payload(task_id, event)
    else:
        stage = str(body.get("stage") or "").strip()
        if not stage:
            raise HTTPException(status_code=400, detail={"error_code": "invalid_event", "message": "Body must include a stage."})
        task_manager.append_task_event(
            task_id,
            stage,
            str(body.get("message") or ""),
            elapsed_seconds=body.get("elapsed_seconds") if isinstance(body.get("elapsed_seconds"), (int, float)) else None,
            level=str(body.get("level") or "info"),
            metrics=body.get("metrics") if isinstance(body.get("metrics"), dict) else None,
        )
    return {"ok": True}


@router.post("/scrape/{task_id}/complete")
async def complete_scrape(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Store final stats for a scrape job so /api/progress/{task_id} returns done."""
    _require_worker_token(x_worker_token)
    body = await request.json()
    stats = body.get("stats")
    if not isinstance(stats, dict):
        raise HTTPException(status_code=400, detail={"error_code": "invalid_stats", "message": "Body must include a stats object."})
    telemetry = _request_telemetry(body)
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "scrape":
        persist_run(
            _request_username(body, stats),
            "desktop-worker",
            stats,
            ok=True,
            task_id=task_id,
            trace_events=_request_trace_events(body),
            telemetry=telemetry,
        )
        logger.warning("Worker completed orphan scrape job %s; persisted run without task state", task_id)
        return {"ok": True, "orphan": True}

    _merge_worker_trace(task_id, body)
    task_manager.append_task_event(task_id, "completed", "Worker posted final stats", level="info")
    task_manager.set_task_done(
        task_id,
        {"status": "success", "stats": stats},
        telemetry,
    )
    task = task_manager.get_task_state(task_id)
    if task:
        task_manager.append_task_event(task_id, "persisted", "Run log persisted on backend", level="info")
        persist_run(
            task.username,
            "desktop-worker",
            stats,
            ok=True,
            task_id=task_id,
            trace_events=task.trace_events,
            telemetry=_task_telemetry(task),
        )
    logger.info("Worker completed scrape job %s", task_id)
    await log_worker_event("job_completed", {
        "task_id": task_id,
        "username": task.username if task else _request_username(body, stats),
        "total_films": stats.get("total_films"),
        "duration_seconds": telemetry.get("duration_seconds"),
    })
    return {"ok": True}


@router.post("/scrape/{task_id}/failed")
async def fail_scrape(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Mark a scrape job failed with a frontend-readable error message."""
    _require_worker_token(x_worker_token)
    body = await request.json()
    message = str(body.get("message") or "Desktop worker failed to scrape this profile.")
    telemetry = _request_telemetry(body)
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "scrape":
        persist_run(
            _request_username(body),
            "desktop-worker",
            {},
            ok=False,
            error_message=message,
            task_id=task_id,
            trace_events=_request_trace_events(body),
            telemetry=telemetry,
        )
        logger.warning("Worker failed orphan scrape job %s; persisted run without task state: %s", task_id, message)
        return {"ok": True, "orphan": True}

    _merge_worker_trace(task_id, body)
    error_stage = telemetry.get("error_stage")
    task_manager.append_task_event(task_id, error_stage or "failed", message, level="error")
    task_manager.set_task_failed(task_id, message, telemetry)
    task = task_manager.get_task_state(task_id)
    if task:
        task_manager.append_task_event(task_id, "persisted", "Failure run log persisted on backend", level="info")
        persist_run(
            task.username,
            "desktop-worker",
            {},
            ok=False,
            error_message=message,
            task_id=task_id,
            trace_events=task.trace_events,
            telemetry=_task_telemetry(task),
        )
    logger.warning("Worker reported scrape job %s failed: %s", task_id, message)
    await log_worker_event("job_failed", {
        "task_id": task_id,
        "username": task.username if task else _request_username(body),
        "error_message": message,
        "error_type": telemetry.get("error_type"),
        "error_stage": telemetry.get("error_stage"),
        "error_code": telemetry.get("error_code"),
        "duration_seconds": telemetry.get("duration_seconds"),
    })
    return {"ok": True}


@router.get("/watchlist/next")
async def claim_next_watchlist(x_worker_token: str | None = Header(default=None)):
    """Claim the oldest queued watchlist/date-night scrape job, or return {job: null}."""
    _require_worker_token(x_worker_token)
    await dashboard_settings.load_worker_control_state()
    if task_manager.is_worker_paused():
        return {"job": None, "paused": True, "desired_state": "pause"}
    mismatch = _worker_version_mismatch()
    if mismatch:
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": "worker_version_mismatch",
                "message": "Desktop worker must be updated before claiming new jobs.",
                "version": mismatch,
            },
        )
    job = claim_next_watchlist_job()
    if job is None:
        return {"job": None}
    logger.info("Worker claimed watchlist job %s type=%s users=%s", job.task_id, job.job_type, job.usernames)
    return {"job": {"task_id": job.task_id, "job_type": job.job_type, "usernames": job.usernames}}


@router.post("/watchlist/{task_id}/complete")
async def complete_watchlist(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Receive raw scraped film lists from the worker so the backend can finish processing."""
    _require_worker_token(x_worker_token)
    body = await request.json()
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error_code": "invalid_body", "message": "Body must be an object."})
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "watchlist":
        raise HTTPException(status_code=404, detail={"error_code": "task_not_found", "message": "Watchlist job not found."})
    task_manager.set_task_done(task_id, body)
    logger.info("Worker completed watchlist job %s", task_id)
    return {"ok": True}


@router.post("/watchlist/{task_id}/failed")
async def fail_watchlist(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Mark a watchlist scrape job as failed."""
    _require_worker_token(x_worker_token)
    body = await request.json()
    message = str(body.get("message") or "Desktop worker failed to scrape watchlist.")
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "watchlist":
        raise HTTPException(status_code=404, detail={"error_code": "task_not_found", "message": "Watchlist job not found."})
    task_manager.set_task_failed(task_id, message)
    logger.warning("Worker reported watchlist job %s failed: %s", task_id, message)
    return {"ok": True}
