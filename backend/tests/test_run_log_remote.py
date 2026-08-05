"""Supabase mirror trims bulky fields but keeps everything the dashboard shows."""
import pytest
from unittest.mock import AsyncMock, patch

from app.services.run_log import _mirror_to_supabase, _remote_payload


def test_remote_payload_drops_bulky_keeps_scalars():
    payload = {
        "username": "semihmutsuz",
        "ok": True,
        "total_films": 412,
        "scrape_seconds": 8.8,
        "analysis_seconds": 2.1,
        "sinefil_meter": {"score": 73},
        "stats": {"all_films": [1, 2, 3]},  # bulky
        "trace_events": [{"stage": "scrape"}],  # lightweight, kept for dashboard
    }
    out = _remote_payload(payload)
    assert "stats" not in out  # only stats is truly bulky
    assert "trace_events" in out  # kept for admin dashboard
    # dashboard needs these
    for key in ("username", "ok", "total_films", "scrape_seconds", "analysis_seconds", "sinefil_meter", "trace_events"):
        assert key in out, key


@pytest.mark.asyncio
async def test_mirror_writes_new_ops_runs_columns():
    """The ops_runs mirror must populate the Phase-1 columns added in migration 009."""
    inserted = {}

    async def fake_insert(table, row):
        inserted["table"] = table
        inserted["row"] = row

    with patch("app.services.run_log.supabase_ops.insert", new=fake_insert):
        await _mirror_to_supabase({
            "username": "alice",
            "ok": True,
            "total_films": 10,
            "task_id": "task-1",
            "job_type": "scrape",
            "source": "desktop-worker",
            "error_code": None,
            "duration_ms": 5000,
            "worker_id": "desktop-fedora",
            "payload": {"username": "alice"},
        })

    assert inserted["table"] == "ops_runs"
    row = inserted["row"]
    assert row["task_id"] == "task-1"
    assert row["job_type"] == "scrape"
    assert row["source"] == "desktop-worker"
    assert row["error_code"] is None
    assert row["duration_ms"] == 5000
    assert row["worker_id"] == "desktop-fedora"
    assert row["username"] == "alice"
    assert row["ok"] is True
    assert row["total_films"] == 10
