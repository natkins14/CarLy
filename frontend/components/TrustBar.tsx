// ─────────────────────────────────────────────────────────────────────────────
// components/TrustBar.tsx
// Horizontal strip of 4 key trust/value stats.
// Server Component — no interactivity needed.
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "100%", label: "Free to use" },
  { value: "0", label: "Data stored" },
  { value: "60 sec", label: "Average time" },
  { value: "Finance + Lease", label: "Both options compared" },
] as const;

export default function TrustBar() {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        padding: "1.5rem clamp(1.25rem, 5vw, 3rem)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-around",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        {STATS.map(({ value, label }) => (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <span
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--color-accent)",
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-faint)",
                fontWeight: 500,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
