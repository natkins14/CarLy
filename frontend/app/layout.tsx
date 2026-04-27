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
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
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
      style={{ colorScheme: "dark" }}
    >
      <body>
        {/*
         * TermsGateWrapper is a Client Component that:
         *  1. Checks sessionStorage["terms_accepted"] on mount
         *  2. Shows the TermsGate modal if not accepted
         *  3. Applies `inert` to the #main-content element while gate is open
         *
         * The main content (#main-content) is rendered unconditionally so that
         * SSR produces the page HTML — the gate overlays it visually.
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
