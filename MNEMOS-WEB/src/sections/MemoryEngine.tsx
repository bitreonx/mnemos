import { motion } from "framer-motion";
import { Shield, Brain, Zap, Lock } from "lucide-react";
import GlowCard from "../components/ui/GlowCard";

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
    title: "Episodic Memory",
    desc: "Agents remember decisions across sessions. Temporal decay prunes stale notes.",
  },
  {
    icon: Shield,
    title: "Contradiction Guard",
    desc: "Detects conflicting architecture facts before agents act on bad context.",
  },
];

export function MemoryEngine() {
  return (
    <section id="memory-engine" className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-emerald-400 text-sm font-mono tracking-wider uppercase">
            Memory Engine · Labyrinth
          </span>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Local AI memory infrastructure
          </h2>
          <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
            Release codename <strong className="text-white/80">Labyrinth</strong> — part of Mneme 0.2.0. Your repository never leaves your machine.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {FEATURES.map((f, i) => (
            <GlowCard key={f.title} delay={i * 0.1}>
              <f.icon className="w-8 h-8 text-emerald-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </GlowCard>
          ))}
        </div>

        <GlowCard>
          <pre className="text-sm text-emerald-300/90 font-mono overflow-x-auto">
{`# Build hybrid index (automatic with mnemos build)
npx mnemos .

# Query — BM25 + local embeddings
npx mnemos memory query "auth middleware"

# Task context for agents (Cursor, Claude Code)
npx mnemos memory context "fix login bug" --budget 8000

# Persist episodic memory
npx mnemos memory remember "JWT in httpOnly cookie" --tag auth`}
          </pre>
        </GlowCard>
      </div>
    </section>
  );
}
