"""
Admin dashboard for MoviesWrapped.
Reads from backend/runs/ + watchlist_runs/ + date_night_runs/ JSON logs.
Auth: ?key=secret query param.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app import task_manager
from app.config import settings
from app.services.run_log import RUNS_DIR

logger = logging.getLogger("letterboxd_wrapped.admin")

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "mw3169305")

WATCHLIST_RUNS_DIR = Path("watchlist_runs")
DATE_NIGHT_RUNS_DIR = Path("date_night_runs")


def _num(value: Any) -> float | None:
    return value if isinstance(value, (int, float)) else None


def _annotate_analysis_run(data: dict[str, Any]) -> None:
    timings = {
        "queue": _num(data.get("queue_wait_seconds")),
        "scrape": _num(data.get("scrape_seconds")),
        "analysis": _num(data.get("analysis_seconds")),
        "postback": _num(data.get("postback_seconds")),
    }
    known_timings = {key: value for key, value in timings.items() if value is not None}
    if known_timings:
        bottleneck, seconds = max(known_timings.items(), key=lambda item: item[1])
        data["bottleneck_stage"] = bottleneck
        data["bottleneck_seconds"] = round(seconds, 1)
    else:
        data["bottleneck_stage"] = None
        data["bottleneck_seconds"] = None

    total_films = _num(data.get("total_films"))
    duration = _num(data.get("duration_seconds"))
    scrape = _num(data.get("scrape_seconds"))
    analysis = _num(data.get("analysis_seconds"))
    if total_films and total_films > 0:
        if duration is not None:
            data["duration_seconds_per_film"] = round(duration / total_films, 3)
        if scrape is not None:
            data["scrape_seconds_per_film"] = round(scrape / total_films, 3)
        if analysis is not None:
            data["analysis_seconds_per_film"] = round(analysis / total_films, 3)


def _backend_git_sha() -> str | None:
    return os.getenv("BACKEND_GIT_SHA") or os.getenv("RENDER_GIT_COMMIT") or os.getenv("GIT_COMMIT")


def _require_admin(request: Request) -> None:
    key = request.query_params.get("key") or request.headers.get("x-admin-key")
    if key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


def _load_json_dir(directory: Path, limit: int = 100) -> list[dict[str, Any]]:
    if not directory.exists():
        return []
    files = sorted(directory.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    items: list[dict[str, Any]] = []
    for f in files[:limit]:
        try:
            data = json.loads(f.read_text())
            stat = f.stat()
            data["_filename"] = f.name
            data["_mtime"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
            data["_size_kb"] = round(stat.st_size / 1024, 1)
            if directory == RUNS_DIR:
                _annotate_analysis_run(data)
            items.append(data)
        except Exception as exc:
            logger.warning("Failed to parse %s: %s", f.name, exc)
    return items


async def _load_runs_supabase(limit: int = 50) -> list[dict[str, Any]]:
    """Read analysis runs from Supabase ops_runs (durable across Render restarts).
    Falls back to [] on any error so the dashboard still renders."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/ops_runs",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {settings.supabase_anon_key}",
                },
                params={"select": "created_at,payload", "order": "created_at.desc", "limit": str(limit)},
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as exc:
        logger.warning("Failed to load runs from Supabase: %s", exc)
        return []
    items: list[dict[str, Any]] = []
    for row in rows:
        data = row.get("payload")
        if not isinstance(data, dict):
            continue
        data["_mtime"] = row.get("created_at")
        _annotate_analysis_run(data)
        items.append(data)
    return items


async def _load_watchlist_runs_supabase(limit: int = 50) -> list[dict[str, Any]]:
    """Read watchlist comparison runs from Supabase ops_watchlist_runs."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/ops_watchlist_runs",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {settings.supabase_anon_key}",
                },
                params={"select": "created_at,payload", "order": "created_at.desc", "limit": str(limit)},
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as exc:
        logger.warning("Failed to load watchlist runs from Supabase: %s", exc)
        return []
    items: list[dict[str, Any]] = []
    for row in rows:
        data = row.get("payload")
        if not isinstance(data, dict):
            continue
        data["_mtime"] = row.get("created_at")
        items.append(data)
    return items


async def _load_date_night_runs_supabase(limit: int = 50) -> list[dict[str, Any]]:
    """Read date night recommendation runs from Supabase ops_date_night_runs."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/ops_date_night_runs",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {settings.supabase_anon_key}",
                },
                params={"select": "created_at,payload", "order": "created_at.desc", "limit": str(limit)},
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as exc:
        logger.warning("Failed to load date night runs from Supabase: %s", exc)
        return []
    items: list[dict[str, Any]] = []
    for row in rows:
        data = row.get("payload")
        if not isinstance(data, dict):
            continue
        data["_mtime"] = row.get("created_at")
        items.append(data)
    return items


async def _load_analysis_runs(limit: int = 50) -> list[dict[str, Any]]:
    if settings.supabase_enabled:
        return await _load_runs_supabase(limit)
    return _load_json_dir(RUNS_DIR, limit=limit)


@router.get("/admin", response_class=HTMLResponse)
async def admin_login(request: Request):
    return templates.TemplateResponse("admin_login.html", {"request": request})


@router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    _require_admin(request)
    runs = await _load_analysis_runs(limit=50)
    if settings.supabase_enabled:
        watchlist_runs = await _load_watchlist_runs_supabase(limit=50)
        date_night_runs = await _load_date_night_runs_supabase(limit=50)
    else:
        watchlist_runs = _load_json_dir(WATCHLIST_RUNS_DIR, limit=50)
        date_night_runs = _load_json_dir(DATE_NIGHT_RUNS_DIR, limit=50)
    worker_status = task_manager.get_worker_status(
        settings.worker_heartbeat_max_age_seconds,
        expected_protocol_version=settings.worker_protocol_version,
        backend_git_sha=_backend_git_sha(),
    )
    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "runs": runs,
            "watchlist_runs": watchlist_runs,
            "date_night_runs": date_night_runs,
            "worker_status": worker_status,
            "worker_enabled": settings.desktop_worker_enabled,
            "key": request.query_params.get("key"),
        },
    )


@router.get("/admin/run/{filename}", response_class=HTMLResponse)
async def admin_run_detail(request: Request, filename: str):
    _require_admin(request)
    safe_name = Path(filename).name
    path = RUNS_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    data = json.loads(path.read_text())
    return templates.TemplateResponse(
        "admin_run.html",
        {"request": request, "run": data, "filename": safe_name, "key": request.query_params.get("key")},
    )


@router.get("/admin/api/runs")
async def admin_api_runs(request: Request, limit: int = 50):
    """JSON API for the admin dashboard."""
    _require_admin(request)
    if settings.supabase_enabled:
        watchlist_runs = await _load_watchlist_runs_supabase(limit)
        date_night_runs = await _load_date_night_runs_supabase(limit)
    else:
        watchlist_runs = _load_json_dir(WATCHLIST_RUNS_DIR, limit)
        date_night_runs = _load_json_dir(DATE_NIGHT_RUNS_DIR, limit)
    return {
        "runs": await _load_analysis_runs(limit),
        "watchlist_runs": watchlist_runs,
        "date_night_runs": date_night_runs,
    }


@router.get("/admin/api/worker")
async def admin_api_worker(request: Request):
    """JSON API for desktop worker dashboard status."""
    _require_admin(request)
    return {
        "enabled": settings.desktop_worker_enabled,
        "status": task_manager.get_worker_status(
            settings.worker_heartbeat_max_age_seconds,
            expected_protocol_version=settings.worker_protocol_version,
            backend_git_sha=_backend_git_sha(),
        ),
    }
