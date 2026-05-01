import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — CarLy",
  robots: { index: false, follow: false },
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "2rem" }}>
    <h2 style={{ fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "-0.02em", color: "#0f172a", marginBottom: "0.75rem" }}>{title}</h2>
    {children}
  </section>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.7, marginBottom: "0.75rem" }}>{children}</p>
);

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)" }}>
      <header style={{ marginBottom: "3rem" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#2563eb", fontSize: "0.875rem", marginBottom: "1.5rem", textDecoration: "none" }}>
          ← Back to CarLy
        </a>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, letterSpacing: "-0.04em", color: "#0f172a", marginBottom: "0.5rem" }}>
          Terms of Use
        </h1>
        <p style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </header>

      <Section title="1. Nature of Estimates">
        <P>CarLy provides vehicle payment estimates for informational and educational purposes only. All figures — including monthly payments, total costs, interest, lease payments, taxes, and fees — are approximations derived from publicly available data and user-supplied inputs.</P>
        <P>These estimates are not guarantees, quotes, or commitments of any kind. Actual payments, rates, and terms are determined solely by lenders and dealers.</P>
      </Section>

      <Section title="2. Not Financial Advice">
        <P>CarLy is not a licensed financial advisor, mortgage broker, insurance broker, or lender. Nothing on this website constitutes financial, legal, tax, or investment advice. You should consult a qualified professional before making any financial decision.</P>
      </Section>

      <Section title="3. No Liability">
        <P>You expressly acknowledge and agree that your use of CarLy is at your sole risk. CarLy and its operators are not liable for any direct, indirect, incidental, or consequential damages arising from your reliance on any estimates or explanations provided by this tool, including decisions to purchase, lease, or finance a vehicle.</P>
      </Section>

      <Section title="4. Data Handling">
        <P>CarLy does not store any personal financial data beyond your current browser session. Credit scores are mapped to a credit tier category (e.g., &ldquo;good&rdquo;) and the raw score is immediately discarded. ZIP codes are used only for tax rate estimation within the current request. No data is persisted to a database.</P>
        <P>Session state is maintained in a short-lived, signed browser cookie that expires after 30 minutes of inactivity. No data from this cookie is linked to your identity.</P>
      </Section>

      <Section title="5. Third-Party Data">
        <P>Vehicle data is sourced from third-party providers. CarLy does not guarantee the accuracy, completeness, or timeliness of this data. MSRP figures may be unavailable or may not reflect current market pricing.</P>
      </Section>

      <Section title="6. Changes to These Terms">
        <P>CarLy reserves the right to update these Terms of Use at any time. Continued use of the tool after changes constitutes acceptance of the updated terms.</P>
      </Section>

      <Section title="7. Governing Law">
        <P>These Terms of Use are governed by the laws of the United States. Any disputes arising from your use of CarLy shall be resolved in accordance with applicable law.</P>
      </Section>

      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1.5rem", marginTop: "0.5rem" }}>
        <p style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
          Questions? Contact us at{" "}
          <a href="mailto:legal@carly.app" style={{ color: "#2563eb" }}>legal@carly.app</a>.
        </p>
      </div>
    </div>
  );
}
