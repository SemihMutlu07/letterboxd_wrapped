#!/usr/bin/env python3
"""Regenerate frontend/dev-fixtures/analysis-runs/ from Supabase analysis_runs.

Exports whatever Supabase currently has for the fixed experiment accounts —
new review-enrichment fields (review_url, date, etc.) only show up here after
a fresh scrape through the updated backend has landed in that user's row.

Usage:
    SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 scripts/export-fixtures.py

Never commit .env files or hardcode these values — read from the environment only.
"""

import json
import os
import sys
from pathlib import Path

import httpx

USERNAMES = ["semihmutsuz", "emirermis", "mertefesenturk", "baris_saydam", "isilaykolik"]

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dev-fixtures" / "analysis-runs"

# Mirrors the filter used by getLatestAnalysisRunByUsername in
# frontend/src/lib/supabase/analysis_runs.ts — keep these in sync.
SELECT_COLUMNS = (
    "id,username,started_at,finished_at,summary,total_films,"
    "sinefil_meter,cinematic_persona,average_rating,total_countries"
)


def fetch_latest_run(client: httpx.Client, username: str) -> dict | None:
    resp = client.get(
        "/rest/v1/analysis_runs",
        params={
            "username": f"eq.{username}",
            "ok": "eq.true",
            "summary": "not.is.null",
            "order": "finished_at.desc",
            "limit": "1",
            "select": SELECT_COLUMNS,
        },
    )
    resp.raise_for_status()
    rows = resp.json()
    return rows[0] if rows else None


def describe_gaps(username: str, run: dict) -> str | None:
    """Returns a one-line gap report for this user's run, or None if nothing is missing."""
    details = (run.get("summary") or {}).get("details") or {}
    review_analysis = details.get("review_analysis") or {}
    if not review_analysis.get("reviews"):
        return f"{username}: review_analysis.reviews MISSING"
    sample = review_analysis["reviews"][0]
    missing_fields = [f for f in ("review_url", "date", "slug") if not sample.get(f)]
    if missing_fields:
        return f"{username}: reviews present ({len(review_analysis['reviews'])}) but missing {missing_fields}"
    return None


def _selftest():
    assert describe_gaps("u", {"summary": {"details": {}}}) == "u: review_analysis.reviews MISSING"
    assert describe_gaps("u", {"summary": {"details": {"review_analysis": {"reviews": [
        {"review_url": "x", "date": "2024-01-01", "slug": "y"},
    ]}}}}) is None
    print("selftest ok")


def main() -> int:
    if "--selftest" in sys.argv:
        _selftest()
        return 0

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        print("SUPABASE_URL and SUPABASE_ANON_KEY must both be set in the environment.", file=sys.stderr)
        return 1

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    index = {
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "source": "supabase.analysis_runs local fixture export",
        "users": {},
    }

    with httpx.Client(
        base_url=supabase_url,
        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
        timeout=15,
    ) as client:
        print("Exporting fixtures:")
        for username in USERNAMES:
            run = fetch_latest_run(client, username)
            if not run:
                print(f"  {username}: NO completed run found in Supabase")
                index["users"][username] = {"found": False, "file": f"{username}.json", "username": username}
                continue

            (FIXTURES_DIR / f"{username}.json").write_text(json.dumps(run, indent=2))
            index["users"][username] = {
                "found": True,
                "file": f"{username}.json",
                "id": run["id"],
                "username": run["username"],
                "finished_at": run["finished_at"],
                "total_films": run["total_films"],
                "sinefil_meter": run["sinefil_meter"],
                "cinematic_persona": run["cinematic_persona"],
                "average_rating": run["average_rating"],
                "total_countries": run["total_countries"],
            }
            gap = describe_gaps(username, run)
            if gap:
                print(f"  {gap}")

    (FIXTURES_DIR / "index.json").write_text(json.dumps(index, indent=2))
    print(f"Wrote {FIXTURES_DIR}/index.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
