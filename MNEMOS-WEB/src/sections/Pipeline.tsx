import { motion } from "framer-motion";
import {
  GitBranch,
  Boxes,
  Network,
  Layers,
  Sparkles,
} from "lucide-react";
import SectionHeading from "../components/ui/SectionHeading";
import Reveal from "../components/ui/Reveal";

/* ===== Self-contained SVG illustrations, designed to fit a 200x120 frame
   and stay inside the card. No overflow, no crop. Each one is centered
   horizontally and anchored at the bottom of the card. ===== */

function IllustRepository() {
  // File tree — folders + files with branch connectors
  const rows = [
    { d: "src", color: "var(--cyan)", leaf: false },
    { d: "components", color: "var(--cyan)", leaf: false },
    { d: "services", color: "var(--cyan)", leaf: false },
    { d: "index.ts", color: "var(--text-faint)", leaf: true },
    { d: "app.ts", color: "var(--text-faint)", leaf: true },
    { d: "README.md", color: "var(--text-faint)", leaf: true },
  ];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <defs>
        <linearGradient id="r-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="120" fill="url(#r-glow)" />
      {rows.map((r, i) => (
        <g key={r.d}>
          {/* branch line */}
          <motion.line
            x1={28}
            y1={20 + i * 16}
            x2={56}
            y2={20 + i * 16}
            stroke="var(--border-strong)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
          />
          <circle cx={28} cy={20 + i * 16} r="2.4" fill="var(--border-strong)" />
          {/* node */}
          <motion.g
            initial={{ x: -6, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
          >
            {r.leaf ? (
              <rect x="56" y={14 + i * 16} width="14" height="12" rx="2" fill={r.color} opacity="0.35" />
            ) : (
              <path
                d={`M56 ${13 + i * 16} h9 l3 3 v9 h-12 z`}
                fill={r.color}
                opacity="0.85"
              />
            )}
            <text
              x="78"
              y={24 + i * 16}
              fontSize="8.5"
              fill="var(--text-dim)"
              fontFamily="var(--font-mono)"
            >
              {r.d}
            </text>
          </motion.g>
        </g>
      ))}
      {/* vertical spine */}
      <line
        x1="28"
        y1="20"
        x2="28"
        y2={20 + (rows.length - 1) * 16}
        stroke="var(--border-strong)"
        strokeWidth="1"
      />
    </svg>
  );
}

function IllustStructure() {
  // Isometric cube cluster — 4 cubes arranged in a 2x2 with the back row elevated
  const cubes = [
    { x: 70, y: 56, c: "var(--brand)", top: "var(--brand)", side: "#6b1ad6" },
    { x: 100, y: 70, c: "var(--cyan)", top: "var(--cyan)", side: "#1a7fb3" },
    { x: 130, y: 56, c: "var(--lilac)", top: "var(--lilac)", side: "#7a4dcc" },
    { x: 100, y: 42, c: "var(--mint)", top: "var(--mint)", side: "#1f8a5a" },
  ];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <defs>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="100" rx="80" ry="14" fill="url(#floor)" />

      {cubes.map((c, i) => {
        const s = 16; // half-size
        return (
          <motion.g
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 + i * 0.08, type: "spring", stiffness: 220, damping: 16 }}
            style={{ transformOrigin: `${c.x}px ${c.y}px` }}
          >
            {/* top face */}
            <polygon
              points={`${c.x},${c.y - s} ${c.x + s * 0.86},${c.y - s * 0.5} ${c.x},${c.y} ${c.x - s * 0.86},${c.y - s * 0.5}`}
              fill={c.top}
              opacity="0.9"
            />
            {/* right face */}
            <polygon
              points={`${c.x},${c.y} ${c.x + s * 0.86},${c.y - s * 0.5} ${c.x + s * 0.86},${c.y + s * 0.5} ${c.x},${c.y + s}`}
              fill={c.side}
              opacity="0.85"
            />
            {/* left face */}
            <polygon
              points={`${c.x},${c.y} ${c.x - s * 0.86},${c.y - s * 0.5} ${c.x - s * 0.86},${c.y + s * 0.5} ${c.x},${c.y + s}`}
              fill={c.c}
            />
          </motion.g>
        );
      })}

      {/* tiny grid hints */}
      <g stroke="var(--border)" strokeWidth="0.5" opacity="0.4">
        <line x1="30" y1="98" x2="170" y2="98" />
        <line x1="50" y1="106" x2="150" y2="106" />
      </g>
    </svg>
  );
}

