"""
utils/response.py — Standardised JSON Envelope Factory

All API responses must conform to the three-field envelope:
  { "data": ..., "meta": ..., "error": ... }

Using factory functions (rather than a dict literal at each call site) ensures
the envelope shape can never drift — there is one definition, one place to
update, and static-analysis tools can track all usages.
"""
from __future__ import annotations

import time
from typing import Any

from flask import jsonify, Response


def success_response(
    data: Any,
    status_code: int = 200,
    meta: dict | None = None,
) -> tuple[Response, int]:
    """Build a successful JSON envelope response.

    Args:
        data:        The primary payload. May be a dict, list, or scalar.
        status_code: HTTP status code (default 200).
        meta:        Optional metadata dict (pagination, cache_zone, timing, etc.).

    Returns:
        A (Flask Response, int) tuple suitable for returning directly from a route.

    Example:
        return success_response({"vehicles": [...]}, meta={"count": 3})
    """
    envelope: dict[str, Any] = {
        "data": data,
        "meta": {
            "timestamp": int(time.time()),
            **(meta or {}),
        },
        "error": None,
    }
    return jsonify(envelope), status_code


def error_response(
    message: str,
    error_code: str,
    status_code: int = 500,
    meta: dict | None = None,
) -> tuple[Response, int]:
    """Build an error JSON envelope response.

    Args:
        message:     Human-readable error description.
        error_code:  Machine-readable snake_case error identifier.
        status_code: HTTP status code.
        meta:        Optional metadata dict.

    Returns:
        A (Flask Response, int) tuple.
    """
    envelope: dict[str, Any] = {
        "data": None,
        "meta": {
            "timestamp": int(time.time()),
            **(meta or {}),
        },
        "error": {
            "code": error_code,
            "message": message,
        },
    }
    return jsonify(envelope), status_code
