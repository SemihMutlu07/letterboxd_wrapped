from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app import task_manager
from app.config import settings
from app.routes.feedback import _parse_letterboxd_username
from app.services.analysis import process_comprehensive_letterboxd_data
from app.services import dashboard_settings
from app.services.scrape_pipeline import ScrapeAnalysisEmpty, scrape_and_analyze
from app.services.run_log import persist_run

logger = logging.getLogger("letterboxd_wrapped.analyze")

router = APIRouter()

_REQUIRED_FILES = [
    "diary.csv", "ratings.csv", "watched.csv", "reviews.csv",
    "watchlist.csv", "films.csv", "comments.csv", "profile.csv",
]


def _find_csv_files(directory: Path) -> dict:
    csv_found: dict = {}
    for root, _dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(".csv"):
                logger.debug("[upload-debug] Found CSV: %s", file)
                for req in _REQUIRED_FILES:
                    if req not in csv_found and req.split(".")[0] in file.lower():
                        csv_found[req] = os.path.join(root, file)
                        logger.info("[upload-debug] Matched %s → %s", req, file)
                        break
    if not csv_found:
        logger.warning("[upload-debug] No matching CSV files in %s. Files found: %s", directory, list(os.walk(directory)))
    return csv_found


AVATAR_JOB_TIMEOUT_SECONDS = 20
AVATAR_JOB_POLL_SECONDS = 1


async def _fetch_avatar_best_effort(username: str) -> Optional[str]:
    """Queue a lightweight avatar-only job on the desktop worker and wait briefly
    for it. Best-effort: any failure or timeout just yields None (frontend already
    falls back to a placeholder), it must never fail the CSV/ZIP analysis."""
    if not settings.desktop_worker_enabled:
        return None
    if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
        return None
    try:
        job_task_id = task_manager.create_scrape_job(username, avatar_only=True)
        loop = asyncio.get_event_loop()
        deadline = loop.time() + AVATAR_JOB_TIMEOUT_SECONDS
        while loop.time() < deadline:
            job = task_manager.get_task_state(job_task_id)
            if job is None or job.status == "failed":
                return None
            if job.status == "done":
                return (job.result or {}).get("stats", {}).get("profile_avatar_url")
            await asyncio.sleep(AVATAR_JOB_POLL_SECONDS)
    except Exception:
        logger.warning("Avatar fetch failed for @%s", username, exc_info=True)
    return None


async def _run_analysis(
    task_id: str,
    session,
    csv_files: dict,
    request_dir: Path,
    username: Optional[str] = None,
) -> None:
    try:
        task_manager.set_task_running(task_id)
        stats = await process_comprehensive_letterboxd_data(session, csv_files, task_id)
        if username:
            stats["profile_avatar_url"] = await _fetch_avatar_best_effort(username)
        task_manager.set_task_done(task_id, {"status": "success", "stats": stats})
        persist_run(username, "upload", stats, ok=True, task_id=task_id)
    except Exception as exc:
        task_manager.set_task_failed(task_id, str(exc))
    finally:
        shutil.rmtree(request_dir, ignore_errors=True)


@router.post("/api/analyze", status_code=202)
async def analyze_data(request: Request, files: List[UploadFile] = File(...)):
    """
    Accept a Letterboxd export (ZIP or CSVs) and start analysis in the background.
    Returns 202 Accepted with a task_id for polling.
    """
    if not files:
        raise HTTPException(status_code=400, detail={"error_code": "no_files", "message": "No files uploaded."})

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    request_dir = upload_dir / str(uuid.uuid4())
    request_dir.mkdir(exist_ok=True)

    csv_files: dict = {}

    try:
        if len(files) == 1 and files[0].filename and files[0].filename.lower().endswith((".zip", ".utc")):
            with zipfile.ZipFile(files[0].file, "r") as zf:
                zf.extractall(request_dir)
        elif all(f.filename and f.filename.lower().endswith(".csv") for f in files):
            for uf in files:
                safe_name = Path(uf.filename).name
                (request_dir / safe_name).write_bytes(await uf.read())
        else:
            shutil.rmtree(request_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail={"error_code": "invalid_input", "message": "Upload a single ZIP file or multiple CSV files."},
            )

        csv_files = _find_csv_files(request_dir)
        if not csv_files:
            shutil.rmtree(request_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail={"error_code": "missing_required_files", "message": "No Letterboxd CSV files found."},
            )

    except zipfile.BadZipFile:
        shutil.rmtree(request_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail={"error_code": "corrupt_zip", "message": "Invalid ZIP archive."})
    except HTTPException:
        raise

    detected_username: Optional[str] = None
    for uf in files:
        if uf.filename:
            detected_username = _parse_letterboxd_username(uf.filename)
            if detected_username:
                break

    task_id = task_manager.create_task_state()
    session = request.app.state.aiohttp_session
    asyncio.create_task(_run_analysis(task_id, session, csv_files, request_dir, detected_username))

    return JSONResponse(status_code=202, content={"task_id": task_id, "status": "pending"})


