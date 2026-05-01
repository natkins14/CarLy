// ─────────────────────────────────────────────────────────────────────────────
// app/layout.tsx
// Root layout — Next.js App Router.
//
// Responsibilities:
//  1. Loads fonts (DM Sans display, JetBrains Mono for numbers)
//  2. Applies global CSS custom properties (design tokens)
//  3. SSR-renders the mandatory DisclaimerFooter on every page
//  4. Mounts the TermsGate wrapper (client component) that checks
//     sessionStorage and gates the main content behind the click-wrap modal
//  5. Renders the sticky Navbar above main content on every page
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import DisclaimerFooter from "@/components/DisclaimerFooter";
import TermsGateWrapper from "@/components/TermsGateWrapper";
import "./globals.css";

// ─── Fonts ───────────────────────────────────────────────────────────────────

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "CarLy — Estimate Your Car Payment",
  description:
    "Get a clear, plain-language estimate of your monthly car payment. " +
    "Compare finance vs. lease options in seconds.",
  robots: { index: true, follow: true },
};

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable}`}
      style={{ colorScheme: "light" }}
    >
      <body>
        {/*
         * TermsGateWrapper is a Client Component that:
         *  1. Checks sessionStorage["terms_accepted"] on mount
         *  2. Shows the TermsGate modal if not accepted
         *  3. Applies `inert` to the #main-content element while gate is open
         */}
        <TermsGateWrapper>
          <div
            id="main-content"
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
            }}
          >
            {/*
             * Navbar is rendered here so it appears on every page,
             * including /estimate and /terms. It is position:fixed so it
             * does not affect document flow. Only shown on the homepage
             * via CSS — on /estimate the back-link header serves as nav.
             *
             * Note: On /estimate, the Navbar overlaps the page header.
             * The estimate page adds paddingTop: 64px to its container to
             * compensate (see app/estimate/page.tsx).
             */}
            <Navbar />

            <main style={{ flex: 1 }}>{children}</main>

            {/*
             * DisclaimerFooter is a Server Component — rendered at build/
             * request time. No JS required. Satisfies §L1 SSR mandate.
             */}
            <DisclaimerFooter />
          </div>
        </TermsGateWrapper>
      </body>
    </html>
  );
}
