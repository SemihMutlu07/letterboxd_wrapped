from unittest.mock import Mock

import pytest

from scripts import verify_desktop_direct_scrape as verify


class Response:
    def __init__(self, body: dict, status_code: int = 200):
        self._body = body
        self.status_code = status_code
        self.text = str(body)

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise verify.requests.HTTPError(f"HTTP {self.status_code}")


def test_verify_worker_requires_direct_transport(monkeypatch):
    body = {
        "enabled": True,
        "status": {
            "online": True,
            "meta": {"scrape_transport": "scraperapi", "self_test_on_start": True},
            "self_test": {"ok": True, "total_films": 10},
        },
    }
    monkeypatch.setattr(verify.requests, "get", Mock(return_value=Response(body)))

    with pytest.raises(SystemExit, match="direct_cloudscraper"):
        verify._verify_worker("https://backend.example.com", "secret")


def test_verify_scrape_accepts_completed_direct_worker_run(monkeypatch):
    submit = Response({"task_id": "task-1"}, status_code=202)
    progress = Response(
        {
            "status": "done",
            "result": {"stats": {"total_films": 42}},
            "scrape_seconds": 12.5,
            "analysis_seconds": 2.0,
            "trace_events": [
                {"stage": "worker_received", "metrics": {"scrape_transport": "direct_cloudscraper"}}
            ],
        }
    )
    monkeypatch.setattr(verify.requests, "post", Mock(return_value=submit))
    monkeypatch.setattr(verify.requests, "get", Mock(return_value=progress))

    result = verify._verify_scrape("https://backend.example.com", "semihmutsuz", 30, 0)

    assert result["task_id"] == "task-1"
    assert result["total_films"] == 42
    assert result["scrape_transport"] == "direct_cloudscraper"
