from __future__ import annotations

import time
import uuid
from typing import Any

import jwt
from fastapi import Request

from config.settings import Config
from exceptions import AuthenticationError
from models.schemas import CreditTier, SessionClaims


def create_session_token(
    config: Config,
    credit_tier: CreditTier | None = None,
    zip_code: str | None = None,
) -> tuple[str, SessionClaims]:
    now = int(time.time())
    payload: dict[str, Any] = {
        "session_id": str(uuid.uuid4()),
        "credit_tier": credit_tier.value if credit_tier else None,
        "zip_code": zip_code,
        "iat": now,
        "exp": now + config.JWT_EXPIRATION_SECONDS,
    }
    token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
    claims = SessionClaims.model_validate(payload)
    return token, claims


def decode_session_token(token: str, config: Config) -> SessionClaims:
    try:
        payload = jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise AuthenticationError() from exc
    return SessionClaims.model_validate(payload)


def extract_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def get_session_claims_from_request(request: Request, config: Config) -> SessionClaims | None:
    token = request.cookies.get(config.SESSION_COOKIE_NAME) or extract_bearer_token(request)
    if not token:
        return None
    try:
        return decode_session_token(token, config)
    except AuthenticationError:
        # Expired or invalid token — treat as no session so the middleware
        # doesn't block public endpoints like /api/session/init.
        return None
