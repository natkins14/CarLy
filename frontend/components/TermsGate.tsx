"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { initSession } from "@/lib/api";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: globalThis.KeyboardEvent) => {
    if (!active || e.key !== "Tab" || !containerRef.current) return;
    const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.closest("[inert]"));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
  }, [active]);

  useEffect(() => { document.addEventListener("keydown", handleKeyDown); return () => document.removeEventListener("keydown", handleKeyDown); }, [handleKeyDown]);
  useEffect(() => { if (active && containerRef.current) { containerRef.current.querySelector<HTMLElement>(FOCUSABLE)?.focus(); } }, [active]);

  return containerRef;
}

interface TermsGateProps {
  onAccepted: () => void;
  mainContentRef: React.RefObject<HTMLElement>;
}

export default function TermsGate({ onAccepted, mainContentRef }: TermsGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useFocusTrap(true);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const main = mainContentRef.current;
    if (main) (main as HTMLElement & { inert: boolean }).inert = true;
    return () => { if (main) (main as HTMLElement & { inert: boolean }).inert = false; };
  }, [mainContentRef]);

  useEffect(() => {
    const block = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") e.preventDefault(); };
    document.addEventListener("keydown", block);
    return () => document.removeEventListener("keydown", block);
  }, []);

  const handleAccept = async () => {
    if (!agreed || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await initSession();
      sessionStorage.setItem("terms_accepted", "true");
      onAccepted();
    } catch {
      setError("Something went wrong while starting your session. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
      <div aria-live="assertive" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        Terms of use agreement required. Please read and accept to continue.
      </div>

      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}
        style={{ position: "relative", width: "100%", maxWidth: 520, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "2.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#0f172a" }}>

        {/* Logo */}
        <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.75rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #4f9cf9, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>C</div>
          <span style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.02em", color: "#0f172a" }}>CarLy</span>
        </div>

        <h1 id={titleId} style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1.2 }}>
          Before you continue
        </h1>
        <p id={descId} style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.6 }}>
          CarLy helps you estimate vehicle payments. Please review what this tool is — and isn&apos;t.
        </p>

        <ul style={{ margin: "0 0 1.5rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[
            { icon: "📊", text: "All results are estimates only, not guarantees." },
            { icon: "🚫", text: "CarLy is not a licensed financial advisor or lender." },
            { icon: "⚖️", text: "You assume all risk for decisions based on this tool." },
            { icon: "🔒", text: "No personal financial data is stored beyond your current session." },
          ].map(({ icon, text }) => (
            <li key={text} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.875rem", lineHeight: 1.5, color: "#374151" }}>
              <span aria-hidden="true" style={{ flexShrink: 0, fontSize: "1rem", marginTop: 1 }}>{icon}</span>
              {text}
            </li>
          ))}
        </ul>

        <p style={{ margin: "0 0 1.5rem", fontSize: "0.8125rem", color: "#64748b" }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline", textUnderlineOffset: 3 }}>
            Full Terms of Use ↗
          </a>
        </p>

        <hr aria-hidden="true" style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "0 0 1.5rem" }} />

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: 1.5, color: "#374151", userSelect: "none" }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} aria-required="true"
            style={{ flexShrink: 0, marginTop: 3, width: 18, height: 18, accentColor: "#4f9cf9", cursor: "pointer" }} />
          I understand and agree to the Terms of Use. CarLy provides estimates only and is not a substitute for professional financial advice.
        </label>

        {error && (
          <p role="alert" style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "#dc2626", background: "rgba(220,38,38,0.06)", borderRadius: 8, padding: "0.625rem 0.875rem" }}>
            {error}
          </p>
        )}

        <button onClick={handleAccept} disabled={!agreed || isSubmitting} aria-disabled={!agreed || isSubmitting}
          style={{ width: "100%", padding: "0.875rem 1.5rem", borderRadius: 10, border: "none", fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.01em", cursor: agreed && !isSubmitting ? "pointer" : "not-allowed", transition: "opacity 0.15s, transform 0.1s", background: agreed && !isSubmitting ? "linear-gradient(135deg, #4f9cf9, #a78bfa)" : "#e2e8f0", color: agreed && !isSubmitting ? "#fff" : "#94a3b8" }}>
          {isSubmitting ? "Starting session…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
