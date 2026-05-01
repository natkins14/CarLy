import Link from "next/link";

export default function HomePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        padding: "2rem 1.5rem",
        fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
        textAlign: "center",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "14px",
          background: "linear-gradient(135deg, #4f9cf9, #a78bfa)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.5px",
          marginBottom: "1.25rem",
        }}
      >
        C
      </div>

      <h1
        style={{
          fontSize: "clamp(2rem, 5vw, 3rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "#f0f2f8",
          margin: "0 0 1rem",
          lineHeight: 1.1,
        }}
      >
        Estimate your car payment
      </h1>

      <p
        style={{
          fontSize: "1.0625rem",
          color: "#8b90a8",
          lineHeight: 1.6,
          maxWidth: 480,
          margin: "0 0 2.5rem",
        }}
      >
        Compare finance and lease options in minutes. No account required —
        nothing stored after your session.
      </p>

      <Link
        href="/estimate"
        style={{
          display: "inline-block",
          padding: "0.9rem 2.25rem",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #4f9cf9, #a78bfa)",
          color: "#fff",
          fontSize: "1rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          textDecoration: "none",
          transition: "opacity 0.15s",
        }}
      >
        Get my estimate →
      </Link>
    </div>
  );
}
