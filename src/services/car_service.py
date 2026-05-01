from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any, Literal
from urllib.parse import quote

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
    """NHTSA vPIC adapter with cache-backed normalization.

    Uses the US DOT NHTSA Vehicle Products Information Catalog API
    (https://vpic.nhtsa.dot.gov/api/) — free, no auth required.

    Remains budget-blind by design. Does not perform payment calculations.
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
        # NHTSA does not filter makes by year; we cache per-year so a future
        # upgrade can swap in a year-aware source without changing callers.
        url = f"{self._api_url}GetMakesForVehicleType/passenger%20car?format=json"
        raw = self._cached_get(url, f"nhtsa:makes:{year}")
        return [
            {
                "make_id": str(entry.get("MakeId", "")),
                "make_display": entry.get("MakeName", "").title(),
            }
            for entry in raw.get("Results", [])
            if entry.get("MakeName")
        ]

    def get_models(self, make: str, year: int) -> list[dict[str, str]]:
        encoded_make = quote(make, safe="")
        url = (
            f"{self._api_url}GetModelsForMakeYear/make/{encoded_make}"
            f"/modelyear/{year}?format=json"
        )
        raw = self._cached_get(url, f"nhtsa:models:{make.lower()}:{year}")
        return [
            {
                "model_name": entry.get("Model_Name", ""),
                "model_make_id": entry.get("Make_Name", ""),
            }
            for entry in raw.get("Results", [])
            if entry.get("Model_Name")
        ]

    def get_trims(
        self,
        make: str,
        model: str,
        year: int,
    ) -> list[VehicleRecord]:
        # NHTSA does not expose trim-level data; return the model as a single
        # record. The VehicleSelector will prompt for manual MSRP entry.
        return [
            VehicleRecord(
                make=make,
                model=model,
                year=year,
                trim=None,
                msrp=None,
                estimated_residual_value=None,
            )
        ]

    def search_vehicles(
        self,
        make: str | None = None,
        model: str | None = None,
        year: int | None = None,
    ) -> list[VehicleRecord]:
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
        # NHTSA does not supply MSRP; manual_msrp is always required.
        if manual_msrp is None:
            raise NotFoundError(
                message="MSRP is required. Please enter the vehicle MSRP manually.",
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

    # ─── Internal helpers ─────────────────────────────────────────────────────

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
        session.headers.update({"Accept": "application/json", "User-Agent": "CarLy/2.0"})
        return session

    def _make_cache_key(self, key: str) -> str:
        key_hash = hashlib.md5(key.encode("utf-8")).hexdigest()[:8]
        safe = key.replace(":", "_").replace("/", "_").replace(" ", "_")[:40]
        return f"{safe}_{key_hash}"

    def _get_cache_path(self, key: str) -> Path:
        return self._cache_dir / f"{key}.json"

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

    def _fetch_url(self, url: str) -> dict[str, Any]:
        start_ts = time.monotonic()
        try:
            response = self._session.get(url, timeout=self._timeout)
            elapsed_ms = int((time.monotonic() - start_ts) * 1000)
            logger.debug("NHTSA GET | url=%s | status=%d | elapsed=%dms", url, response.status_code, elapsed_ms)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as exc:
            raise CarQueryTimeoutError() from exc
        except requests.exceptions.HTTPError as exc:
            raise CarQueryException(message=f"NHTSA API returned an error: {exc}") from exc
        except requests.exceptions.RequestException as exc:
            raise CarQueryException(message=f"Failed to reach NHTSA API: {exc}") from exc

    def _cached_get(self, url: str, cache_key: str) -> dict[str, Any]:
        key = self._make_cache_key(cache_key)
        cached_data, zone = self._read_cache(key)

        if zone in ("fresh", "stale"):
            if zone == "stale":
                logger.info("Serving stale cache for %s", cache_key)
            return cached_data or {}

        try:
            live_data = self._fetch_url(url)
            self._write_cache(key, live_data)
            return live_data
        except (CarQueryTimeoutError, CarQueryException) as exc:
            raise CarQueryUnavailableError() from exc
