"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/FAQSection.tsx
// Accordion-style FAQ section for the homepage.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "Is CarLy free?",
    a: "Yes, completely. No account, no credit card, no hidden fees.",
  },
  {
    q: "Does CarLy store my credit score?",
    a: "No. Your credit score is used only within your session to determine a rate tier. It is never persisted to any database.",
  },
  {
    q: "How accurate are the estimates?",
    a: "Estimates are based on publicly available rate tiers and your inputs. Actual rates are set by lenders and may differ. Always verify with your dealer or lender.",
  },
  {
    q: "Can I compare finance and lease?",
    a: "Yes — select 'Show Both' and CarLy will generate side-by-side estimates for the same vehicle.",
  },
  {
    q: "What information do I need?",
    a: "Just your target budget (monthly or total), the vehicle year/make/model and price, your credit score range, and your ZIP code for tax estimation.",
  },
] as const;

function FAQItem({
  q,
  a,
  isOpen,
  onToggle,
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        border: isOpen
          ? "1px solid rgba(79,156,249,0.35)"
          : "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        transition: "border-color 0.2s",
        background: isOpen ? "rgba(79,156,249,0.03)" : "var(--color-surface)",
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          padding: "1.125rem 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <span
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--color-text)",
            lineHeight: 1.4,
          }}
        >
          {q}
        </span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: isOpen ? "rgba(79,156,249,0.12)" : "var(--color-surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
            color: isOpen ? "var(--color-accent)" : "var(--color-text-faint)",
            fontSize: "1.125rem",
            lineHeight: "1",
          }}
        >
          +
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: "0 1.25rem 1.125rem" }}>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--color-text-muted)",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            {a}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      style={{
        padding: "5rem clamp(1.25rem, 5vw, 3rem)",
        background: "var(--color-surface)",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
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
            Common questions
          </p>
          <h2
            id="faq-heading"
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "var(--color-text)",
              margin: 0,
            }}
          >
            FAQ
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {FAQ_ITEMS.map(({ q, a }, i) => (
            <FAQItem
              key={q}
              q={q}
              a={a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
