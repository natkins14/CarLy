from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from models.schemas import VehicleRecord
from services.car_service import CarService

cars_router = APIRouter(prefix="/cars", tags=["cars"])


def get_car_service(request: Request) -> CarService:
    return request.app.state.car_service


@cars_router.get("/", response_model=list[VehicleRecord])
def list_vehicles(
    year: int | None = Query(default=None, ge=1900, le=2100),
    make: str | None = None,
    model: str | None = None,
    car_service: CarService = Depends(get_car_service),
) -> list[VehicleRecord]:
    normalized_make = make.strip().lower() if make else None
    normalized_model = model.strip().lower() if model else None
    return car_service.search_vehicles(
        make=normalized_make,
        model=normalized_model,
        year=year,
    )
