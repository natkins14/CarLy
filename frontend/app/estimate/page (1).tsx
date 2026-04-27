"use client";

// app/estimate/page.tsx
// Estimate page — hosts the 4-step progressive disclosure form.

import { useState } from "react";
import EstimateForm from "@/components/EstimateForm";
import type { EstimateResponse } from "@/types";

export default function EstimatePage() {
  const [result, setResult] = useState<EstimateResponse | null>(null);

  if (result) {
    return (
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "3rem 1.5rem",
          fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
        }}
      >
        {/* Payment Result */}
        <div
          style={{
            background: "#0e1117",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "1.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#8b90a8", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, margin: 0 }}>
                Est. Monthly Payment
              </p>
              <p
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  color: "#f0f2f8",
                  margin: "0.25rem 0",
                  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                }}
              >
                ${result.payment_result.finance_monthly_payment.toFixed(2)}
                <span style={{ fontSize: "1rem", color: "#8b90a8", fontWeight: 400 }}>/mo</span>
              </p>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25em",
                fontSize: "0.75rem",
                color: "#8b90a8",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 999,
                padding: "0.25em 0.75em",
              }}
            >
              Non-Binding Estimate ℹ️
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            {[
              { label: "Total cost", value: `$${result.payment_result.finance_total_cost.toLocaleString()}` },
              { label: "Total interest", value: `$${result.payment_result.finance_total_interest.toLocaleString()}` },
              { label: "APR applied", value: `${(result.payment_result.apr_applied * 100).toFixed(2)}%` },
              { label: "Term", value: `${result.payment_result.term_months} months` },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "0.75rem", background: "rgba(255,255,255,0.025)", borderRadius: 10 }}>
                <p style={{ fontSize: "0.75rem", color: "#555977", margin: "0 0 0.2rem" }}>{label}</p>
                <p style={{ fontSize: "1rem", color: "#c4c8dc", fontWeight: 600, margin: 0, fontFamily: "var(--font-mono, monospace)" }}>{value}</p>
              </div>
            ))}
          </div>

          {result.payment_result.lease_monthly_payment && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ fontSize: "0.75rem", color: "#8b90a8", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 0.5rem" }}>
                Lease Option
              </p>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#a78bfa", margin: 0, fontFamily: "var(--font-mono, monospace)" }}>
                ${result.payment_result.lease_monthly_payment.toFixed(2)}<span style={{ fontSize: "0.875rem", color: "#8b90a8", fontWeight: 400 }}>/mo</span>
              </p>
            </div>
          )}

          {!result.payment_result.budget_fit && result.payment_result.filter_relaxation_suggestion && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                background: "rgba(251,191,36,0.06)",
                border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: 10,
                fontSize: "0.8125rem",
                color: "#fbbf24",
              }}
            >
              ⚠️ {result.payment_result.filter_relaxation_suggestion}
            </div>
          )}
        </div>

        {/* AI Narrative */}
        {result.ai_narrative && (
          <section
            className="ai-section"
            aria-label="AI Explanation"
            style={{ marginBottom: "1.5rem" }}
          >
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#4f9cf9", letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 0.75rem" }}>
              ✦ AI Insights
            </p>
            <p style={{ fontSize: "0.9375rem", color: "#c4c8dc", lineHeight: 1.7, margin: "0 0 0.75rem" }}>
              {result.ai_narrative}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#555977", margin: 0 }}>
              This explanation is AI-generated and is for informational purposes only. It is not financial advice.
            </p>
          </section>
        )}

        <button
          onClick={() => setResult(null)}
          style={{
            width: "100%",
            padding: "0.875rem",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#8b90a8",
            fontSize: "0.9375rem",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Start a new estimate
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
      }}
    >
      <header style={{ marginBottom: "2.5rem" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#4f9cf9",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
            textDecoration: "none",
          }}
        >
          ← CarLy
        </a>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#f0f2f8",
            margin: 0,
          }}
        >
          Estimate your payment
        </h1>
        <p style={{ fontSize: "0.9375rem", color: "#8b90a8", marginTop: "0.5rem" }}>
          4 quick steps. Nothing stored after your session.
        </p>
      </header>

      <EstimateForm onSuccess={setResult} />
    </div>
  );
}
