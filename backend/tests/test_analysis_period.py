"""Contracts for bounded public-profile Wrapped analyses."""
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.services import scraper
from app.services.scrape_pipeline import (
    ScrapeAnalysisEmpty,
    analysis_period_bounds,
    normalize_analysis_period,
    scrape_and_analyze,
)


@pytest.fixture
async def api_client():
    """Synchronous scrape mode, so route-to-pipeline arguments stay observable."""
    from app.main import create_app

    app = create_app()
    app.state.aiohttp_session = object()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://period-test") as client:
        yield client


@pytest.mark.asyncio
async def test_scrape_route_defaults_to_year_and_rejects_invalid_period(api_client, monkeypatch):
    from app.config import settings

    original_token = settings.worker_token
    settings.worker_token = ""
    try:
        with patch("app.routes.analyze.scrape_and_analyze", new=AsyncMock(return_value={"total_films": 1})) as analyze:
            response = await api_client.post("/api/scrape-profile", json={"username": "semih"})
        assert response.status_code == 200
        assert analyze.await_args.kwargs["analysis_period"] == "year"

        invalid = await api_client.post(
            "/api/scrape-profile", json={"username": "semih", "analysis_period": "week"}
        )
        assert invalid.status_code == 400
        assert invalid.json()["detail"]["error_code"] == "invalid_analysis_period"
    finally:
        settings.worker_token = original_token


@pytest.mark.asyncio
async def test_scrape_route_maps_empty_bounded_period_to_actionable_error(api_client, monkeypatch):
    from app.config import settings

    original_token = settings.worker_token
    settings.worker_token = ""
    try:
        empty = ScrapeAnalysisEmpty("semih", scraper_ok=False, period_empty=True)
        with patch("app.routes.analyze.scrape_and_analyze", new=AsyncMock(side_effect=empty)):
            response = await api_client.post(
                "/api/scrape-profile", json={"username": "semih", "analysis_period": "month"}
            )
        assert response.status_code == 400
        assert response.json()["detail"]["error_code"] == "no_films_in_period"
    finally:
        settings.worker_token = original_token


def test_analysis_period_defaults_to_year_and_rejects_unknown_values():
    assert normalize_analysis_period(None) == "year"
    assert normalize_analysis_period("year") == "year"
    assert normalize_analysis_period("month") == "month"
    assert normalize_analysis_period("lifetime") == "lifetime"
    with pytest.raises(ValueError):
        normalize_analysis_period("week")


def test_analysis_period_bounds_are_inclusive_and_lifetime_is_unbounded():
    today = date(2026, 7, 25)
    assert analysis_period_bounds("month", today=today) == (date(2026, 6, 25), today)
    assert analysis_period_bounds("year", today=today) == (date(2025, 7, 25), today)
    assert analysis_period_bounds("lifetime", today=today) == (None, today)


def test_diary_cutoff_never_stops_on_unparseable_or_out_of_order_page(monkeypatch):
    """An unsorted/malformed diary page cannot prove later pages are old."""
    session = type("Session", (), {"close": lambda self: None})()
    monkeypatch.setattr(scraper, "_fetch", lambda *args, **kwargs: type("R", (), {"status_code": 200, "text": "x"})())
    monkeypatch.setattr(scraper, "PAGE_DELAY", 0)
    pages = iter([
        [{"title": "Recent", "watch_date": "2026-07-20"}, {"title": "Unknown", "watch_date": ""}],
        [{"title": "Older but still needed", "watch_date": "2026-06-30"}],
        [],
    ])
    monkeypatch.setattr(scraper, "_parse_diary_rows", lambda _soup: next(pages))

    films = scraper._sync_scrape_diary("semih", 3, session=session, cutoff_date=date(2026, 6, 25))

    assert [film["title"] for film in films] == ["Recent", "Unknown", "Older but still needed"]


