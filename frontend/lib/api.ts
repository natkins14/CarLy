// ─────────────────────────────────────────────────────────────────────────────
// lib/api.ts
// Typed fetch wrappers for every CarLy backend endpoint.
//
// Design decisions:
//  - All functions are async and return typed results or throw ApiError.
//  - Credentials are always included so the HttpOnly JWT cookie is sent.
//  - No global state — callers own loading/error state (React, SWR, etc.).
//  - The X-Cache-Status header is forwarded to callers where relevant.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ApiError,
  CacheZone,
  EstimateRequest,
  EstimateResponse,
  SessionClaims,
  SessionInitRequest,
  VehicleRecord,
} from "@/types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Core fetch wrapper. Throws a typed ApiError for any non-2xx response.
 * Always includes credentials (cookie forwarding) and sets Content-Type.
 */
async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(path, {
    ...init,
    credentials: "include", // Required for HttpOnly JWT cookie
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    // Attempt to parse the backend error envelope
    let apiError: ApiError;
    try {
      apiError = await response.json();
    } catch {
      // Fallback for unexpected non-JSON errors (e.g. Vercel 502)
      apiError = {
        error: "network_error",
        message: `Unexpected response from server (HTTP ${response.status}).`,
        action: "retry",
      };
    }
    throw apiError;
  }

  const data: T = await response.json();
  return { data, headers: response.headers };
}

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * POST /api/session/init
 *
 * Creates a new session JWT and sets the HttpOnly cookie.
 * Call this on terms acceptance (TermsGate) and on session expiry.
 *
 * @param payload  Optional credit score / tier and ZIP code to embed in session.
 * @returns        SessionClaims decoded from the response body.
 */
export async function initSession(
  payload: SessionInitRequest = {}
): Promise<SessionClaims> {
  const { data } = await apiFetch<SessionClaims>("/api/session/init", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data;
}

// ─── Estimation ───────────────────────────────────────────────────────────────

/**
 * Result type that includes the optional stale-data cache zone so the
 * frontend can render the "Vehicle data as of [Timestamp]" banner.
 */
export interface EstimateResult {
  response: EstimateResponse;
  /** Present when the backend served vehicle data from stale cache. */
  cacheZone: CacheZone | null;
}

/**
 * POST /api/estimate
 *
 * Runs the full estimation pipeline: vehicle resolution → DCS → AI narrative.
 * Requires a valid session cookie (set via initSession).
 *
 * @param payload  Validated EstimateRequest (use EstimateRequestSchema first).
 * @returns        EstimateResult including optional cache zone metadata.
 * @throws         ApiError on validation failure (400), auth failure (401),
 *                 vehicle data unavailability (503), or server error (500/422).
 */
export async function fetchEstimate(
  payload: EstimateRequest
): Promise<EstimateResult> {
  const { data, headers } = await apiFetch<EstimateResponse>("/api/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const rawCacheZone = headers.get("X-Cache-Status");
  const cacheZone: CacheZone | null =
    rawCacheZone === "fresh" ||
    rawCacheZone === "stale" ||
    rawCacheZone === "expired"
      ? rawCacheZone
      : null;

  return { response: data, cacheZone };
}

// ─── Vehicle / Cars ───────────────────────────────────────────────────────────

/**
 * Parameters for GET /cars/
 * All filters are optional; omitting all returns an empty array.
 */
export interface VehicleSearchParams {
  year?: number;
  make?: string;
  model?: string;
}

/**
 * Result type that surfaces cache zone for the stale-data UI banner.
 */
export interface VehicleSearchResult {
  vehicles: VehicleRecord[];
  cacheZone: CacheZone | null;
}

/**
 * GET /cars/
 *
 * Fetches a list of VehicleRecord objects matching the given filters.
 * Used to populate cascading Year → Make → Model → Trim dropdowns.
 *
 * The backend is "budget-blind" on this endpoint — no financial filtering
 * occurs here. Budget-based filtering happens inside POST /api/estimate.
 *
 * @param params   Optional year / make / model filters.
 * @returns        VehicleSearchResult including optional cache zone metadata.
 * @throws         ApiError on 503 (vehicle data unavailable) or 500.
 */
export async function fetchVehicles(
  params: VehicleSearchParams = {}
): Promise<VehicleSearchResult> {
  const query = new URLSearchParams();
  if (params.year !== undefined) query.set("year", String(params.year));
  if (params.make) query.set("make", params.make);
  if (params.model) query.set("model", params.model);

  const path = `/cars/${query.toString() ? `?${query}` : ""}`;

  const { data, headers } = await apiFetch<VehicleRecord[]>(path, {
    method: "GET",
  });

  const rawCacheZone = headers.get("X-Cache-Status");
  const cacheZone: CacheZone | null =
    rawCacheZone === "fresh" ||
    rawCacheZone === "stale" ||
    rawCacheZone === "expired"
      ? rawCacheZone
      : null;

  return { vehicles: data, cacheZone };
}

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Narrows an unknown thrown value to ApiError so callers can
 * access `.message`, `.action`, etc. without a type assertion.
 *
 * Usage:
 *   try { await fetchEstimate(payload); }
 *   catch (err) {
 *     if (isApiError(err)) setError(err);
 *   }
 */
export function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "error" in err &&
    "message" in err &&
    "action" in err
  );
}
