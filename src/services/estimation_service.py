from __future__ import annotations

from models.schemas import EstimateRequest, EstimateResponse, SessionClaims
from services.ai_service import AIExplanationService
from services.car_service import CarService
from services.context_builder import build_context_packet
from services.dcs import build_payment_result, resolve_credit_tier


class EstimationService:
    def __init__(
        self,
        car_service: CarService,
        ai_service: AIExplanationService,
    ) -> None:
        self._car_service = car_service
        self._ai_service = ai_service

    def estimate(
        self,
        request: EstimateRequest,
        session_claims: SessionClaims,
    ) -> EstimateResponse:
        credit_tier = resolve_credit_tier(
            credit_score=request.credit_score,
            explicit_tier=request.credit_tier or session_claims.credit_tier,
        )
        zip_code = request.zip_code or session_claims.zip_code

        vehicle = self._car_service.resolve_vehicle(
            make=request.make,
            model=request.model,
            year=request.year,
            trim=request.trim,
            manual_msrp=request.msrp,
            credit_tier=credit_tier,
        )

        payment_result, tax_estimate = build_payment_result(
            vehicle=vehicle,
            credit_tier=credit_tier,
            budget_mode=request.budget_mode,
            budget_value=request.budget_value,
            down_payment=request.down_payment,
            loan_term_months=request.loan_term_months,
            purchase_type=request.purchase_type.value,
            zip_code=zip_code,
        )

        context_packet = build_context_packet(
            vehicle=vehicle,
            payment_result=payment_result,
            credit_tier=credit_tier.value,
            purchase_type=request.purchase_type.value,
        )
        ai_narrative = self._ai_service.generate_explanation(context_packet)

        warnings = list(payment_result.warnings)
        if request.credit_score is None and request.credit_tier is None and session_claims.credit_tier is None:
            warnings.append("No credit score provided. Used a default 'good' tier market estimate.")
            payment_result = payment_result.model_copy(update={"warnings": warnings})

        return EstimateResponse(
            vehicle=vehicle,
            payment_result=payment_result,
            tax_estimate=tax_estimate,
            user_context={
                "session_id": session_claims.session_id,
                "credit_tier": credit_tier.value,
                "purchase_type": request.purchase_type.value,
                "budget_mode": request.budget_mode.value,
                "budget_value": request.budget_value,
            },
            ai_narrative=ai_narrative,
        )
