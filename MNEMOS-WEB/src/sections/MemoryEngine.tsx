import { motion } from "framer-motion";
import { Shield, Brain, Zap, Lock } from "lucide-react";
import GlowCard from "../components/ui/GlowCard";

const EASE = [0.22, 0.8, 0.18, 1] as const;

const FEATURES = [
  {
    icon: Lock,
    title: "100% On-Device",
    desc: "No cloud, no API keys, no telemetry. Every embedding and query runs locally.",
  },
  {
    icon: Brain,
    title: "Hybrid Retrieval",
    desc: "BM25 + local 384-dim embeddings fused with RRF — semantic + exact match.",
  },
  {
    icon: Zap,
    title: "Chronoshift + Provenance",
    desc: "Import Claude JSONL back-catalog into episodic memory. Ask with cited answers that admit gaps honestly.",
  },
  {
    icon: Shield,
    title: "Veil + Spiralfuse",
    desc: "Team/client scoped memory at query time. Loop token fuse stops runaway agent spend.",
  },
];

export function MemoryEngine() {
  return (
    <section id="memory-engine" className="relative overflow-hidden py-28">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/4 top-20 h-[500px] w-[500px] rounded-full bg-[var(--brand)] opacity-[0.08] blur-[120px]" />
        <div className="absolute right-1/4 bottom-20 h-[400px] w-[400px] rounded-full bg-[var(--cyan)] opacity-[0.06] blur-[100px]" />
      </div>

      <div className="container-px mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-16 text-center"
        >
          <span className="inline-flex items-center gap-2 font-mono text-[0.8125rem] uppercase tracking-[0.12em] text-[var(--text-faint)]">
            <span className="h-1 w-1 rounded-full bg-[var(--brand)]" />
            Memory Engine · Labyrinth
          </span>
          <h2 className="mt-5 font-serif text-[2.5rem] font-normal leading-[1.08] tracking-tight text-[var(--text)] md:text-[3.2rem]">
            Local AI memory <span className="italic text-[var(--brand)]">infrastructure</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-[var(--text-dim)]">
            Release codename <strong className="font-semibold text-[var(--text)]">Labyrinth</strong> — part of Mneme 0.3.0.{" "}
            Your repository never leaves your machine.
          </p>
        </motion.div>

        <div className="mb-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            >
              <GlowCard className="h-full" accent="var(--brand)">
                <f.icon className="mb-3 h-7 w-7 text-[var(--brand)]" strokeWidth={1.5} />
                <h3 className="mb-2 text-[0.9375rem] font-semibold text-[var(--text)]">{f.title}</h3>
                <p className="text-[0.875rem] leading-relaxed text-[var(--text-dim)]">{f.desc}</p>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
        >
          <GlowCard accent="var(--cyan)">
            <pre className="overflow-x-auto font-mono text-[0.8125rem] leading-[1.75] text-[var(--text-dim)]">
              <code>
{`# Build hybrid index (automatic with mnemos build)
npx mnemos .

# Cited recall — admits gaps honestly (Provenance)
npx mnemos memory ask "what did we decide about auth?"

# Import Claude session back-catalog (Chronoshift)
npx mnemos memory chronoshift ~/.claude/projects/

# Agent loop token fuse (Spiralfuse)
npx mnemos memory loop start --max-tokens 250000
npx mnemos memory loop tick --tokens 12000`}
              </code>
            </pre>
          </GlowCard>
        </motion.div>
      </div>
    </section>
  );
}
