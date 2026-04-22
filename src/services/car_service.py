"""
services/car_service.py — CarQuery API Service Layer

This is the ONLY module in the application that is aware of the CarQuery
external API. All other modules receive the normalised internal Vehicle
entity or list of makes/models.

Key design decisions:
  - requests.Session with HTTPAdapter + Retry for connection reuse and
    transparent backoff on transient upstream errors.
  - File-based Stale-While-Revalidate cache (fresh / stale / expired zones)
    per architecture.md §2.2.2. Cache keys are content-addressed via md5.
  - All CarQuery fields are normalised before leaving this module. Raw
    API response shapes never propagate to routes or other services.
  - Execution time is logged at DEBUG level on every external call to
    enable latency profiling without a dedicated APM tool.
"""
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
)

logger: logging.Logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal type aliases
# ---------------------------------------------------------------------------
CacheZone = Literal["fresh", "stale", "expired"]

# Normalised internal Vehicle entity (per architecture.md §2.2.2 table)
VehicleEntity = dict[str, Any]  # typed dict would be ideal; kept as alias for clarity

MakeEntry = dict[str, str]   # {"make_id": str, "make_display": str}
ModelEntry = dict[str, str]  # {"model_name": str, "model_make_id": str}
TrimEntry = dict[str, Any]   # raw trim before normalisation


