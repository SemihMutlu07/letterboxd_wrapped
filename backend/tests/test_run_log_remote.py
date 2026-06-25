"""Supabase mirror trims bulky fields but keeps everything the dashboard shows."""

from app.services.run_log import _remote_payload


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
