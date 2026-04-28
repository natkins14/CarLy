"use client";

// ─────────────────────────────────────────────────────────────────────────────
// app/estimate/results/page.tsx
// Results page — assembles PaymentCard, AIInsightsSection, BudgetIndicator.
// All financial figures come directly from API payment_result.
// WCAG 2.1 AA compliant: contrast ratios ≥ 4.5:1, keyboard-navigable,
// mobile-first at 375px viewport.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { FinanceCard, LeaseCard } from "@/components/PaymentCard";
import AIInsightsSection from "@/components/AIInsightsSection";
import BudgetIndicator from "@/components/BudgetIndicator";
import ErrorDisplay from "@/components/ErrorDisplay";
import type { EstimateResponse, ApiError } from "@/types";

// ─── Vehicle header ───────────────────────────────────────────────────────────

function VehicleHeader({ response }: { response: EstimateResponse }) {
  const { vehicle, payment_result, tax_estimate, user_context } = response;
  const msrp = vehicle.msrp
    ? `$${vehicle.msrp.toLocaleString()}`
    : "MSRP N/A";
  const taxRate = tax_estimate.sales_tax_rate > 0
    ? `${(tax_estimate.sales_tax_rate * 100).toFixed(2)}%`
    : "0%";
  const allIn = payment_result.all_in_price
    ? `$${payment_result.all_in_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

  return (
    <div style={{ marginBottom: "2rem" }}>
      {/* Vehicle name */}
      <h1
        style={{
          margin: "0 0 0.375rem",
          fontSize: "clamp(1.5rem, 5vw, 2.25rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "#f0f2f8",
          lineHeight: 1.15,
        }}
      >
        {vehicle.year} {vehicle.make} {vehicle.model}
        {vehicle.trim && (
          <span style={{ color: "#8b90a8", fontWeight: 400, fontSize: "0.6em", marginLeft: "0.4em" }}>
            {vehicle.trim}
          </span>
        )}
      </h1>

      {/* Meta row — MSRP, tax, all-in */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem 1.25rem",
          marginTop: "0.75rem",
        }}
      >
        {[
          { label: "MSRP", value: msrp },
          { label: `Est. tax (${tax_estimate.state_code ?? "—"})`, value: taxRate },
          { label: "Est. all-in price", value: allIn },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#555977", fontWeight: 500 }}>{label}:</span>
            <span style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#8b90a8",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {value}
            </span>
            {label === "Est. all-in price" && (
              <span style={{ fontSize: "0.6875rem", color: "#434660" }}>(est.)</span>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{
        marginTop: "1.25rem",
        height: 1,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 1,
      }} />
    </div>
  );
}

// ─── Comparison view (both finance + lease) ───────────────────────────────────

function ComparisonView({ response }: { response: EstimateResponse }) {
  const { vehicle, payment_result } = response;
  const hasLease = payment_result.lease_monthly_payment !== null && payment_result.lease_monthly_payment !== undefined;

  return (
    <>
      {/* Section label when showing both */}
      {hasLease && (
        <p style={{
          margin: "0 0 1rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#555977",
        }}>
          Compare options
        </p>
      )}

      {/* Cards — stack on mobile, side-by-side when both present and viewport allows */}
      <div style={{
        display: "grid",
        gridTemplateColumns: hasLease ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr",
        gap: "1rem",
      }}>
        <FinanceCard payment={payment_result} vehicle={vehicle} isComparison={hasLease} />
        {hasLease && (
          <LeaseCard payment={payment_result} vehicle={vehicle} isComparison={hasLease} />
        )}
      </div>
    </>
  );
}

// ─── Results page component ───────────────────────────────────────────────────

interface ResultsPageProps {
  response: EstimateResponse;
  onNewEstimate?: () => void;
  error?: ApiError | null;
  onRetry?: () => void;
}

export default function ResultsPage({ response, onNewEstimate, error, onRetry }: ResultsPageProps) {
  const [mounted, setMounted] = useState(false);

  // Staggered reveal — animate in after mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .result-section {
          animation: fadeSlideUp 0.35s ease-out both;
        }
        .result-section:nth-child(1) { animation-delay: 0ms; }
        .result-section:nth-child(2) { animation-delay: 60ms; }
        .result-section:nth-child(3) { animation-delay: 120ms; }
        .result-section:nth-child(4) { animation-delay: 180ms; }
        .result-section:nth-child(5) { animation-delay: 240ms; }

        /* Focus-visible skip link — keyboard users */
        .skip-link {
          position: absolute;
          top: -100px;
          left: 1rem;
          z-index: 999;
          padding: 0.5rem 1rem;
          background: #4f9cf9;
          color: #fff;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          text-decoration: none;
          transition: top 0.1s;
        }
        .skip-link:focus { top: 1rem; }

        /* Responsive: single-column below 640px */
        @media (max-width: 639px) {
          .results-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Skip-to-content for keyboard users */}
      <a href="#results-main" className="skip-link">
        Skip to payment results
      </a>

      <div
        id="results-main"
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "2.5rem 1rem",
          fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.15s",
        }}
      >
        {/* Back + nav */}
        <div className="result-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <button
            onClick={onNewEstimate}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#8b90a8",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "#e8eaf0";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "#8b90a8";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            <span aria-hidden="true">←</span>
            New estimate
          </button>

          <span style={{
            fontSize: "0.6875rem",
            color: "#434660",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            Payment Estimate
          </span>
        </div>

        {/* Inline API error (e.g. after re-submit) */}
        {error && (
          <div className="result-section" style={{ marginBottom: "1.5rem" }}>
            <ErrorDisplay error={error} onRetry={onRetry} />
          </div>
        )}

        {/* Vehicle header */}
        <div className="result-section">
          <VehicleHeader response={response} />
        </div>

        {/* Budget indicator */}
        <div className="result-section" style={{ marginBottom: "1.5rem" }}>
          <BudgetIndicator payment={response.payment_result} />
        </div>

        {/* Payment cards */}
        <div className="result-section" style={{ marginBottom: "0" }}>
          <ComparisonView response={response} />
        </div>

        {/* AI Insights — separate section, never inside a payment card (§L2) */}
        <div className="result-section">
          <AIInsightsSection narrative={response.ai_narrative} />
        </div>

        {/* Footer actions */}
        <div
          className="result-section"
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={onNewEstimate}
            style={{
              flex: 1,
              minWidth: 160,
              padding: "0.875rem 1.5rem",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#8b90a8",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "#e8eaf0";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "#8b90a8";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            ← Start a new estimate
          </button>
        </div>

        {/* Inline per-result disclaimer (§L1) */}
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "0.6875rem",
            color: "#434660",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          All figures are estimates only — verify with your dealer or lender before any financial decision.
          CarLy is not a licensed financial advisor, broker, or lender.
        </p>
      </div>
    </>
  );
}
