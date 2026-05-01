// ─────────────────────────────────────────────────────────────────────────────
// app/page.tsx — Homepage (revamped)
//
// Composes the new homepage sections. All heavy interactivity lives in
// "use client" child components; this root page is a Server Component.
// ─────────────────────────────────────────────────────────────────────────────

import HeroSection from "@/components/HeroSection";
import TrustBar from "@/components/TrustBar";
import HowItWorks from "@/components/HowItWorks";
import SampleResults from "@/components/SampleResults";
import EstimateCTA from "@/components/EstimateCTA";
import FAQSection from "@/components/FAQSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustBar />
      <HowItWorks />
      <SampleResults />
      <EstimateCTA />
      <FAQSection />
    </>
  );
}
