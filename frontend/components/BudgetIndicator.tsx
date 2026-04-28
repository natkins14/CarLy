"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/BudgetIndicator.tsx
// Amber/Green budget fit indicator driven entirely by payment_result.budget_fit.
// Shows filter_relaxation_suggestion when budget is over.
// No financial calculations performed in this component.
// ─────────────────────────────────────────────────────────────────────────────

import type { PaymentResult } from "@/types";

interface BudgetIndicatorProps {
  payment: PaymentResult;
}

export default function BudgetIndicator({ payment }: BudgetIndicatorProps) {
  const { budget_fit, budget_mode, budget_value, filter_relaxation_suggestion, warnings } = payment;

  const budgetLabel = budget_mode === "monthly"
    ? `$${budget_value.toLocaleString()}/mo`
    : `$${budget_value.toLocaleString()} total`;

  const fit = budget_fit;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={fit ? "Vehicle is within budget" : "Vehicle exceeds budget"}
      style={{
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${fit ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.25)"}`,
      }}
    >
      {/* Main indicator bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
          padding: "1rem 1.25rem",
          background: fit
            ? "rgba(52,211,153,0.06)"
            : "rgba(251,191,36,0.06)",
        }}
      >
        {/* Icon */}
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: fit
              ? "rgba(52,211,153,0.15)"
              : "rgba(251,191,36,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "1rem",
          }}
        >
          {fit ? "✓" : "↑"}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              fontWeight: 600,
              color: fit ? "#34d399" : "#fbbf24",
              lineHeight: 1.3,
            }}
          >
            {fit
              ? `Within your ${budgetLabel} budget`
              : `Slightly over your ${budgetLabel} budget`}
          </p>
          {!fit && (
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#8b90a8", lineHeight: 1.4 }}>
              Estimate includes a 15% tolerance buffer for tax variance.
            </p>
          )}
        </div>

        {/* Pill badge */}
        <span
          style={{
            flexShrink: 0,
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: fit ? "#34d399" : "#fbbf24",
            background: fit ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
            border: `1px solid ${fit ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}`,
            borderRadius: 999,
            padding: "0.25em 0.75em",
          }}
        >
          {fit ? "Fits" : "Over budget"}
        </span>
      </div>

      {/* Relaxation suggestion — shown only when over budget */}
      {!fit && filter_relaxation_suggestion && (
        <div
          style={{
            padding: "0.875rem 1.25rem",
            background: "rgba(251,191,36,0.04)",
            borderTop: "1px solid rgba(251,191,36,0.12)",
            display: "flex",
            gap: "0.625rem",
            alignItems: "flex-start",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "0.75rem", color: "#fbbf24", flexShrink: 0, lineHeight: "1.5rem" }}>
            💡
          </span>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#c4c8dc", lineHeight: 1.55 }}>
            <strong style={{ color: "#fbbf24", fontWeight: 600 }}>Tip: </strong>
            {filter_relaxation_suggestion}
          </p>
        </div>
      )}

      {/* Warnings (e.g., default tier used) */}
      {warnings && warnings.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${fit ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)"}`,
            padding: "0.75rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          }}
        >
          {warnings.map((warning, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#8b90a8",
                lineHeight: 1.5,
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-start",
              }}
            >
              <span aria-hidden="true" style={{ color: "#555977", flexShrink: 0 }}>⚠</span>
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
