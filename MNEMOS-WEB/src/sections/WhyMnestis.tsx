import {
  Network,
  Dna,
  Bot,
  Radar,
  Boxes,
  GitBranch,
} from "lucide-react";
import { WHY_CARDS } from "../lib/site";
import SectionHeading from "../components/ui/SectionHeading";
import GlowCard from "../components/ui/GlowCard";
import Reveal from "../components/ui/Reveal";

const ICONS: Record<string, typeof Network> = {
  architecture: Network,
  dna: Dna,
  context: Bot,
  impact: Radar,
  capabilities: Boxes,
  flows: GitBranch,
};

export default function WhyMnestis() {
  return (
    <section id="why" className="container-px mx-auto max-w-[1200px] scroll-mt-24 py-24 sm:py-32">
      <SectionHeading
        eyebrow="Why MNESTIS"
        title={
          <>
            Everything an agent needs,
            <br className="hidden sm:block" /> the moment it opens your repo.
          </>
        }
        subtitle="AI tools and new teammates fail the same way — they grep random files instead of reading architecture. MNESTIS gives every consumer the same ground truth."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {WHY_CARDS.map((card, i) => {
          const Icon = ICONS[card.key];
          return (
            <Reveal key={card.key} delay={i * 0.06}>
              <GlowCard accent={card.accent} className="h-full p-7">
                <div
                  className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--border)] transition-transform duration-300 group-hover:scale-110"
                  style={{ color: card.accent, background: "var(--surface-2)" }}
                >
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-[var(--text)]">
                  {card.title}
                </h3>
                <p className="mt-2.5 text-[0.95rem] leading-relaxed text-[var(--text-dim)]">
                  {card.desc}
                </p>
              </GlowCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
