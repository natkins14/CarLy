from __future__ import annotations

import time

import jwt

from auth.session import create_session_token
from config.settings import TestingConfig
from models.schemas import VehicleRecord


def test_session_init_sets_cookie(client) -> None:
    response = client.post(
        "/api/session/init",
        json={"credit_score": 720, "zip_code": "10001"},
    )
    assert response.status_code == 201
    assert response.json()["credit_tier"] == "good"
    assert "carly_session=" in response.headers.get("set-cookie", "")


def test_estimate_requires_authenticated_session(client) -> None:
    response = client.post(
        "/api/estimate",
        json={
            "budget_mode": "monthly",
            "budget_value": 650,
            "purchase_type": "both",
            "down_payment": 3000,
            "loan_term_months": 60,
            "zip_code": "10001",
            "credit_score": 720,
            "year": 2024,
            "make": "Toyota",
            "model": "Camry",
            "trim": "XLE",
            "msrp": 32000,
        },
    )
    assert response.status_code == 401


def test_estimate_returns_payment_payload_and_budget_decision(client) -> None:
    token, _ = create_session_token(TestingConfig(), zip_code="10001")
    client.cookies.set("carly_session", token)

    response = client.post(
        "/api/estimate",
        json={
            "budget_mode": "monthly",
            "budget_value": 650,
            "purchase_type": "both",
            "down_payment": 3000,
            "loan_term_months": 60,
            "zip_code": "10001",
            "credit_score": 720,
            "year": 2024,
            "make": "Toyota",
            "model": "Camry",
            "trim": "XLE",
            "msrp": 32000,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["payment_result"]["finance_monthly_payment"] > 0
    assert body["payment_result"]["budget_fit"] is True
    assert body["vehicle"]["msrp"] == 32000.0


def test_estimate_uses_default_credit_tier_when_missing_score(client) -> None:
    token, _ = create_session_token(TestingConfig(), zip_code="97201")
    client.cookies.set("carly_session", token)

    response = client.post(
        "/api/estimate",
        json={
            "budget_mode": "total",
            "budget_value": 40000,
            "purchase_type": "finance",
            "down_payment": 2000,
            "loan_term_months": 60,
            "zip_code": "97201",
            "year": 2024,
            "make": "Honda",
            "model": "Civic",
            "trim": "Sport",
            "msrp": 28000,
        },
    )
    assert response.status_code == 200
    warnings = response.json()["payment_result"]["warnings"]
    assert any("default 'good' tier" in warning for warning in warnings)


def test_estimate_rejects_expired_jwt(client) -> None:
    config = TestingConfig()
    payload = {
        "session_id": "expired-session",
        "credit_tier": "good",
        "zip_code": "10001",
        "iat": int(time.time()) - 4000,
        "exp": int(time.time()) - 3600,
    }
    expired_token = jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)
    client.cookies.set("carly_session", expired_token)

    response = client.post(
        "/api/estimate",
        json={
            "budget_mode": "monthly",
            "budget_value": 650,
            "purchase_type": "finance",
            "down_payment": 3000,
            "loan_term_months": 60,
            "zip_code": "10001",
            "year": 2024,
            "make": "Toyota",
            "model": "Camry",
            "trim": "XLE",
            "msrp": 32000,
        },
    )
    assert response.status_code == 401


def test_cars_search_remains_budget_blind(client, monkeypatch) -> None:
    vehicle = VehicleRecord(
        make="Toyota",
        model="Camry",
        year=2024,
        trim="XLE",
        msrp=32000,
        estimated_residual_value=16960,
    )
    monkeypatch.setattr(
        client.app.state.car_service,
        "search_vehicles",
        lambda make, model, year: [vehicle],
    )
    response = client.get("/cars/?make=toyota&model=camry&year=2024")
    assert response.status_code == 200
    assert response.json()[0]["make"] == "Toyota"
