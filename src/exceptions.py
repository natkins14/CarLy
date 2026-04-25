from __future__ import annotations


class CarLyBaseException(Exception):
    message = "An unexpected error occurred."
    status_code = 500
    error_code = "internal_error"
    action = "none"
    retry_after_seconds: int | None = None

    def __init__(
        self,
        message: str | None = None,
        status_code: int | None = None,
        error_code: str | None = None,
        action: str | None = None,
        retry_after_seconds: int | None = None,
    ) -> None:
        self.message = message or self.__class__.message
        self.status_code = status_code or self.__class__.status_code
        self.error_code = error_code or self.__class__.error_code
        self.action = action or self.__class__.action
        self.retry_after_seconds = (
            retry_after_seconds
            if retry_after_seconds is not None
            else self.__class__.retry_after_seconds
        )
        super().__init__(self.message)

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "error": self.error_code,
            "message": self.message,
            "action": self.action,
        }
        if self.retry_after_seconds is not None:
            payload["retry_after_seconds"] = self.retry_after_seconds
        return payload


class CarQueryException(CarLyBaseException):
    message = "The vehicle data service returned an error."
    status_code = 502
    error_code = "carquery_error"
    action = "retry"


class CarQueryUnavailableError(CarQueryException):
    message = "CarQuery API is unreachable and no cache is available."
    status_code = 503
    error_code = "vehicle_data_unavailable"
    action = "retry"
    retry_after_seconds = 30


class CarQueryTimeoutError(CarQueryException):
    message = "The vehicle data service timed out."
    status_code = 504
    error_code = "carquery_timeout"
    action = "retry"


class ValidationError(CarLyBaseException):
    message = "Invalid request parameters."
    status_code = 400
    error_code = "validation_error"
    action = "none"


class NotFoundError(CarLyBaseException):
    message = "The requested resource was not found."
    status_code = 404
    error_code = "not_found"
    action = "none"


class AuthenticationError(CarLyBaseException):
    message = "Your session has expired. Please start over."
    status_code = 401
    error_code = "jwt_invalid"
    action = "reload"


class DCSCalculationError(CarLyBaseException):
    message = "We couldn't calculate payments for this vehicle. Please check your inputs."
    status_code = 422
    error_code = "dcs_calculation_error"
    action = "none"
