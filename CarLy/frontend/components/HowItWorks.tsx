// ─────────────────────────────────────────────────────────────────────────────
// components/HowItWorks.tsx
// 4-step process section for the homepage.
// Server Component — hover states handled via CSS classes in globals.css.
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Set your budget",
    body: "Choose monthly payment or total price. Add your down payment amount.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Pick a vehicle",
    body: "Select year, make, and model. Enter the asking price or MSRP.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 17H3a2 2 0 0 1-2-2v-4l2.7-6.3A2 2 0 0 1 5.6 3h12.8a2 2 0 0 1 1.9 1.7L23 11v4a2 2 0 0 1-2 2h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="16.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Add your details",
    body: "Enter your credit score and ZIP — used only to estimate your rate tier.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Get your estimate",
    body: "See finance and lease options side by side, with AI-powered plain-language insights.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      style={{
        padding: "6rem clamp(1.25rem, 5vw, 3rem)",
        background: "var(--color-bg)",
      }}
    >
      <style>{`
        .hiw-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          transition: all 0.2s;
          position: relative;
        }
        .hiw-card:hover {
          border-color: rgba(79,156,249,0.35);
          box-shadow: 0 8px 32px rgba(0,0,0,0.09), 0 0 0 1px rgba(79,156,249,0.15);
          transform: translateY(-3px);
        }
        .hiw-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--color-surface-2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.125rem;
          color: var(--color-text-muted);
          transition: background 0.2s, color 0.2s;
        }
        .hiw-card:hover .hiw-icon {
          background: rgba(79,156,249,0.12);
          color: var(--color-accent);
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
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
            Simple process
          </p>
          <h2
            id="how-heading"
            style={{
              fontSize: "clamp(1.875rem, 4vw, 2.625rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "var(--color-text)",
              lineHeight: 1.1,
              margin: "0 0 0.875rem",
            }}
          >
            Your estimate in 4 steps
          </h2>
          <p
            style={{
              fontSize: "1.0625rem",
              color: "var(--color-text-muted)",
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            No jargon. No account. Nothing stored after you leave.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {STEPS.map(({ num, icon, title, body }, i) => (
            <div key={num} className="hiw-card">
              {/* Step number */}
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  color: "rgba(79,156,249,0.5)",
                  fontFamily: "var(--font-mono)",
                  marginBottom: "1rem",
                }}
              >
                {num}
              </div>

              {/* Icon */}
              <div className="hiw-icon">{icon}</div>

              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "var(--color-text)",
                  marginBottom: "0.5rem",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {body}
              </p>

              {/* Connector arrow (not last) */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: -14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 28,
                    height: 28,
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
