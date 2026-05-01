"use client";

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
    const params = new URLSearchParams();
    if (budget) params.set("budget", budget);
    params.set("type", type);
    router.push(`/estimate?${params.toString()}`);
  }

  return (
    <section
      id="estimate-cta"
      aria-labelledby="cta-heading"
      style={{ padding: "6rem clamp(1.25rem, 5vw, 3rem)", background: "#f1f5f9", position: "relative", overflow: "hidden" }}
    >
      {/* Subtle gradient accent */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 60% at 30% 50%, rgba(79,156,249,0.07), transparent 65%), radial-gradient(ellipse 50% 50% at 80% 50%, rgba(167,139,250,0.05), transparent 65%)" }} />

      <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", zIndex: 1, textAlign: "center" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#2563eb", marginBottom: "0.75rem" }}>
          Try it now
        </p>
        <h2 id="cta-heading" style={{ fontSize: "clamp(1.875rem, 4vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#0f172a", lineHeight: 1.1, margin: "0 0 1rem" }}>
          What&apos;s your monthly budget?
        </h2>
        <p style={{ fontSize: "1.0625rem", color: "#64748b", margin: "0 0 2.5rem" }}>
          Start with a number — we&apos;ll handle the rest.
        </p>

        <form onSubmit={handleSubmit}>
          <div
            style={{ background: "#ffffff", border: focused ? "1px solid rgba(79,156,249,0.5)" : "1px solid #e2e8f0", borderRadius: 20, padding: "1.5rem", boxShadow: focused ? "0 0 0 3px rgba(79,156,249,0.1)" : "0 1px 3px rgba(0,0,0,0.06)", transition: "border-color 0.2s, box-shadow 0.2s" }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            {/* Purchase type toggle */}
            <fieldset style={{ border: "none", padding: 0, margin: "0 0 1.25rem" }}>
              <legend className="sr-only">Purchase type</legend>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                {(["finance", "lease", "both"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                    style={{ padding: "0.4375rem 1rem", borderRadius: 8, fontSize: "0.8125rem", fontWeight: 600, background: type === t ? "rgba(79,156,249,0.08)" : "transparent", border: type === t ? "1px solid rgba(79,156,249,0.35)" : "1px solid #e2e8f0", color: type === t ? "#2563eb" : "#64748b", transition: "all 0.15s", textTransform: "capitalize", fontFamily: "var(--font-sans)", cursor: "pointer" }}>
                    {t === "both" ? "Show both" : t}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Budget input */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span aria-hidden="true" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: "1.125rem", color: "#94a3b8", pointerEvents: "none", fontFamily: "var(--font-mono)" }}>$</span>
                <input
                  type="number"
                  placeholder="650"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  aria-label="Monthly budget in dollars"
                  style={{ width: "100%", padding: "0.9375rem 1rem 0.9375rem 2.25rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a", fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-mono)", outline: "none", transition: "border-color 0.15s" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(79,156,249,0.5)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                />
              </div>
              <span style={{ color: "#94a3b8", fontSize: "0.9375rem", fontWeight: 500, whiteSpace: "nowrap" }}>/ month</span>
            </div>

            {/* Submit */}
            <button type="submit"
              style={{ width: "100%", padding: "0.9375rem", borderRadius: 12, background: "linear-gradient(135deg, #4f9cf9, #a78bfa)", color: "#fff", fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em", boxShadow: "0 4px 20px rgba(79,156,249,0.3)", transition: "transform 0.15s, box-shadow 0.15s", fontFamily: "var(--font-sans)", border: "none", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(79,156,249,0.45)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(79,156,249,0.3)"; }}>
              Get My Estimate →
            </button>

            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.875rem", marginBottom: 0 }}>
              Credit score and ZIP required on next step — never stored.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