@pytest.mark.asyncio
async def test_bounded_pipeline_uses_diary_only_filters_before_analysis_and_records_metadata(monkeypatch):
    sources = scraper.ProfileScrapeSources(
        diary=[
            {"title": "Keep", "year": "2025", "rating": 4, "watch_date": "2026-07-01"},
            {"title": "Drop", "year": "2024", "rating": 3, "watch_date": "2025-01-01"},
        ],
        grid=[{"title": "Undated", "year": "2020", "rating": None, "watch_date": ""}],
    )
    captured = {}

    async def fake_sources(*args, **kwargs):
        captured.update(kwargs)
        return sources

    async def fake_analysis(_session, csv_files, *_args):
        import pandas as pd
        captured["analyzed_titles"] = pd.read_csv(csv_files["watched.csv"])["Name"].tolist()
        return {"total_films": 1, "all_films": []}

    monkeypatch.setattr("app.services.scrape_pipeline.scrape_profile_sources", fake_sources)
    monkeypatch.setattr("app.services.scrape_pipeline.process_comprehensive_letterboxd_data", fake_analysis)

    stats = await scrape_and_analyze(object(), "semih", analysis_period="year")

    assert captured["include_grid"] is False
    assert captured["diary_cutoff"] is not None
    assert captured["analyzed_titles"] == ["Keep"]
    assert stats["analysis_period"]["key"] == "year"
    assert stats["analysis_period"]["start_date"]
    assert stats["analysis_period"]["end_date"]


@pytest.mark.asyncio
async def test_lifetime_pipeline_preserves_grid_films(monkeypatch):
    sources = scraper.ProfileScrapeSources(
        diary=[{"title": "Dated", "year": "2025", "rating": 4, "watch_date": "2025-01-01"}],
        grid=[{"title": "Undated", "year": "2020", "rating": None, "watch_date": ""}],
    )
    captured = {}

    async def fake_sources(*args, **kwargs):
        captured.update(kwargs)
        return sources

    async def fake_analysis(_session, csv_files, *_args):
        import pandas as pd
        captured["titles"] = pd.read_csv(csv_files["watched.csv"])["Name"].tolist()
        return {"total_films": 2, "all_films": []}

    monkeypatch.setattr("app.services.scrape_pipeline.scrape_profile_sources", fake_sources)
    monkeypatch.setattr("app.services.scrape_pipeline.process_comprehensive_letterboxd_data", fake_analysis)

    stats = await scrape_and_analyze(object(), "semih", analysis_period="lifetime")

    assert captured["include_grid"] is True
    assert captured["diary_cutoff"] is None
    assert captured["titles"] == ["Dated", "Undated"]
    assert stats["analysis_period"]["start_date"] is None


def _patch_sources(monkeypatch, sources):
    async def fake_sources(*_args, **_kwargs):
        return sources

    monkeypatch.setattr("app.services.scrape_pipeline.scrape_profile_sources", fake_sources)


@pytest.mark.asyncio
async def test_empty_bounded_period_is_reported_only_when_the_scrape_itself_worked(monkeypatch):
    # Scrape succeeded — films exist, they just fall outside the window.
    _patch_sources(monkeypatch, scraper.ProfileScrapeSources(
        diary=[{"title": "Old", "year": "2019", "rating": 4, "watch_date": "2019-01-01"}],
        grid=[],
        film_count=1,
    ))

    with pytest.raises(ScrapeAnalysisEmpty) as caught:
        await scrape_and_analyze(object(), "semih", analysis_period="month")

    assert caught.value.period_empty is True


@pytest.mark.asyncio
async def test_failed_scrape_is_not_blamed_on_the_period(monkeypatch):
    # Nothing came back at all — blocked, private or a dead scraper. Reporting
    # this as "no films in the selected period" would hide the real breakage,
    # and `year` is the default so it would hide it on the common path.
    _patch_sources(monkeypatch, scraper.ProfileScrapeSources(diary=[], grid=[], film_count=0))

    with pytest.raises(ScrapeAnalysisEmpty) as caught:
        await scrape_and_analyze(object(), "semih", analysis_period="month")

    assert caught.value.period_empty is False
    assert caught.value.scraper_ok is False


@pytest.mark.asyncio
async def test_parse_failure_behind_a_real_film_count_is_not_blamed_on_the_period(monkeypatch):
    # The profile advertises 412 films but nothing parsed. Whatever that gets
    # classified as, it must not be reported as an empty period — `year` is the
    # default, so that would mask the failure for most requests.
    _patch_sources(monkeypatch, scraper.ProfileScrapeSources(diary=[], grid=[], film_count=412))

    with pytest.raises(ScrapeAnalysisEmpty) as caught:
        await scrape_and_analyze(object(), "semih", analysis_period="year")

    assert caught.value.period_empty is False
