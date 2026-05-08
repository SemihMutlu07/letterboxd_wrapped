from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app import task_manager
from app.routes.feedback import _parse_letterboxd_username
from app.services.analysis import process_comprehensive_letterboxd_data
from app.services.scraper import (
    check_profile_exists,
    diary_to_csv_dicts,
    merge_scraped_films,
    scrape_profile_sources,
)

logger = logging.getLogger("letterboxd_wrapped.analyze")

router = APIRouter()


def _persist_run(username: Optional[str], source: str, stats: dict) -> None:
    """Best-effort local run log under backend/runs/{username}-{iso-ts}.json.

    Never raises — logging failures don't break the user's request. The directory
    is gitignored via repo-root .gitignore (`**/runs/`).
    """
    try:
        runs_dir = Path("runs")
        runs_dir.mkdir(parents=True, exist_ok=True)
        safe_user = re.sub(r"[^a-z0-9_-]", "_", (username or "anon").lower()) or "anon"
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        path = runs_dir / f"{safe_user}-{ts}.json"
        payload = {
            "username": username,
            "source": source,
            "timestamp": ts,
            "total_films": stats.get("total_films"),
            "sinefil_meter": stats.get("sinefil_meter"),
            "stats": stats,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info("Persisted run: %s (source=%s, films=%s)", path, source, payload["total_films"])
    except Exception as exc:
        logger.warning("Failed to persist run for %s: %s", username, exc)

_REQUIRED_FILES = [
    "diary.csv", "ratings.csv", "watched.csv", "reviews.csv",
    "watchlist.csv", "films.csv", "comments.csv", "profile.csv",
]


def _find_csv_files(directory: Path) -> dict:
    csv_found: dict = {}
    for root, _dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(".csv"):
                for req in _REQUIRED_FILES:
                    if req not in csv_found and req.split(".")[0] in file.lower():
                        csv_found[req] = os.path.join(root, file)
                        break
    return csv_found


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
        task_manager.set_task_done(task_id, {"status": "success", "stats": stats})
        _persist_run(username, "upload", stats)
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
    This is best-effort and depends on Letterboxd's public HTML remaining accessible.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "invalid_json", "message": "Request body must be valid JSON."},
        )
    username = str(body.get("username") or "").strip().lower()
    if not username or not re.match(r"^[a-z0-9_]+$", username):
        raise HTTPException(
            status_code=400,
            detail={"error_code": "invalid_username", "message": "Please enter a valid Letterboxd username."},
        )

    try:
        exists = await check_profile_exists(username)
    except Exception as exc:
        logger.warning("check_profile_exists failed for %s: %s", username, exc)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "scrape_unreachable", "message": "Could not reach Letterboxd. Try again in a moment."},
        )
    if not exists:
        raise HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": f"Letterboxd user '{username}' not found."},
        )

    try:
        diary_films, grid_films = await scrape_profile_sources(username, max_pages=60)
    except Exception as exc:
        logger.warning("Scraping failed for %s: %s", username, exc)
        raise HTTPException(
            status_code=502,
            detail={"error_code": "scrape_failed", "message": "Letterboxd blocked or returned an unexpected page. Try again later."},
        )

    request_dir: Optional[Path] = None
    try:
        logger.info("scrape_profile: %s diary=%d grid=%d", username, len(diary_films), len(grid_films))
        films = merge_scraped_films(diary_films, grid_films)
        csv_dicts = diary_to_csv_dicts(films)
        if not films or not csv_dicts["watched"]:
            raise HTTPException(
                status_code=400,
                detail={"error_code": "no_films", "message": f"No public films found for @{username}. The profile may be private or empty."},
            )

        request_dir = Path("uploads") / str(uuid.uuid4())
        request_dir.mkdir(parents=True, exist_ok=True)
        watched_path = request_dir / "watched.csv"
        ratings_path = request_dir / "ratings.csv"

        import pandas as pd

        pd.DataFrame(csv_dicts["watched"]).to_csv(watched_path, index=False)
        csv_files = {"watched.csv": str(watched_path)}

        if csv_dicts["ratings"]:
            pd.DataFrame(csv_dicts["ratings"]).to_csv(ratings_path, index=False)
            csv_files["ratings.csv"] = str(ratings_path)

        stats = await process_comprehensive_letterboxd_data(request.app.state.aiohttp_session, csv_files)
        stats["scraped_username"] = username
        stats["scraped_film_count"] = len(films)
        stats["scraped_diary_count"] = len(diary_films)
        stats["scraped_grid_only_count"] = len(films) - len(diary_films)
        _persist_run(username, "scrape", stats)
        return {"status": "success", "stats": stats}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("scrape_profile failed for %s", username)
        raise HTTPException(
            status_code=500,
            detail={"error_code": "analysis_failed", "message": f"Analysis failed: {type(exc).__name__}: {exc}"},
        )
    finally:
        if request_dir is not None:
            shutil.rmtree(request_dir, ignore_errors=True)


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
