from __future__ import annotations

from models.schemas import BudgetMode, CreditTier, VehicleRecord
from services.dcs import (
    build_payment_result,
    build_tax_estimate,
    calculate_finance,
    calculate_lease,
    estimate_residual_value,
    lookup_sales_tax,
    map_credit_score_to_tier,
)


def test_calculate_finance_matches_reference_value() -> None:
    result = calculate_finance(
        principal=30000,
        annual_apr=0.0725,
        term_months=60,
        down_payment=3000,
    )
    assert result.monthly_payment == 597.58
    assert result.total_cost == 38854.80
    assert result.total_interest == 5854.80


def test_calculate_lease_matches_reference_value() -> None:
    result = calculate_lease(
        msrp=35000,
        down_payment=3000,
        money_factor=0.00175,
        residual_pct=0.53,
        term_months=36,
        sales_tax_rate=0.0625,
    )
    assert result.monthly_payment == 490.95
    assert result.total_cost == 20674.20
    assert result.residual_value == 18550.00


def test_credit_score_mapping_and_residual_placeholder() -> None:
    assert map_credit_score_to_tier(720) == CreditTier.GOOD
    assert estimate_residual_value(35000, CreditTier.GOOD) == 18550.00


def test_tax_lookup_zero_percent_and_missing_prefix() -> None:
    assert lookup_sales_tax("97201") == ("OR", 0.0)
    assert lookup_sales_tax("12345") == ("NY", 0.04)
    assert lookup_sales_tax("65000") == (None, 0.0)


def test_build_payment_result_handles_monthly_and_total_budget_modes() -> None:
    vehicle = VehicleRecord(
        make="Toyota",
        model="Camry",
        year=2024,
        trim="XLE",
        msrp=32000,
        estimated_residual_value=16960,
    )

    monthly_result, _ = build_payment_result(
        vehicle=vehicle,
        credit_tier=CreditTier.GOOD,
        budget_mode=BudgetMode.MONTHLY,
        budget_value=400,
        down_payment=2000,
        loan_term_months=60,
        purchase_type="finance",
        zip_code="10001",
    )
    assert monthly_result.budget_fit is False
    assert monthly_result.filter_relaxation_suggestion is not None

    total_result, tax_estimate = build_payment_result(
        vehicle=vehicle,
        credit_tier=CreditTier.GOOD,
        budget_mode=BudgetMode.TOTAL,
        budget_value=40000,
        down_payment=2000,
        loan_term_months=60,
        purchase_type="both",
        zip_code="10001",
    )
    assert total_result.budget_fit is True
    assert tax_estimate.all_in_price is not None


def test_build_tax_estimate_returns_none_all_in_price_without_msrp() -> None:
    estimate = build_tax_estimate(msrp=None, zip_code="97201", down_payment=1000)
    assert estimate.all_in_price is None
