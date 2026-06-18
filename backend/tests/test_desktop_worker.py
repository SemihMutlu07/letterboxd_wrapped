"""
Desktop scrape worker — process loop unit tests.

Exercises _process_job in isolation: the scrape pipeline and the backend POST
are mocked, so we assert the worker reports success vs. failure correctly and
never crashes the loop on a scrape exception.
"""
import pytest
from unittest.mock import AsyncMock, patch

from app.worker import desktop_scrape_worker as worker
from app.services.scrape_pipeline import ScrapeAnalysisEmpty


def _cfg():
    cfg = worker.WorkerConfig()
    cfg.base_url = "http://backend.test"
    cfg.token = "secret"
    return cfg


@pytest.mark.asyncio
async def test_process_job_posts_success(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "OUTBOX_DIR", tmp_path / "outbox")
    job = {"task_id": "abc", "username": "semihmutsuz"}
    stats = {"total_films": 394}

    with (
        patch.object(worker, "scrape_and_analyze", new=AsyncMock(return_value=stats)),
        patch.object(worker, "_post", new=AsyncMock()) as mock_post,
    ):
        await worker._process_job(object(), _cfg(), job)

    assert mock_post.await_count == 2
    args = mock_post.await_args_list[-1].args
    assert args[2] == "/api/worker/scrape/abc/complete"
    assert args[3]["stats"] == stats
    assert "duration_seconds" in args[3]["telemetry"]
    assert args[3]["trace_events"][0]["stage"] == "worker_received"
    assert args[3]["trace_events"][-1]["stage"] == "postback_started"


@pytest.mark.asyncio
async def test_process_job_posts_failure_on_exception(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "OUTBOX_DIR", tmp_path / "outbox")
    job = {"task_id": "abc", "username": "semihmutsuz"}

    with (
        patch.object(worker, "scrape_and_analyze", new=AsyncMock(side_effect=ScrapeAnalysisEmpty("semihmutsuz", scraper_ok=False))),
        patch.object(worker, "_post", new=AsyncMock()) as mock_post,
    ):
        await worker._process_job(object(), _cfg(), job)

    assert mock_post.await_count == 2
    args = mock_post.await_args_list[-1].args
    assert args[2] == "/api/worker/scrape/abc/failed"
    assert "No public films found" in args[3]["message"]
    assert args[3]["telemetry"]["error_type"] == "ScrapeAnalysisEmpty"
    assert args[3]["telemetry"]["error_stage"] == "scrape_empty"
    assert args[3]["trace_events"][0]["stage"] == "worker_received"
    assert args[3]["trace_events"][-1]["stage"] == "postback_started"


@pytest.mark.asyncio
async def test_process_job_keeps_outbox_when_postback_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "OUTBOX_DIR", tmp_path / "outbox")
    job = {"task_id": "abc", "username": "semihmutsuz"}
    stats = {"total_films": 394}

    with (
        patch.object(worker, "scrape_and_analyze", new=AsyncMock(return_value=stats)),
        patch.object(worker, "_post", new=AsyncMock(return_value=False)),
    ):
        await worker._process_job(object(), _cfg(), job)

    outbox_files = list((tmp_path / "outbox").glob("*.json"))
    assert len(outbox_files) == 1
    assert "complete" in outbox_files[0].name


@pytest.mark.asyncio
async def test_flush_outbox_deletes_acknowledged_item(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "OUTBOX_DIR", tmp_path / "outbox")
    cfg = _cfg()
    payload = {"username": "semihmutsuz", "stats": {"total_films": 394}}
    outbox_path = worker._write_outbox("abc", "complete", "/api/worker/scrape/abc/complete", payload)

    with patch.object(worker, "_post", new=AsyncMock(return_value=True)) as mock_post:
        await worker._flush_outbox(object(), cfg)

    mock_post.assert_awaited_once()
    assert not outbox_path.exists()


def test_failure_message_mapping():
    assert "No public films" in worker._failure_message("u", ScrapeAnalysisEmpty("u", scraper_ok=False))
    assert "analysis came back empty" in worker._failure_message("u", ScrapeAnalysisEmpty("u", scraper_ok=True))
    assert worker._failure_message("u", ValueError("Letterboxd is blocking requests")) == "Letterboxd is blocking requests"


def test_failure_telemetry_mapping():
    telemetry = worker._failure_telemetry(ScrapeAnalysisEmpty("u", scraper_ok=True), 1.2)
    assert telemetry == {
        "duration_seconds": 1.2,
        "error_type": "ScrapeAnalysisEmpty",
        "error_stage": "analysis_empty",
    }
