/** Single source of truth for site-wide constants and homepage content. */

export const SITE = {
  name: "Mnemos",
  brand: "Get Mnemos",
  tagline: "Give AI a memory of your codebase.",
  description:
    "Get Mnemos transforms repositories into understanding. Humans and AI instantly grasp architecture, flows, domains, APIs, and business capabilities.",
  url: "https://getmnemos.vercel.app",
  github: "https://github.com/bitreonx/mnemos",
  avatar: "https://avatars.githubusercontent.com/u/207326426?v=4",
  author: "bitreonx",
  authorByline: "by bitreonx",
  authorTitle: "Mnemos Creator",
  install: "npx getmnemos .",
  npm: "getmnemos",
  pypi: "getmnemos",
} as const;

export const NAV_LINKS = [
  { label: "Why Mnemos", href: "#why" },
  { label: "Modes", href: "#modes" },
  { label: "New Gen", href: "#newgen" },
  { label: "Benchmarks", href: "#benchmarks" },
  { label: "Compare", href: "#compare" },
  { label: "Docs", href: "/docs", route: true },
] as const;

/** Tools referenced as part of the AI-developer ecosystem (illustrative only). */
export const AI_TOOLS = [
  "Claude",
  "Cursor",
  "Codex",
  "OpenHands",
  "Gemini",
  "Kiro",
] as const;

export const WHY_CARDS = [
  {
    key: "architecture",
    title: "Architecture Understanding",
    desc: "See systems, layers, and boundaries the moment you open a repo — no spelunking through folders.",
    accent: "var(--brand)",
  },
  {
    key: "dna",
    title: "Repository DNA",
    desc: "A compressed, queryable fingerprint of the whole codebase. The first thing any agent should read.",
    accent: "var(--cyan)",
  },
  {
    key: "context",
    title: "AI Context",
    desc: "A versioned JSON contract agents reason from — same ground truth over HTTP, MCP, or copy-paste.",
    accent: "var(--brand)",
  },
  {
    key: "impact",
    title: "Impact Analysis",
    desc: "Trace the blast radius of any change across the dependency graph before you touch a line.",
    accent: "var(--mint)",
  },
  {
    key: "capabilities",
    title: "Business Capabilities",
    desc: "Product features inferred from routes, handlers, and naming — the story behind the code.",
    accent: "var(--cyan)",
  },
  {
    key: "flows",
    title: "Flows & Journeys",
    desc: "Execution paths and user journeys mapped from entry points to outcomes, automatically.",
    accent: "var(--brand)",
  },
] as const;

export const DNA_STRANDS = [
  { label: "Domains", value: "Business boundaries from structure & imports", color: "var(--brand)" },
  { label: "Flows", value: "Execution paths through the call graph", color: "var(--cyan)" },
  { label: "Capabilities", value: "Features inferred from routes & handlers", color: "var(--lilac)" },
  { label: "Critical Paths", value: "The routes that carry the most weight", color: "var(--mint)" },
  { label: "AI Readiness", value: "Six dimensions of agent-friendliness", color: "var(--brand)" },
] as const;

export const MODES = [
  {
    id: "vibe",
    label: "Vibe Mode",
    audience: "Vibecoders · PMs · Founders",
    feel: "Duolingo × Notion",
    tagline: "The product story, in plain language.",
    points: [
      "Friendly explanations of what the product does",
      "User journeys & capabilities at a glance",
      "Health, momentum, and shareable links",
      "No raw JSON. No intimidating graphs.",
    ],
    color: "var(--brand)",
  },
  {
    id: "coder",
    label: "Developer Mode",
    audience: "Human developers",
    feel: "Linear",
    tagline: "The full technical architecture.",
    points: [
      "Systems, domains, and dependency graphs",
      "Execution flows & code map",
      "Smells, risk heatmap, and history",
      "Keyboard-first, built for shipping.",
    ],
    color: "var(--cyan)",
  },
  {
    id: "ai",
    label: "AI Agent Mode",
    audience: "Claude · Cursor · Codex",
    feel: "Cursor",
    tagline: "Optimized machine context.",
    points: [
      "AI Pack v1 — a stable, versioned contract",
      "Repair cards & verify commands",
      "Served over HTTP or MCP",
      "Everything an agent needs, nothing it doesn't.",
    ],
    color: "var(--lilac)",
  },
] as const;

/** Verified mnemos-bench scores — see mnemos-bench/results/VERIFIED.md */
export const BENCHMARK_RESULTS = [
  {
    repo: "Express",
    tier: "small",
    accuracy: 100,
    buildMs: 500,
    tokens: 8901,
    compression: 19.9,
    measuredAt: "2026-06-18",
  },
  {
    repo: "NestJS",
    tier: "medium",
    accuracy: 100,
    buildMs: 73000,
    tokens: 212366,
    compression: 4.8,
    measuredAt: "2026-06-18",
  },
] as const;

