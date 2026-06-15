# Mnemos

> **Give AI a memory of your codebase.** One command. Any repository. Instant understanding.

```bash
npx mnemos .
```

```
✓ 1,848 files analyzed
✓ 40 domains discovered
✓ 137 flows discovered
✓ 490 APIs discovered
✓ Repository DNA generated
✓ Screenshot-ready SVG cards rendered

  This repository contains

    40 domains
    137 flows
    490 APIs
    12 capabilities

  Most critical domain:
    Transport

  Highest risk domain:
    Attendance

Opening browser…
```

**Mnemos gives Claude, Cursor, and Codex instant understanding of any codebase.**

Within one minute, Mnemos discovers your domains, traces your critical paths, ranks your risks, and writes a structured **Repository DNA** that any AI agent can read first.

---

## The 30-Second Experience

```bash
npx mnemos .        # full experience: analyze, DNA, browser
npx mnemos dna .    # viral one-glance summary
npx mnemos explain .  # plain-language description
npx mnemos snapshot . # screenshot-ready SVG cards
```

No config. No database. No API keys. No account. No cloud. No telemetry. No setup wizard.

---

## Repository DNA

Every repository produces a canonical `project.dna.json` — the single file AI agents should read first.

```json
{
  "$schema": "mnemos/dna/v3",
  "repository": "your-app",
  "repository_health_score": 89,
  "ai_readiness_score": 97,
  "capabilities": [...],
  "journeys": [...],
  "domains": [...],
  "critical_paths": [...],
  "risks": [...]
}
```

Drag it into **Claude Code**, **Cursor**, or **Codex** and they instantly understand your architecture.

---

## Screenshot-Ready Visuals

Every analysis produces shareable SVG cards for your README, PRs, and social posts.

### Architecture View

Domain cards instead of graph nodes. Each domain shows its services, APIs, and risk.

### Journey View

User flows as clean numbered sequences — *Student → Frontend → Registration API → Database → Notification*.

### AI Context View

A single screen for AI agents: capabilities, domains, critical paths, AI readiness score.

All cards live in `.mnemos/snapshots/*.svg` and are ready to embed in any markdown.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx mnemos .` | **Full experience** — analyze, DNA, open report |
| `mnemos dna [path]` | Viral one-glance Repository DNA summary |
| `mnemos explain [path]` | Plain-language description of the codebase |
| `mnemos story [path]` | Architecture narrative storytelling |
| `mnemos snapshot [path]` | Screenshot-ready SVG cards for README |
| `mnemos score [path]` | Repository health + AI readiness scores |
| `mnemos build [path]` | Build memory model only |
| `mnemos serve [path]` | Memory server for AI agents (`:4000`) |
| `mnemos ui` | Launch React visualization UI |
| `mnemos impact <node>` | Blast radius analysis |
| `mnemos ask <question>` | Architecture copilot |
| `mnemos review <diff>` | Review a PR diff against memory model |
| `mnemos onboard [path]` | New-developer onboarding guide |

### The viral command: `mnemos dna`

```bash
npx mnemos dna .
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REPOSITORY DNA  ·  express
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  express is a single package with 8 capabilities, 2 domains, and 0 APIs.

  Capabilities      Domains           Journeys          APIs
  8                 2                 0                 0

  ┌─────────────────────────────────────┐
  │  Health Score:     75 / 100        │
  │  AI Readiness:     80 / 100        │
  └─────────────────────────────────────┘

  Most Critical Domain:    Test
  Highest Risk Domain:     Test

  Top Capabilities:
    • Transport & Routing
    • Search & Discovery
    • API & Routing
    • Authentication & Identity

  Drag .mnemos/project.dna.json into Claude, Cursor, or Codex.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### The plain-language command: `mnemos explain`

```bash
npx mnemos explain .
```

```
This repository is a single package with 141 source files across javascript.

Primary Capabilities:
• Transport & Routing
• Search & Discovery
• API & Routing
• Authentication & Identity

Architecture Style:
Single Package

Most Critical Domain:
Test

Highest Risk Domain:
Test

Main User Journeys:
• Trip Lifecycle
• Admin Configuration
• Search & Discovery
```

---

## Artifacts

```
.mnemos/
├── project.dna.json          ← canonical Repository DNA (AI agents read this first)
├── agent_context.json        ← machine-optimized agent bundle
├── repository_summary.json   ← narrative summary
├── health-score.json         ← architecture, maintainability, AI readiness
├── domains.json
├── flows.json
├── critical_paths.json
├── report/
│   └── index.html            ← interactive intelligence report
├── snapshots/
│   ├── dna-summary.svg       ← README-ready cards
│   ├── capabilities.svg
│   ├── journeys.svg
│   ├── journey-flow.svg      ← numbered flow sequence
│   ├── architecture.svg      ← domain cards
│   ├── ai-context.svg        ← AI agent view
│   └── health-score.svg
└── context/
    ├── architecture.md
    ├── flows.md
    └── ...
```

---

## AI Workflow

Point your AI agent at these files in order:

1. `.mnemos/project.dna.json` — compressed understanding (read this first)
2. `.mnemos/agent_context.json` — rich context with search hints
3. `.mnemos/flows.json` + `.mnemos/domains.json` — structural detail

Or start the memory server:

```bash
npx mnemos serve .
```

| Endpoint | Description |
|----------|-------------|
| `GET /dna` | Repository DNA |
| `GET /explain` | Human summary |
| `GET /copilot?q=` | Ask architecture questions |
| `GET /impact/:node` | Blast radius |
| `GET /search?q=` | Search domains/services |
| `GET /heatmap` | Technical debt heatmap |
| `POST /review` | PR diff review |

Works with **Cursor**, **Claude Code**, **Codex**, **Gemini CLI**, **OpenHands**.

---

## Built for AI Developers

Mnemos is not a code graph tool. Mnemos is not repository visualization. Mnemos is not architecture analysis.

**Mnemos is the memory layer for software.**

It generates files that AI tools understand:

- `project.dna.json` — every AI agent should read this first
- `agent_context.json` — searchable context bundle
- `context/architecture.md` — markdown summary
- `context/flows.md` — flow documentation
- `context/critical_paths.md` — what breaks first

Drop them into Claude Code, Cursor, or Codex. Watch your AI agent go from "I don't know this repo" to instant understanding.

---

## Repository Health

```bash
npx mnemos score .
```

```
Repository Health Score

  Overall:           89
  Architecture:      92
  Maintainability:   88
  Complexity:        74
  Documentation:     85
  Coupling:          88
  AI Readiness:      97

Recommendations:
  • Add documentation to Transport domain.
  • Reduce coupling between Attendance and Registration.
```

---

## Three Modes

The HTML report (`report/index.html`) includes a mode switch:

| Mode | Audience | Focus |
|------|----------|-------|
| **Vibe** | Founders, PMs, designers | Capabilities, user journeys, narrative |
| **Developer** | Engineers, architects | Domains, flows, smells, scores |
| **AI Agent** | Claude, Cursor, Codex | `project.dna.json`, agent artifacts |

Single-file. Works offline. Searchable. Shareable.

---

## Development

```bash
git clone <repo>
cd mnemos
npm install
npm run build
npx mnemos .
```

Monorepo: `@mnemos/core` (engine) · `@mnemos/cli` (CLI) · `@mnemos/ui` (React UI)

## License

MIT