function IllustEnrich() {
  // Connected node graph
  const nodes = [
    { x: 40, y: 50, c: "var(--brand)" },
    { x: 90, y: 28, c: "var(--cyan)" },
    { x: 140, y: 44, c: "var(--lilac)" },
    { x: 60, y: 90, c: "var(--mint)" },
    { x: 130, y: 86, c: "var(--brand)" },
  ];
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [0, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <defs>
        <linearGradient id="e-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="url(#e-line)"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.7 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g
          key={i}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 280, damping: 18 }}
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        >
          <circle cx={n.x} cy={n.y} r="9" fill={n.c} opacity="0.18" />
          <circle cx={n.x} cy={n.y} r="4.5" fill={n.c} />
          <circle cx={n.x} cy={n.y} r="2" fill="#fff" />
        </motion.g>
      ))}
    </svg>
  );
}

function IllustOptimize() {
  /* A "refining chamber":
     - chaotic input stream on the left
     - a rotating compression prism in the middle
     - a clean, organized output stream on the right
     - a tiny loss-curve graph in the corner proving the optimization
  */
  // 12 input particles that morph into 6 organized output bars
  const inputs = Array.from({ length: 14 }).map((_, i) => ({
    x: 16 + (i % 7) * 6,
    y: 18 + Math.floor(i / 7) * 10 + ((i * 37) % 6),
    r: 1.2 + ((i * 13) % 18) / 10,
    c: ["var(--brand)", "var(--cyan)", "var(--lilac)", "var(--mint)"][i % 4],
    delay: i * 0.05,
  }));
  const outputs = [0.7, 0.95, 0.55, 0.88, 0.78, 0.99];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <defs>
        <linearGradient id="opt-stream" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--brand)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="opt-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
        <radialGradient id="opt-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <filter id="opt-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* input zone background */}
      <rect x="6" y="14" width="48" height="92" rx="6" fill="var(--surface-2)" opacity="0.4" />
      <text x="14" y="24" fontSize="6" fill="var(--text-faint)" fontFamily="var(--font-mono)">
        RAW
      </text>

      {/* input particles */}
      {inputs.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={p.c}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 0.85, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + p.delay, duration: 0.5 }}
        />
      ))}

      {/* mid: stream lines from input zone to prism */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.path
          key={`s-${i}`}
          d={`M 54 ${28 + i * 12} Q 78 ${20 + i * 10} 100 ${60}`}
          stroke="url(#opt-stream)"
          strokeWidth="0.9"
          fill="none"
          strokeDasharray="2 3"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.7 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.05, duration: 0.6 }}
        />
      ))}

      {/* central compression core (rotating diamond) */}
      <circle cx="100" cy="60" r="22" fill="url(#opt-core)" />
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 60px" }}
      >
        <polygon
          points="100,46 114,60 100,74 86,60"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.2"
          opacity="0.9"
        />
        <polygon
          points="100,40 120,60 100,80 80,60"
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="0.7"
          opacity="0.5"
        />
      </motion.g>
      <motion.g
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 60px" }}
      >
        <polygon
          points="100,52 108,60 100,68 92,60"
          fill="var(--brand)"
          opacity="0.95"
          filter="url(#opt-glow)"
        />
      </motion.g>

      {/* mid: stream lines from prism to output */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.path
          key={`so-${i}`}
          d={`M 100 ${60} Q 122 ${20 + i * 10} 146 ${28 + i * 12}`}
          stroke="url(#opt-stream)"
          strokeWidth="0.9"
          fill="none"
          strokeDasharray="2 3"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.7 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 + i * 0.05, duration: 0.6 }}
        />
      ))}

      {/* output zone */}
      <rect x="146" y="14" width="48" height="92" rx="6" fill="var(--surface-2)" opacity="0.4" />
      <text x="154" y="24" fontSize="6" fill="var(--mint)" fontFamily="var(--font-mono)">
        OPT
      </text>
      {outputs.map((h, i) => (
        <motion.rect
          key={`b-${i}`}
          x={152 + i * 7}
          y={102 - h * 60}
          width="4.5"
          height={h * 60}
          rx="1"
          fill="url(#opt-bar)"
          initial={{ scaleY: 0, opacity: 0 }}
          whileInView={{ scaleY: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.9 + i * 0.06, duration: 0.4 }}
          style={{ transformOrigin: `${154 + i * 7}px 102px` }}
        />
      ))}

      {/* tiny loss curve in the lower mid */}
      <g transform="translate(64 96)">
        <path
          d="M0 8 L10 6 L20 7 L30 4 L40 3 L50 1.5 L60 1"
          stroke="var(--mint)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
        <motion.circle
          cx="60"
          cy="1"
          r="1.6"
          fill="var(--mint)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1.2, duration: 0.4 }}
        />
        <text x="0" y="-2" fontSize="5" fill="var(--text-faint)" fontFamily="var(--font-mono)">
          loss
        </text>
      </g>
    </svg>
  );
}

