from app.config import Settings


def test_custom_domain_is_allowed_by_default() -> None:
    origins = Settings(_env_file=None).cors_origins

    assert "https://movieswrapped.com" in origins
    assert "https://www.movieswrapped.com" in origins
