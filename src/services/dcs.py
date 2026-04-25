from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Final

from models.schemas import (
    BudgetMode,
    CreditTier,
    FinanceResult,
    LeaseResult,
    PaymentResult,
    TaxEstimate,
    VehicleRecord,
)


TWOPLACES: Final[Decimal] = Decimal("0.01")
DOC_REG_FEE_RATE: Final[Decimal] = Decimal("0.02")


@dataclass(frozen=True)
class CreditTerms:
    apr: Decimal
    money_factor: Decimal
    residual_pct: Decimal


CREDIT_TERMS: Final[dict[CreditTier, CreditTerms]] = {
    CreditTier.EXCELLENT: CreditTerms(
        apr=Decimal("0.0525"),
        money_factor=Decimal("0.00125"),
        residual_pct=Decimal("0.55"),
    ),
    CreditTier.GOOD: CreditTerms(
        apr=Decimal("0.0725"),
        money_factor=Decimal("0.00175"),
        residual_pct=Decimal("0.53"),
    ),
    CreditTier.FAIR: CreditTerms(
        apr=Decimal("0.1025"),
        money_factor=Decimal("0.00240"),
        residual_pct=Decimal("0.51"),
    ),
    CreditTier.POOR: CreditTerms(
        apr=Decimal("0.1500"),
        money_factor=Decimal("0.00340"),
        residual_pct=Decimal("0.49"),
    ),
}

# Approximate USPS ZIP clusters mapped to state-level base sales tax for MVP.
ZIP_TAX_RANGES: Final[list[tuple[int, int, str, Decimal]]] = [
    (100, 149, "NY", Decimal("0.04")),
    (197, 199, "DE", Decimal("0.00")),
    (201, 246, "VA", Decimal("0.053")),
    (270, 289, "NC", Decimal("0.0475")),
    (290, 299, "SC", Decimal("0.06")),
    (300, 319, "GA", Decimal("0.04")),
    (320, 349, "FL", Decimal("0.06")),
    (430, 459, "OH", Decimal("0.0575")),
    (480, 499, "MI", Decimal("0.06")),
    (590, 599, "MT", Decimal("0.00")),
    (600, 629, "IL", Decimal("0.0625")),
    (750, 799, "TX", Decimal("0.0625")),
    (800, 816, "CO", Decimal("0.029")),
    (850, 865, "AZ", Decimal("0.056")),
    (889, 898, "NV", Decimal("0.0685")),
    (900, 961, "CA", Decimal("0.0725")),
    (970, 979, "OR", Decimal("0.00")),
    (980, 994, "WA", Decimal("0.065")),
    (995, 999, "AK", Decimal("0.00")),
    (30, 38, "NH", Decimal("0.00")),
]


def _to_decimal(value: float | int | str | Decimal) -> Decimal:
    return Decimal(str(value))


def _round_money(value: Decimal) -> float:
    return float(value.quantize(TWOPLACES, rounding=ROUND_HALF_UP))


def map_credit_score_to_tier(credit_score: int | None) -> CreditTier:
    if credit_score is None:
        return CreditTier.GOOD
    if credit_score >= 750:
        return CreditTier.EXCELLENT
    if credit_score >= 700:
        return CreditTier.GOOD
    if credit_score >= 650:
        return CreditTier.FAIR
    return CreditTier.POOR


def resolve_credit_tier(
    credit_score: int | None,
    explicit_tier: CreditTier | None = None,
) -> CreditTier:
    if explicit_tier is not None:
        return explicit_tier
    return map_credit_score_to_tier(credit_score)


def get_credit_terms(tier: CreditTier) -> CreditTerms:
    return CREDIT_TERMS[tier]


def estimate_residual_value(
    msrp: float | None,
    credit_tier: CreditTier,
) -> float | None:
    if msrp is None:
        return None
    terms = get_credit_terms(credit_tier)
    return _round_money(_to_decimal(msrp) * terms.residual_pct)


