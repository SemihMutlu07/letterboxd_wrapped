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
from app.security import reset_rate_limits
from app import supabase_ops


@pytest.fixture(autouse=True)
def _reset_security_state():
    reset_rate_limits()
    yield
    reset_rate_limits()


@pytest.fixture(autouse=True, scope="session")
def _disable_supabase_in_tests():
    original_url = settings.supabase_url
    original_key = settings.supabase_anon_key
    original_email = settings.supabase_ops_email
    original_password = settings.supabase_ops_password
    original_token = supabase_ops._access_token
    original_expiry = supabase_ops._access_token_expires_at
    settings.supabase_url = ""
    settings.supabase_anon_key = ""
    settings.supabase_ops_email = "ops@movieswrapped.internal"
    settings.supabase_ops_password = "test-password"
    supabase_ops._access_token = "test-access-token"
    supabase_ops._access_token_expires_at = float("inf")
    try:
        yield
    finally:
        settings.supabase_url = original_url
        settings.supabase_anon_key = original_key
        settings.supabase_ops_email = original_email
        settings.supabase_ops_password = original_password
        supabase_ops._access_token = original_token
        supabase_ops._access_token_expires_at = original_expiry
