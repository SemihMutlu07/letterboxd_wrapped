from __future__ import annotations

import asyncio

from app import task_manager
from app.models.recommend import DateNightResponse, MutualProfile
from app.services.recommender import (
    build_mutual_profile,
    compare_watchlist_sets,
    discover_date_night_recommendations,
    enrich_films,
    enrich_films_concurrent,
    public_film,
)
from app.services.scraper import merge_scraped_films


def _is_current_processing_task(task_id: str, task) -> bool:
    return (
        task_manager.get_task_state(task_id) is task
        and task.status == "running"
        and task.stage == "processing"
    )


async def finalize_watchlist_job(task_id: str, session) -> None:
    """Turn a worker's raw scrape payload into the public API result."""
    task = task_manager.get_task_state(task_id)
    if task is None or task.status in {"done", "failed"}:
        return
    raw = task.result or {}
    task.result = None
    try:
        if task.job_type == "watchlist_compare":
            result = compare_watchlist_sets(raw.get("first_watchlist", []), raw.get("second_watchlist", []))
            common, first_only, second_only = await asyncio.gather(
                enrich_films_concurrent(session, result["common"], limit=50),
                enrich_films_concurrent(session, result["first_only"], limit=50),
                enrich_films_concurrent(session, result["second_only"], limit=50),
            )
            result.update(
                common=[public_film(f) for f in common],
                first_only=[public_film(f) for f in first_only],
                second_only=[public_film(f) for f in second_only],
            )
            final = {"status": "success", "users": task.usernames, **result}
            if not _is_current_processing_task(task_id, task):
                return
            from app.routes.watchlist import _persist_watchlist_run

            _persist_watchlist_run(task.usernames, result, None, ok=True)
        else:
            first = merge_scraped_films(raw.get("first_diary", []), raw.get("first_grid", []))
            second = merge_scraped_films(raw.get("second_diary", []), raw.get("second_grid", []))
            first_enriched, second_enriched, first_wl, second_wl = await asyncio.gather(
                enrich_films(session, first, limit=80),
                enrich_films(session, second, limit=80),
                enrich_films(session, raw.get("first_watchlist", []), limit=80),
                enrich_films(session, raw.get("second_watchlist", []), limit=80),
            )
            profile = await asyncio.to_thread(build_mutual_profile, first_enriched, second_enriched)
            recommendations = await discover_date_night_recommendations(first_wl, second_wl, profile)
            if not recommendations:
                raise ValueError("No strong mutual recommendation was found yet.")
            final = DateNightResponse(
                mutual_profile=MutualProfile(**profile), recommendations=recommendations
            ).model_dump()
            if not _is_current_processing_task(task_id, task):
                return
            from app.routes.recommend import _persist_date_night_run

            _persist_date_night_run(task.usernames, profile, final["recommendations"], None, ok=True)
        if not _is_current_processing_task(task_id, task):
            return
        task_manager.set_task_done(task_id, final)
    except Exception as exc:  # finalization failures must reach the poller
        current = task_manager.get_task_state(task_id)
        if current is not task or task.status in {"done", "failed"}:
            return
        if task.job_type == "watchlist_compare":
            from app.routes.watchlist import _persist_watchlist_run

            _persist_watchlist_run(task.usernames, None, None, ok=False, error_message=str(exc))
        else:
            from app.routes.recommend import _persist_date_night_run

            _persist_date_night_run(task.usernames, None, [], None, ok=False, error_message=str(exc))
        error_code = (
            "watchlist_processing_failed"
            if task.job_type == "watchlist_compare"
            else "date_night_processing_failed"
        )
        task_manager.set_task_failed(
            task_id,
            str(exc),
            {
                "error_type": type(exc).__name__,
                "error_stage": "processing",
                "error_code": error_code,
            },
        )
