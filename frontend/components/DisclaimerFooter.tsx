// ─────────────────────────────────────────────────────────────────────────────
// components/DisclaimerFooter.tsx
//
// Mandatory global legal footer — rendered server-side in the root layout so
// the disclaimer text is present even if client-side JavaScript fails to load.
// (requirements2.0.md §L1, planning.md §10.1)
//
// This is a React Server Component (no "use client" directive).
// ─────────────────────────────────────────────────────────────────────────────

export default function DisclaimerFooter() {
  return (
    <footer
      role="contentinfo"
      aria-label="Legal disclaimer"
      style={{
        width: "100%",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        background: "#080b11",
        padding: "1.5rem 2rem",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {/* Primary disclaimer — mandatory per §L1 */}
        <p
          style={{
            margin: 0,
            /* Must not be smaller than 12px / 0.75rem (NFR3 accessibility) */
            fontSize: "0.75rem",
            lineHeight: 1.6,
            color: "#6b7090",
          }}
        >
          CarLy provides payment estimates for informational purposes only. All
          figures are approximations based on publicly available data and
          user-provided inputs. Actual payments, rates, and terms are determined
          by lenders and dealers and may differ significantly. CarLy is not a
          licensed financial advisor, broker, or lender.
        </p>

        {/* Secondary line — copyright + version marker */}
        <p
          style={{
            margin: 0,
            fontSize: "0.6875rem",
            color: "#434660",
          }}
        >
          © {new Date().getFullYear()} CarLy &mdash; Estimates only. Not a
          financial recommendation. All trademarks belong to their respective
          owners.
        </p>
      </div>
    </footer>
  );
}
