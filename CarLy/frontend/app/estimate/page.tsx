"use client";

// ─────────────────────────────────────────────────────────────────────────────
// app/estimate/page.tsx
// Multi-step estimate form page.
// Reads optional ?budget= and ?type= query params from the homepage CTA
// to pre-fill the first step.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EstimateForm from "@/components/EstimateForm";
import ResultsPage from "@/app/estimate/results/page";
import type { EstimateResponse, ApiError } from "@/types";

export default function EstimatePage() {
  const searchParams = useSearchParams();
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
        // 64px offset for the fixed Navbar from layout.tsx
        padding: "calc(64px + 2rem) 1rem 3rem",
        fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
      }}
    >
      <header style={{ marginBottom: "2.5rem" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--color-accent-dark)",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")
          }
        >
          <span aria-hidden="true">←</span> CarLy
        </Link>
        <h1
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Estimate your payment
        </h1>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "var(--color-text-muted)",
            marginTop: "0.5rem",
            marginBottom: 0,
          }}
        >
          4 quick steps. Nothing stored after your session.
        </p>
      </header>
      <EstimateForm onSuccess={handleSuccess} />
    </div>
  );
}
