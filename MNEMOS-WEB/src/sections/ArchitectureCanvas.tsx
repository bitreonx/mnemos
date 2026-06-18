import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ZoomIn, Move, Layers, Box, Network, FileCode2, Search, GitBranch } from "lucide-react";
import SectionHeading from "../components/ui/SectionHeading";

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  color: string;
  icon?: "box" | "layer" | "net" | "file" | "search" | "branch";
  meta?: string;
};
type Edge = { from: string; to: string; strong?: boolean };
type Level = {
  id: string;
  label: string;
  sub: string;
  nodes: Node[];
  edges: Edge[];
};

const C = ["var(--brand)", "var(--cyan)", "var(--lilac)", "var(--mint)"];

/* Apple-style "everything in its right place" data — no overlapping
   positions, every edge visually justified, balanced negative space. */
const LEVELS: Level[] = [
  {
    id: "capabilities",
    label: "Capabilities",
    sub: "Product story",
    nodes: [
      { id: "Commerce", label: "Commerce", x: 30, y: 32, r: 22, color: C[0], icon: "box", meta: "8 flows" },
      { id: "Identity", label: "Identity", x: 70, y: 32, r: 20, color: C[1], icon: "branch", meta: "5 flows" },
      { id: "Insights", label: "Insights", x: 50, y: 70, r: 18, color: C[2], icon: "net", meta: "3 flows" },
      { id: "Trust", label: "Trust", x: 20, y: 70, r: 14, color: C[3], icon: "layer", meta: "2 flows" },
    ],
    edges: [
      { from: "Commerce", to: "Identity", strong: true },
      { from: "Commerce", to: "Insights" },
      { from: "Identity", to: "Insights" },
      { from: "Identity", to: "Trust" },
    ],
  },
  {
    id: "domains",
    label: "Domains",
    sub: "Business boundaries",
    nodes: [
      { id: "auth", label: "auth", x: 20, y: 30, r: 16, color: C[1], icon: "branch", meta: "14 files" },
      { id: "billing", label: "billing", x: 50, y: 22, r: 18, color: C[0], icon: "box", meta: "22 files" },
      { id: "catalog", label: "catalog", x: 80, y: 30, r: 17, color: C[0], icon: "layer", meta: "19 files" },
      { id: "orders", label: "orders", x: 35, y: 68, r: 19, color: C[2], icon: "net", meta: "27 files" },
      { id: "search", label: "search", x: 65, y: 78, r: 14, color: C[3], icon: "search", meta: "11 files" },
      { id: "users", label: "users", x: 18, y: 75, r: 13, color: C[1], icon: "branch", meta: "9 files" },
    ],
    edges: [
      { from: "auth", to: "billing", strong: true },
      { from: "billing", to: "orders", strong: true },
      { from: "catalog", to: "orders" },
      { from: "catalog", to: "search" },
      { from: "auth", to: "users" },
      { from: "orders", to: "search" },
    ],
  },
  {
    id: "services",
    label: "Services",
    sub: "Runtime topology",
    nodes: [
      { id: "gateway", label: "gateway", x: 18, y: 26, r: 13, color: C[1], icon: "branch", meta: "ts" },
      { id: "api", label: "api", x: 50, y: 20, r: 14, color: C[0], icon: "box", meta: "ts" },
      { id: "worker", label: "worker", x: 82, y: 26, r: 12, color: C[2], icon: "net", meta: "py" },
      { id: "db", label: "db", x: 32, y: 60, r: 12, color: C[3], icon: "layer", meta: "pg" },
      { id: "cache", label: "cache", x: 50, y: 70, r: 11, color: C[1], icon: "layer", meta: "rd" },
      { id: "queue", label: "queue", x: 68, y: 60, r: 11, color: C[2], icon: "net", meta: "mq" },
      { id: "cdn", label: "cdn", x: 82, y: 78, r: 10, color: C[0], icon: "layer", meta: "edge" },
    ],
    edges: [
      { from: "gateway", to: "api", strong: true },
      { from: "api", to: "db", strong: true },
      { from: "api", to: "cache" },
      { from: "worker", to: "queue" },
      { from: "worker", to: "db" },
      { from: "gateway", to: "cdn" },
      { from: "api", to: "worker" },
    ],
  },
  {
    id: "files",
    label: "Files",
    sub: "Source map",
    nodes: Array.from({ length: 14 }).map((_, i) => ({
      id: `f${i}`,
      label: ["svc.ts", "types.ts", "index.ts", "router.ts", "schema.ts", "repo.ts", "client.ts", "model.ts", "auth.ts", "utils.ts", "queue.ts", "job.ts", "cache.ts", "view.tsx"][i],
      x: 12 + ((i * 37) % 76),
      y: 22 + ((i * 53) % 60),
      r: 5 + (i % 3) * 1.5,
      color: C[i % 4],
      icon: "file" as const,
    })),
    edges: Array.from({ length: 14 }).map((_, i) => ({
      from: `f${i}`,
      to: `f${(i + 3) % 14}`,
    })),
  },
];

