from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from exceptions import AuthenticationError
from models.schemas import EstimateRequest, EstimateResponse, SessionClaims
from services.estimation_service import EstimationService

estimate_router = APIRouter(prefix="/api", tags=["estimate"])


def get_estimation_service(request: Request) -> EstimationService:
    return request.app.state.estimation_service


def require_session_claims(request: Request) -> SessionClaims:
    claims = getattr(request.state, "session_claims", None)
    if claims is None:
        raise AuthenticationError()
    return claims


@estimate_router.post("/estimate", response_model=EstimateResponse)
def estimate_vehicle_cost(
    payload: EstimateRequest,
    session_claims: SessionClaims = Depends(require_session_claims),
    estimation_service: EstimationService = Depends(get_estimation_service),
) -> EstimateResponse:
    return estimation_service.estimate(payload, session_claims)
