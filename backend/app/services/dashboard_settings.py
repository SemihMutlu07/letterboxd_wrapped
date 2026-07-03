from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app import supabase_ops, task_manager
from app.config import settings


SETTINGS_TABLE = "ops_dashboard_settings"
WORKER_CONTROL_KEY = "worker_control"

_worker_control_loaded = False
_last_loaded_at: str | None = None
_last_saved_at: str | None = None
_last_save_ok: bool | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def reset_cache_for_tests() -> None:
    global _worker_control_loaded, _last_loaded_at, _last_saved_at, _last_save_ok
    _worker_control_loaded = False
    _last_loaded_at = None
    _last_saved_at = None
    _last_save_ok = None


def settings_store_status() -> dict[str, Any]:
    source = "supabase" if settings.supabase_enabled else "memory"
    return {
        "persistent": settings.supabase_enabled,
        "source": source,
        "table": SETTINGS_TABLE if settings.supabase_enabled else None,
        "worker_control_key": WORKER_CONTROL_KEY,
        "worker_control_loaded": _worker_control_loaded,
        "last_loaded_at": _last_loaded_at,
        "last_saved_at": _last_saved_at,
        "last_save_ok": _last_save_ok,
    }


async def load_worker_control_state(*, force: bool = False) -> dict[str, Any]:
    """Load durable worker controls once per backend process when Supabase is on."""
    global _worker_control_loaded, _last_loaded_at
    if not settings.supabase_enabled:
        return settings_store_status()
    if _worker_control_loaded and not force:
        return settings_store_status()

    rows = await supabase_ops.select(
        SETTINGS_TABLE,
        {"key": f"eq.{WORKER_CONTROL_KEY}", "select": "value,updated_at", "limit": "1"},
    )
    if rows:
        value = rows[0].get("value")
        if isinstance(value, dict):
            task_manager.apply_worker_control_state(value)
    _worker_control_loaded = True
    _last_loaded_at = _now_iso()
    return settings_store_status()


async def save_worker_control_state() -> dict[str, Any]:
    """Persist current worker controls; keep memory as the fallback on failure."""
    global _worker_control_loaded, _last_saved_at, _last_save_ok
    if not settings.supabase_enabled:
        _worker_control_loaded = True
        return settings_store_status()

    now = _now_iso()
    _last_save_ok = await supabase_ops.upsert(
        SETTINGS_TABLE,
        {
            "key": WORKER_CONTROL_KEY,
            "value": task_manager.get_worker_control_state(),
            "updated_at": now,
        },
        on_conflict="key",
    )
    _worker_control_loaded = True
    _last_saved_at = now
    return settings_store_status()
