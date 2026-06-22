from __future__ import annotations

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    tmdb_api_key: str = ""
    tmdb_requests_per_second: int = 25
    tmdb_429_retries: int = 2
    frontend_origins: str = ""
    debug_cinema_scale: bool = False
    log_level: str = "INFO"
    scraper_api_key: str = ""

    # Optional: mirror run logs to Supabase so the admin dashboard survives Render
    # restarts (local runs/ is ephemeral there). Anon key only — never service_role.
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # Desktop-worker mode: when worker_token is set, /api/scrape-profile queues
    # jobs for an outbound desktop worker instead of scraping inline. The worker
    # authenticates with this shared secret via the X-Worker-Token header.
    worker_token: str = ""
    # A heartbeat older than this many seconds means the desktop worker is offline.
    worker_heartbeat_max_age_seconds: int = 60
    # Increment this when worker/backend control-plane payloads become
    # incompatible. Older desktop workers will keep heartbeating but will not
    # receive new jobs until updated.
    worker_protocol_version: int = 1
    # Optional startup smoke test for the desktop worker. Keep opt-in because it
    # performs a real Letterboxd scrape and should not run on every restart by
    # accident.
    worker_self_test_on_start: bool = False
    worker_self_test_username: str = "semihmutsuz"

    @property
    def desktop_worker_enabled(self) -> bool:
        return bool(self.worker_token)

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def cors_origins(self) -> List[str]:
        base = [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://movieswrapped.netlify.app",
            "https://letterboxd-wrapped.netlify.app",
        ]
        extra = [o.strip() for o in self.frontend_origins.split(",") if o.strip()]
        return base + extra


settings = Settings()
