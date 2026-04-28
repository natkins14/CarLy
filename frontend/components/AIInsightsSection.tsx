"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/AIInsightsSection.tsx
// AI-generated narrative section — visually distinct from payment cards.
// Must NOT be nested inside a PaymentCard.
// Hidden entirely when ai_narrative is null (no empty section, no error shown).
// Contains mandatory AI disclaimer per requirements2.0.md §L2.
// ─────────────────────────────────────────────────────────────────────────────

interface AIInsightsSectionProps {
  narrative: string | null | undefined;
}

export default function AIInsightsSection({ narrative }: AIInsightsSectionProps) {
  // Specification: hide entirely when null — no empty section, no error message
  if (!narrative) return null;

  return (
    <section
      aria-label="AI-generated payment explanation"
      style={{
        // Visually distinct background — separates from white/dark payment cards
        background: "rgba(79, 156, 249, 0.05)",
        border: "1px solid rgba(79, 156, 249, 0.18)",
        borderRadius: 16,
        padding: "1.75rem",
        // ≥ 16px margin from surrounding payment cards (§L2)
        marginTop: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative left stripe — visible AI section marker */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 3,
          background: "linear-gradient(180deg, #4f9cf9, rgba(79,156,249,0))",
          borderRadius: "16px 0 0 16px",
        }}
      />

      {/* Mandatory label: "✦ AI Insights" per §L2 */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <span
          aria-hidden="true"
          style={{
            fontSize: "0.75rem",
            color: "#4f9cf9",
            lineHeight: 1,
          }}
        >
          ✦
        </span>
        <p
          style={{
            margin: 0,
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#4f9cf9",
          }}
        >
          AI Insights
        </p>
      </div>

      {/* Narrative text */}
      <p
        style={{
          margin: "0 0 1.25rem",
          fontSize: "0.9375rem",
          color: "#c4c8dc",
          lineHeight: 1.75,
          // Slightly indented to feel distinguished from badge area
          paddingLeft: "0.25rem",
        }}
      >
        {narrative}
      </p>

      {/* Mandatory disclaimer per §L2 — always appended */}
      <div
        style={{
          borderTop: "1px solid rgba(79,156,249,0.12)",
          paddingTop: "0.875rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: "0.6875rem",
            color: "#4f9cf9",
            opacity: 0.6,
            flexShrink: 0,
            lineHeight: "1.4rem",
          }}
        >
          ℹ
        </span>
        <p
          style={{
            margin: 0,
            // Must not be smaller than 0.75rem (NFR3 accessibility)
            fontSize: "0.75rem",
            color: "#555977",
            lineHeight: 1.5,
          }}
        >
          This explanation is AI-generated and is for informational purposes only. It is not financial advice.
        </p>
      </div>
    </section>
  );
}
