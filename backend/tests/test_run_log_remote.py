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
        "trace_events": [{"stage": "scrape"}],  # bulky
    }
    out = _remote_payload(payload)
    assert "stats" not in out and "trace_events" not in out
    # dashboard needs these
    for key in ("username", "ok", "total_films", "scrape_seconds", "analysis_seconds", "sinefil_meter"):
        assert key in out, key