function IllustIntelligence() {
  /* A "neural core":
     - holographic grid floor
     - 3 concentric orbital rings (different speeds, different tilts)
     - 12 firing neurons (animated dashes) connected to the core
     - a pulsing, multi-layer central core
     - knowledge particles drifting around
  */
  const neurons = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const r = 38 + (i % 3) * 6;
    return {
      x: 100 + Math.cos(angle) * r,
      y: 56 + Math.sin(angle) * (r * 0.5),
      angle,
      delay: (i * 0.12) % 1.5,
    };
  });
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <defs>
        <radialGradient id="ai-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ai-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="40%" stopColor="var(--brand)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ai-fiber" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--brand)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
        <filter id="ai-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* holographic grid floor */}
      <g stroke="var(--border-strong)" strokeWidth="0.4" opacity="0.35">
        <ellipse cx="100" cy="56" rx="78" ry="36" fill="none" />
        <ellipse cx="100" cy="56" rx="58" ry="26" fill="none" />
        <ellipse cx="100" cy="56" rx="38" ry="16" fill="none" />
        <line x1="22" y1="56" x2="178" y2="56" />
        <line x1="100" y1="20" x2="100" y2="92" />
      </g>

      {/* outer halo */}
      <circle cx="100" cy="56" r="44" fill="url(#ai-halo)" />

      {/* orbital ring 1 — wide, fast, brand */}
      <motion.ellipse
        cx="100"
        cy="56"
        rx="40"
        ry="11"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="0.9"
        strokeDasharray="2 4"
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 56px" }}
        opacity="0.7"
      />

      {/* orbital ring 2 — medium, reverse, cyan */}
      <motion.ellipse
        cx="100"
        cy="56"
        rx="28"
        ry="8"
        fill="none"
        stroke="var(--cyan)"
        strokeWidth="0.8"
        strokeDasharray="1 3"
        animate={{ rotate: -360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 56px" }}
        opacity="0.7"
      />

      {/* orbital ring 3 — inner, lilac, with a single bright dot */}
      <motion.ellipse
        cx="100"
        cy="56"
        rx="18"
        ry="5"
        fill="none"
        stroke="var(--lilac)"
        strokeWidth="0.7"
        strokeDasharray="3 2"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "100px 56px" }}
        opacity="0.6"
      />

      {/* firing neurons — animated lines from outside to core */}
      {neurons.map((n, i) => (
        <g key={`fiber-${i}`}>
          <line
            x1={n.x}
            y1={n.y}
            x2="100"
            y2="56"
            stroke="url(#ai-fiber)"
            strokeWidth="0.7"
            opacity="0.5"
          />
          <motion.line
            x1={n.x}
            y1={n.y}
            x2="100"
            y2="56"
            stroke="var(--brand)"
            strokeWidth="1.2"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: n.delay,
            }}
          />
        </g>
      ))}

      {/* central pulsing core */}
      <motion.circle
        cx="100"
        cy="56"
        r="9"
        fill="url(#ai-core-glow)"
        animate={{ scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "100px 56px" }}
      />
      <circle cx="100" cy="56" r="4" fill="#fff" />

      {/* neuron endpoints (small dots at the end of each fiber) */}
      {neurons.map((n, i) => (
        <g key={`ep-${i}`}>
          <circle cx={n.x} cy={n.y} r="2.4" fill="var(--brand)" opacity="0.25" />
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="1.6"
            fill="var(--brand)"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: n.delay }}
          />
        </g>
      ))}

      {/* drifting knowledge particles */}
      {[
        { x: 28, y: 22, d: 0.1 },
        { x: 172, y: 30, d: 0.6 },
        { x: 34, y: 90, d: 1.0 },
        { x: 168, y: 86, d: 0.3 },
        { x: 50, y: 14, d: 1.4 },
        { x: 156, y: 18, d: 0.8 },
      ].map((p, i) => (
        <motion.circle
          key={`k-${i}`}
          cx={p.x}
          cy={p.y}
          r="1.4"
          fill="var(--cyan)"
          filter="url(#ai-blur)"
          animate={{ y: [p.y, p.y - 3, p.y], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: p.d, ease: "easeInOut" }}
        />
      ))}

      {/* label tag */}
      <g>
        <rect
          x="78"
          y="98"
          width="44"
          height="12"
          rx="6"
          fill="var(--surface-solid)"
          stroke="var(--border-strong)"
          strokeWidth="0.5"
          opacity="0.95"
        />
        <circle cx="86" cy="104" r="1.5" fill="var(--mint)" />
        <text
          x="91"
          y="106.5"
          fontSize="6"
          fill="var(--text-dim)"
          fontFamily="var(--font-mono)"
        >
          AI CORE · live
        </text>
      </g>
    </svg>
  );
}

