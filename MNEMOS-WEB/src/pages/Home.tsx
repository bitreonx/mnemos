import Hero from "../sections/Hero";
import TrustedBy from "../sections/TrustedBy";
import WhyMnestis from "../sections/WhyMnestis";
import AiReadiness from "../sections/AiReadiness";
import SharedAgentMemory from "../sections/SharedAgentMemory";
import { MemoryEngine } from "../sections/MemoryEngine";
import RepositoryDNA from "../sections/RepositoryDNA";
import Pipeline from "../sections/Pipeline";
import ThreeModes from "../sections/ThreeModes";
import FableMindset from "../sections/FableMindset";
import ArchitectureCanvas from "../sections/ArchitectureCanvas";
import Benchmarks from "../sections/Benchmarks";
import Comparison from "../sections/Comparison";
import CTA from "../sections/CTA";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <WhyMnestis />
      <AiReadiness />
      <SharedAgentMemory />
      <MemoryEngine />
      <RepositoryDNA />
      <Pipeline />
      <ThreeModes />
      <FableMindset />
      <ArchitectureCanvas />
      <Benchmarks />
      <Comparison />
      <CTA />
    </>
  );
}