class CarService:
    """Encapsulates all interactions with the CarQuery API.

    Instantiate once (in app.py) and share the instance via Flask's
    application context or dependency injection pattern. This preserves
    the requests.Session across requests, maximising connection reuse.

    Args:
        api_url:         Base URL for the CarQuery API (overridable for tests).
        timeout_seconds: Per-request timeout ceiling in seconds.
        cache_dir:       Directory for the file-based SWR cache.
        fresh_ttl:       Age (seconds) below which cache is considered fresh.
        stale_ttl:       Age (seconds) below which cache is considered stale.
    """

    def __init__(
        self,
        api_url: str,
        timeout_seconds: int,
        cache_dir: Path,
        fresh_ttl: int = 86_400,
        stale_ttl: int = 172_800,
    ) -> None:
        self._api_url: str = api_url.rstrip("/") + "/"
        self._timeout: int = timeout_seconds
        self._cache_dir: Path = cache_dir
        self._fresh_ttl: int = fresh_ttl
        self._stale_ttl: int = stale_ttl

        self._session: requests.Session = self._build_session()
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(
            "CarService initialised | api_url=%s | cache_dir=%s | timeout=%ds",
            self._api_url,
            self._cache_dir,
            self._timeout,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_makes(self, year: int) -> list[MakeEntry]:
        """Fetch all US-market makes for a given model year.

        Corresponds to CarQuery cmd=getMakes (Step 1 of the hierarchical
        query sequence defined in architecture.md §2.2.2).

        Args:
            year: Four-digit model year, e.g. 2023.

        Returns:
            List of dicts with keys: make_id, make_display.

        Raises:
            CarQueryUnavailableError: API unreachable with no usable cache.
            CarQueryTimeoutError:     API did not respond within timeout.
            CarQueryException:        Any other upstream error.
        """
        params: dict[str, Any] = {
            "cmd": "getMakes",
            "year": year,
            "sold_in_us": 1,
        }
        raw: dict = self._cached_request(params)
        makes: list[MakeEntry] = [
            {
                "make_id": entry.get("make_id", ""),
                "make_display": entry.get("make_display", ""),
            }
            for entry in raw.get("Makes", [])
            if entry.get("make_display")
        ]
        logger.debug("get_makes | year=%d | count=%d", year, len(makes))
        return makes

    def get_models(self, make: str, year: int) -> list[ModelEntry]:
        """Fetch all US-market models for a make and model year.

        Corresponds to CarQuery cmd=getModels (Step 2).

        Args:
            make: Make identifier as returned by get_makes (make_id).
            year: Four-digit model year.

        Returns:
            List of dicts with keys: model_name, model_make_id.

        Raises:
            CarQueryUnavailableError, CarQueryTimeoutError, CarQueryException.
        """
        params: dict[str, Any] = {
            "cmd": "getModels",
            "make": make,
            "year": year,
            "sold_in_us": 1,
        }
        raw: dict = self._cached_request(params)
        models: list[ModelEntry] = [
            {
                "model_name": entry.get("model_name", ""),
                "model_make_id": entry.get("model_make_id", ""),
            }
            for entry in raw.get("Models", [])
            if entry.get("model_name")
        ]
        logger.debug(
            "get_models | make=%s | year=%d | count=%d", make, year, len(models)
        )
        return models

    def get_trims(
        self,
        make: str,
        model: str,
        year: int,
    ) -> list[VehicleEntity]:
        """Fetch available trims and return normalised VehicleEntity list.

        Corresponds to CarQuery cmd=getTrims (Step 3) + internal normalisation
        (Step 4). Raw CarQuery fields are transformed here and never exported.

        Args:
            make:  Make identifier (make_id).
            model: Model name as returned by get_models.
            year:  Four-digit model year.

        Returns:
            List of normalised VehicleEntity dicts.

        Raises:
            CarQueryUnavailableError, CarQueryTimeoutError, CarQueryException.
        """
        params: dict[str, Any] = {
            "cmd": "getTrims",
            "make": make,
            "model": model,
            "year": year,
        }
        raw: dict = self._cached_request(params)
        trims: list[TrimEntry] = raw.get("Trims", [])
        normalised: list[VehicleEntity] = [
            self._normalise_trim(trim) for trim in trims
        ]
        logger.debug(
            "get_trims | make=%s | model=%s | year=%d | count=%d",
            make,
            model,
            year,
            len(normalised),
        )
        return normalised

    def search_vehicles(
        self,
        make: str | None = None,
        model: str | None = None,
        year: int | None = None,
    ) -> list[VehicleEntity]:
        """High-level search used by GET /cars.

        Resolves the correct CarQuery command based on which parameters are
        supplied and returns normalised VehicleEntity objects.

        Query logic:
          - make + model + year  → getTrims (most specific)
          - make + year          → getModels (returns models, not full vehicles)
          - year only            → getMakes  (returns makes, not full vehicles)

        For the /cars route, all three params are expected for a meaningful
        result. Partial queries return partial data shaped as VehicleEntity
        with only the available fields populated.

        Args:
            make:  Optional make identifier.
            model: Optional model name.
            year:  Optional model year.

        Returns:
            List of VehicleEntity dicts.
        """
        if make and model and year:
            return self.get_trims(make, model, year)

        if make and year:
            models = self.get_models(make, year)
            return [
                {
                    "make": make,
                    "model": m["model_name"],
                    "year": year,
                    "trim": None,
                    "msrp": None,
                    "estimated_residual_value": None,
                }
                for m in models
            ]

        if year:
            makes = self.get_makes(year)
            return [
                {
                    "make": m["make_display"],
                    "model": None,
                    "year": year,
                    "trim": None,
                    "msrp": None,
                    "estimated_residual_value": None,
                }
                for m in makes
            ]

        # No useful params — return empty rather than an unbounded query
        logger.warning("search_vehicles called with no filter parameters.")
        return []

    # ------------------------------------------------------------------
    # Private: HTTP + Cache
    # ------------------------------------------------------------------

    def _build_session(self) -> requests.Session:
        """Construct a requests.Session with connection pooling and retry logic.

        HTTPAdapter with Retry provides:
          - 3 retries on connection errors and 502/503/504 status codes.
          - Exponential backoff (0.3s, 0.6s, 1.2s) between attempts.
          - Separate pools for HTTP and HTTPS to match CarQuery's endpoint.

        The timeout is NOT set on the session (it must be per-call so that
        the configured value from settings is always respected).
        """
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.3,
            status_forcelist=[502, 503, 504],
            allowed_methods=["GET"],
            raise_on_status=False,  # We handle status codes manually below
        )
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=4,
            pool_maxsize=10,
        )
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        session.headers.update(
            {
                "Accept": "application/json",
                "User-Agent": "CarLy/1.0 (contact: ops@carly.app)",
            }
        )
        return session

    def _make_cache_key(self, params: dict[str, Any]) -> str:
        """Produce a deterministic, filesystem-safe cache key.

        The key format matches architecture.md §2.2.2:
          carquery:{cmd}:{md5(sorted_json(params))}
        """
        cmd: str = params.get("cmd", "unknown")
        # Sort keys for determinism regardless of dict insertion order
        params_json: str = json.dumps(params, sort_keys=True)
        params_hash: str = hashlib.md5(params_json.encode()).hexdigest()[:8]
        return f"carquery:{cmd}:{params_hash}"

    def _get_cache_path(self, key: str) -> Path:
        # Sanitise the key to be a safe filename (replace colons)
        safe_name: str = key.replace(":", "_")
        return self._cache_dir / f"{safe_name}.json"

    def _read_cache(self, key: str) -> tuple[dict | None, CacheZone]:
        """Read from the file cache and return the data with its freshness zone.

        Returns:
            (data, zone) where zone is "fresh", "stale", or "expired".
            data is None when zone is "expired".
        """
        path: Path = self._get_cache_path(key)
        if not path.exists():
            return None, "expired"

        age: float = time.time() - path.stat().st_mtime
        try:
            data: dict = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Cache read error for key=%s: %s", key, exc)
            return None, "expired"

        if age <= self._fresh_ttl:
            return data, "fresh"
        if age <= self._stale_ttl:
            return data, "stale"
        return None, "expired"

    def _write_cache(self, key: str, data: dict) -> None:
        """Persist API response to the file cache."""
        path: Path = self._get_cache_path(key)
        try:
            path.write_text(json.dumps(data), encoding="utf-8")
            logger.debug("Cache write | key=%s", key)
        except OSError as exc:
            # Non-fatal: log and continue — degraded to no-cache mode
            logger.warning("Cache write failed for key=%s: %s", key, exc)

    def _fetch_from_api(self, params: dict[str, Any]) -> dict:
        """Execute an HTTP GET against the CarQuery API.

        Args:
            params: Query parameters (including cmd).

        Returns:
            Parsed JSON response dict.

        Raises:
            CarQueryTimeoutError: Raised on requests.Timeout.
            CarQueryException:    Raised on any other requests or HTTP error.
        """
        start_ts: float = time.monotonic()
        try:
            response = self._session.get(
                self._api_url,
                params=params,
                timeout=self._timeout,
            )
            elapsed_ms: int = int((time.monotonic() - start_ts) * 1000)
            logger.debug(
                "CarQuery HTTP GET | cmd=%s | status=%d | elapsed=%dms",
                params.get("cmd"),
                response.status_code,
                elapsed_ms,
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout as exc:
            elapsed_ms = int((time.monotonic() - start_ts) * 1000)
            logger.error(
                "CarQuery timeout | cmd=%s | elapsed=%dms",
                params.get("cmd"),
                elapsed_ms,
            )
            raise CarQueryTimeoutError() from exc

        except requests.exceptions.HTTPError as exc:
            logger.error(
                "CarQuery HTTP error | cmd=%s | status=%s",
                params.get("cmd"),
                getattr(exc.response, "status_code", "unknown"),
            )
            raise CarQueryException(
                message=f"CarQuery API returned an error: {exc}"
            ) from exc

        except requests.exceptions.RequestException as exc:
            logger.error("CarQuery request failed | cmd=%s | error=%s", params.get("cmd"), exc)
            raise CarQueryException(
                message=f"Failed to reach CarQuery API: {exc}"
            ) from exc

    def _cached_request(self, params: dict[str, Any]) -> dict:
        """Cache-aware wrapper around _fetch_from_api.

        Implements the Stale-While-Revalidate strategy defined in
        architecture.md §2.2.2:

          fresh   → Return cached data. No API call.
          stale   → Return cached data. Log that revalidation is needed.
                    (Background async revalidation is deferred to Phase 2
                     when asyncio is introduced. For this Flask MVP, the
                     stale data is returned and the cache is updated
                     synchronously on the next "expired" request.)
          expired → Fetch from API. Update cache on success.
                    On failure with no cache: raise CarQueryUnavailableError.

        Args:
            params: CarQuery query params including cmd.

        Returns:
            Parsed response dict (from cache or live API).
        """
        key: str = self._make_cache_key(params)
        cached_data, zone = self._read_cache(key)

        if zone == "fresh":
            logger.debug("Cache HIT (fresh) | key=%s", key)
            return cached_data  # type: ignore[return-value]

        if zone == "stale":
            logger.info(
                "Cache HIT (stale) | key=%s | Serving stale data. "
                "Revalidation will occur on next expired request.",
                key,
            )
            # Stale data is served immediately; revalidation is deferred
            # (architecture.md §5.1: asyncio.create_task pattern for Phase 2)
            return cached_data  # type: ignore[return-value]

        # zone == "expired": must call the live API
        logger.debug("Cache MISS (expired) | key=%s | Calling CarQuery API.", key)
        try:
            live_data: dict = self._fetch_from_api(params)
            self._write_cache(key, live_data)
            return live_data
        except (CarQueryTimeoutError, CarQueryException) as exc:
            # API failed — no usable cache exists. Hard failure.
            logger.error(
                "CarQuery unavailable and no cache | key=%s | error=%s", key, exc
            )
            raise CarQueryUnavailableError() from exc

    # ------------------------------------------------------------------
    # Private: Normalisation
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_msrp(raw_value: Any) -> float | None:
        """Normalise a CarQuery MSRP value.

        Per architecture.md §2.2.2: treat absent or "0" as null.

        Args:
            raw_value: The raw model_msrp from CarQuery.

        Returns:
            Float MSRP or None.
        """
        if raw_value is None:
            return None
        try:
            value = float(raw_value)
            return value if value > 0 else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _normalise_trim(raw: TrimEntry) -> VehicleEntity:
        """Transform a raw CarQuery trim dict into a clean VehicleEntity.

        Mapping table (architecture.md §2.2.2):
          make_display  → make        (direct)
          model_name    → model       (direct)
          model_year    → year        (int cast)
          model_trim    → trim        (null if absent)
          model_msrp    → msrp        (float or null per _parse_msrp)
          (derived)     → estimated_residual_value  (null at this layer;
                          populated by DCS when credit_tier is known)
        """
        msrp: float | None = CarService._parse_msrp(raw.get("model_msrp"))
        try:
            year: int = int(raw.get("model_year", 0))
        except (TypeError, ValueError):
            year = 0

        return {
            "make": raw.get("make_display") or raw.get("model_make_id", ""),
            "model": raw.get("model_name", ""),
            "year": year,
            "trim": raw.get("model_trim") or None,
            "msrp": msrp,
            # Residual value requires credit_tier (known at estimation time).
            # The CarQuery adapter does not have access to user session data,
            # so this field is deferred and populated by the DCS layer.
            "estimated_residual_value": None,
        }
