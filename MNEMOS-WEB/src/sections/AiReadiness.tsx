import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";

/* ---------- isometric cube primitive ---------- */
function Cube({ s = 22, x = 0, y = 0, hue }: { s: number; x?: number; y?: number; hue: string }) {
  const h = s * 0.5;
  const d = s * 0.58;
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={`0,${-d} ${h},${-d - h * 0.5} ${h * 2},${-d} ${h},${-d + h * 0.5}`} fill={hue} opacity="0.95" />
      <polygon points={`0,${-d} ${h},${-d + h * 0.5} ${h},${h * 0.5} 0,0`} fill={hue} opacity="0.55" />
      <polygon points={`${h},${-d + h * 0.5} ${h * 2},${-d} ${h * 2},${0} ${h},${h * 0.5}`} fill={hue} opacity="0.3" />
    </g>
  );
}

/* ---------- per-stage mini visuals (refined, lower contrast) ---------- */
function VisualRepo() {
  const rows = ["src", "components", "services", "index.ts", "app.ts", "README.md"];
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-3">
      {rows.map((r, i) => (
        <motion.div
          key={r}
          initial={{ opacity: 0, x: -6 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-2 text-[10.5px] text-[var(--text-dim)]"
        >
          <span
            className="h-2 w-2 rounded-[3px]"
            style={{ background: i < 3 ? "var(--cyan)" : "var(--text-faint)" }}
          />
          <span className="font-mono">{r}</span>
        </motion.div>
      ))}
    </div>
  );
}

function VisualStructure() {
  const cubes: [number, number][] = [
    [40, 70], [62, 58], [84, 70], [40, 92], [62, 80], [84, 92], [51, 105],
  ];
  return (
    <svg viewBox="0 0 130 120" className="h-full w-full">
      {cubes.map(([x, y], i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 220, damping: 18 }}
        >
          <Cube s={20} x={x} y={y} hue={i % 3 === 0 ? "var(--brand)" : "var(--cyan)"} />
        </motion.g>
      ))}
    </svg>
  );
}

function VisualEnrich() {
  const nodes: [number, number][] = [
    [30, 40], [70, 28], [100, 55], [55, 70], [85, 92], [35, 88],
  ];
  const edges: [number, number][] = [[0, 1], [1, 2], [0, 3], [3, 4], [3, 5], [2, 4]];
  return (
    <svg viewBox="0 0 130 120" className="h-full w-full">
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          stroke="var(--border-strong)"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 5.5 : 4}
          fill={i % 2 ? "var(--cyan)" : "var(--brand)"}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 14 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </svg>
  );
}

function VisualOptimize() {
  return (
    <svg viewBox="0 0 130 120" className="h-full w-full">
      {[0, 1, 2].map((i) => (
        <motion.polygon
          key={i}
          points="65,30 110,55 65,80 20,55"
          transform={`translate(0 ${i * 14})`}
          fill={i === 0 ? "var(--brand)" : "var(--cyan)"}
          opacity={0.25 + i * 0.22}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 0.25 + i * 0.22, y: i * 14 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
        />
      ))}
    </svg>
  );
}

function VisualModel() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 130 130" className="h-full w-full">
      <defs>
        <radialGradient id="modelGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="65" cy="60" r="55" fill="url(#modelGlow)" />
      <motion.g
        animate={reduce ? {} : { y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {[0, 1, 2].map((i) => (
          <Cube key={i} s={30} x={42} y={95 - i * 22} hue="var(--brand)" />
        ))}
      </motion.g>
    </svg>
  );
}

/* ---------- single source of truth: pipeline stages ---------- */
const STAGES = [
  {
    n: "01",
    title: "Connect",
    blurb: "Point at any repo.",
    Visual: VisualRepo,
  },
  {
    n: "02",
    title: "Parse",
    blurb: "Code becomes structure.",
    Visual: VisualStructure,
  },
  {
    n: "03",
    title: "Link",
    blurb: "A graph of relationships.",
    Visual: VisualEnrich,
  },
  {
    n: "04",
    title: "Scope",
    blurb: "Memory by context.",
    Visual: VisualOptimize,
  },
  {
    n: "05",
    title: "Serve",
    blurb: "Agents query via MCP.",
    Visual: VisualModel,
  },
];

export default function AiReadiness() {
  return (
    <section className="container-px mx-auto max-w-[1200px] py-24 sm:py-32">
      <SectionHeading
        eyebrow="AI readiness"
        title={
          <>
            From repo to ready,
            <br className="hidden sm:block" /> in five steps.
          </>
        }
        subtitle={
          <>
            Mnemos reads your codebase, understands it, and turns it into a durable memory layer your AI agents can query. No retraining. No setup.
          </>
        }
      />

      {/* Pipeline */}
      <Reveal delay={0.1}>
        <div className="relative mt-20">
          {/* connecting line behind the visuals (desktop) */}
          <div
            className="pointer-events-none absolute left-[8%] right-[8%] top-[116px] hidden h-px lg:block"
            aria-hidden
          >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent" />
            <div className="absolute inset-0 mx-auto h-3 w-3 -translate-y-[5px] rounded-full bg-[var(--brand)] opacity-0" />
          </div>

          <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            {STAGES.map((s, i) => {
              const Visual = s.Visual;
              return (
                <motion.li
                  key={s.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    delay: i * 0.07,
                    duration: 0.5,
                    ease: [0.22, 0.8, 0.18, 1],
                  }}
                  className="relative"
                >
                  {/* Step index */}
                  <div className="mb-3 flex items-center gap-3">
                    <span className="font-mono text-[11px] font-medium tabular-nums tracking-wider text-[var(--text-faint)]">
                      {s.n}
                    </span>
                    <span className="h-px flex-1 bg-[var(--border)]" />
                  </div>

                  {/* Visual frame (Apple-style clean surface) */}
                  <div className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                    <Visual />
                  </div>

                  {/* Copy */}
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-[var(--text)]">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-dim)]">
                    {s.blurb}
                  </p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </Reveal>

      {/* Outcome line — the single takeaway (Apple-style, generous space) */}
      <Reveal delay={0.2}>
        <div className="mt-24 text-center">
          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-[var(--text-dim)]">
            The result is a{" "}
            <span className="text-[var(--text)] font-medium">living memory layer</span>{" "}
            that stays in sync with your repo and gives every agent the context it needs — instantly.
          </p>
          <a
            href="#install"
            className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[var(--text)] transition-colors hover:text-[var(--brand)]"
          >
            See it in action
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}