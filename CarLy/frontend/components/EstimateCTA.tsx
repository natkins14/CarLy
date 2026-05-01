"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/EstimateCTA.tsx
// Dark full-width section with a quick budget input and purchase-type toggle.
// Links directly to /estimate — does not call the API itself.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PurchaseType } from "@/types";

export default function EstimateCTA() {
  const router = useRouter();
  const [budget, setBudget] = useState("");
  const [type, setType] = useState<PurchaseType>("finance");
  const [focused, setFocused] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Pass budget as a query param so EstimatePage can pre-fill it
    const params = new URLSearchParams();
    if (budget) params.set("budget", budget);
    params.set("type", type);
    router.push(`/estimate?${params.toString()}`);
  }

  return (
    <section
      id="estimate-cta"
      aria-labelledby="cta-heading"
      style={{
        padding: "6rem clamp(1.25rem, 5vw, 3rem)",
        background: "#0b1120",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradients */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 70% 60% at 30% 50%, rgba(79,156,249,0.12), transparent 65%),
            radial-gradient(ellipse 50% 50% at 80% 50%, rgba(167,139,250,0.08), transparent 65%)
          `,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            marginBottom: "0.75rem",
          }}
        >
          Try it now
        </p>
        <h2
          id="cta-heading"
          style={{
            fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#f1f5f9",
            lineHeight: 1.1,
            margin: "0 0 1rem",
          }}
        >
          What&apos;s your monthly budget?
        </h2>
        <p
          style={{
            fontSize: "1.0625rem",
            color: "#64748b",
            margin: "0 0 2.5rem",
          }}
        >
          Start with a number — we&apos;ll handle the rest.
        </p>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: focused
                ? "1px solid rgba(79,156,249,0.5)"
                : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "1.5rem",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: focused ? "0 0 0 3px rgba(79,156,249,0.15)" : "none",
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            {/* Purchase type toggle */}
            <fieldset
              style={{ border: "none", padding: 0, margin: "0 0 1.25rem" }}
            >
              <legend className="sr-only">Purchase type</legend>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {(["finance", "lease", "both"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    style={{
                      padding: "0.4375rem 1rem",
                      borderRadius: 8,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      background:
                        type === t ? "rgba(79,156,249,0.18)" : "transparent",
                      border:
                        type === t
                          ? "1px solid rgba(79,156,249,0.45)"
                          : "1px solid rgba(255,255,255,0.08)",
                      color:
                        type === t ? "var(--color-accent)" : "#475569",
                      transition: "all 0.15s",
                      textTransform: "capitalize",
                      fontFamily: "var(--font-sans)",
                      cursor: "pointer",
                    }}
                  >
                    {t === "both" ? "Show both" : t}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Budget input */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div style={{ flex: 1, position: "relative" }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "1.125rem",
                    color: "#475569",
                    pointerEvents: "none",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  placeholder="650"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  aria-label="Monthly budget in dollars"
                  style={{
                    width: "100%",
                    padding: "0.9375rem 1rem 0.9375rem 2.25rem",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#f1f5f9",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(79,156,249,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.1)")
                  }
                />
              </div>
              <span
                style={{
                  color: "#334155",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                / month
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.9375rem",
                borderRadius: 12,
                background: "var(--color-accent-grad)",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                boxShadow: "0 4px 20px rgba(79,156,249,0.35)",
                transition: "transform 0.15s, box-shadow 0.15s",
                fontFamily: "var(--font-sans)",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 8px 28px rgba(79,156,249,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 4px 20px rgba(79,156,249,0.35)";
              }}
            >
              Get My Estimate →
            </button>

            <p
              style={{
                fontSize: "0.75rem",
                color: "#334155",
                marginTop: "0.875rem",
                marginBottom: 0,
              }}
            >
              Credit score and ZIP required on next step — never stored.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
