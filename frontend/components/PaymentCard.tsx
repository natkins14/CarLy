"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/PaymentCard.tsx
// Finance and Lease payment result cards.
// "Est. Monthly Payment" is the largest visual element.
// Includes "Non-Binding Estimate" and "Market Estimate" badges with tooltips.
// All numbers come ONLY from payment_result — no frontend calculations.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useId } from "react";
import type { PaymentResult, VehicleRecord } from "@/types";

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        role="button"
        tabIndex={0}
        aria-describedby={id}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onKeyDown={e => e.key === "Enter" && setVisible(v => !v)}
        style={{ cursor: "help", display: "inline-flex", alignItems: "center" }}
      >
        {children}
      </span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1f2e",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
            color: "#c4c8dc",
            whiteSpace: "nowrap",
            maxWidth: 240,
            whiteSpace: "normal" as any,
            lineHeight: 1.5,
            zIndex: 100,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {content}
          {/* Arrow */}
          <span style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid rgba(255,255,255,0.12)",
          }} />
        </span>
      )}
    </span>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string;
  tooltip: string;
  color?: "muted" | "market";
}

function Badge({ label, tooltip, color = "muted" }: BadgeProps) {
  const colors = {
    muted: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "#8b90a8" },
    market: { bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)", text: "#a78bfa" },
  };
  const c = colors[color];

  return (
    <Tooltip content={tooltip}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25em",
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          color: c.text,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: 999,
          padding: "0.2em 0.65em",
          whiteSpace: "nowrap" as const,
          cursor: "help",
        }}
      >
        {label} <span aria-hidden="true" style={{ fontSize: "0.65em", opacity: 0.7 }}>ℹ</span>
      </span>
    </Tooltip>
  );
}

// ─── Data Row ─────────────────────────────────────────────────────────────────

function DataRow({ label, value, mono = true, sub }: { label: string; value: string; mono?: boolean; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      <span style={{ fontSize: "0.6875rem", color: "#555977", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{
        fontSize: "0.9375rem",
        fontWeight: 600,
        color: "#c4c8dc",
        fontFamily: mono ? "var(--font-mono, 'JetBrains Mono', monospace)" : "inherit",
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
      }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: "0.6875rem", color: "#434660", marginTop: "0.1rem" }}>{sub}</span>}
    </div>
  );
}

// ─── Finance Card ─────────────────────────────────────────────────────────────

interface FinanceCardProps {
  payment: PaymentResult;
  vehicle: VehicleRecord;
  isComparison?: boolean;
}

