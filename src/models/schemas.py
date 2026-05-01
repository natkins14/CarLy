from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CreditTier(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class PurchaseType(str, Enum):
    FINANCE = "finance"
    LEASE = "lease"
    BOTH = "both"


class BudgetMode(str, Enum):
    MONTHLY = "monthly"
    TOTAL = "total"


class VehicleRecord(BaseModel):
    model_config = ConfigDict(frozen=True)

    make: str
    model: str
    year: int = Field(ge=1900, le=2100)
    trim: str | None = None
    msrp: float | None = Field(default=None, ge=0)
    estimated_residual_value: float | None = Field(default=None, ge=0)


class SessionInitRequest(BaseModel):
    credit_score: int | None = Field(default=None, ge=300, le=850)
    credit_tier: CreditTier | None = None
    zip_code: str | None = None

    @field_validator("zip_code")
    @classmethod
    def validate_zip_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.isdigit() or len(value) != 5:
            raise ValueError("zip_code must be exactly 5 digits")
        return value

    @model_validator(mode="after")
    def ensure_credit_hint(self) -> "SessionInitRequest":
        if self.credit_score is None and self.credit_tier is None:
            return self
        return self


class SessionClaims(BaseModel):
    model_config = ConfigDict(frozen=True)

    session_id: str
    credit_tier: CreditTier | None = None
    zip_code: str | None = None
    exp: int
    iat: int


class EstimateRequest(BaseModel):
    budget_mode: BudgetMode
    budget_value: float = Field(gt=0, le=500_000)
    purchase_type: PurchaseType = PurchaseType.BOTH
    down_payment: float = Field(default=0.0, ge=0, le=500_000)
    loan_term_months: int = Field(default=60)
    zip_code: str
    credit_score: int | None = Field(default=None, ge=300, le=850)
    credit_tier: CreditTier | None = None
    year: int = Field(ge=1900, le=2100)
    make: str = Field(min_length=1)
    model: str = Field(min_length=1)
    trim: str | None = None
    msrp: float | None = Field(default=None, gt=0, le=500_000)

    @field_validator("loan_term_months")
    @classmethod
    def validate_term(cls, value: int) -> int:
        allowed = {24, 36, 48, 60, 72, 84}
        if value not in allowed:
            raise ValueError(f"loan_term_months must be one of {sorted(allowed)}")
        return value

    @field_validator("zip_code")
    @classmethod
    def validate_zip_code(cls, value: str) -> str:
        if not value.isdigit() or len(value) != 5:
            raise ValueError("zip_code must be exactly 5 digits")
        return value

    @field_validator("make", "model", "trim")
    @classmethod
    def normalize_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class TaxEstimate(BaseModel):
    model_config = ConfigDict(frozen=True)

    zip_code: str
    state_code: str | None = None
    sales_tax_rate: float = Field(default=0.0, ge=0)
    sales_tax_amount: float = Field(default=0.0, ge=0)
    documentation_fee: float = Field(default=0.0, ge=0)
    estimated_total_fees: float = Field(default=0.0, ge=0)
    all_in_price: float | None = Field(default=None, ge=0)


class FinanceResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    monthly_payment: float = Field(ge=0)
    total_cost: float = Field(ge=0)
    total_interest: float = Field(ge=0)
    apr_applied: float = Field(ge=0)
    term_months: int


class LeaseResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    monthly_payment: float = Field(ge=0)
    total_cost: float = Field(ge=0)
    money_factor_applied: float = Field(ge=0)
    residual_pct_applied: float = Field(ge=0)
    residual_value: float = Field(ge=0)
    term_months: int


class PaymentResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    finance_monthly_payment: float = Field(ge=0)
    finance_total_cost: float = Field(ge=0)
    finance_total_interest: float = Field(ge=0)
    apr_applied: float = Field(ge=0)
    lease_monthly_payment: float | None = Field(default=None, ge=0)
    lease_total_cost: float | None = Field(default=None, ge=0)
    money_factor_applied: float | None = Field(default=None, ge=0)
    residual_pct_applied: float | None = Field(default=None, ge=0)
    residual_value: float | None = Field(default=None, ge=0)
    term_months: int
    down_payment_applied: float = Field(ge=0)
    sales_tax_rate: float = Field(ge=0)
    all_in_price: float | None = Field(default=None, ge=0)
    budget_mode: BudgetMode
    budget_value: float = Field(gt=0)
    budget_fit: bool
    filter_relaxation_suggestion: str | None = None
    warnings: list[str] = Field(default_factory=list)
    calculation_timestamp: datetime


class EstimateResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    vehicle: VehicleRecord
    payment_result: PaymentResult
    tax_estimate: TaxEstimate
    user_context: dict[str, Any]
