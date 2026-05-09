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
