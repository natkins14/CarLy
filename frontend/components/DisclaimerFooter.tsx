export default function DisclaimerFooter() {
  return (
    <footer
      role="contentinfo"
      aria-label="Legal disclaimer"
      style={{
        width: "100%",
        borderTop: "1px solid #e2e8f0",
        background: "#f8fafc",
        padding: "1.5rem 2rem",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.6, color: "#64748b" }}>
          CarLy provides payment estimates for informational purposes only. All figures are
          approximations based on publicly available data and user-provided inputs. Actual payments,
          rates, and terms are determined by lenders and dealers and may differ significantly.
          CarLy is not a licensed financial advisor, broker, or lender.
        </p>
        <p style={{ margin: 0, fontSize: "0.6875rem", color: "#94a3b8" }}>
          © {new Date().getFullYear()} CarLy &mdash; Estimates only. Not a financial recommendation.
          All trademarks belong to their respective owners.
        </p>
      </div>
    </footer>
  );
}