const STAGES = [
  {
    n: "01",
    title: "Repository",
    Icon: GitBranch,
    accent: "var(--cyan)",
    points: ["src", "components", "services", "index.ts", "app.ts", "README.md"],
    Illust: IllustRepository,
  },
  {
    n: "02",
    title: "Structure",
    Icon: Boxes,
    accent: "var(--brand)",
    points: ["Domains", "Services", "Modules", "Boundaries"],
    Illust: IllustStructure,
  },
  {
    n: "03",
    title: "Enrich",
    Icon: Network,
    accent: "var(--lilac)",
    points: ["Flows", "Journals", "Apis", "Risk heatmap"],
    Illust: IllustEnrich,
  },
  {
    n: "04",
    title: "Optimize",
    Icon: Layers,
    accent: "var(--mint)",
    points: ["Decisions", "Caching", "Stale data", "Bottlenecks"],
    Illust: IllustOptimize,
  },
  {
    n: "05",
    title: "Intelligence",
    Icon: Sparkles,
    accent: "var(--brand)",
    points: ["Copilot", "AI pack", "Trends", "Predictions"],
    Illust: IllustIntelligence,
  },
];

export default function Pipeline() {
  return (
    <section
      id="pipeline"
      className="container-px mx-auto max-w-[1280px] scroll-mt-24 py-24 sm:py-32"
    >
      <SectionHeading
        eyebrow="Five Stages"
        title={
          <>
            From a folder of files to{" "}
            <span
              style={{
                background: "var(--grad-brand)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              living intelligence.
            </span>
          </>
        }
        subtitle="One continuous pipeline. Each stage takes the previous one further — and Mnemos handles the entire trip."
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((s, i) => {
          const Illust = s.Illust;
          const isLast = i === STAGES.length - 1;
          return (
            <Reveal key={s.n} delay={i * 0.05} className="h-full">
              <div
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors duration-300 hover:border-[var(--border-strong)]"
                onMouseMove={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                }}
              >
                {/* spotlight */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, ${s.accent} 14%, transparent), transparent 60%)`,
                  }}
                />

                <div className="relative z-10 flex items-start justify-between">
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {s.n}
                  </span>
                  <span
                    className="grid h-7 w-7 place-items-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${s.accent} 16%, transparent)`,
                      color: s.accent,
                    }}
                  >
                    <s.Icon size={13} />
                  </span>
                </div>

                <h3 className="relative z-10 mt-3 text-lg font-semibold tracking-tight text-[var(--text)]">
                  {s.title}
                </h3>

                {/* Illustration — fixed height, properly contained, centered */}
                <div
                  className="relative z-10 mt-4 h-[120px] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)]"
                  style={{
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--brand) 4%, var(--bg-1)) 0%, var(--bg-1) 100%)",
                  }}
                >
                  <Illust />
                </div>

                <ul className="relative z-10 mt-4 space-y-1.5">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-2 font-mono text-[11.5px] text-[var(--text-dim)]"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background:
                            s.title === "Repository" ? p === "src" || p === "components" || p === "services" ? s.accent : "var(--text-faint)" : s.accent,
                          opacity: s.title === "Repository" && p.endsWith(".ts") || p.endsWith(".md") ? 0.55 : 0.9,
                        }}
                      />
                      {p}
                    </li>
                  ))}
                </ul>

                {/* connector arrow between cards on desktop */}
                {!isLast && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-1/2 z-20 hidden h-px w-6 -translate-y-1/2 lg:block"
                    style={{
                      background:
                        "linear-gradient(90deg, var(--border-strong), transparent)",
                    }}
                  />
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
