"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/TermsGateWrapper.tsx
//
// Client Component wrapper that:
//  - Reads sessionStorage on mount to decide if TermsGate should render
//  - Passes the #main-content ref to TermsGate so it can apply `inert`
//  - Re-checks on visibility change (tab regain) since sessionStorage
//    could be cleared by the user
//
// Placed in the root layout as a Client Component boundary so that the
// layout itself (and DisclaimerFooter) remain Server Components.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import TermsGate from "@/components/TermsGate";

const STORAGE_KEY = "terms_accepted";

export default function TermsGateWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // null = not yet checked (prevents flash of either state during SSR hydration)
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () =>
      setAccepted(sessionStorage.getItem(STORAGE_KEY) === "true");

    check();

    // Re-check when the tab regains focus (user might have cleared storage)
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  const handleAccepted = () => setAccepted(true);

  return (
    <>
      {/* Show gate while not accepted (null = hydrating, treat as not accepted) */}
      {accepted !== true && (
        <TermsGate
          onAccepted={handleAccepted}
          mainContentRef={mainRef as React.RefObject<HTMLElement>}
        />
      )}

      {/* Main content is always rendered (for SSR); gate overlays it */}
      <div ref={mainRef}>{children}</div>
    </>
  );
}
