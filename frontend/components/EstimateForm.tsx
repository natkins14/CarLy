"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EstimateRequestSchema, EstimateRequestInput } from "@/lib/schemas";
import { fetchEstimate, isApiError } from "@/lib/api";
import VehicleSelector, { type VehicleSelection } from "@/components/VehicleSelector";
import type { EstimateResponse } from "@/types";

type FormValues = EstimateRequestInput;

interface EstimateFormProps {
  onSuccess?: (result: EstimateResponse) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  color: "#0f172a",
  fontSize: "0.9375rem",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#64748b",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: "0.375rem",
};

const errorStyle: React.CSSProperties = { fontSize: "0.8125rem", color: "#dc2626", marginTop: "0.25rem" };

const STEPS = ["Budget", "Vehicle", "Financials", "Review"];

export default function EstimateForm({ onSuccess }: EstimateFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [vehicle, setVehicle] = useState<VehicleSelection>({ year: null, make: null, model: null, vehiclePrice: null });
  const [vehicleError, setVehicleError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, watch, trigger, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(EstimateRequestSchema) as any,
    defaultValues: {
      purchase_type: "both",
      budget_mode: "monthly",
      budget_value: 0,
      down_payment: 0,
      loan_term_months: 60,
      credit_score: undefined,
      zip_code: "",
      year: 2024,
      make: "",
      model: "",
      trim: undefined,
      credit_tier: undefined,
      msrp: undefined,
    } as const,
    mode: "onTouched",
  });

  const budgetMode = watch("budget_mode");
  const budgetValue = watch("budget_value");
  const downPayment = watch("down_payment");

  // Keep form fields in sync with the vehicle state so Zod validation
  // sees real values when the user submits from the Review step.
  useEffect(() => {
    if (vehicle.year) setValue("year", vehicle.year);
    if (vehicle.make) setValue("make", vehicle.make);
    if (vehicle.model) setValue("model", vehicle.model);
    if (vehicle.vehiclePrice != null) setValue("msrp", vehicle.vehiclePrice);
  }, [vehicle, setValue]);

  useEffect(() => {
    const newWarnings: string[] = [];
    if (budgetMode === "total" && downPayment > budgetValue) {
      newWarnings.push("Your down payment exceeds your total budget. Results may be limited.");
    }
    setWarnings(newWarnings);
  }, [budgetMode, budgetValue, downPayment]);

  useEffect(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `Step ${currentStep + 1} of ${STEPS.length}: ${STEPS[currentStep]}`;
    }
  }, [currentStep]);

  async function goNext() {
    if (currentStep === 0) {
      const valid = await trigger(["purchase_type", "budget_mode", "budget_value", "down_payment"]);
      if (!valid) return;
    }
    if (currentStep === 1) {
      if (!vehicle.year || !vehicle.make || !vehicle.model) {
        setVehicleError("Please select a year, make, and model.");
        return;
      }
      if (!vehicle.vehiclePrice) {
        setVehicleError("Please enter the vehicle price.");
        return;
      }
      setVehicleError(undefined);
    }
    if (currentStep === 2) {
      const valid = await trigger(["credit_score", "zip_code", "loan_term_months"]);
      if (!valid) return;
    }
    setCurrentStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() { setCurrentStep(s => Math.max(s - 1, 0)); }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    setShowFallback(false);

    const payload = {
      ...data,
      year: vehicle.year!,
      make: vehicle.make!,
      model: vehicle.model!,
      trim: undefined,
      msrp: vehicle.vehiclePrice ?? undefined,
    };

    fallbackTimer.current = setTimeout(() => setShowFallback(true), 3000);

    try {
      const { response } = await fetchEstimate(payload as Parameters<typeof fetchEstimate>[0]);
      onSuccess?.(response);
    } catch (err) {
      if (isApiError(err)) {
        setSubmitError(err.message);
        if (err.action === "reload") setTimeout(() => window.location.reload(), 1500);
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    } finally {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      setIsSubmitting(false);
      setShowFallback(false);
    }
  }

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div style={{ fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)" }}>
      <style>{`
        input:focus, select:focus { border-color: #4f9cf9 !important; outline: none; }
        .step-enter { animation: stepIn 0.2s ease-out; }
        @keyframes stepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .radio-card { position: relative; }
        .radio-card input { position: absolute; opacity: 0; width: 0; height: 0; }
        .radio-card label {
          display: flex; align-items: center; justify-content: center;
          padding: 0.625rem 1rem; border-radius: 8px; cursor: pointer;
          border: 1px solid #e2e8f0; background: #ffffff;
          font-size: 0.875rem; color: #64748b; transition: all 0.15s;
          user-select: none;
        }
        .radio-card input:checked + label {
          border-color: #4f9cf9; background: rgba(79,156,249,0.08); color: #0f172a; font-weight: 600;
        }
        .radio-card label:hover { border-color: #93c5fd; color: #1e293b; }
        .radio-card input:focus-visible + label { outline: 2px solid #4f9cf9; outline-offset: 2px; }
      `}</style>

      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }} />

      {/* Progress */}
      <div role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label={`Step ${currentStep + 1} of ${STEPS.length}`} style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {STEPS.map((step, i) => (
            <div key={step} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= currentStep ? "#4f9cf9" : "#e2e8f0", transition: "background 0.3s" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {STEPS.map((step, i) => (
            <span key={step} style={{ fontSize: "0.6875rem", fontWeight: i === currentStep ? 700 : 400, color: i === currentStep ? "#2563eb" : i < currentStep ? "#64748b" : "#94a3b8", letterSpacing: "0.04em", textTransform: "uppercase", transition: "color 0.2s" }}>
              {step}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* Step 1: Budget */}
        {currentStep === 0 && (
          <div className="step-enter" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "0.25rem" }}>What are you looking for?</h2>
              <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Choose how you want to buy and set your budget.</p>
            </div>

            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Purchase type</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginTop: "0.375rem" }}>
                {(["finance", "lease", "both"] as const).map(type => (
                  <div className="radio-card" key={type}>
                    <input {...register("purchase_type")} type="radio" id={`pt-${type}`} value={type} />
                    <label htmlFor={`pt-${type}`}>{type === "finance" ? "Finance" : type === "lease" ? "Lease" : "Show Both"}</label>
                  </div>
                ))}
              </div>
              {errors.purchase_type && <p role="alert" aria-live="polite" style={errorStyle}>{errors.purchase_type.message}</p>}
            </fieldset>

            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Budget type</legend>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.375rem" }}>
                {(["monthly", "total"] as const).map(mode => (
                  <div className="radio-card" key={mode}>
                    <input {...register("budget_mode")} type="radio" id={`bm-${mode}`} value={mode} />
                    <label htmlFor={`bm-${mode}`}>{mode === "monthly" ? "Monthly Payment" : "Total Price"}</label>
                  </div>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="budget_value" style={labelStyle}>{budgetMode === "monthly" ? "Monthly budget (USD)" : "Total budget (USD)"}</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9375rem" }}>$</span>
                <input id="budget_value" type="number" min={1} max={500000} placeholder={budgetMode === "monthly" ? "650" : "35000"} aria-required="true" aria-invalid={!!errors.budget_value} {...register("budget_value", { valueAsNumber: true })} style={{ ...inputStyle, paddingLeft: "1.75rem" }} />
              </div>
              {errors.budget_value && <p role="alert" aria-live="polite" style={errorStyle}>{errors.budget_value.message}</p>}
            </div>

            <div>
              <label htmlFor="down_payment" style={labelStyle}>Down payment (USD)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.9375rem" }}>$</span>
                <input id="down_payment" type="number" min={0} max={500000} placeholder="3000" aria-invalid={!!errors.down_payment} {...register("down_payment", { valueAsNumber: true })} style={{ ...inputStyle, paddingLeft: "1.75rem" }} />
              </div>
              {errors.down_payment && <p role="alert" aria-live="polite" style={errorStyle}>{errors.down_payment.message}</p>}
            </div>

            {warnings.length > 0 && (
              <div role="status" aria-live="polite" style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", borderRadius: 10, padding: "0.875rem 1rem", fontSize: "0.8125rem", color: "#d97706" }}>
                {warnings.map((w, i) => <p key={i} style={{ margin: 0 }}>⚠️ {w}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Vehicle */}
        {currentStep === 1 && (
          <div className="step-enter" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "0.25rem" }}>Which vehicle?</h2>
              <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Select year, make, and model, then enter the vehicle price.</p>
            </div>
            <VehicleSelector value={vehicle} onChange={setVehicle} error={vehicleError} />
          </div>
        )}

        {/* Step 3: Financials */}
        {currentStep === 2 && (
          <div className="step-enter" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "0.25rem" }}>Your financial details</h2>
              <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Used to estimate your rate. Nothing is stored after your session.</p>
            </div>

            <div>
              <label htmlFor="credit_score" style={labelStyle}>Credit score (300–850)</label>
              <input id="credit_score" type="number" min={300} max={850} placeholder="720" aria-required="true" aria-invalid={!!errors.credit_score} {...register("credit_score", { valueAsNumber: true })} style={inputStyle} />
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>Your score maps to an interest rate tier. The raw value is never stored.</p>
              {errors.credit_score && <p role="alert" aria-live="polite" style={errorStyle}>{errors.credit_score.message}</p>}
            </div>

            <div>
              <label htmlFor="zip_code" style={labelStyle}>ZIP code</label>
              <input id="zip_code" type="text" inputMode="numeric" maxLength={5} placeholder="10001" aria-required="true" aria-invalid={!!errors.zip_code} {...register("zip_code")} style={inputStyle} />
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>Used to estimate local sales tax only. Not stored.</p>
              {errors.zip_code && <p role="alert" aria-live="polite" style={errorStyle}>{errors.zip_code.message}</p>}
            </div>

            <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
              <legend style={labelStyle}>Loan / lease term</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginTop: "0.375rem" }}>
                {([24, 36, 48, 60, 72, 84] as const).map(term => (
                  <div className="radio-card" key={term}>
                    <input
                      type="radio"
                      id={`term-${term}`}
                      name="loan_term_months"
                      checked={watch("loan_term_months") === term}
                      onChange={() => setValue("loan_term_months", term, { shouldValidate: true })}
                    />
                    <label htmlFor={`term-${term}`}>{term} mo</label>
                  </div>
                ))}
              </div>
              {errors.loan_term_months && <p role="alert" aria-live="polite" style={errorStyle}>{errors.loan_term_months.message}</p>}
            </fieldset>
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 3 && (
          <div className="step-enter" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: "0.25rem" }}>Ready to estimate</h2>
              <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Review your selections before getting results.</p>
            </div>

            {[
              { label: "Vehicle", value: vehicle.year && vehicle.make ? `${vehicle.year} ${vehicle.make} ${vehicle.model ?? ""}`.trim() : "Not selected" },
              { label: "Vehicle Price", value: vehicle.vehiclePrice ? `$${vehicle.vehiclePrice.toLocaleString()}` : "N/A" },
              { label: "Purchase type", value: watch("purchase_type") },
              { label: "Budget", value: `$${(watch("budget_value") || 0).toLocaleString()} / ${watch("budget_mode") === "monthly" ? "mo" : "total"}` },
              { label: "Down payment", value: `$${(watch("down_payment") || 0).toLocaleString()}` },
              { label: "Loan term", value: `${watch("loan_term_months")} months` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>{label}</span>
                <span style={{ fontSize: "0.9375rem", color: "#0f172a", fontWeight: 500 }}>{value}</span>
              </div>
            ))}

            <p style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", margin: 0 }}>
              Estimated only — verify with your dealer or lender before any financial decision.
            </p>

            {submitError && (
              <div role="alert" aria-live="assertive" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "0.875rem 1rem", fontSize: "0.875rem", color: "#dc2626" }}>
                {submitError}
              </div>
            )}

            {showFallback && isSubmitting && (
              <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "rgba(79,156,249,0.06)", borderRadius: 10, border: "1px solid rgba(79,156,249,0.15)", fontSize: "0.875rem", color: "#64748b" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f9cf9" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                This is taking longer than expected. Hang tight…
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "2rem" }}>
          {currentStep > 0 && (
            <button type="button" onClick={goBack} disabled={isSubmitting}
              style={{ flex: "0 0 auto", padding: "0.875rem 1.5rem", borderRadius: 10, border: "1px solid #e2e8f0", background: "transparent", color: "#64748b", fontSize: "0.9375rem", fontWeight: 500, cursor: isSubmitting ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              ← Back
            </button>
          )}

          {!isLastStep ? (
            <button type="button" onClick={goNext}
              style={{ flex: 1, padding: "0.875rem 1.5rem", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #4f9cf9, #a78bfa)", color: "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", transition: "opacity 0.15s, transform 0.1s" }}
              onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}>
              Continue →
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting} aria-disabled={isSubmitting} aria-busy={isSubmitting}
              style={{ flex: 1, padding: "0.875rem 1.5rem", borderRadius: 10, border: "none", background: isSubmitting ? "#e2e8f0" : "linear-gradient(135deg, #4f9cf9, #a78bfa)", color: isSubmitting ? "#94a3b8" : "#fff", fontSize: "0.9375rem", fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", transition: "all 0.2s" }}>
              {isSubmitting ? "Calculating…" : "Get My Estimate →"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
