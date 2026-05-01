import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustBar from "@/components/TrustBar";
import HowItWorks from "@/components/HowItWorks";
import SampleResults from "@/components/SampleResults";
import EstimateCTA from "@/components/EstimateCTA";
import FAQSection from "@/components/FAQSection";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <TrustBar />
      <HowItWorks />
      <SampleResults />
      <EstimateCTA />
      <FAQSection />
    </>
  );
}
