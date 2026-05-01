"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/Navbar.tsx
// Sticky top navigation bar.
// Transparent on load, transitions to frosted-glass on scroll.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 64,
        background: scrolled ? "rgba(248,250,252,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(226,232,240,0.7)"
          : "1px solid transparent",
        transition: "background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease",
        display: "flex",
        alignItems: "center",
        padding: "0 clamp(1.25rem, 4vw, 3rem)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--color-accent-grad)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
              boxShadow: "0 2px 8px rgba(79,156,249,0.35)",
              flexShrink: 0,
            }}
          >
            C
          </div>
          <span
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              color: "var(--color-text)",
            }}
          >
            Car
            <span style={{ color: "var(--color-accent)" }}>Ly</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <Link
            href="#how-it-works"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--color-text)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--color-text-muted)")
            }
          >
            How it works
          </Link>
          <Link
            href="#faq"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--color-text)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--color-text-muted)")
            }
          >
            FAQ
          </Link>
          <Link
            href="/estimate"
            style={{
              padding: "0.5rem 1.125rem",
              borderRadius: "var(--radius-md)",
              background: "var(--color-accent-grad)",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(79,156,249,0.3)",
              transition: "opacity 0.15s, transform 0.1s",
              display: "inline-block",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.88")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")
            }
          >
            Estimate now
          </Link>
        </div>
      </div>
    </nav>
  );
}
