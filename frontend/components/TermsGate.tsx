"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/TermsGate.tsx
//
// Full-viewport blocking modal that must be accepted before the user can
// interact with the application. Implements the click-wrap requirements from
// requirements2.0.md §L3.
//
// Accessibility checklist:
//  ✅ aria-modal="true" on the dialog
//  ✅ Focus trapped inside the modal (custom hook)
//  ✅ Background receives `inert` attribute (prevents keyboard escape)
//  ✅ aria-live="assertive" announces gate presence on mount
//  ✅ "Continue" button is disabled until checkbox is checked (React state,
//     not CSS alone — per §L3 rule 1)
//  ✅ Terms link opens /terms without dismissing gate
//
// Persistence:
//  - sessionStorage only ("terms_accepted" = "true")
//  - Cleared on tab close — user re-accepts each session
//  - No localStorage, no server-side persistence of consent decision
// ─────────────────────────────────────────────────────────────────────────────

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { initSession } from "@/lib/api";

// ─── Focusable element selector ───────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ─── Focus trap hook ──────────────────────────────────────────────────────────

function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (!active || e.key !== "Tab" || !containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.closest("[inert]"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [active]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Move focus into the modal on mount
  useEffect(() => {
    if (active && containerRef.current) {
      const first =
        containerRef.current.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }
  }, [active]);

  return containerRef;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TermsGateProps {
  /** Called after the session cookie is set and acceptance is stored. */
  onAccepted: () => void;
  /** Ref to the main application content — receives `inert` while gate is open. */
  mainContentRef: React.RefObject<HTMLElement>;
}

export default function TermsGate({
  onAccepted,
  mainContentRef,
}: TermsGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useFocusTrap(true);
  const titleId = useId();
  const descId = useId();

  // Apply `inert` to everything outside the modal
  useEffect(() => {
    const main = mainContentRef.current;
    if (main) {
      (main as HTMLElement & { inert: boolean }).inert = true;
    }
    return () => {
      if (main) {
        (main as HTMLElement & { inert: boolean }).inert = false;
      }
    };
  }, [mainContentRef]);

  // Prevent Escape from closing the modal (it is a hard gate)
  useEffect(() => {
    const block = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    document.addEventListener("keydown", block);
    return () => document.removeEventListener("keydown", block);
  }, []);

  const handleAccept = async () => {
    if (!agreed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Establish the session cookie — required before any /api/estimate call
      await initSession();
      // Persist acceptance in sessionStorage (not localStorage)
      sessionStorage.setItem("terms_accepted", "true");
      onAccepted();
    } catch {
      setError(
        "Something went wrong while starting your session. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  const handleCheckboxKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") setAgreed((v) => !v);
  };

  return (
    /* Backdrop */
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgba(10, 12, 18, 0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      {/* Live region announces the gate on mount for screen readers */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
      >
        Terms of use agreement required. Please read and accept to continue.
      </div>

      {/* Modal dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "520px",
          background: "#0e1117",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "2.5rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color: "#e8eaf0",
        }}
      >
        {/* Logo mark */}
        <div
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "1.75rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #4f9cf9, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.5px",
            }}
          >
            C
          </div>
          <span
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#fff",
            }}
          >
            CarLy
          </span>
        </div>

        <h1
          id={titleId}
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.35rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#f0f2f8",
            lineHeight: 1.2,
          }}
        >
          Before you continue
        </h1>

        <p
          id={descId}
          style={{
            margin: "0 0 1.5rem",
            fontSize: "0.875rem",
            color: "#8b90a8",
            lineHeight: 1.6,
          }}
        >
          CarLy helps you estimate vehicle payments. Please review what this
          tool is — and isn&apos;t.
        </p>

        {/* Terms list */}
        <ul
          style={{
            margin: "0 0 1.5rem",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {[
            {
              icon: "📊",
              text: "All results are estimates only, not guarantees.",
            },
            {
              icon: "🚫",
              text: "CarLy is not a licensed financial advisor or lender.",
            },
            {
              icon: "⚖️",
              text: "You assume all risk for decisions based on this tool.",
            },
            {
              icon: "🔒",
              text: "No personal financial data is stored beyond your current session.",
            },
          ].map(({ icon, text }) => (
            <li
              key={text}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                color: "#c4c8dc",
              }}
            >
              <span
                aria-hidden="true"
                style={{ flexShrink: 0, fontSize: "1rem", marginTop: "1px" }}
              >
                {icon}
              </span>
              {text}
            </li>
          ))}
        </ul>

        {/* Link to full terms (opens without dismissing gate) */}
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.8125rem", color: "#8b90a8" }}>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#4f9cf9",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Full Terms of Use ↗
          </a>
        </p>

        {/* Divider */}
        <hr
          aria-hidden="true"
          style={{
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            margin: "0 0 1.5rem",
          }}
        />

        {/* Checkbox — state-controlled, not CSS-only (§L3 rule 1) */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            cursor: "pointer",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            color: "#c4c8dc",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            onKeyDown={handleCheckboxKeyDown}
            aria-required="true"
            style={{
              flexShrink: 0,
              marginTop: "3px",
              width: 18,
              height: 18,
              accentColor: "#4f9cf9",
              cursor: "pointer",
            }}
          />
          I understand and agree to the Terms of Use. CarLy provides estimates
          only and is not a substitute for professional financial advice.
        </label>

        {/* Error state */}
        {error && (
          <p
            role="alert"
            style={{
              margin: "0 0 1rem",
              fontSize: "0.8125rem",
              color: "#f87171",
              background: "rgba(248,113,113,0.08)",
              borderRadius: "8px",
              padding: "0.625rem 0.875rem",
            }}
          >
            {error}
          </p>
        )}

        {/* Continue button — disabled until agreed === true */}
        <button
          onClick={handleAccept}
          disabled={!agreed || isSubmitting}
          aria-disabled={!agreed || isSubmitting}
          style={{
            width: "100%",
            padding: "0.875rem 1.5rem",
            borderRadius: "10px",
            border: "none",
            fontSize: "0.9375rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            cursor: agreed && !isSubmitting ? "pointer" : "not-allowed",
            transition: "opacity 0.15s, background 0.15s, transform 0.1s",
            background:
              agreed && !isSubmitting
                ? "linear-gradient(135deg, #4f9cf9, #a78bfa)"
                : "rgba(255,255,255,0.07)",
            color: agreed && !isSubmitting ? "#fff" : "#555977",
            transform: "translateY(0)",
          }}
          onMouseDown={(e) => {
            if (agreed && !isSubmitting) {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(1px)";
            }
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(0)";
          }}
        >
          {isSubmitting ? "Starting session…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
