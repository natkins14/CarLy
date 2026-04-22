"""
config/settings.py — Class-Based Configuration with Type Hints

Pattern: A base Config class holds all shared settings and reads from
environment variables via python-dotenv. Environment-specific subclasses
(DevelopmentConfig, ProductionConfig) override only what differs.

The `get_config()` factory is the single entry point used by app.py —
application code never imports a specific config class directly.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env file from the project root (two levels up from this file: src/config/ → src/ → /)
_PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent.parent
load_dotenv(_PROJECT_ROOT / ".env")


class Config:
    """Base configuration. All values derived from environment variables.

    Attributes are typed to document intent and to surface misconfiguration
    immediately at import time rather than during a live request.
    """

    # --- Flask core ---
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    TESTING: bool = False
    DEBUG: bool = False

    # --- CarQuery API ---
    # Overridable so tests can point at a local mock server.
    CARQUERY_API_URL: str = os.environ.get(
        "CARQUERY_API_URL",
        "https://www.carqueryapi.com/api/0.3/",
    )
    CARQUERY_TIMEOUT_SECONDS: int = int(
        os.environ.get("CARQUERY_TIMEOUT_SECONDS", "3")
    )

    # --- File Cache ---
    # Resolved to an absolute path so the process working directory is irrelevant.
    CACHE_DIR: Path = Path(
        os.environ.get("CACHE_DIR", str(_PROJECT_ROOT / ".cache" / "carquery"))
    ).resolve()

    CACHE_FRESH_TTL_SECONDS: int = 86_400   # 24 hours
    CACHE_STALE_TTL_SECONDS: int = 172_800  # 48 hours

    # --- Logging ---
    LOG_LEVEL: int = getattr(
        logging,
        os.environ.get("LOG_LEVEL", "INFO").upper(),
        logging.INFO,
    )


class DevelopmentConfig(Config):
    """Local development overrides."""

    DEBUG: bool = True
    LOG_LEVEL: int = logging.DEBUG


class ProductionConfig(Config):
    """Production hardening overrides."""

    DEBUG: bool = False
    LOG_LEVEL: int = logging.WARNING

    def __init__(self) -> None:
        # In production, SECRET_KEY must be set explicitly — fail loudly at
        # startup (not mid-request) if the env var is missing.
        secret = os.environ.get("SECRET_KEY")
        if not secret:
            raise RuntimeError(
                "SECRET_KEY environment variable is not set. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        self.SECRET_KEY = secret


class TestingConfig(Config):
    """Isolated test configuration.

    Points CarQuery at a local fixture URL and uses a temporary cache directory
    so tests never hit the live API or pollute the development cache.
    """

    TESTING: bool = True
    DEBUG: bool = True
    LOG_LEVEL: int = logging.DEBUG
    CARQUERY_API_URL: str = "http://localhost:9999/mock-carquery/"
    CACHE_DIR: Path = Path("/tmp/carly-test-cache")


_CONFIG_MAP: dict[str, type[Config]] = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config() -> Config:
    """Return the appropriate Config instance based on FLASK_ENV.

    Defaults to DevelopmentConfig if FLASK_ENV is unset or unrecognised,
    which is the safe choice for local developer environments.
    """
    env: str = os.environ.get("FLASK_ENV", "development").lower()
    config_class: type[Config] = _CONFIG_MAP.get(env, DevelopmentConfig)
    return config_class()
