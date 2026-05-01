// ─────────────────────────────────────────────────────────────────────────────
// components/SampleResults.tsx
// Static illustration of what the estimate output looks like.
// Uses hardcoded sample numbers — this is marketing copy, not real data.
// Server Component.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";

function SampleCard({
  type,
}: {
  type: "finance" | "lease";
}) {
  const isFinance = type === "finance";
  const accentColor = isFinance ? "var(--color-accent)" : "var(--color-accent-2)";
  const accentDark = isFinance ? "var(--color-accent-dark)" : "#7c3aed";
  const accentBg = isFinance
    ? "rgba(79,156,249,0.06)"
    : "rgba(167,139,250,0.06)";
  const accentBorder = isFinance
    ? "rgba(79,156,249,0.18)"
    : "rgba(167,139,250,0.18)";
  const topBar = isFinance
    ? "linear-gradient(90deg, var(--color-accent), transparent)"
    : "linear-gradient(90deg, var(--color-accent-2), transparent)";

  const data = isFinance
    ? {
        label: "Finance",
        monthly: "634",
        row1: { label: "Total cost", value: "$38,040" },
        row2: { label: "Total interest", value: "$5,540" },
        row3: { label: "Term", value: "60 mo" },
        row4: { label: "Down payment", value: "$3,000" },
        rateLabel: "APR Applied",
        rateValue: "6.99%",
      }
    : {
        label: "Lease",
        monthly: "419",
        row1: { label: "Total paid", value: "$15,084" },
        row2: { label: "Money factor", value: "0.00185" },
        row3: { label: "Term", value: "36 mo" },
        row4: { label: "Down payment", value: "$3,000" },
        rateLabel: "Residual",
        rateValue: "55%",
      };

  return (
    <article
      aria-label={`Sample ${data.label} estimate`}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.75rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Top accent bar */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: topBar,
          borderRadius: "16px 16px 0 0",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <p
          style={{
            fontSize: "0.6875rem",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: accentDark,
            margin: 0,
          }}
        >
          {data.label}
        </p>
        <span
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-faint)",
            borderRadius: 999,
            padding: "0.2rem 0.6rem",
          }}
        >
          Non-Binding Estimate
        </span>
      </div>

      {/* Monthly payment */}
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-muted)",
          fontWeight: 500,
          margin: "0 0 0.25rem",
        }}
      >
        Est. Monthly Payment
      </p>
      <p style={{ margin: "0 0 1.5rem", lineHeight: 1 }}>
        <span
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
            verticalAlign: "top",
            marginTop: "0.5rem",
            display: "inline-block",
            fontFamily: "var(--font-mono)",
          }}
        >
          $
        </span>
        <span
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            letterSpacing: "-0.05em",
            fontFamily: "var(--font-mono)",
            color: "var(--color-text)",
          }}
        >
          {data.monthly}
        </span>
        <span
          style={{
            fontSize: "0.9375rem",
            color: "var(--color-text-faint)",
            marginLeft: "0.25rem",
            fontWeight: 500,
          }}
        >
          /mo
        </span>
      </p>

      {/* Detail grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.875rem",
          padding: "1.125rem",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          marginBottom: "1.125rem",
        }}
      >
        {[data.row1, data.row2, data.row3, data.row4].map(({ label, value }) => (
          <div key={label}>
            <p
              style={{
                fontSize: "0.5625rem",
                fontWeight: 700,
                color: "var(--color-text-faint)",
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
                color: "var(--color-text)",
                fontFamily: "var(--font-mono)",
                margin: 0,
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Rate row */}
      <div
        style={{
          padding: "0.75rem 1rem",
          background: accentBg,
          border: `1px solid ${accentBorder}`,
          borderRadius: "var(--radius-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}
        >
          {data.rateLabel}:{" "}
        </span>
        <span
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: accentDark,
            fontFamily: "var(--font-mono)",
          }}
        >
          {data.rateValue}
        </span>
      </div>
    </article>
  );
}

export default function SampleResults() {
  return (
    <section
      aria-labelledby="sample-heading"
      style={{
        padding: "6rem clamp(1.25rem, 5vw, 3rem)",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
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
            Example output
          </p>
          <h2
            id="sample-heading"
            style={{
              fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "var(--color-text)",
              lineHeight: 1.1,
              margin: "0 0 0.875rem",
            }}
          >
            What you&apos;ll see
          </h2>
          <p
            style={{
              fontSize: "1.0625rem",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            A clear side-by-side breakdown — no fine print buried in footnotes.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
            maxWidth: 760,
            margin: "0 auto 1.5rem",
          }}
        >
          <SampleCard type="finance" />
          <SampleCard type="lease" />
        </div>

        {/* AI Insights teaser */}
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            background: "rgba(79,156,249,0.04)",
            border: "1px solid rgba(79,156,249,0.15)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem 1.75rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              background: "linear-gradient(180deg, var(--color-accent), transparent)",
              borderRadius: "16px 0 0 16px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.625rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{ color: "var(--color-accent)", fontSize: "0.875rem" }}
            >
              ✦
            </span>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-accent)",
              }}
            >
              AI Insights
            </span>
          </div>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--color-text-muted)",
              lineHeight: 1.7,
              margin: "0 0 1rem",
            }}
          >
            &ldquo;At your budget of $650/mo, financing the Camry fits
            comfortably — you&apos;d pay $16 under your cap. Leasing saves
            $215/mo but you won&apos;t own the vehicle at the end. If low monthly
            cost matters more than equity, leasing is worth a closer look.&rdquo;
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-faint)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            This explanation is AI-generated and is for informational purposes
            only. It is not financial advice.
          </p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <Link
            href="/estimate"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.9375rem 2.5rem",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-accent-grad)",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.015em",
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(79,156,249,0.35)",
              transition: "opacity 0.15s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
              (e.currentTarget as HTMLAnchorElement).style.transform = "";
            }}
          >
            Get your real estimate →
          </Link>
        </div>
      </div>
    </section>
  );
}