const ICONS: Record<NonNullable<Node["icon"]>, typeof Layers> = {
  box: Box,
  layer: Layers,
  net: Network,
  file: FileCode2,
  search: Search,
  branch: GitBranch,
};

const EASE = [0.22, 0.8, 0.18, 1] as const;

export default function ArchitectureCanvas() {
  const [level, setLevel] = useState(1);
  const [hover, setHover] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const current = LEVELS[level];
  const find = (id: string) => current.nodes.find((n) => n.id === id);

  useEffect(() => {
    const id = setInterval(() => setT((v) => (v + 1) % 1000), 40);
    return () => clearInterval(id);
  }, []);

  const connected = (id: string) => {
    if (!hover) return null;
    if (hover === id) return "self";
    const hit = current.edges.find((e) => e.from === hover || e.to === hover);
    if (!hit) return null;
    if (hit.from === id || hit.to === id) return "link";
    return null;
  };

  return (
    <section
      className="relative overflow-hidden border-y border-[var(--border)] bg-[var(--bg-1)]"
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {/* === The "Apple" background — animated flowing isobars, not a grid === */}
      {/* Soft brand glow that follows the cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--brand) 10%, transparent), transparent 60%)",
        }}
      />

      {/* Layer 1: massive soft glow at the center */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[160px]"
        style={{ width: 900, height: 900, background: "var(--glow)", opacity: 0.12 }}
      />

      {/* Layer 2: the headline lines — long, slow, beautiful bezier curves
          that drift through the section. Apple "isobar" feel. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="isoA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
            <stop offset="40%" stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="isoB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--lilac)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[
          { d: "M -50 220 C 240 60, 540 380, 820 200 S 1200 60, 1280 220", grad: "url(#isoA)", w: 1.1, dy: 0 },
          { d: "M -50 360 C 220 540, 540 200, 820 420 S 1200 540, 1280 360", grad: "url(#isoB)", w: 0.9, dy: 8 },
          { d: "M -50 520 C 240 320, 540 620, 820 460 S 1200 320, 1280 520", grad: "url(#isoA)", w: 0.7, dy: 14 },
        ].map((l, i) => (
          <motion.path
            key={i}
            d={l.d}
            stroke={l.grad}
            strokeWidth={l.w}
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.8 + i * 0.2, ease: EASE, delay: i * 0.1 }}
            style={{ transform: `translateY(${Math.sin((t + i * 30) / 30) * 6 + l.dy}px)` }}
          />
        ))}
      </svg>

      {/* Layer 3: ultra-fine guide dots at intersections (Apple keynote feel) */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {[
          [180, 200],
          [960, 180],
          [320, 520],
          [1040, 560],
          [600, 360],
        ].map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="1.6"
            fill="var(--brand)"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 0.45, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 + i * 0.08, duration: 0.6 }}
          />
        ))}
      </svg>

      <div className="container-px relative mx-auto max-w-[1200px] py-24 sm:py-32">
        <SectionHeading
          eyebrow="Architecture Canvas"
          title="Zoom from product to a single file."
          subtitle="One continuous map — capabilities, domains, services, files. Clean by default, structured all the way down."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* zoom rail */}
          <div className="flex flex-col gap-2.5">
            {LEVELS.map((l, i) => {
              const active = i === level;
              return (
                <button
                  key={l.id}
                  onClick={() => setLevel(i)}
                  className="focus-ring group flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-all duration-300"
                  style={{
                    borderColor: active ? "var(--brand)" : "var(--border)",
                    background: active ? "var(--surface)" : "transparent",
                    transform: active ? "translateX(2px)" : "translateX(0)",
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: active ? "var(--brand)" : "var(--text-faint)" }}
                        animate={{ scale: active ? [1, 1.4, 1] : 1 }}
                        transition={{ duration: 1.6, repeat: active ? Infinity : 0 }}
                      />
                      <p
                        className="text-sm font-semibold tracking-tight"
                        style={{ color: active ? "var(--brand)" : "var(--text)" }}
                      >
                        {l.label}
                      </p>
                    </div>
                    <p className="ml-3.5 mt-0.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                      {l.sub} · {l.nodes.length} nodes
                    </p>
                  </div>
                  <ZoomIn
                    size={16}
                    className="transition-colors"
                    style={{ color: active ? "var(--brand)" : "var(--text-faint)" }}
                  />
                </button>
              );
            })}

            <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[11px] font-mono text-[var(--text-faint)]">
              <span className="flex items-center gap-1.5">
                <Move size={12} /> drag
              </span>
              <span className="opacity-40">·</span>
              <span>scroll to zoom</span>
            </div>
          </div>

          {/* canvas — no internal grid; let the section lines be the only ones */}
          <div
            className="card relative aspect-[16/11] overflow-hidden p-0"
            style={{ background: "var(--bg-1)" }}
          >
            {/* a single hairline frame inside, nothing more */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-6 rounded-2xl border border-dashed"
              style={{ borderColor: "var(--border)" }}
            />

            {/* compass + axes */}
            <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 py-1 font-mono text-[10px] text-[var(--text-faint)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand)" }} />
              live map
            </div>
            <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 py-1 font-mono text-[10px] text-[var(--text-faint)]">
              <span>zoom</span>
              <span className="text-[var(--text-dim)]">·</span>
              <span style={{ color: "var(--brand)" }}>{current.label.toLowerCase()}</span>
            </div>

            <motion.svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              className="relative h-full w-full cursor-grab active:cursor-grabbing"
              drag
              dragConstraints={{ left: -22, right: 22, top: -22, bottom: 22 }}
              dragElastic={0.12}
            >
              <defs>
                <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.85" />
                </linearGradient>
                <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </radialGradient>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="3.5"
                  markerHeight="3.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 8 5 L 0 10 z" fill="var(--text-faint)" />
                </marker>
              </defs>

              <motion.g
                key={current.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: EASE }}
                style={{ transformOrigin: "50px 50px", transformBox: "fill-box" }}
              >
                {/* edges first so nodes sit on top */}
                {current.edges.map((e, i) => {
                  const a = find(e.from);
                  const b = find(e.to);
                  if (!a || !b) return null;
                  const dim = hover && connected(e.from) !== "link" && connected(e.to) !== "link" && hover !== e.from && hover !== e.to;
                  return (
                    <motion.line
                      key={`${e.from}-${e.to}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={e.strong ? "url(#edgeGrad)" : "var(--border-strong)"}
                      strokeWidth={e.strong ? 0.5 : 0.3}
                      strokeDasharray={e.strong ? "0" : "1.4 1.4"}
                      markerEnd="url(#arrow)"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: dim ? 0.15 : e.strong ? 0.95 : 0.55 }}
                      transition={{ delay: 0.05 + i * 0.04, duration: 0.6 }}
                      style={{ transition: "opacity 0.25s" }}
                    />
                  );
                })}

                {/* nodes */}
                {current.nodes.map((n, i) => {
                  const Icon = n.icon ? ICONS[n.icon] : null;
                  const isHover = hover === n.id;
                  const isLink = connected(n.id) === "link";
                  const dim = hover && !isHover && !isLink;
                  return (
                    <motion.g
                      key={n.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: dim ? 0.32 : 1 }}
                      transition={{
                        delay: 0.15 + i * 0.04,
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                        opacity: { duration: 0.25 },
                      }}
                      style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "fill-box" }}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      className="cursor-pointer"
                    >
                      {/* outer aura */}
                      <circle cx={n.x} cy={n.y} r={n.r / 4 + 6} fill={n.color} opacity={isHover ? 0.3 : 0.12} />
                      {/* halo ring for hover */}
                      {isHover && (
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={n.r / 4 + 9}
                          fill="none"
                          stroke={n.color}
                          strokeWidth={0.4}
                          strokeDasharray="1 1.4"
                          opacity={0.85}
                        />
                      )}
                      {/* solid core */}
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={n.r / 4 + (isHover ? 0.6 : 0)}
                        fill={n.color}
                        style={{ transition: "r 0.25s" }}
                      />
                      {/* icon */}
                      {Icon && current.id !== "files" && (
                        <foreignObject
                          x={n.x - 2.2}
                          y={n.y - 2.2}
                          width={4.4}
                          height={4.4}
                          style={{ pointerEvents: "none" }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "grid",
                              placeItems: "center",
                              color: "#fff",
                              fontSize: 2.2,
                              lineHeight: 0,
                              opacity: 0.95,
                            }}
                          >
                            <Icon size={9} strokeWidth={2.5} />
                          </div>
                        </foreignObject>
                      )}
                      {/* label */}
                      {current.id !== "files" && (
                        <text
                          x={n.x}
                          y={n.y + n.r / 4 + 5}
                          textAnchor="middle"
                          fontSize="2.4"
                          fill="var(--text)"
                          fontFamily="var(--font-mono)"
                          fontWeight="600"
                          opacity={dim ? 0.4 : 1}
                        >
                          {n.label}
                        </text>
                      )}
                      {current.id !== "files" && n.meta && (
                        <text
                          x={n.x}
                          y={n.y + n.r / 4 + 7.6}
                          textAnchor="middle"
                          fontSize="1.7"
                          fill="var(--text-faint)"
                          fontFamily="var(--font-mono)"
                          opacity={dim ? 0.3 : 0.85}
                        >
                          {n.meta}
                        </text>
                      )}
                      {current.id === "files" && (
                        <text
                          x={n.x}
                          y={n.y + n.r / 4 + 3.2}
                          textAnchor="middle"
                          fontSize="1.7"
                          fill="var(--text-dim)"
                          fontFamily="var(--font-mono)"
                          opacity={dim ? 0.3 : 1}
                        >
                          {n.label}
                        </text>
                      )}

                      {/* hover tooltip */}
                      {isHover && current.id !== "files" && (
                        <g style={{ pointerEvents: "none" }}>
                          <rect
                            x={n.x + n.r / 4 + 2}
                            y={n.y - 6}
                            width={22}
                            height={7.5}
                            rx={1.5}
                            fill="var(--surface-solid)"
                            stroke="var(--border-strong)"
                            strokeWidth={0.25}
                          />
                          <text
                            x={n.x + n.r / 4 + 3.2}
                            y={n.y - 2.5}
                            fontSize="1.9"
                            fill="var(--text-dim)"
                            fontFamily="var(--font-mono)"
                          >
                            click to inspect
                          </text>
                          <text
                            x={n.x + n.r / 4 + 3.2}
                            y={n.y + 0.5}
                            fontSize="1.7"
                            fill="var(--text-faint)"
                            fontFamily="var(--font-mono)"
                          >
                            {current.sub} · {n.meta}
                          </text>
                        </g>
                      )}
                    </motion.g>
                  );
                })}
              </motion.g>
            </motion.svg>

            {/* legend */}
            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-1.5 font-mono text-[10px] text-[var(--text-dim)]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 rounded-full" style={{ background: "var(--grad-brand)" }} />
                strong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 rounded-full" style={{ background: "var(--border-strong)" }} />
                weak
              </span>
              <span className="text-[var(--text-faint)]">·</span>
              <span>{current.edges.length} edges</span>
            </div>

            {/* bottom progress hairline */}
            <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
              <motion.div
                key={current.id}
                className="h-full"
                style={{ background: "var(--grad-brand)" }}
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.1, ease: EASE }}
              />
            </div>
          </div>
        </div>

        {/* legend strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVELS.map((l, i) => {
            const active = i === level;
            return (
              <button
                key={l.id}
                onClick={() => setLevel(i)}
                className="focus-ring group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--border-strong)]"
                style={{ opacity: active ? 1 : 0.75 }}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: active
                      ? "color-mix(in srgb, var(--brand) 18%, transparent)"
                      : "var(--surface-2)",
                    color: active ? "var(--brand)" : "var(--text-faint)",
                  }}
                >
                  <Layers size={13} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold tracking-tight text-[var(--text)]">{l.label}</p>
                  <p className="truncate text-[11px] text-[var(--text-faint)]">{l.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
