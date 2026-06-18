import { motion } from "framer-motion";
import {
  Terminal,
  GitBranch,
  Network,
  FileCode2,
  ShieldCheck,
  Sparkles,
  Activity,
} from "lucide-react";
import { BENCHMARKS, BENCHMARK_RESULTS } from "../lib/site";
import SectionHeading from "../components/ui/SectionHeading";
import AnimatedCounter from "../components/ui/AnimatedCounter";
import Reveal from "../components/ui/Reveal";
import CopyCommand from "../components/ui/CopyCommand";

/* Half-width feature previews — each one is a tiny, focused visual that
   shows a real Mnemos surface, so the section reads as "what you actually
   ship", not just marketing numbers. */
function PreviewArchitecture() {
  const nodes = [
    { id: "auth", x: 18, y: 28, c: "var(--cyan)" },
    { id: "billing", x: 46, y: 20, c: "var(--brand)" },
    { id: "catalog", x: 72, y: 34, c: "var(--brand)" },
    { id: "orders", x: 38, y: 60, c: "var(--lilac)" },
    { id: "search", x: 66, y: 68, c: "var(--mint)" },
    { id: "users", x: 16, y: 72, c: "var(--cyan)" },
  ];
  const edges: [number, number][] = [[0, 1], [1, 3], [2, 3], [2, 4], [0, 5], [3, 4]];
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="var(--border-strong)"
          strokeWidth="0.5"
          strokeDasharray="1.4 1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.7 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 + i * 0.04, duration: 0.5 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g
          key={n.id}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.04, type: "spring", stiffness: 280, damping: 18 }}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        >
          <circle cx={n.x} cy={n.y} r="6" fill={n.c} opacity="0.18" />
          <circle cx={n.x} cy={n.y} r="3.2" fill={n.c} />
          <text
            x={n.x}
            y={n.y + 7}
            textAnchor="middle"
            fontSize="3.2"
            fill="var(--text-dim)"
            fontFamily="var(--font-mono)"
          >
            {n.id}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

function PreviewCopilot() {
  return (
    <div className="flex h-full flex-col gap-2 font-mono text-[11px]">
      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[#0c0916] px-2.5 py-1.5 text-[var(--lilac)]">
        <Sparkles size={11} /> <span>repair · circular dep</span>
      </div>
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 leading-relaxed text-[var(--text-dim)]">
        Extract <span className="text-[var(--brand)]">shared/types.ts</span> to
        break auth ↔ billing cycle.
      </div>
      <div className="mt-auto flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[var(--text-faint)]">
        <span className="text-[var(--mint)]">●</span> verified · 1.2s
      </div>
    </div>
  );
}

function PreviewAiPack() {
  return (
    <div className="h-full overflow-hidden rounded-md border border-[var(--border)] bg-[#0c0916] p-2.5 font-mono text-[10.5px] leading-relaxed text-[var(--lilac)]">
      <p className="text-[var(--text-faint)]">// AI Pack v1</p>
      <p><span style={{ color: "var(--brand)" }}>"version"</span>: "1.0.0",</p>
      <p><span style={{ color: "var(--brand)" }}>"domains"</span>: 31, <span style={{ color: "var(--brand)" }}>"flows"</span>: 268,</p>
      <p><span style={{ color: "var(--brand)" }}>"score"</span>: 92,</p>
      <p><span style={{ color: "var(--brand)" }}>"issues"</span>: [ … ]</p>
      <p className="text-[var(--text-faint)]">// served via MCP / HTTP</p>
    </div>
  );
}

function PreviewHeatmap() {
  const cells = Array.from({ length: 7 * 5 }).map((_, i) => {
    const c = Math.floor((Math.sin(i * 1.7) + 1) * 50 + 20);
    return c;
  });
  return (
    <div className="grid h-full grid-cols-7 gap-1">
      {cells.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.012, duration: 0.4 }}
          className="rounded-[3px]"
          style={{
            background:
              c > 130
                ? "var(--brand)"
                : c > 90
                ? "color-mix(in srgb, var(--brand) 60%, var(--cyan))"
                : c > 60
                ? "color-mix(in srgb, var(--brand) 30%, var(--cyan))"
                : "color-mix(in srgb, var(--brand) 8%, var(--surface-2))",
            boxShadow: c > 130 ? "0 0 8px -1px var(--glow)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

function PreviewTerminal() {
  const lines = [
    { c: "var(--brand)", t: "$ npx mnemos ." },
    { c: "var(--text-faint)", t: "▸ scanning 1,247 files…" },
    { c: "var(--mint)", t: "✓ 31 domains · 268 flows · 412 apis" },
    { c: "var(--brand)", t: "$ mnemos serve --port 4000" },
    { c: "var(--text-dim)", t: "▸ copilot ready · http://localhost:4000" },
  ];
  return (
    <div className="h-full overflow-hidden rounded-md border border-[var(--border)] bg-[#0a0810] p-2.5 font-mono text-[10.5px] leading-relaxed">
      {lines.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -4 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 + i * 0.08 }}
          style={{ color: l.c }}
        >
          {l.t}
        </motion.div>
      ))}
    </div>
  );
}