export const BENCHMARKS = [
  { label: "Task accuracy", value: 100, suffix: "%", hint: "Express & NestJS ground-truth suite" },
  { label: "Compression", value: 19.9, suffix: "×", hint: "Express — DNA vs raw repo tokens" },
  { label: "Build time", value: 0.5, suffix: "s", hint: "Express — full memory model" },
  { label: "Graph edges", value: 780, suffix: "", hint: "Express — import graph after CJS fix" },
  { label: "Tokens saved", value: 95, suffix: "%", hint: "vs. raw file dumps (Express)" },
  { label: "Time saved", value: 96, suffix: "%", hint: "onboarding TTU vs manual grep" },
] as const;

export const COMPARISON = {
  rows: [
    { feature: "Architecture & domains", mnemos: true, graphify: "partial", gitingest: false, madge: false },
    { feature: "Execution flows & journeys", mnemos: true, graphify: "partial", gitingest: false, madge: false },
    { feature: "Business capabilities", mnemos: true, graphify: false, gitingest: false, madge: false },
    { feature: "Dependency graph", mnemos: true, graphify: true, gitingest: false, madge: true },
    { feature: "AI Pack (versioned JSON)", mnemos: true, graphify: false, gitingest: "partial", madge: false },
    { feature: "MCP server for IDEs", mnemos: true, graphify: false, gitingest: false, madge: false },
    { feature: "Impact / blast radius", mnemos: true, graphify: "partial", gitingest: false, madge: "partial" },
    { feature: "Local-first, no cloud", mnemos: true, graphify: true, gitingest: true, madge: true },
    { feature: "Security dependency audit", mnemos: true, graphify: false, gitingest: false, madge: false },
    { feature: "Supernova beast-mode intelligence", mnemos: true, graphify: false, gitingest: false, madge: false },
  ],
  cols: ["Mnemos", "Graphify", "gitingest", "Madge"],
} as const;

export const CHAT_LINES = [
  "Welcome to Mnemos.",
  "Explore the memory layer for software.",
  "Don't let your code be forgotten.",
] as const;

/**
 * "New Gen" — the Fable Mindset layer.
 * Honest, method-based framing: Mnemos ports Fable 5's working *discipline*
 * into any agent. It does not retrain models or transplant raw capability.
 * Numbers are distilled from 4,665 public Fable 5 traces (Glint-Research).
 */
export const FABLE = {
  dataset: "https://huggingface.co/datasets/Glint-Research/Fable-5-traces",
  datasetLabel: "4,665 public Fable 5 traces",
  honesty:
    "Mnemos ports Fable 5's working discipline into any agent — it does not retrain models or transplant raw capability. It makes a model *work* with Fable's habits, not become Fable.",
  // The "secret sauce" revealed by the decrypt animation: the decision loop.
  decisionLoop: [
    { step: "GROUND", desc: "Establish real state — git status, targeted grep, read the file before touching it." },
    { step: "REASON", desc: "State the goal, the hypothesis, and the plan before the first tool call." },
    { step: "ACT", desc: "Take the next deliberate step; batch only what is truly independent." },
    { step: "OBSERVE", desc: "Actually read what came back — never barrel through a pre-planned sequence." },
    { step: "RE-EVALUATE", desc: "Update the plan from the evidence, not the other way around." },
    { step: "VERIFY", desc: "Run the project's real test / build / lint on what you changed." },
    { step: "NARRATE", desc: "Report outcomes faithfully — never claim success you did not verify." },
  ],
  // Measured habit gap — distilled from the dataset appendix. Evidence, not vibes.
  habits: [
    { habit: "Reasons before acting", source: 92, baseline: 40 },
    { habit: "Re-evaluates after each result", source: 87, baseline: 39 },
    { habit: "Reasons on nearly every turn", source: 86, baseline: 39 },
    { habit: "Reads the file before editing", source: 88, baseline: 88 },
  ],
  // Token savings — all from real, shipping mechanisms.
  savings: [
    { value: 10, suffix: "×", label: "Session debloat", hint: "A 32 MB Claude log collapses to ~1.1 MB — the signal under the echo." },
    { value: 94, suffix: "%", label: "Context vs raw dumps", hint: "Agents read the compact DNA pack instead of grepping the whole repo." },
    { value: 0, suffix: "", label: "Cloud / API keys", hint: "Local-first. Nothing leaves your machine.", display: "Zero" },
  ],
  install: "npx getmnemos . && getmnemos setup --platform claude",
  skillNote: "Installs the fable-mindset skill + CLAUDE.md context so Opus, Sonnet — any agent — adopts the discipline.",
} as const;