def lookup_sales_tax(zip_code: str) -> tuple[str | None, float]:
    prefix = int(zip_code[:3]) if len(zip_code) >= 3 else int(zip_code)
    prefix_two = int(zip_code[:2]) if len(zip_code) >= 2 else prefix

    for start, end, state_code, rate in ZIP_TAX_RANGES:
        if start < 100 and start <= prefix_two <= end:
            return state_code, float(rate)
        if start >= 100 and start <= prefix <= end:
            return state_code, float(rate)
    return None, 0.0


def build_tax_estimate(
    msrp: float | None,
    zip_code: str,
    down_payment: float,
) -> TaxEstimate:
    state_code, tax_rate = lookup_sales_tax(zip_code)
    if msrp is None:
        return TaxEstimate(
            zip_code=zip_code,
            state_code=state_code,
            sales_tax_rate=tax_rate,
            sales_tax_amount=0.0,
            documentation_fee=0.0,
            estimated_total_fees=0.0,
            all_in_price=None,
        )

    msrp_decimal = _to_decimal(msrp)
    down_payment_decimal = _to_decimal(down_payment)
    tax_rate_decimal = _to_decimal(tax_rate)

    sales_tax_amount = msrp_decimal * tax_rate_decimal
    doc_fee = msrp_decimal * DOC_REG_FEE_RATE
    total_fees = sales_tax_amount + doc_fee
    all_in_price = msrp_decimal + total_fees - down_payment_decimal

    return TaxEstimate(
        zip_code=zip_code,
        state_code=state_code,
        sales_tax_rate=tax_rate,
        sales_tax_amount=_round_money(sales_tax_amount),
        documentation_fee=_round_money(doc_fee),
        estimated_total_fees=_round_money(total_fees),
        all_in_price=_round_money(all_in_price) if all_in_price >= 0 else 0.0,
    )


def calculate_finance(
    principal: float,
    annual_apr: float,
    term_months: int,
    down_payment: float,
) -> FinanceResult:
    r = _to_decimal(annual_apr) / Decimal("12")
    n = _to_decimal(term_months)
    principal_decimal = _to_decimal(principal)
    down_payment_decimal = _to_decimal(down_payment)

    if r == 0:
        monthly = principal_decimal / n
    else:
        factor = (Decimal("1") + r) ** int(term_months)
        monthly = principal_decimal * (r * factor) / (factor - Decimal("1"))

    monthly = monthly.quantize(TWOPLACES, rounding=ROUND_HALF_UP)
    total_cost = (monthly * n + down_payment_decimal).quantize(
        TWOPLACES,
        rounding=ROUND_HALF_UP,
    )
    total_interest = (total_cost - principal_decimal - down_payment_decimal).quantize(
        TWOPLACES,
        rounding=ROUND_HALF_UP,
    )

    return FinanceResult(
        monthly_payment=float(monthly),
        total_cost=float(total_cost),
        total_interest=float(total_interest),
        apr_applied=annual_apr,
        term_months=term_months,
    )


def calculate_lease(
    msrp: float,
    down_payment: float,
    money_factor: float,
    residual_pct: float,
    term_months: int,
    sales_tax_rate: float,
) -> LeaseResult:
    msrp_decimal = _to_decimal(msrp)
    down_payment_decimal = _to_decimal(down_payment)
    money_factor_decimal = _to_decimal(money_factor)
    residual_pct_decimal = _to_decimal(residual_pct)
    term_decimal = _to_decimal(term_months)
    tax_decimal = _to_decimal(sales_tax_rate)

    cap_cost = msrp_decimal - down_payment_decimal
    residual_value = msrp_decimal * residual_pct_decimal
    depreciation = (cap_cost - residual_value) / term_decimal
    finance_charge = (cap_cost + residual_value) * money_factor_decimal
    base_payment = depreciation + finance_charge
    monthly = (base_payment * (Decimal("1") + tax_decimal)).quantize(
        TWOPLACES,
        rounding=ROUND_HALF_UP,
    )
    total_cost = (monthly * term_decimal + down_payment_decimal).quantize(
        TWOPLACES,
        rounding=ROUND_HALF_UP,
    )

    return LeaseResult(
        monthly_payment=float(monthly),
        total_cost=float(total_cost),
        money_factor_applied=money_factor,
        residual_pct_applied=float(residual_pct_decimal),
        residual_value=_round_money(residual_value),
        term_months=term_months,
    )


