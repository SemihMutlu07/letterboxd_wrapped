"""
Shared pytest fixtures for the backend suite.

The backend loads real credentials from ``backend/.env`` via pydantic-settings.
Left untouched, that makes the test suite hit the *production* Supabase project:
worker tests would mirror fake runs into ``ops_runs`` and the admin endpoints
would read them back. Two harms result — production data pollution, and
order-dependent flakiness (each test reads back whatever the previous test
inserted, so ``runs[0]`` is non-deterministic).

Force Supabase OFF for the whole session so every test is hermetic and uses the
per-test temporary ``RUNS_DIR`` on the filesystem instead. Tests that want to
exercise the Supabase path can re-enable it locally.
"""
import pytest

from app.config import settings


@pytest.fixture(autouse=True, scope="session")
def _disable_supabase_in_tests():
    original_url = settings.supabase_url
    original_key = settings.supabase_anon_key
    settings.supabase_url = ""
    settings.supabase_anon_key = ""
    try:
        yield
    finally:
        settings.supabase_url = original_url
        settings.supabase_anon_key = original_key
