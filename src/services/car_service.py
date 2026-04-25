from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any, Literal

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from exceptions import (
    CarQueryException,
    CarQueryTimeoutError,
    CarQueryUnavailableError,
    NotFoundError,
)
from models.schemas import CreditTier, VehicleRecord
from services.dcs import estimate_residual_value

logger = logging.getLogger(__name__)

CacheZone = Literal["fresh", "stale", "expired"]


class CarService:
    """CarQuery adapter with cache-backed normalization only.

    This service remains budget-blind by design. It is responsible for:
      - calling CarQuery
      - caching responses
      - transforming raw API payloads into VehicleRecord objects

    It does not perform payment calculations or affordability decisions.
    """

    def __init__(
        self,
        api_url: str,
        timeout_seconds: int,
        cache_dir: Path,
        fresh_ttl: int = 86_400,
        stale_ttl: int = 172_800,
    ) -> None:
        self._api_url = api_url.rstrip("/") + "/"
        self._timeout = timeout_seconds
        self._cache_dir = cache_dir
        self._fresh_ttl = fresh_ttl
        self._stale_ttl = stale_ttl
        self._session = self._build_session()
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def get_makes(self, year: int) -> list[dict[str, str]]:
        params = {"cmd": "getMakes", "year": year, "sold_in_us": 1}
        raw = self._cached_request(params)
        return [
            {
                "make_id": entry.get("make_id", ""),
                "make_display": entry.get("make_display", ""),
            }
            for entry in raw.get("Makes", [])
            if entry.get("make_display")
        ]

    def get_models(self, make: str, year: int) -> list[dict[str, str]]:
        params = {"cmd": "getModels", "make": make, "year": year, "sold_in_us": 1}
        raw = self._cached_request(params)
        return [
            {
                "model_name": entry.get("model_name", ""),
                "model_make_id": entry.get("model_make_id", ""),
            }
            for entry in raw.get("Models", [])
            if entry.get("model_name")
        ]

    def get_trims(
        self,
        make: str,
        model: str,
        year: int,
    ) -> list[VehicleRecord]:
        params = {"cmd": "getTrims", "make": make, "model": model, "year": year}
        raw = self._cached_request(params)
        trims = raw.get("Trims", [])
        return [self._normalise_trim(trim) for trim in trims]

    def search_vehicles(
        self,
        make: str | None = None,
        model: str | None = None,
        year: int | None = None,
    ) -> list[VehicleRecord]:
        """Branch exclusively on make/model/year and stay affordability-blind."""
        if make and model and year:
            return self.get_trims(make, model, year)

        if make and year:
            return [
                VehicleRecord(
                    make=make,
                    model=entry["model_name"],
                    year=year,
                    trim=None,
                    msrp=None,
                    estimated_residual_value=None,
                )
                for entry in self.get_models(make, year)
            ]

        if year:
            return [
                VehicleRecord(
                    make=entry["make_display"],
                    model="",
                    year=year,
                    trim=None,
                    msrp=None,
                    estimated_residual_value=None,
                )
                for entry in self.get_makes(year)
            ]

        return []

    def resolve_vehicle(
        self,
        make: str,
        model: str,
        year: int,
        trim: str | None = None,
        manual_msrp: float | None = None,
        credit_tier: CreditTier = CreditTier.GOOD,
    ) -> VehicleRecord:
        try:
            vehicles = self.get_trims(make=make, model=model, year=year)
        except CarQueryUnavailableError:
            vehicles = []

        selected: VehicleRecord | None = None

        if trim:
            normalized_trim = trim.strip().lower()
            selected = next(
                (
                    vehicle
                    for vehicle in vehicles
                    if (vehicle.trim or "").strip().lower() == normalized_trim
                ),
                None,
            )
        elif vehicles:
            selected = vehicles[0]

        if selected is None:
            if manual_msrp is None:
                raise NotFoundError(
                    message="Vehicle trim could not be resolved from CarQuery and no MSRP was supplied.",
                    error_code="vehicle_not_found",
                    status_code=404,
                )
            return VehicleRecord(
                make=make.strip(),
                model=model.strip(),
                year=year,
                trim=trim,
                msrp=manual_msrp,
                estimated_residual_value=estimate_residual_value(manual_msrp, credit_tier),
            )

        if selected.msrp is None and manual_msrp is not None:
            return selected.model_copy(
                update={
                    "msrp": manual_msrp,
                    "estimated_residual_value": estimate_residual_value(
                        manual_msrp,
                        credit_tier,
                    ),
                }
            )
        return selected

    def _build_session(self) -> requests.Session:
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.3,
            status_forcelist=[502, 503, 504],
            allowed_methods=["GET"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=4, pool_maxsize=10)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        session.headers.update(
            {
                "Accept": "application/json",
                "User-Agent": "CarLy/2.0 (contact: ops@carly.app)",
            }
        )
        return session

    def _make_cache_key(self, params: dict[str, Any]) -> str:
        cmd = params.get("cmd", "unknown")
        params_json = json.dumps(params, sort_keys=True)
        params_hash = hashlib.md5(params_json.encode("utf-8")).hexdigest()[:8]
        return f"carquery:{cmd}:{params_hash}"

    def _get_cache_path(self, key: str) -> Path:
        return self._cache_dir / f"{key.replace(':', '_')}.json"

    def _read_cache(self, key: str) -> tuple[dict[str, Any] | None, CacheZone]:
        path = self._get_cache_path(key)
        if not path.exists():
            return None, "expired"

        age = time.time() - path.stat().st_mtime
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Cache read failed for %s: %s", key, exc)
            return None, "expired"

        if age <= self._fresh_ttl:
            return data, "fresh"
        if age <= self._stale_ttl:
            return data, "stale"
        return None, "expired"

    def _write_cache(self, key: str, data: dict[str, Any]) -> None:
        path = self._get_cache_path(key)
        try:
            path.write_text(json.dumps(data), encoding="utf-8")
        except OSError as exc:
            logger.warning("Cache write failed for %s: %s", key, exc)

    def _fetch_from_api(self, params: dict[str, Any]) -> dict[str, Any]:
        start_ts = time.monotonic()
        try:
            response = self._session.get(self._api_url, params=params, timeout=self._timeout)
            elapsed_ms = int((time.monotonic() - start_ts) * 1000)
            logger.debug(
                "CarQuery HTTP GET | cmd=%s | status=%d | elapsed=%dms",
                params.get("cmd"),
                response.status_code,
                elapsed_ms,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as exc:
            raise CarQueryTimeoutError() from exc
        except requests.exceptions.HTTPError as exc:
            raise CarQueryException(
                message=f"CarQuery API returned an error: {exc}"
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise CarQueryException(message=f"Failed to reach CarQuery API: {exc}") from exc

    def _cached_request(self, params: dict[str, Any]) -> dict[str, Any]:
        key = self._make_cache_key(params)
        cached_data, zone = self._read_cache(key)

        if zone == "fresh":
            return cached_data or {}

        if zone == "stale":
            logger.info("Serving stale cache for %s", key)
            return cached_data or {}

        try:
            live_data = self._fetch_from_api(params)
            self._write_cache(key, live_data)
            return live_data
        except (CarQueryTimeoutError, CarQueryException) as exc:
            raise CarQueryUnavailableError() from exc

    @staticmethod
    def _parse_msrp(raw_value: Any) -> float | None:
        if raw_value is None:
            return None
        try:
            value = float(raw_value)
            return value if value > 0 else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _normalise_trim(raw: dict[str, Any]) -> VehicleRecord:
        msrp = CarService._parse_msrp(raw.get("model_msrp"))
        try:
            year = int(raw.get("model_year", 0))
        except (TypeError, ValueError):
            year = 0

        return VehicleRecord(
            make=raw.get("make_display") or raw.get("model_make_id", ""),
            model=raw.get("model_name", ""),
            year=year,
            trim=raw.get("model_trim") or None,
            msrp=msrp,
            estimated_residual_value=estimate_residual_value(msrp, CreditTier.GOOD),
        )
