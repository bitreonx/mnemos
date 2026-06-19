import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";
import CopyCommand from "../components/ui/CopyCommand";
import AnimatedCounter from "../components/ui/AnimatedCounter";

const EASE = [0.22, 0.8, 0.18, 1] as const;

const STATS = [
  { value: 92, suffix: "%", label: "fewer tokens per subagent", decimals: 0 },
  { value: 13.4, suffix: "×", label: "memory vs raw source", decimals: 1 },
  { value: 96, suffix: "", label: "AI readiness score", decimals: 0 },
] as const;

/** Minimal funnel: repo → one memory layer → many agents. */
function MemoryFunnel() {
  const agents = ["Main", "Sub A", "Sub B", "Sub C"];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <svg viewBox="0 0 360 300" className="h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id="mem-funnel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="360" height="300" fill="url(#mem-funnel)" rx="16" />

        {/* repo */}
        <rect x="130" y="24" width="100" height="36" rx="8" fill="var(--surface-2)" stroke="var(--border-strong)" />
        <text x="180" y="46" textAnchor="middle" fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-mono)">
          repository
        </text>

        {/* single build arrow */}
        <motion.line
          x1="180" y1="62" x2="180" y2="88"
          stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="4 3"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE }}
        />

        {/* shared memory */}
        <motion.rect
          x="108" y="92" width="144" height="44" rx="10"
          fill="var(--brand)"
          fillOpacity="0.12"
          stroke="var(--brand)" strokeOpacity="0.45"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1, ease: EASE }}
        />
        <text x="180" y="112" textAnchor="middle" fontSize="11" fill="var(--text)" fontFamily="var(--font-sans)" fontWeight="600">
          Shared Memory
        </text>
        <text x="180" y="128" textAnchor="middle" fontSize="9.5" fill="var(--text-faint)" fontFamily="var(--font-mono)">
          .mnemos/auth.memory.json
        </text>

        {/* fan-out to agents */}
        {agents.map((name, i) => {
          const x = 58 + i * 82;
          const delay = 0.2 + i * 0.06;
          return (
            <g key={name}>
              <motion.path
                d={`M180 136 Q180 168 ${x} 196`}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay, ease: EASE }}
              />
              <motion.rect
                x={x - 34} y={200} width="68" height="30" rx="7"
                fill="var(--surface-2)" stroke="var(--border)"
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: delay + 0.05, ease: EASE }}
              />
              <text x={x} y={219} textAnchor="middle" fontSize="10" fill="var(--text-dim)" fontFamily="var(--font-mono)">
                {name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Side-by-side cost strip — editorial, not card soup. */
function CostStrip() {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-2">
      <div className="border-b border-[var(--border)] p-6 sm:border-b-0 sm:border-r sm:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
          Without Mnemos
        </p>
        <p className="mt-3 font-mono text-[2rem] font-semibold leading-none tracking-tight text-[var(--text)]">
          ~6,400<span className="ml-1 text-[0.45em] font-normal text-[var(--text-faint)]">t</span>
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
          Three subagents each re-read <code className="font-mono text-[var(--text)]">src/auth/*</code> from disk.
        </p>
        <ul className="mt-4 space-y-1.5 font-mono text-[11px] text-[var(--text-faint)]">
          <li>Agent A → auth · 3,200t</li>
          <li>Agent B → auth · 3,200t</li>
          <li className="opacity-60">…same files, again</li>
        </ul>
      </div>

      <div className="p-6 sm:p-8" style={{ background: "color-mix(in srgb, var(--brand) 5%, transparent)" }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--brand)]">
          With Mnemos
        </p>
        <p className="mt-3 font-mono text-[2rem] font-semibold leading-none tracking-tight text-[var(--text)]">
          ~480<span className="ml-1 text-[0.45em] font-normal text-[var(--text-faint)]">t</span>
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
          One shard built once. Every agent loads{" "}
          <code className="font-mono text-[var(--text)]">auth.memory.json</code>.
        </p>
        <ul className="mt-4 space-y-1.5 font-mono text-[11px] text-[var(--text-dim)]">
          <li>Agent A → shard · ~160t</li>
          <li>Agent B → shard · ~160t</li>
          <li>Agent C → shard · ~160t</li>
        </ul>
      </div>
    </div>
  );
}

export default function SharedAgentMemory() {
  return (
    <section id="shared-memory" className="container-px mx-auto max-w-[1100px] scroll-mt-24 py-24 sm:py-28">
      {/* Hook — the reason this exists */}
      <Reveal>
        <blockquote className="mx-auto max-w-2xl border-l-2 border-[var(--brand)] pl-5 text-left sm:pl-6">
          <p className="font-serif text-[1.15rem] italic leading-snug text-[var(--text)] sm:text-[1.25rem]">
            &ldquo;14% of your usage came from subagent-heavy sessions. Each subagent runs its own
            requests.&rdquo;
          </p>
          <footer className="mt-2 text-[12px] text-[var(--text-faint)]">
            — Claude Code usage insight · the problem Mnemos solves
          </footer>
        </blockquote>
      </Reveal>

      <div className="mt-14">
        <SectionHeading
          eyebrow="Shared Agent Memory"
          title={
            <>
              Analyze once.
              <br className="hidden sm:block" />
              <span className="font-serif italic text-[var(--brand)]">Every agent</span> reuses it.
            </>
          }
          subtitle="Subagents shouldn't rebuild the same understanding. Mnemos writes pre-sharded memory to .mnemos/ — one load, shared context, no duplicate exploration."
        />
      </div>

      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <Reveal>
          <MemoryFunnel />
        </Reveal>
        <Reveal delay={0.08}>
          <CostStrip />
        </Reveal>
      </div>

      {/* Three numbers — the payoff */}
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={0.04 + i * 0.04}>
            <div className="bg-[var(--surface)] px-6 py-7 text-center sm:py-8">
              <p className="font-mono text-[2.1rem] font-semibold leading-none tracking-tight text-[var(--text)] sm:text-[2.35rem]">
                <AnimatedCounter value={s.value} suffix={s.suffix} decimals={s.decimals} />
              </p>
              <p className="mt-2.5 text-[12px] leading-snug text-[var(--text-dim)]">{s.label}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* CTA — one command, docs for depth */}
      <Reveal delay={0.1}>
        <div className="mt-12 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
          <CopyCommand command="mnemos memory build ." />
          <Link
            to="/docs/shared-agent-memory"
            className="focus-ring inline-flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--brand)]"
          >
            Shards, server &amp; budgeting
            <ArrowRight size={15} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
