"use client";

import { useState } from "react";
import Link from "next/link";
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
    return <ResultsPage response={result} onNewEstimate={handleNewEstimate} error={error} onRetry={handleNewEstimate} />;
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1rem", fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)" }}>
      <header style={{ marginBottom: "2.5rem" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#2563eb", fontSize: "0.875rem", marginBottom: "1.5rem", textDecoration: "none" }}>
          <span aria-hidden="true">←</span> CarLy
        </Link>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "-0.04em", color: "#0f172a", margin: 0 }}>
          Estimate your payment
        </h1>
        <p style={{ fontSize: "0.9375rem", color: "#64748b", marginTop: "0.5rem" }}>
          4 quick steps. Nothing stored after your session.
        </p>
      </header>
      <EstimateForm onSuccess={handleSuccess} />
    </div>
  );
}