function PreviewJourney() {
  return (
    <svg viewBox="0 0 100 60" className="h-full w-full">
      <defs>
        <linearGradient id="jGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      <motion.path
        d="M6 30 C25 30 30 12 50 12 S75 30 94 30"
        fill="none"
        stroke="url(#jGrad)"
        strokeWidth="1.4"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
      />
      {[
        { x: 6, y: 30, l: "browse" },
        { x: 50, y: 12, l: "checkout" },
        { x: 94, y: 30, l: "fulfil" },
      ].map((p, i) => (
        <motion.g
          key={i}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 + i * 0.15, type: "spring", stiffness: 280, damping: 18 }}
          style={{ transformOrigin: `${p.x}px ${p.y}px` }}
        >
          <circle cx={p.x} cy={p.y} r="5" fill="var(--brand)" />
          <circle cx={p.x} cy={p.y} r="2.5" fill="#fff" />
          <text
            x={p.x}
            y={p.y + 12}
            textAnchor="middle"
            fontSize="4"
            fill="var(--text-dim)"
            fontFamily="var(--font-mono)"
          >
            {p.l}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

const PREVIEWS = [
  { title: "Architecture map", Icon: Network, Comp: PreviewArchitecture, accent: "var(--brand)" },
  { title: "Copilot repair", Icon: Sparkles, Comp: PreviewCopilot, accent: "var(--lilac)" },
  { title: "AI Pack v1", Icon: FileCode2, Comp: PreviewAiPack, accent: "var(--cyan)" },
  { title: "Risk heatmap", Icon: Activity, Comp: PreviewHeatmap, accent: "var(--mint)" },
  { title: "Live terminal", Icon: Terminal, Comp: PreviewTerminal, accent: "var(--brand)" },
  { title: "User journey", Icon: GitBranch, Comp: PreviewJourney, accent: "var(--cyan)" },
];

export default function Benchmarks() {
  return (
    <section id="benchmarks" className="container-px mx-auto max-w-[1200px] scroll-mt-24 py-24 sm:py-32">
      <SectionHeading
        eyebrow="Benchmarks"
        title="Numbers from real repositories."
        subtitle="Reproducible locally from mnemos-bench. Less context, more signal — every build, every repo."
      />

      {/* Verified repo scores */}
      <Reveal>
        <div className="mt-14 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-5 py-3.5 font-medium">Repo</th>
                <th className="px-5 py-3.5 font-medium">Accuracy</th>
                <th className="px-5 py-3.5 font-medium">Build</th>
                <th className="px-5 py-3.5 font-medium">Tokens</th>
                <th className="px-5 py-3.5 font-medium">Compression</th>
              </tr>
            </thead>
            <tbody>
              {BENCHMARK_RESULTS.map((row) => (
                <tr key={row.repo} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-4 font-medium text-[var(--text)]">
                    {row.repo}
                    <span className="ml-2 font-mono text-[10px] text-[var(--text-faint)]">({row.tier})</span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-[var(--mint)]">{row.accuracy}%</td>
                  <td className="px-5 py-4 text-[var(--text-dim)]">
                    {row.buildMs >= 1000 ? `${(row.buildMs / 1000).toFixed(1)} s` : `${row.buildMs} ms`}
                  </td>
                  <td className="px-5 py-4 font-mono text-[var(--text-dim)]">{row.tokens.toLocaleString()}</td>
                  <td className="px-5 py-4 font-semibold text-[var(--brand)]">{row.compression}×</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--border)] px-5 py-3 font-mono text-[10px] text-[var(--text-faint)]">
            Measured {BENCHMARK_RESULTS[0]?.measuredAt} · reproducible via npm run bench:regression
          </p>
        </div>
      </Reveal>

      {/* Numbers grid — task accuracy is the hero stat */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BENCHMARKS.map((b, i) => {
          const hero = b.label === "Task accuracy";
          return (
            <Reveal key={b.label} delay={i * 0.05}>
              <div
                className="card group relative h-full overflow-hidden p-7"
                style={
                  hero
                    ? {
                        background:
                          "linear-gradient(155deg, color-mix(in srgb, var(--brand) 16%, var(--surface)) 0%, var(--surface) 60%)",
                        borderColor: "color-mix(in srgb, var(--brand) 45%, var(--border))",
                        boxShadow: "var(--shadow-glow)",
                      }
                    : undefined
                }
              >
                <div
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: "var(--glow)" }}
                  aria-hidden
                />
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-4xl font-semibold tracking-tight sm:text-5xl"
                    style={
                      hero
                        ? { color: "var(--brand)" }
                        : {
                            background: "var(--grad-text)",
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                            color: "transparent",
                          }
                    }
                  >
                    <AnimatedCounter value={b.value} suffix={b.suffix} decimals={Number.isInteger(b.value) ? 0 : 1} />
                  </span>
                </div>
                <p
                  className="mt-3 font-medium"
                  style={{ color: hero ? "var(--brand)" : "var(--text)" }}
                >
                  {b.label}
                </p>
                <p className="text-sm text-[var(--text-dim)]">{b.hint}</p>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Feature wraps — semi-results of the app, every feature represented */}
      <Reveal delay={0.05}>
        <div className="mt-10 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text)]">
              Every feature, in motion.
            </h3>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Six real surfaces, one repo. Hover any card to peek inside.
            </p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--mint)]" />
            live preview
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEWS.map(({ title, Icon, Comp, accent }) => (
            <motion.div
              key={title}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              {/* hover spotlight */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(220px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, ${accent} 16%, transparent), transparent 60%)`,
                }}
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-[var(--text)]">
                  <span
                    className="grid h-6 w-6 place-items-center rounded-md"
                    style={{
                      background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                      color: accent,
                    }}
                  >
                    <Icon size={12} />
                  </span>
                  {title}
                </div>
                <span
                  className="font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: accent }}
                >
                  live
                </span>
              </div>
              <div className="relative z-10 mt-3 aspect-[5/3] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-1)] p-2.5">
                <Comp />
              </div>
            </motion.div>
          ))}
        </div>
      </Reveal>

      {/* bottom terminal-style command row */}
      <Reveal delay={0.1}>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CopyCommand command="npm run bench:regression" />
          <CopyCommand command="npm run bench:ai-eval" />
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-[11px] text-[var(--text-faint)] sm:inline-flex">
            <ShieldCheck size={12} style={{ color: "var(--mint)" }} />
            reproducible
          </span>
        </div>
      </Reveal>
    </section>
  );
}
