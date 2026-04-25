from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from auth.session import create_session_token
from config.settings import Config
from models.schemas import SessionClaims, SessionInitRequest
from services.dcs import resolve_credit_tier

session_router = APIRouter(prefix="/api/session", tags=["session"])


def get_config(request: Request) -> Config:
    return request.app.state.config


@session_router.post("/init", response_model=SessionClaims, status_code=status.HTTP_201_CREATED)
def initialize_session(
    payload: SessionInitRequest,
    response: Response,
    config: Config = Depends(get_config),
) -> SessionClaims:
    credit_tier = resolve_credit_tier(payload.credit_score, payload.credit_tier)
    token, claims = create_session_token(
        config=config,
        credit_tier=credit_tier,
        zip_code=payload.zip_code,
    )
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="strict",
        max_age=config.JWT_EXPIRATION_SECONDS,
    )
    return claims
