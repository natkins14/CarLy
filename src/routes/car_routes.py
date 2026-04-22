"""
routes/car_routes.py — /cars Blueprint

Responsibility: HTTP interface only.
  1. Parse and validate incoming query parameters.
  2. Delegate to CarService.
  3. Return a standardised JSON envelope.

No business logic, no direct API calls, no cache management.
All of that belongs in services/car_service.py.
"""
from __future__ import annotations

import logging

from flask import Blueprint, current_app, request

from exceptions import (
    CarLyBaseException,
    CarQueryUnavailableError,
    ValidationError,
)
from utils.response import error_response, success_response

logger: logging.Logger = logging.getLogger(__name__)

# Blueprint name doubles as the URL prefix namespace.
# Register with url_prefix="/cars" in app.py.
cars_bp: Blueprint = Blueprint("cars", __name__)


@cars_bp.get("/", strict_slashes=False)
def list_vehicles():
    """GET /cars — Search for vehicles by make, model, and/or year.

    Query Parameters:
        make  (str, optional):  Vehicle make identifier (e.g. "toyota").
        model (str, optional):  Vehicle model name (e.g. "camry").
        year  (int, optional):  Four-digit model year (e.g. 2023).

    Returns:
        200 — List of normalised VehicleEntity objects under data.vehicles.
        400 — Validation error (invalid year format, etc.).
        503 — CarQuery unavailable with no cache.
        502 — Any other upstream CarQuery error.
        500 — Unhandled internal error (caught by global handler in app.py).

    Response envelope (all cases):
        {
            "data":  { "vehicles": [...] } | null,
            "meta":  { "timestamp": int, "count": int, ... },
            "error": { "code": str, "message": str } | null
        }
    """
    # --- Parse query params ---
    raw_make: str | None = request.args.get("make", type=str)
    raw_model: str | None = request.args.get("model", type=str)
    raw_year: str | None = request.args.get("year", type=str)

    # Normalise strings: strip whitespace, lowercase make/model for API compat
    make: str | None = raw_make.strip().lower() if raw_make else None
    model: str | None = raw_model.strip().lower() if raw_model else None
    year: int | None = None

    # --- Validate year ---
    if raw_year is not None:
        try:
            year = int(raw_year)
            if not (1900 <= year <= 2100):
                raise ValidationError(
                    message=f"year must be between 1900 and 2100, got {year}.",
                    error_code="invalid_year",
                    status_code=400,
                )
        except ValueError as exc:
            raise ValidationError(
                message=f"year must be a valid integer, got '{raw_year}'.",
                error_code="invalid_year",
                status_code=400,
            ) from exc

    logger.info(
        "GET /cars | make=%s | model=%s | year=%s",
        make or "—",
        model or "—",
        year or "—",
    )

    # --- Delegate to service ---
    # The CarService instance is stored on the Flask app object in app.py.
    # Accessing via current_app avoids a circular import and ensures we always
    # get the fully-initialised instance created during the app factory.
    car_service = current_app.car_service  # type: ignore[attr-defined]

    vehicles: list[dict] = car_service.search_vehicles(
        make=make,
        model=model,
        year=year,
    )

    logger.info(
        "GET /cars → %d results | make=%s | model=%s | year=%s",
        len(vehicles),
        make or "—",
        model or "—",
        year or "—",
    )

    return success_response(
        data={"vehicles": vehicles},
        meta={
            "count": len(vehicles),
            "filters": {
                "make": make,
                "model": model,
                "year": year,
            },
        },
    )
