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

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

logger = logging.getLogger("letterboxd_wrapped.admin")

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "mw3169305")

RUNS_DIR = Path("runs")
WATCHLIST_RUNS_DIR = Path("watchlist_runs")
DATE_NIGHT_RUNS_DIR = Path("date_night_runs")


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
            items.append(data)
        except Exception as exc:
            logger.warning("Failed to parse %s: %s", f.name, exc)
    return items


@router.get("/admin", response_class=HTMLResponse)
async def admin_login(request: Request):
    return templates.TemplateResponse("admin_login.html", {"request": request})


@router.get("/admin/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    _require_admin(request)
    runs = _load_json_dir(RUNS_DIR, limit=50)
    watchlist_runs = _load_json_dir(WATCHLIST_RUNS_DIR, limit=50)
    date_night_runs = _load_json_dir(DATE_NIGHT_RUNS_DIR, limit=50)
    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "runs": runs,
            "watchlist_runs": watchlist_runs,
            "date_night_runs": date_night_runs,
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
    return {
        "runs": _load_json_dir(RUNS_DIR, limit),
        "watchlist_runs": _load_json_dir(WATCHLIST_RUNS_DIR, limit),
        "date_night_runs": _load_json_dir(DATE_NIGHT_RUNS_DIR, limit),
    }
