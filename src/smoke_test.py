"""
smoke_test.py — CarLy /cars Endpoint Integration Smoke Test

Verifies the full Flask request stack — factory, blueprints, error handlers,
and JSON envelope — using Flask's built-in test client with CarService's
network layer mocked out via unittest.mock.patch.

This means:
  - No live server needed.
  - No network calls made.
  - Tests run in milliseconds and pass in any environment (CI, offline, etc.).
  - The mock returns realistic CarQuery-shaped payloads so normalisation
    logic inside CarService is still exercised end-to-end.

Run:
    python src/smoke_test.py        (from project root)

Exit codes:
    0 — All assertions passed.
    1 — One or more assertions failed.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from typing import Any
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Bootstrap: add src/ to sys.path so imports resolve from project root.
# ---------------------------------------------------------------------------
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

from config.settings import TestingConfig
from app import create_app

# ---------------------------------------------------------------------------
# Console formatting
# ---------------------------------------------------------------------------
_PASS = "\033[92m✔\033[0m"
_FAIL = "\033[91m✘\033[0m"
_results: list[tuple[str, bool]] = []


def assert_that(condition: bool, name: str, detail: str = "") -> None:
    status = _PASS if condition else _FAIL
    print(f"  {status}  {name}" + (f"  ({detail})" if detail else ""))
    _results.append((name, condition))


def body(response) -> dict:
    return json.loads(response.data.decode("utf-8"))


# ---------------------------------------------------------------------------
# Shared mock data — realistic CarQuery payloads
# ---------------------------------------------------------------------------

_MOCK_MAKES_RESPONSE: dict = {
    "Makes": [
        {"make_id": "toyota", "make_display": "Toyota"},
        {"make_id": "honda",  "make_display": "Honda"},
    ]
}

_MOCK_MODELS_RESPONSE: dict = {
    "Models": [
        {"model_name": "Camry",  "model_make_id": "toyota"},
        {"model_name": "Corolla","model_make_id": "toyota"},
    ]
}

_MOCK_TRIMS_RESPONSE: dict = {
    "Trims": [
        {
            "make_display":  "Toyota",
            "model_name":    "Camry",
            "model_year":    "2022",
            "model_trim":    "LE",
            "model_msrp":    "26320",
        },
        {
            "make_display":  "Toyota",
            "model_name":    "Camry",
            "model_year":    "2022",
            "model_trim":    "XLE",
            "model_msrp":    "31220",
        },
    ]
}

# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

def test_envelope_structure_on_valid_year_request(client) -> None:
    """Every successful response must contain data, meta (with count +
    timestamp + filters), and a null error field."""
    print("\n[1] Envelope structure — GET /cars?year=2022")

    with patch(
        "services.car_service.CarService._fetch_from_api",
        return_value=_MOCK_MAKES_RESPONSE,
    ):
        r = client.get("/cars?year=2022")
        b = body(r)

    assert_that(r.status_code == 200,            "HTTP 200 OK",               f"got {r.status_code}")
    assert_that("data"  in b,                    "envelope has 'data' key")
    assert_that("meta"  in b,                    "envelope has 'meta' key")
    assert_that("error" in b,                    "envelope has 'error' key")
    assert_that(b["error"] is None,              "error is null on success")
    assert_that("vehicles" in (b.get("data") or {}), "data.vehicles key present")
    assert_that("count"     in (b.get("meta") or {}), "meta.count present")
    assert_that("timestamp" in (b.get("meta") or {}), "meta.timestamp present")
    assert_that("filters"   in (b.get("meta") or {}), "meta.filters present")


def test_vehicles_list_contains_normalised_makes(client) -> None:
    """When only year is supplied, get_makes() is called and the normalised
    make names must appear in data.vehicles."""
    print("\n[2] Normalisation — makes returned for year-only query")

    with patch(
        "services.car_service.CarService._fetch_from_api",
        return_value=_MOCK_MAKES_RESPONSE,
    ):
        r = client.get("/cars?year=2022")
        b = body(r)

    vehicles: list = (b.get("data") or {}).get("vehicles", [])
    makes_in_response = {v.get("make") for v in vehicles}

    assert_that(r.status_code == 200,                "HTTP 200")
    assert_that(len(vehicles) == 2,                  "2 vehicles returned",  f"got {len(vehicles)}")
    assert_that("Toyota" in makes_in_response,       "'Toyota' in response")
    assert_that("Honda"  in makes_in_response,       "'Honda' in response")
    assert_that(
        (b.get("meta") or {}).get("count") == 2,
        "meta.count == 2",
    )


def test_full_trim_query_returns_vehicle_entities(client) -> None:
    """When make + model + year are all supplied, get_trims() is called and
    the result must contain normalised VehicleEntity fields including msrp."""
    print("\n[3] Full trim query — make=toyota&model=camry&year=2022")

    with patch(
        "services.car_service.CarService._fetch_from_api",
        return_value=_MOCK_TRIMS_RESPONSE,
    ):
        r = client.get("/cars?make=toyota&model=camry&year=2022")
        b = body(r)

    vehicles: list = (b.get("data") or {}).get("vehicles", [])
    assert_that(r.status_code == 200,  "HTTP 200")
    assert_that(len(vehicles) == 2,    "2 trims returned",        f"got {len(vehicles)}")

    first: dict = vehicles[0] if vehicles else {}
    assert_that("make"  in first, "VehicleEntity has 'make'")
    assert_that("model" in first, "VehicleEntity has 'model'")
    assert_that("year"  in first, "VehicleEntity has 'year'")
    assert_that("trim"  in first, "VehicleEntity has 'trim'")
    assert_that("msrp"  in first, "VehicleEntity has 'msrp'")
    assert_that(first.get("msrp") == 26320.0, "msrp parsed as float 26320.0", f"got {first.get('msrp')!r}")
    assert_that(first.get("year") == 2022,    "year parsed as int 2022",       f"got {first.get('year')!r}")
    assert_that(first.get("trim") == "LE",    "trim is 'LE'",                  f"got {first.get('trim')!r}")


def test_msrp_zero_normalised_to_null(client) -> None:
    """A CarQuery model_msrp of '0' must be normalised to None (architecture.md §2.2.2)."""
    print("\n[4] MSRP normalisation — '0' must become null")

    zero_msrp_payload = {
        "Trims": [
            {
                "make_display": "Honda",
                "model_name":   "Civic",
                "model_year":   "2021",
                "model_trim":   "Sport",
                "model_msrp":   "0",
            }
        ]
    }
    with patch(
        "services.car_service.CarService._fetch_from_api",
        return_value=zero_msrp_payload,
    ):
        r = client.get("/cars?make=honda&model=civic&year=2021")
        b = body(r)

    vehicles: list = (b.get("data") or {}).get("vehicles", [])
    assert_that(r.status_code == 200,               "HTTP 200")
    assert_that(len(vehicles) == 1,                 "1 vehicle returned")
    assert_that(vehicles[0].get("msrp") is None,    "msrp is null for '0' input",
                f"got {vehicles[0].get('msrp')!r}")


def test_invalid_year_string_returns_400(client) -> None:
    """A non-numeric year must return HTTP 400 with error_code='invalid_year'
    and null data — without touching the CarService at all."""
    print("\n[5] Validation — non-numeric year returns 400")

    r = client.get("/cars?year=twenty-twenty")
    b = body(r)

    assert_that(r.status_code == 400,                          "HTTP 400")
    assert_that(b["data"] is None,                             "data is null")
    assert_that((b.get("error") or {}).get("code") == "invalid_year",
                "error.code == 'invalid_year'",
                f"got '{(b.get('error') or {}).get('code')}'")


def test_year_out_of_range_returns_400(client) -> None:
    """Year values outside 1900–2100 must be rejected with HTTP 400."""
    print("\n[6] Validation — year=1799 out of range")

    r = client.get("/cars?year=1799")
    b = body(r)

    assert_that(r.status_code == 400,                          "HTTP 400")
    assert_that((b.get("error") or {}).get("code") == "invalid_year",
                "error.code == 'invalid_year'")


def test_no_params_returns_empty_list(client) -> None:
    """A request with no filters returns an empty vehicles list, not an error."""
    print("\n[7] No query params — empty list, no error")

    r = client.get("/cars")
    b = body(r)

    assert_that(r.status_code == 200,           "HTTP 200")
    assert_that(b["error"] is None,             "error is null")
    vehicles = (b.get("data") or {}).get("vehicles")
    assert_that(isinstance(vehicles, list),     "data.vehicles is a list")
    assert_that(len(vehicles) == 0,             "data.vehicles is empty",
                f"got {len(vehicles)} items")
    assert_that((b.get("meta") or {}).get("count") == 0, "meta.count == 0")


def test_filters_echoed_in_meta(client) -> None:
    """Applied filters must be echoed (lowercased) in meta.filters."""
    print("\n[8] meta.filters reflection — make and year")

    with patch(
        "services.car_service.CarService._fetch_from_api",
        return_value=_MOCK_MODELS_RESPONSE,
    ):
        r = client.get("/cars?make=Toyota&year=2022")
        b = body(r)

    filters: dict = (b.get("meta") or {}).get("filters", {})
    assert_that(filters.get("make") == "toyota",
                "meta.filters.make lowercased to 'toyota'",
                f"got '{filters.get('make')}'")
    assert_that(filters.get("year") == 2022,
                "meta.filters.year is int 2022",
                f"got {filters.get('year')!r}")
    assert_that(filters.get("model") is None,
                "meta.filters.model is null when not supplied")


def test_404_returns_structured_envelope(client) -> None:
    """An unknown route must return HTTP 404 with a structured envelope."""
    print("\n[9] 404 handler")

    r = client.get("/does-not-exist")
    b = body(r)

    assert_that(r.status_code == 404,  "HTTP 404")
    assert_that(b["data"] is None,     "data is null")
    assert_that((b.get("error") or {}).get("code") == "not_found",
                "error.code == 'not_found'")


def test_405_returns_structured_envelope(client) -> None:
    """POST to a GET-only route must return HTTP 405 with a structured envelope."""
    print("\n[10] 405 handler — POST to /cars")

    r = client.post("/cars/")
    b = body(r)

    assert_that(r.status_code == 405,  "HTTP 405")
    assert_that(b["data"] is None,     "data is null")
    assert_that((b.get("error") or {}).get("code") == "method_not_allowed",
                "error.code == 'method_not_allowed'")


def test_upstream_failure_returns_503_envelope(client) -> None:
    """When CarService raises CarQueryUnavailableError (no cache + API down),
    the response must be HTTP 503 with error_code='vehicle_data_unavailable'."""
    print("\n[11] Upstream failure — 503 envelope")

    from exceptions import CarQueryUnavailableError

    with patch(
        "services.car_service.CarService._cached_request",
        side_effect=CarQueryUnavailableError(),
    ):
        r = client.get("/cars?year=2022")
        b = body(r)

    assert_that(r.status_code == 503,  "HTTP 503")
    assert_that(b["data"] is None,     "data is null on 503")
    assert_that(
        (b.get("error") or {}).get("code") == "vehicle_data_unavailable",
        "error.code == 'vehicle_data_unavailable'",
        f"got '{(b.get('error') or {}).get('code')}'",
    )


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_test(fn, client) -> None:
    try:
        fn(client)
    except Exception:
        print(f"  {_FAIL}  EXCEPTION in {fn.__name__}")
        traceback.print_exc()
        _results.append((fn.__name__, False))


def main() -> int:
    print("=" * 62)
    print("  CarLy  /cars  Endpoint — Smoke Test Suite")
    print("=" * 62)

    flask_app = create_app(TestingConfig())
    test_fns = [
        test_envelope_structure_on_valid_year_request,
        test_vehicles_list_contains_normalised_makes,
        test_full_trim_query_returns_vehicle_entities,
        test_msrp_zero_normalised_to_null,
        test_invalid_year_string_returns_400,
        test_year_out_of_range_returns_400,
        test_no_params_returns_empty_list,
        test_filters_echoed_in_meta,
        test_404_returns_structured_envelope,
        test_405_returns_structured_envelope,
        test_upstream_failure_returns_503_envelope,
    ]

    with flask_app.test_client() as client:
        for fn in test_fns:
            run_test(fn, client)

    total  = len(_results)
    passed = sum(1 for _, ok in _results if ok)
    failed = total - passed

    print("\n" + "=" * 62)
    if failed == 0:
        print(f"  {_PASS}  {passed}/{total} passed — All clear")
    else:
        print(f"  {_FAIL}  {passed}/{total} passed — {failed} FAILED")
    print("=" * 62)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
