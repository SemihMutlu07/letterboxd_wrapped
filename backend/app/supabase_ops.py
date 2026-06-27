"""Tiny best-effort wrappers around the Supabase REST API (anon key only).

Both calls swallow errors (insert is a no-op, select returns []) so a Supabase
outage never breaks the request path or the dashboard. Callers pre-trim rows.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("letterboxd_wrapped.supabase_ops")


def _auth_headers() -> dict[str, str]:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
    }


def insert(table: str, row: dict[str, Any]) -> None:
    """Best-effort POST one row to `table`. No-op on any error."""
    try:
        httpx.post(
            f"{settings.supabase_url}/rest/v1/{table}",
            headers={**_auth_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
            json=row,
            timeout=5.0,
        )
    except Exception as exc:
        logger.warning("Failed to mirror row to %s: %s", table, exc)


async def select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    """Best-effort GET rows from `table`. Returns [] on any error."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/{table}",
                headers=_auth_headers(),
                params=params,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("Failed to load rows from %s: %s", table, exc)
        return []