export function FinanceCard({ payment, vehicle, isComparison }: FinanceCardProps) {
  const aprPct = (payment.apr_applied * 100).toFixed(2);
  const totalCost = payment.finance_total_cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalInterest = payment.finance_total_interest.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const monthlyPmt = payment.finance_monthly_payment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const downPmt = payment.down_payment_applied.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <article
      aria-label={`Finance payment estimate for ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      style={{
        background: "#0e1117",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "1.75rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle top accent */}
      <div aria-hidden="true" style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 2,
        background: "linear-gradient(90deg, #4f9cf9, transparent)",
        borderRadius: "16px 16px 0 0",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4f9cf9" }}>
            Finance
          </p>
          {isComparison && (
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#555977" }}>Standard auto loan</p>
          )}
        </div>
        <Badge
          label="Non-Binding Estimate"
          tooltip="This figure is an approximation. Verify with your dealer or lender before making any financial decision."
        />
      </div>

      {/* Monthly payment — largest element */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#8b90a8", fontWeight: 500 }}>
          Est. Monthly Payment
        </p>
        <p
          aria-label={`Estimated monthly finance payment: $${monthlyPmt}`}
          style={{
            margin: 0,
            fontSize: "clamp(2.5rem, 8vw, 3.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#f0f2f8",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "0.45em", color: "#8b90a8", fontWeight: 400, verticalAlign: "top", marginTop: "0.35em", marginRight: "0.1em", display: "inline-block" }}>$</span>
          {monthlyPmt}
          <span aria-hidden="true" style={{ fontSize: "0.35em", color: "#8b90a8", fontWeight: 400, marginLeft: "0.2em" }}>/mo</span>
        </p>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        padding: "1.25rem",
        background: "rgba(255,255,255,0.025)",
        borderRadius: 10,
        marginBottom: "1.25rem",
      }}>
        <DataRow label="Total cost" value={`$${totalCost}`} />
        <DataRow label="Total interest" value={`$${totalInterest}`} />
        <DataRow label="Term" value={`${payment.term_months} months`} mono={false} />
        <DataRow label="Down payment" value={`$${downPmt}`} />
      </div>

      {/* APR row with Market Estimate badge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.875rem 1rem",
        background: "rgba(79,156,249,0.04)",
        border: "1px solid rgba(79,156,249,0.1)",
        borderRadius: 10,
        gap: "0.75rem",
        flexWrap: "wrap",
      }}>
        <div>
          <span style={{ fontSize: "0.75rem", color: "#8b90a8" }}>APR Applied: </span>
          <span style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "#4f9cf9",
            fontFamily: "var(--font-mono, monospace)",
          }}>
            {aprPct}%
          </span>
        </div>
        <Badge
          label="Market Estimate"
          color="market"
          tooltip="Based on industry-average rates for your credit tier. Actual rates are set by lenders and may differ significantly."
        />
      </div>

      {/* Inline caveat */}
      <p style={{ margin: "1rem 0 0", fontSize: "0.6875rem", color: "#434660", lineHeight: 1.5 }}>
        Estimated only — verify with your dealer or lender before making any financial decision.
      </p>
    </article>
  );
}

// ─── Lease Card ───────────────────────────────────────────────────────────────

interface LeaseCardProps {
  payment: PaymentResult;
  vehicle: VehicleRecord;
  isComparison?: boolean;
}

export function LeaseCard({ payment, vehicle, isComparison }: LeaseCardProps) {
  if (
    payment.lease_monthly_payment === null ||
    payment.lease_monthly_payment === undefined
  ) return null;

  const monthlyPmt = payment.lease_monthly_payment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalCost = (payment.lease_total_cost ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const residualVal = (payment.residual_value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const residualPct = payment.residual_pct_applied !== null && payment.residual_pct_applied !== undefined
    ? `${(payment.residual_pct_applied * 100).toFixed(0)}%`
    : "—";
  const moneyFactor = payment.money_factor_applied !== null && payment.money_factor_applied !== undefined
    ? payment.money_factor_applied.toFixed(5)
    : "—";
  const downPmt = payment.down_payment_applied.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <article
      aria-label={`Lease payment estimate for ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      style={{
        background: "#0e1117",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "1.75rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle top accent — violet for lease */}
      <div aria-hidden="true" style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 2,
        background: "linear-gradient(90deg, #a78bfa, transparent)",
        borderRadius: "16px 16px 0 0",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a78bfa" }}>
            Lease
          </p>
          {isComparison && (
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "#555977" }}>Lower monthly, no ownership</p>
          )}
        </div>
        <Badge
          label="Non-Binding Estimate"
          tooltip="This figure is an approximation. Verify with your dealer or lender before making any financial decision."
        />
      </div>

      {/* Monthly payment — largest element */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", color: "#8b90a8", fontWeight: 500 }}>
          Est. Monthly Payment
        </p>
        <p
          aria-label={`Estimated monthly lease payment: $${monthlyPmt}`}
          style={{
            margin: 0,
            fontSize: "clamp(2.5rem, 8vw, 3.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#f0f2f8",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "0.45em", color: "#8b90a8", fontWeight: 400, verticalAlign: "top", marginTop: "0.35em", marginRight: "0.1em", display: "inline-block" }}>$</span>
          {monthlyPmt}
          <span aria-hidden="true" style={{ fontSize: "0.35em", color: "#8b90a8", fontWeight: 400, marginLeft: "0.2em" }}>/mo</span>
        </p>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        padding: "1.25rem",
        background: "rgba(255,255,255,0.025)",
        borderRadius: 10,
        marginBottom: "1.25rem",
      }}>
        <DataRow label="Total paid" value={`$${totalCost}`} />
        <DataRow label="Residual value" value={`$${residualVal}`} />
        <DataRow label="Term" value={`${payment.term_months} months`} mono={false} />
        <DataRow label="Down payment" value={`$${downPmt}`} />
      </div>

      {/* Money factor + Residual row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.875rem 1rem",
        background: "rgba(167,139,250,0.04)",
        border: "1px solid rgba(167,139,250,0.1)",
        borderRadius: 10,
        gap: "0.75rem",
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "#8b90a8" }}>Money factor: </span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#a78bfa", fontFamily: "var(--font-mono, monospace)" }}>
              {moneyFactor}
            </span>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "#8b90a8" }}>Residual: </span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#a78bfa", fontFamily: "var(--font-mono, monospace)" }}>
              {residualPct}
            </span>
          </div>
        </div>
        <Badge
          label="Market Estimate"
          color="market"
          tooltip="Based on industry-average rates for your credit tier. Actual rates are set by lenders and may differ significantly."
        />
      </div>

      {/* Inline caveat */}
      <p style={{ margin: "1rem 0 0", fontSize: "0.6875rem", color: "#434660", lineHeight: 1.5 }}>
        Estimated only — verify with your dealer or lender before making any financial decision.
      </p>
    </article>
  );
}
