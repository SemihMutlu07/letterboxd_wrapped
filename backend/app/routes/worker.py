"""
Authenticated endpoints for the outbound desktop scrape worker.

The desktop machine is not publicly exposed; it runs a long-lived process that
polls these endpoints to claim queued scrape jobs, runs the local scrape +
analysis pipeline, and posts results back. All endpoints require a shared secret
in the `X-Worker-Token` header matching settings.worker_token.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app import task_manager
from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.worker")

router = APIRouter(prefix="/api/worker")


def _require_worker_token(x_worker_token: str | None) -> None:
    """Reject the request unless a worker token is configured and matches."""
    if not settings.worker_token or x_worker_token != settings.worker_token:
        raise HTTPException(
            status_code=401,
            detail={"error_code": "unauthorized", "message": "Invalid or missing worker token."},
        )


@router.post("/heartbeat")
async def worker_heartbeat(x_worker_token: str | None = Header(default=None)):
    """Worker liveness ping — keeps /api/scrape-profile from reporting offline."""
    _require_worker_token(x_worker_token)
    task_manager.record_worker_heartbeat()
    return {"ok": True}


@router.get("/scrape/next")
async def claim_next_scrape(x_worker_token: str | None = Header(default=None)):
    """Claim the oldest queued scrape job, or return {job: null} if none."""
    _require_worker_token(x_worker_token)
    job = task_manager.claim_next_scrape_job()
    if job is None:
        return {"job": None}
    logger.info("Worker claimed scrape job %s for @%s", job.task_id, job.username)
    return {"job": {"task_id": job.task_id, "username": job.username}}


@router.post("/scrape/{task_id}/complete")
async def complete_scrape(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Store final stats for a scrape job so /api/progress/{task_id} returns done."""
    _require_worker_token(x_worker_token)
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "scrape":
        raise HTTPException(status_code=404, detail={"error_code": "task_not_found", "message": "Scrape job not found or expired."})
    body = await request.json()
    stats = body.get("stats")
    if not isinstance(stats, dict):
        raise HTTPException(status_code=400, detail={"error_code": "invalid_stats", "message": "Body must include a stats object."})
    task_manager.set_task_done(task_id, {"status": "success", "stats": stats})
    logger.info("Worker completed scrape job %s", task_id)
    return {"ok": True}


@router.post("/scrape/{task_id}/failed")
async def fail_scrape(task_id: str, request: Request, x_worker_token: str | None = Header(default=None)):
    """Mark a scrape job failed with a frontend-readable error message."""
    _require_worker_token(x_worker_token)
    task = task_manager.get_task_state(task_id)
    if task is None or task.kind != "scrape":
        raise HTTPException(status_code=404, detail={"error_code": "task_not_found", "message": "Scrape job not found or expired."})
    body = await request.json()
    message = str(body.get("message") or "Desktop worker failed to scrape this profile.")
    task_manager.set_task_failed(task_id, message)
    logger.warning("Worker reported scrape job %s failed: %s", task_id, message)
    return {"ok": True}
