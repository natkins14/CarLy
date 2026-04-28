"use client";

// ─────────────────────────────────────────────────────────────────────────────
// app/estimate/page.tsx
// Main estimate page — hosts the 4-step form and renders ResultsPage on success.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import EstimateForm from "@/components/EstimateForm";
import ResultsPage from "@/app/estimate/results/page";
import type { EstimateResponse, ApiError } from "@/types";

export default function EstimatePage() {
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  function handleSuccess(response: EstimateResponse) {
    setError(null);
    setResult(response);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNewEstimate() {
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    return (
      <ResultsPage
        response={result}
        onNewEstimate={handleNewEstimate}
        error={error}
        onRetry={handleNewEstimate}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "3rem 1rem",
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
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")}
          onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
        >
          <span aria-hidden="true">←</span> CarLy
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

      <EstimateForm onSuccess={handleSuccess} />
    </div>
  );
}
