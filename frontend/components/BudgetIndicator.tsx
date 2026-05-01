"use client";

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
  const green = { bg: "rgba(5,150,105,0.06)", border: "rgba(5,150,105,0.2)", text: "#059669", pill: "rgba(5,150,105,0.1)", pillBorder: "rgba(5,150,105,0.25)" };
  const amber = { bg: "rgba(217,119,6,0.06)", border: "rgba(217,119,6,0.2)", text: "#d97706", pill: "rgba(217,119,6,0.1)", pillBorder: "rgba(217,119,6,0.25)" };
  const c = fit ? green : amber;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={fit ? "Vehicle is within budget" : "Vehicle exceeds budget"}
      style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${c.border}` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "1rem 1.25rem", background: c.bg }}>
        <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", background: c.pill, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem", color: c.text }}>
          {fit ? "✓" : "↑"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: c.text, lineHeight: 1.3 }}>
            {fit ? `Within your ${budgetLabel} budget` : `Slightly over your ${budgetLabel} budget`}
          </p>
          {!fit && (
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
              Estimate includes a 15% tolerance buffer for tax variance.
            </p>
          )}
        </div>
        <span style={{ flexShrink: 0, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: c.text, background: c.pill, border: `1px solid ${c.pillBorder}`, borderRadius: 999, padding: "0.25em 0.75em" }}>
          {fit ? "Fits" : "Over budget"}
        </span>
      </div>

      {!fit && filter_relaxation_suggestion && (
        <div style={{ padding: "0.875rem 1.25rem", background: "rgba(217,119,6,0.04)", borderTop: `1px solid rgba(217,119,6,0.12)`, display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
          <span aria-hidden="true" style={{ fontSize: "0.75rem", color: "#d97706", flexShrink: 0, lineHeight: "1.5rem" }}>💡</span>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#374151", lineHeight: 1.55 }}>
            <strong style={{ color: "#d97706", fontWeight: 600 }}>Tip: </strong>
            {filter_relaxation_suggestion}
          </p>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div style={{ borderTop: `1px solid ${c.border}`, padding: "0.75rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {warnings.map((warning, i) => (
            <p key={i} style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.5, display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ color: "#94a3b8", flexShrink: 0 }}>⚠</span>
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
