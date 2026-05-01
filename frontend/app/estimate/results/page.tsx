"use client";

import { useState, useEffect } from "react";
import { FinanceCard, LeaseCard } from "@/components/PaymentCard";
import BudgetIndicator from "@/components/BudgetIndicator";
import ErrorDisplay from "@/components/ErrorDisplay";
import type { EstimateResponse, ApiError } from "@/types";

// ─── Car image via Wikipedia ──────────────────────────────────────────────────

function CarImage({ year, make, model }: { year: number; make: string; model: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const title = `${make} ${model}`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=700&origin=*`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const pages = data?.query?.pages;
        if (!pages) return;
        const page = Object.values(pages)[0] as any;
        const thumb = page?.thumbnail?.source;
        if (thumb) setSrc(thumb);
      })
      .catch(() => {});
  }, [make, model]);

  if (!src) return null;

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: "1.75rem", background: "#f8fafc", maxHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img
        src={src}
        alt={`${year} ${make} ${model}`}
        style={{ width: "100%", height: "100%", objectFit: "cover", maxHeight: 320, display: "block" }}
        onError={() => setSrc(null)}
      />
    </div>
  );
}

// ─── Vehicle header ───────────────────────────────────────────────────────────

function VehicleHeader({ response }: { response: EstimateResponse }) {
  const { vehicle, payment_result, tax_estimate } = response;
  const msrp = vehicle.msrp ? `$${vehicle.msrp.toLocaleString()}` : "—";
  const taxRate = tax_estimate.sales_tax_rate > 0 ? `${(tax_estimate.sales_tax_rate * 100).toFixed(2)}%` : "0%";
  const allIn = payment_result.all_in_price
    ? `$${payment_result.all_in_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <CarImage year={vehicle.year} make={vehicle.make} model={vehicle.model} />

      <h1 style={{ margin: "0 0 0.375rem", fontSize: "clamp(1.5rem, 5vw, 2.25rem)", fontWeight: 700, letterSpacing: "-0.04em", color: "#0f172a", lineHeight: 1.15 }}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.25rem", marginTop: "0.75rem" }}>
        {[
          { label: "MSRP", value: msrp },
          { label: `Est. tax (${tax_estimate.state_code ?? "—"})`, value: taxRate },
          { label: "Est. all-in price", value: allIn },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>{label}:</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#334155", fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
            {label === "Est. all-in price" && <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>(est.)</span>}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1.25rem", height: 1, background: "#e2e8f0", borderRadius: 1 }} />
    </div>
  );
}

// ─── Comparison view ──────────────────────────────────────────────────────────

function ComparisonView({ response }: { response: EstimateResponse }) {
  const { vehicle, payment_result } = response;
  const hasLease = payment_result.lease_monthly_payment !== null && payment_result.lease_monthly_payment !== undefined;

  return (
    <>
      {hasLease && (
        <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
          Compare options
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: hasLease ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr", gap: "1rem" }}>
        <FinanceCard payment={payment_result} vehicle={vehicle} isComparison={hasLease} />
        {hasLease && <LeaseCard payment={payment_result} vehicle={vehicle} isComparison={hasLease} />}
      </div>
    </>
  );
}

// ─── Results page ─────────────────────────────────────────────────────────────

interface ResultsPageProps {
  response: EstimateResponse;
  onNewEstimate?: () => void;
  error?: ApiError | null;
  onRetry?: () => void;
}

export default function ResultsPage({ response, onNewEstimate, error, onRetry }: ResultsPageProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .result-section { animation: fadeSlideUp 0.35s ease-out both; }
        .result-section:nth-child(1) { animation-delay: 0ms; }
        .result-section:nth-child(2) { animation-delay: 60ms; }
        .result-section:nth-child(3) { animation-delay: 120ms; }
        .result-section:nth-child(4) { animation-delay: 180ms; }
        .result-section:nth-child(5) { animation-delay: 240ms; }
        .skip-link { position: absolute; top: -100px; left: 1rem; z-index: 999; padding: 0.5rem 1rem; background: #4f9cf9; color: #fff; border-radius: 6px; font-size: 0.875rem; font-weight: 600; text-decoration: none; transition: top 0.1s; }
        .skip-link:focus { top: 1rem; }
        @media (max-width: 639px) { .results-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <a href="#results-main" className="skip-link">Skip to payment results</a>

      <div id="results-main" style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1rem", fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)", opacity: mounted ? 1 : 0, transition: "opacity 0.15s" }}>

        {/* Nav row */}
        <div className="result-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <button onClick={onNewEstimate}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "transparent", color: "#64748b", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0f172a"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; }}>
            <span aria-hidden="true">←</span> New estimate
          </button>
          <span style={{ fontSize: "0.6875rem", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Payment Estimate</span>
        </div>

        {error && (
          <div className="result-section" style={{ marginBottom: "1.5rem" }}>
            <ErrorDisplay error={error} onRetry={onRetry} />
          </div>
        )}

        <div className="result-section"><VehicleHeader response={response} /></div>

        <div className="result-section" style={{ marginBottom: "1.5rem" }}>
          <BudgetIndicator payment={response.payment_result} />
        </div>

        <div className="result-section" style={{ marginBottom: 0 }}>
          <ComparisonView response={response} />
        </div>

        {/* Footer actions */}
        <div className="result-section" style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={onNewEstimate}
            style={{ flex: 1, minWidth: 160, padding: "0.875rem 1.5rem", borderRadius: 10, border: "1px solid #e2e8f0", background: "transparent", color: "#64748b", fontSize: "0.9375rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#0f172a"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; }}>
            ← Start a new estimate
          </button>
        </div>

        <p style={{ marginTop: "1.25rem", fontSize: "0.6875rem", color: "#94a3b8", lineHeight: 1.6, textAlign: "center" }}>
          All figures are estimates only — verify with your dealer or lender before any financial decision.
          CarLy is not a licensed financial advisor, broker, or lender.
        </p>
      </div>
    </>
  );
}