def evaluate_budget_fit(
    budget_mode: BudgetMode,
    budget_value: float,
    monthly_payment: float,
    tax_estimate: TaxEstimate,
) -> tuple[bool, str | None]:
    if budget_mode == BudgetMode.MONTHLY:
        ceiling = budget_value * 1.15
        is_fit = monthly_payment <= ceiling
        suggestion = None if is_fit else "Increase monthly budget or improve credit tier."
        return is_fit, suggestion

    all_in_price = tax_estimate.all_in_price or 0.0
    ceiling = budget_value * 1.10
    is_fit = all_in_price <= ceiling
    suggestion = None if is_fit else "Increase total budget, reduce fees, or choose a lower MSRP."
    return is_fit, suggestion


def build_payment_result(
    vehicle: VehicleRecord,
    credit_tier: CreditTier,
    budget_mode: BudgetMode,
    budget_value: float,
    down_payment: float,
    loan_term_months: int,
    purchase_type: str,
    zip_code: str,
) -> tuple[PaymentResult, TaxEstimate]:
    if vehicle.msrp is None:
        raise ValueError("MSRP is required to calculate payments.")

    credit_terms = get_credit_terms(credit_tier)
    tax_estimate = build_tax_estimate(vehicle.msrp, zip_code, down_payment)
    if tax_estimate.all_in_price is None:
        raise ValueError("All-in price could not be estimated.")

    finance_result = calculate_finance(
        principal=tax_estimate.all_in_price,
        annual_apr=float(credit_terms.apr),
        term_months=loan_term_months,
        down_payment=down_payment,
    )

    lease_result: LeaseResult | None = None
    warnings: list[str] = []
    if purchase_type in {"lease", "both"}:
        lease_result = calculate_lease(
            msrp=vehicle.msrp,
            down_payment=down_payment,
            money_factor=float(credit_terms.money_factor),
            residual_pct=float(credit_terms.residual_pct),
            term_months=loan_term_months,
            sales_tax_rate=tax_estimate.sales_tax_rate,
        )

    comparison_monthly = finance_result.monthly_payment
    if purchase_type == "lease" and lease_result is not None:
        comparison_monthly = lease_result.monthly_payment
    elif purchase_type == "both" and lease_result is not None:
        comparison_monthly = min(finance_result.monthly_payment, lease_result.monthly_payment)

    budget_fit, suggestion = evaluate_budget_fit(
        budget_mode=budget_mode,
        budget_value=budget_value,
        monthly_payment=comparison_monthly,
        tax_estimate=tax_estimate,
    )

    if purchase_type == "lease" and lease_result is None:
        warnings.append("Lease estimate unavailable for this vehicle.")

    return (
        PaymentResult(
            finance_monthly_payment=finance_result.monthly_payment,
            finance_total_cost=finance_result.total_cost,
            finance_total_interest=finance_result.total_interest,
            apr_applied=finance_result.apr_applied,
            lease_monthly_payment=lease_result.monthly_payment if lease_result else None,
            lease_total_cost=lease_result.total_cost if lease_result else None,
            money_factor_applied=lease_result.money_factor_applied if lease_result else None,
            residual_pct_applied=lease_result.residual_pct_applied if lease_result else None,
            residual_value=lease_result.residual_value if lease_result else None,
            term_months=loan_term_months,
            down_payment_applied=down_payment,
            sales_tax_rate=tax_estimate.sales_tax_rate,
            all_in_price=tax_estimate.all_in_price,
            budget_mode=budget_mode,
            budget_value=budget_value,
            budget_fit=budget_fit,
            filter_relaxation_suggestion=suggestion,
            warnings=warnings,
            calculation_timestamp=datetime.now(UTC),
        ),
        tax_estimate,
    )