@router.post("/api/scrape-profile")
async def scrape_profile(request: Request):
    """
    Scrape a public Letterboxd profile and run the same analysis pipeline.

    When DESKTOP-WORKER mode is enabled (settings.worker_token set), this does
    NOT scrape inline. It queues a job for the outbound desktop worker and
    returns 202 {task_id}; the frontend then polls /api/progress/{task_id}.
    Without a worker token it scrapes synchronously (local dev / fallback).
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "invalid_json", "message": "Request body must be valid JSON."},
        )
    raw_username = str(body.get("username") or "").strip()
    username = raw_username.lower()
    if not username or not re.match(r"^[a-z0-9_]+$", username):
        logger.warning("scrape-profile invalid_username: raw=%r sanitized=%r", raw_username, username if username else "<empty>")
        raise HTTPException(
            status_code=400,
            detail={"error_code": "invalid_username", "message": "Please enter a valid Letterboxd username."},
        )

    # Desktop-worker mode: route the heavy scrape to the always-on desktop worker.
    if settings.desktop_worker_enabled:
        await dashboard_settings.load_worker_control_state()
        if task_manager.is_worker_paused():
            logger.warning("scrape-profile desktop_worker_paused for %s", username)
            persist_run(
                username,
                "scrape",
                {},
                ok=False,
                error_message="The desktop scraper was paused; scrape was not attempted.",
                error_type="desktop_worker_paused",
                error_stage="desktop_worker_paused",
            )
            raise HTTPException(
                status_code=503,
                detail={
                    "error_code": "desktop_worker_paused",
                    "message": "The desktop scraper is paused for maintenance. Upload your Letterboxd export for a full Wrapped, or try again shortly.",
                },
            )
        if not task_manager.is_worker_online(settings.worker_heartbeat_max_age_seconds):
            logger.warning("scrape-profile desktop_worker_offline for %s", username)
            # Record the rejected attempt so the dashboard shows offline outages,
            # not just successful/worker-reported runs.
            persist_run(
                username,
                "scrape",
                {},
                ok=False,
                error_message="The desktop scraper was offline; scrape was not attempted.",
                error_type="desktop_worker_offline",
                error_stage="desktop_worker_offline",
            )
            raise HTTPException(
                status_code=503,
                detail={
                    "error_code": "desktop_worker_offline",
                    "message": "The desktop scraper is offline right now. Upload your Letterboxd export for a full Wrapped, or try again shortly.",
                },
            )
        task_id = task_manager.create_scrape_job(username)
        logger.info("Queued scrape job %s for @%s", task_id, username)
        return JSONResponse(status_code=202, content={"task_id": task_id, "status": "pending"})

    # Synchronous fallback: no desktop worker configured (local dev).
    try:
        stats = await scrape_and_analyze(request.app.state.aiohttp_session, username)
    except ScrapeAnalysisEmpty as exc:
        if exc.scraper_ok:
            raise HTTPException(
                status_code=500,
                detail={"error_code": "analysis_failed", "message": f"Scraped @{username} but analysis pipeline returned empty. Please try again."},
            )
        raise HTTPException(
            status_code=400,
            detail={"error_code": "no_films", "message": f"No public films found for @{username}. The profile may be private, empty, or temporarily blocked by Letterboxd."},
        )
    except ValueError as exc:
        # Re-raise 404s / 403s / rate-limits from scraper as service-unavailable
        # (not 400/404) so the frontend shows the correct guidance message.
        logger.warning("Scrape blocked/value error for %s: %s", username, exc)
        msg = str(exc)
        if "Letterboxd is blocking" in msg:
            raise HTTPException(
                status_code=503,
                detail={"error_code": "scrape_blocked", "message": msg},
            )
        raise HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": f"{exc}"},
        )
    except Exception as exc:
        logger.exception("Scraping failed for %s: %s", username, exc)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "scrape_failed", "message": f"Letterboxd returned an unexpected response for @{username}. (Debug: {type(exc).__name__}: {exc}) Try again later."},
        )

    persist_run(username, "scrape", stats, ok=True)
    return {"status": "success", "stats": stats}


@router.get("/api/progress/{task_id}")
async def get_task_progress(task_id: str):
    """Poll analysis progress and retrieve the final result when done."""
    task = task_manager.get_task_state(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found or expired")
    return {
        "task_id": task.task_id,
        "status": task.status,
        "stage": task.stage,
        "message": task.message,
        "progress": task.progress,
        "total": task.total,
        "result": task.result,
        "error": task.error,
        "duration_seconds": task.duration_seconds,
        "queue_wait_seconds": task.queue_wait_seconds,
        "worker_seconds": task.worker_seconds,
        "scrape_seconds": task.scrape_seconds,
        "analysis_seconds": task.analysis_seconds,
        "postback_seconds": task.postback_seconds,
        "error_type": task.error_type,
        "error_stage": task.error_stage,
        "error_code": task.error_code,
        "trace_events": task.trace_events,
    }


@router.get("/api/progress")
async def get_progress_legacy():
    """Legacy progress endpoint — returns the most recent active task state."""
    running = sorted(
        [t for t in task_manager._tasks.values() if t.status in ("pending", "running")],
        key=lambda t: t.created_at,
        reverse=True,
    )
    if running:
        t = running[0]
        return {"stage": t.stage, "message": t.message, "progress": t.progress, "total": t.total}
    return {"stage": "idle", "message": "Ready to analyze", "progress": 0, "total": 0}
