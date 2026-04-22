"""
app.py — CarLy Application Factory

The Application Factory pattern (create_app) is used so that:
  1. Tests can call create_app(TestingConfig()) and get a fully isolated instance.
  2. Multiple gunicorn workers each call create_app() independently —
     no shared mutable global state between processes.
  3. Blueprint registration, error handlers, and service wiring are all
     co-located in one function, making startup sequencing obvious.

Usage:
    Development:  FLASK_APP=src/app.py flask run
    Production:   gunicorn "app:create_app()"   (run from src/)
    Tests:        app = create_app(TestingConfig())
    Direct:       python src/app.py
"""
from __future__ import annotations

import logging
import os
import sys
from typing import Any

from flask import Flask

from config.settings import Config, get_config
from exceptions import CarLyBaseException
from routes.car_routes import cars_bp
from services.car_service import CarService
from utils.response import error_response


def create_app(config: Config | None = None) -> Flask:
    """Construct and configure the Flask application.

    Args:
        config: A Config instance. If None, get_config() reads FLASK_ENV
                and selects the appropriate subclass. Pass an explicit config
                in tests for full isolation.

    Returns:
        A configured Flask application instance ready to serve requests.
    """
    if config is None:
        config = get_config()

    app = Flask(__name__, instance_relative_config=False)

    # ------------------------------------------------------------------ #
    # 1. Logging                                                           #
    # ------------------------------------------------------------------ #
    _configure_logging(config.LOG_LEVEL)
    logger = logging.getLogger(__name__)
    # NOTE: app.env was removed in Flask 3.x — read directly from os.environ.
    flask_env: str = os.environ.get("FLASK_ENV", "development")
    logger.info(
        "Starting CarLy | env=%s | log_level=%s",
        flask_env,
        logging.getLevelName(config.LOG_LEVEL),
    )

    # ------------------------------------------------------------------ #
    # 2. Flask settings                                                    #
    # ------------------------------------------------------------------ #
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["DEBUG"] = config.DEBUG
    app.config["TESTING"] = config.TESTING
    # Propagate the typed Config object so tests can inspect it via
    # app.config["CARLY_CONFIG"] without re-reading env vars.
    app.config["CARLY_CONFIG"] = config

    # ------------------------------------------------------------------ #
    # 3. Service wiring                                                    #
    # ------------------------------------------------------------------ #
    # CarService is instantiated once and attached to the app object.
    # Blueprints access it via current_app.car_service — no circular imports,
    # no module-level globals, one fully initialised instance per process.
    app.car_service = CarService(  # type: ignore[attr-defined]
        api_url=config.CARQUERY_API_URL,
        timeout_seconds=config.CARQUERY_TIMEOUT_SECONDS,
        cache_dir=config.CACHE_DIR,
        fresh_ttl=config.CACHE_FRESH_TTL_SECONDS,
        stale_ttl=config.CACHE_STALE_TTL_SECONDS,
    )

    # ------------------------------------------------------------------ #
    # 4. Blueprint registration                                            #
    # ------------------------------------------------------------------ #
    app.register_blueprint(cars_bp, url_prefix="/cars")
    app.url_map.strict_slashes = False

    # ------------------------------------------------------------------ #
    # 5. Global error handlers                                             #
    # ------------------------------------------------------------------ #
    _register_error_handlers(app)

    logger.info(
        "CarLy initialised. Blueprints: %s", list(app.blueprints.keys())
    )
    return app


# --------------------------------------------------------------------------- #
# Logging configuration                                                        #
# --------------------------------------------------------------------------- #

def _configure_logging(level: int) -> None:
    """Configure the root logger with a structured formatter.

    All module loggers inherit from the root logger, so one call here covers
    every module. Handlers are cleared first to prevent duplicate lines when
    create_app() is called multiple times in the same process (e.g., tests).
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()
    root_logger.addHandler(handler)


# --------------------------------------------------------------------------- #
# Global error handlers                                                        #
# --------------------------------------------------------------------------- #

def _register_error_handlers(app: Flask) -> None:
    """Register application-wide exception -> JSON envelope mappings.

    Every response — including errors — conforms to the standard
    { data, meta, error } envelope. Stack traces are logged server-side
    only and never included in the response body (architecture.md §3.2).
    """
    logger = logging.getLogger(__name__)

    @app.errorhandler(CarLyBaseException)
    def handle_carly_exception(exc: CarLyBaseException):
        """Catch all known CarLy domain exceptions in one handler."""
        logger.error(
            "Application error | code=%s | status=%d | message=%s",
            exc.error_code,
            exc.status_code,
            exc.message,
        )
        return error_response(
            message=exc.message,
            error_code=exc.error_code,
            status_code=exc.status_code,
        )

    @app.errorhandler(400)
    def handle_400(exc: Any):
        return error_response(
            message="Bad request.",
            error_code="bad_request",
            status_code=400,
        )

    @app.errorhandler(404)
    def handle_404(exc: Any):
        return error_response(
            message="The requested endpoint does not exist.",
            error_code="not_found",
            status_code=404,
        )

    @app.errorhandler(405)
    def handle_405(exc: Any):
        return error_response(
            message="Method not allowed.",
            error_code="method_not_allowed",
            status_code=405,
        )

    @app.errorhandler(500)
    def handle_500(exc: Any):
        logger.exception("Unhandled internal server error: %s", exc)
        return error_response(
            message="Something went wrong. Please try again.",
            error_code="internal_error",
            status_code=500,
        )


# --------------------------------------------------------------------------- #
# Entrypoint                                                                   #
# --------------------------------------------------------------------------- #
# Guard with __name__ == "__main__" so that importing this module (e.g. in
# smoke_test.py or gunicorn) does NOT automatically call create_app().
# Gunicorn:   gunicorn "app:create_app()"
# Flask CLI:  FLASK_APP=src/app.py flask run

if __name__ == "__main__":
    _app = create_app()
    _app.run(host="0.0.0.0", port=5000)
