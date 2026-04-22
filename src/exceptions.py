"""
exceptions.py — CarLy Custom Exception Hierarchy

Design: All domain exceptions inherit from CarLyBaseException, which carries
the HTTP status code and a structured payload. This lets the global error
handler in app.py remain a single, logic-free function.
"""


class CarLyBaseException(Exception):
    """Base for all application-level exceptions.

    Attributes:
        message:     Human-readable description (safe to surface to API consumers).
        status_code: HTTP status code this exception maps to.
        error_code:  Machine-readable snake_case identifier for client error handling.
    """

    message: str = "An unexpected error occurred."
    status_code: int = 500
    error_code: str = "internal_error"

    def __init__(
        self,
        message: str | None = None,
        status_code: int | None = None,
        error_code: str | None = None,
    ) -> None:
        self.message = message or self.__class__.message
        self.status_code = status_code or self.__class__.status_code
        self.error_code = error_code or self.__class__.error_code
        super().__init__(self.message)

    def to_dict(self) -> dict:
        return {
            "code": self.error_code,
            "message": self.message,
        }


class CarQueryException(CarLyBaseException):
    """Raised when the CarQuery API returns an unexpected or error response.

    This is the general-purpose CarQuery failure — use the more specific
    subclasses below when the failure mode is known.
    """

    message = "The vehicle data service returned an error."
    status_code = 502  # Bad Gateway — upstream failure
    error_code = "carquery_error"


class CarQueryUnavailableError(CarQueryException):
    """Raised when the CarQuery API is unreachable AND no usable cache exists.

    Maps to HTTP 503 per architecture.md §5.1. The frontend uses this specific
    error_code to trigger the manual MSRP input fallback UI.
    """

    message = "CarQuery API is unreachable and no cache is available."
    status_code = 503
    error_code = "vehicle_data_unavailable"


class CarQueryTimeoutError(CarQueryException):
    """Raised when the CarQuery API does not respond within the configured timeout."""

    message = "The vehicle data service timed out."
    status_code = 504  # Gateway Timeout
    error_code = "carquery_timeout"


class ValidationError(CarLyBaseException):
    """Raised when incoming request parameters fail business-rule validation."""

    message = "Invalid request parameters."
    status_code = 400
    error_code = "validation_error"


class NotFoundError(CarLyBaseException):
    """Raised when a requested resource (e.g., make/model for a year) does not exist."""

    message = "The requested resource was not found."
    status_code = 404
    error_code = "not_found"
