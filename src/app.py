from __future__ import annotations

import logging
import sys
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from auth.session import get_session_claims_from_request
from config.settings import Config, get_config
from exceptions import CarLyBaseException
from routes.car_routes import cars_router
from routes.estimate_routes import estimate_router
from routes.session_routes import session_router
from services.car_service import CarService
from services.estimation_service import EstimationService


def create_app(config: Config | None = None) -> FastAPI:
    if config is None:
        config = get_config()

    _configure_logging(config.LOG_LEVEL)
    app = FastAPI(title="CarLy", debug=config.DEBUG)

    # ─── CORS Middleware ─────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:8000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.config = config
    app.state.car_service = CarService(
        api_url=config.CARQUERY_API_URL,
        timeout_seconds=config.CARQUERY_TIMEOUT_SECONDS,
        cache_dir=config.CACHE_DIR,
        fresh_ttl=config.CACHE_FRESH_TTL_SECONDS,
        stale_ttl=config.CACHE_STALE_TTL_SECONDS,
    )
    app.state.estimation_service = EstimationService(
        car_service=app.state.car_service,
    )

    @app.middleware("http")
    async def session_middleware(request: Request, call_next):
        request.state.session_claims = None
        try:
            claims = get_session_claims_from_request(request, config)
            request.state.session_claims = claims
            return await call_next(request)
        except CarLyBaseException as exc:
            return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(CarLyBaseException)
    async def handle_carly_exception(request: Request, exc: CarLyBaseException):
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=400,
            content={
                "error": "validation_error",
                "message": "Invalid request parameters.",
                "action": "none",
                "details": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        logging.getLogger(__name__).exception("Unhandled internal server error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_error",
                "message": "Something went wrong. Please try again.",
                "action": "none",
            },
        )
    
    @app.get("/")
    def root(): 
        return {"message": "CarLy API is running."}

    app.include_router(cars_router)
    app.include_router(session_router)
    app.include_router(estimate_router)
    return app


def _configure_logging(level: int) -> None:
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


app = create_app()
