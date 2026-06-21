"""Verify the production Render -> desktop direct-scrape path end to end."""

from __future__ import annotations

import argparse
from getpass import getpass
import json
import os
from time import monotonic, sleep

import requests


def _json(response: requests.Response) -> dict:
    try:
        response.raise_for_status()
        body = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise SystemExit(f"HTTP verification failed: {exc}") from exc
    if not isinstance(body, dict):
        raise SystemExit("HTTP verification failed: expected a JSON object")
    return body


def _verify_worker(backend_url: str, admin_secret: str) -> dict:
    response = requests.get(
        f"{backend_url}/admin/api/worker",
        headers={"X-Admin-Key": admin_secret},
        timeout=30,
    )
    body = _json(response)
    status = body.get("status") or {}
    meta = status.get("meta") or {}
    self_test = status.get("self_test") or {}

    if not body.get("enabled") or not status.get("online"):
        raise SystemExit("Desktop worker is not enabled and online")
    if meta.get("scrape_transport") != "direct_cloudscraper":
        raise SystemExit("Worker does not report scrape_transport=direct_cloudscraper")
    if not meta.get("self_test_on_start"):
        raise SystemExit("Worker was not started with WORKER_SELF_TEST_ON_START=1")
    if not self_test.get("ok") or not (self_test.get("total_films") or 0) > 0:
        raise SystemExit("Worker startup self-test is missing or did not return films > 0")
    return status


def _verify_scrape(backend_url: str, username: str, timeout_seconds: int, poll_seconds: float) -> dict:
    submit = requests.post(
        f"{backend_url}/api/scrape-profile",
        json={"username": username},
        timeout=30,
    )
    if submit.status_code != 202:
        raise SystemExit(f"Expected scrape submission HTTP 202, got {submit.status_code}: {submit.text[:500]}")
    task_id = _json(submit).get("task_id")
    if not task_id:
        raise SystemExit("Scrape submission did not return task_id")

    deadline = monotonic() + timeout_seconds
    while monotonic() < deadline:
        progress = _json(requests.get(f"{backend_url}/api/progress/{task_id}", timeout=30))
        if progress.get("status") == "done":
            result = progress.get("result") or {}
            stats = result.get("stats") or {}
            total_films = stats.get("total_films") or 0
            transports = {
                (event.get("metrics") or {}).get("scrape_transport")
                for event in progress.get("trace_events") or []
                if isinstance(event, dict)
            }
            if total_films <= 0:
                raise SystemExit("Completed scrape returned total_films <= 0")
            if "direct_cloudscraper" not in transports:
                raise SystemExit("Task trace does not prove direct_cloudscraper transport")
            return {
                "task_id": task_id,
                "status": "done",
                "total_films": total_films,
                "scrape_transport": "direct_cloudscraper",
                "scrape_seconds": progress.get("scrape_seconds"),
                "analysis_seconds": progress.get("analysis_seconds"),
            }
        if progress.get("status") in {"error", "failed"}:
            raise SystemExit(f"Scrape task failed: {progress.get('error') or progress.get('message')}")
        sleep(poll_seconds)
    raise SystemExit(f"Scrape task {task_id} did not finish within {timeout_seconds}s")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", default="https://wrapped-backend.onrender.com")
    parser.add_argument("--username", default="semihmutsuz")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--poll-seconds", type=float, default=2)
    args = parser.parse_args()

    backend_url = args.backend.rstrip("/")
    admin_secret = os.getenv("ADMIN_SECRET") or getpass("Render ADMIN_SECRET: ")
    worker = _verify_worker(backend_url, admin_secret)
    result = _verify_scrape(backend_url, args.username, args.timeout, args.poll_seconds)
    result["startup_self_test_films"] = worker["self_test"]["total_films"]
    result["worker_git_sha"] = (worker.get("meta") or {}).get("worker_git_sha")
    result["backend_git_sha"] = (worker.get("version") or {}).get("backend_git_sha")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
