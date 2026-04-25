from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

try:
    from anthropic import Anthropic
except ImportError:  # pragma: no cover
    Anthropic = None  # type: ignore[assignment]


class Config:
    APP_NAME = "CarLy"
    APP_ENV = os.environ.get("APP_ENV", os.environ.get("FLASK_ENV", "development"))
    DEBUG = os.environ.get("APP_DEBUG", "true").lower() == "true"
    TESTING = False

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    JWT_SECRET = os.environ.get("JWT_SECRET", SECRET_KEY)
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_SECONDS = int(os.environ.get("JWT_EXPIRATION_SECONDS", "1800"))
    SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "carly_session")

    CARQUERY_API_URL = os.environ.get(
        "CARQUERY_API_URL",
        "https://www.carqueryapi.com/api/0.3/",
    )
    CARQUERY_TIMEOUT_SECONDS = int(os.environ.get("CARQUERY_TIMEOUT_SECONDS", "3"))

    CACHE_DIR = Path(
        os.environ.get("CACHE_DIR", str(_PROJECT_ROOT / ".cache" / "carquery"))
    ).resolve()
    CACHE_FRESH_TTL_SECONDS = 86_400
    CACHE_STALE_TTL_SECONDS = 172_800

    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.environ.get(
        "ANTHROPIC_MODEL",
        "claude-3-5-sonnet-latest",
    )
    ANTHROPIC_MAX_TOKENS = int(os.environ.get("ANTHROPIC_MAX_TOKENS", "400"))

    LOG_LEVEL = getattr(
        logging,
        os.environ.get("LOG_LEVEL", "INFO").upper(),
        logging.INFO,
    )

    @property
    def anthropic_enabled(self) -> bool:
        return bool(self.ANTHROPIC_API_KEY and Anthropic is not None)

    def get_anthropic_client(self) -> Any:
        if not self.anthropic_enabled:
            return None
        return Anthropic(api_key=self.ANTHROPIC_API_KEY)


class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = logging.DEBUG


class ProductionConfig(Config):
    DEBUG = False
    LOG_LEVEL = logging.WARNING

    def __init__(self) -> None:
        if not os.environ.get("JWT_SECRET"):
            raise RuntimeError("JWT_SECRET environment variable is required in production.")


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    LOG_LEVEL = logging.DEBUG
    CARQUERY_API_URL = "http://localhost:9999/mock-carquery/"
    CACHE_DIR = (_PROJECT_ROOT / ".cache" / "test-carquery").resolve()
    JWT_SECRET = "test-secret"


@lru_cache(maxsize=1)
def get_config() -> Config:
    env = os.environ.get("APP_ENV", os.environ.get("FLASK_ENV", "development")).lower()
    config_map: dict[str, type[Config]] = {
        "development": DevelopmentConfig,
        "production": ProductionConfig,
        "testing": TestingConfig,
    }
    return config_map.get(env, DevelopmentConfig)()
