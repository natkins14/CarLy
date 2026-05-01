"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/HeroSection.tsx
// Full-viewport hero section for the homepage.
// Includes: pill badge, headline, subheadline, CTA buttons, trust signals,
// and an interactive floating payment preview card.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import Link from "next/link";

// ─── Scroll cue ──────────────────────────────────────────────────────────────
function ScrollCue() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: "2.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 24,
          height: 38,
          borderRadius: 12,
          border: "2px solid rgba(255,255,255,0.15)",
          display: "flex",
          justifyContent: "center",
          paddingTop: 6,
        }}
      >
        <div
          style={{
            width: 4,
            height: 8,
            borderRadius: 2,
            background: "rgba(255,255,255,0.3)",
            animation: "scrollPulse 1.8s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// ─── Floating preview card ────────────────────────────────────────────────────
function PreviewCard() {
  const [activeTab, setActiveTab] = useState<"finance" | "lease">("finance");

  const data = {
    finance: {
      monthly: "$634",
      rate: "6.99% APR",
      term: "60 mo",
      total: "$38,040",
      interest: "$5,540",
    },
    lease: {
      monthly: "$419",
      rate: "MF 0.00185",
      term: "36 mo",
      total: "$15,084",
      interest: "55% Residual",
    },
  };
  const d = data[activeTab];

  return (
    <div style={{ marginTop: "3.5rem", position: "relative", zIndex: 2, width: "100%", maxWidth: 420 }}>
      <div
        style={{
          background: "rgba(15,23,42,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "1.75rem",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Vehicle label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-accent)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#64748b",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            2025 Toyota Camry XSE
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              color: "#475569",
              fontFamily: "var(--font-mono)",
            }}
          >
            $32,500
          </span>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(255,255,255,0.05)",
            borderRadius: 10,
            padding: 4,
            marginBottom: "1.5rem",
            gap: 4,
          }}
        >
          {(["finance", "lease"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.5rem",
                borderRadius: 8,
                fontSize: "0.8125rem",
                fontWeight: 600,
                background:
                  activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent",
                color: activeTab === tab ? "#f1f5f9" : "#475569",
                boxShadow:
                  activeTab === tab ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
                transition: "all 0.2s",
                textTransform: "capitalize",
                fontFamily: "var(--font-sans)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Monthly payment */}
        <div style={{ marginBottom: "1.5rem" }}>
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "#475569",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 0.375rem",
            }}
          >
            Est. Monthly Payment
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
            <span
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                letterSpacing: "-0.05em",
                fontFamily: "var(--font-mono)",
                color: "#f1f5f9",
                lineHeight: 1,
              }}
            >
              {d.monthly}
            </span>
            <span
              style={{
                fontSize: "0.9375rem",
                color: "#475569",
                fontWeight: 500,
              }}
            >
              /mo
            </span>
          </div>
        </div>

        {/* Detail grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.875rem 1.25rem",
            padding: "1.125rem",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            marginBottom: "1rem",
          }}
        >
          {[
            { label: "Rate", value: d.rate },
            { label: "Term", value: d.term },
            { label: "Total cost", value: d.total },
            { label: "Down payment", value: "$3,000" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "#334155",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  margin: "0 0 0.2rem",
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  fontFamily: "var(--font-mono)",
                  margin: 0,
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "rgba(79,156,249,0.12)",
            border: "1px solid rgba(79,156,249,0.25)",
            borderRadius: 6,
            padding: "0.3rem 0.75rem",
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--color-accent)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Non-binding estimate · Verify with dealer
        </div>
      </div>

      {/* Glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 21,
          background:
            "linear-gradient(135deg, rgba(79,156,249,0.25), rgba(167,139,250,0.18))",
          filter: "blur(24px)",
          zIndex: -1,
          opacity: 0.7,
        }}
      />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "8rem clamp(1.25rem, 5vw, 3rem) 5rem",
        overflow: "hidden",
        background: "#0b1120",
      }}
    >
      <style>{`
        @keyframes scrollPulse {
          0%   { transform: translateY(0); opacity: 1; }
          50%  { transform: translateY(6px); opacity: 0.4; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Mesh gradient background */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 80% 60% at 20% 40%, rgba(79,156,249,0.15) 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(167,139,250,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 60% 80%, rgba(79,156,249,0.08) 0%, transparent 60%)
          `,
        }}
      />

      {/* Grid lines */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 760,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Pill badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(79,156,249,0.12)",
            border: "1px solid rgba(79,156,249,0.25)",
            borderRadius: 999,
            padding: "0.375rem 1rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--color-accent)",
            letterSpacing: "0.02em",
            marginBottom: "1.75rem",
          }}
        >
          {/* Zap icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          AI-powered · No account required
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          style={{
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.15,
            color: "#f1f5f9",
            margin: "0 0 1.75rem",
          }}
        >
          Know your payment{" "}
          <span style={{ color: "var(--color-accent)" }}>
            before you negotiate.
          </span>
        </h1>

        {/* Subheadline */}
        <p
          style={{
            fontSize: "clamp(1.0625rem, 2.5vw, 1.25rem)",
            color: "#94a3b8",
            lineHeight: 1.65,
            maxWidth: 540,
            fontWeight: 400,
            margin: "0 0 2rem",
          }}
        >
          Compare finance and lease options in minutes. Enter your budget, pick
          a vehicle, and get a clear monthly estimate — free.
        </p>

        {/* CTA buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.875rem",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: "1.75rem",
          }}
        >
          <Link
            href="/estimate"
            style={{
              padding: "0.9375rem 2.5rem",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-accent-grad)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.015em",
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(79,156,249,0.4)",
              transition: "transform 0.15s, box-shadow 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 28px rgba(79,156,249,0.5)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.transform = "";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 20px rgba(79,156,249,0.4)";
            }}
          >
            Get My Estimate →
          </Link>
          <a
            href="#how-it-works"
            style={{
              padding: "0.9375rem 1.75rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#94a3b8",
              fontSize: "1rem",
              fontWeight: 500,
              textDecoration: "none",
              transition: "all 0.15s",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(79,156,249,0.4)";
              (e.currentTarget as HTMLAnchorElement).style.color = "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8";
            }}
          >
            See how it works
            {/* Chevron icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>

        {/* Trust micro-signals */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "No PII stored" },
            { label: "Session-only data" },
            { label: "Free to use" },
          ].map(({ label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                color: "#64748b",
                fontSize: "0.8125rem",
                fontWeight: 500,
              }}
            >
              {/* Shield/lock icon placeholder */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Floating preview card */}
      <PreviewCard />

      {/* Scroll cue */}
      <ScrollCue />
    </section>
  );
}
