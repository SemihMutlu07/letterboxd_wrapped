"""Tiny best-effort wrappers around the Supabase REST API (anon key only).

All three calls swallow errors (insert/upsert are no-ops, select returns [])
so a Supabase outage never breaks the request path or the dashboard. Callers
pre-trim rows. Auth headers are fixed once at client construction instead of
being merged into every individual request.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Coroutine

import httpx

from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.supabase_ops")

_background_tasks: set[asyncio.Task] = set()


def _auth_headers() -> dict[str, str]:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
    }


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(headers=_auth_headers(), timeout=5.0)


def fire_and_forget(coro: Coroutine[Any, Any, Any]) -> None:
    """Schedule a best-effort coroutine without blocking the caller.

    Keeps a reference to the task so it isn't garbage-collected mid-flight
    (a documented asyncio pitfall). Falls back to a blocking run when there's
    no running event loop (e.g. called from a sync test).
    """
    try:
        task = asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        asyncio.run(coro)
        return
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def insert(table: str, row: dict[str, Any]) -> None:
    """Best-effort POST one row to `table`. No-op on any error."""
    try:
        async with _client() as client:
            await client.post(
                f"{settings.supabase_url}/rest/v1/{table}",
                headers={"Prefer": "return=minimal"},
                json=row,
            )
    except Exception as exc:
        logger.warning("Failed to mirror row to %s: %s", table, exc)


async def select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    """Best-effort GET rows from `table`. Returns [] on any error."""
    try:
        async with _client() as client:
            resp = await client.get(f"{settings.supabase_url}/rest/v1/{table}", params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Failed to load rows from %s: %s", table, exc)
        return []


async def upsert(table: str, row: dict[str, Any], *, on_conflict: str) -> bool:
    """Best-effort UPSERT one row to `table`. Returns False on any error."""
    try:
        async with _client() as client:
            resp = await client.post(
                f"{settings.supabase_url}/rest/v1/{table}",
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": on_conflict},
                json=row,
            )
            resp.raise_for_status()
            return True
    except Exception as exc:
        logger.warning("Failed to upsert row to %s: %s", table, exc)
        return False
