from __future__ import annotations

import asyncio
import os
import re
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app import task_manager
from app.services.analysis import process_comprehensive_letterboxd_data
from app.services.scraper import (
    check_profile_exists,
    diary_to_csv_dicts,
    merge_scraped_films,
    scrape_diary,
    scrape_films_grid,
)

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
) -> None:
    try:
        task_manager.set_task_running(task_id)
        stats = await process_comprehensive_letterboxd_data(session, csv_files, task_id)
        task_manager.set_task_done(task_id, {"status": "success", "stats": stats})
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

    task_id = task_manager.create_task_state()
    session = request.app.state.aiohttp_session
    asyncio.create_task(_run_analysis(task_id, session, csv_files, request_dir))

    return JSONResponse(status_code=202, content={"task_id": task_id, "status": "pending"})


@router.post("/api/scrape-profile")
async def scrape_profile(request: Request):
    """
    Scrape a public Letterboxd profile and run the same analysis pipeline.
    This is best-effort and depends on Letterboxd's public HTML remaining accessible.
    """
    body = await request.json()
    username = str(body.get("username") or "").strip().lower()
    if not username or not re.match(r"^[a-z0-9_]+$", username):
        raise HTTPException(
            status_code=400,
            detail={"error_code": "invalid_username", "message": "Please enter a valid Letterboxd username."},
        )

    if not await check_profile_exists(username):
        raise HTTPException(
            status_code=404,
            detail={"error_code": "user_not_found", "message": f"Letterboxd user '{username}' not found."},
        )

    diary_films = await scrape_diary(username, max_pages=60)
    grid_films = await scrape_films_grid(username, max_pages=60)
    films = merge_scraped_films(diary_films, grid_films)

    if not films:
        raise HTTPException(
            status_code=400,
            detail={"error_code": "no_films", "message": f"No public films found for @{username}."},
        )

    request_dir = Path("uploads") / str(uuid.uuid4())
    request_dir.mkdir(parents=True, exist_ok=True)

    try:
        csv_dicts = diary_to_csv_dicts(films)
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
        return {"status": "success", "stats": stats}
    finally:
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
