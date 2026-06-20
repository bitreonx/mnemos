# INFERNO-bench

**Independent Framework for Evaluating Repository Navigation Objectives**

The adversarial codebase understanding benchmark — where every tool faces the fire.

> SWE-bench tests whether models can **fix** real bugs. INFERNO tests whether tools and models can **understand** real systems — auth flows, blast radius, architecture, capabilities, and context efficiency.

## Why INFERNO?

OpenAI, Anthropic, and Google publish model cards citing SWE-bench, HumanEval, and MMLU. Codebase understanding had no equivalent — until now.

INFERNO is designed for the same audience:

- **Pinned fixtures** at exact commit SHAs (no drift)
- **Multi-signal verification** (keywords AND/OR, path assertions, forbidden traps)
- **Tier A/B/C/F gates** — report tier, not vibes
- **Independent ground-truth checks** — grep evidence without running Mnemos
- **Fair competitor baselines** — digest keyword search, not hardcoded zeros

Full governance: [GOVERNANCE.md](./GOVERNANCE.md) · Dataset: [dataset/v1.0.0.json](./dataset/v1.0.0.json)

## Structure

```
mnemos-bench/
├── dataset/         # Versioned INFERNO dataset (pinned SHAs)
├── GOVERNANCE.md    # Verification protocol (SWE-bench-style)
├── repos/           # Real cloned repositories (pinned, never simulated)
├── tasks/           # Six universal questions + per-repo ground truth
├── scorer/
│   ├── verify.mjs   # Multi-signal verification harness
│   ├── run.mjs      # Benchmark runner
│   └── regression.mjs
├── results/         # Measured JSON + leaderboard
└── blind-eval/      # Human A/B protocol
```

## Repository tiers

| Tier | Repository | Status |
|------|------------|--------|
| Small | [expressjs/express](https://github.com/expressjs/express) @ `18e5985` | **Verified** |
| Medium | [nestjs/nest](https://github.com/nestjs/nest) @ `6859216` | **Verified** |
| Large | [vercel/next.js](https://github.com/vercel/next.js) | Planned v1.1 |
| Huge | [microsoft/vscode](https://github.com/microsoft/vscode) | Planned v1.1 |

## The six universal tasks

Every entrant answers the same questions:

1. **Where does login start?** — auth entry points
2. **What breaks if X changes?** — impact / blast radius
3. **Explain the repository** — architecture overview
4. **Find the most critical subsystem** — centrality
5. **List business capabilities** — not folder names
6. **Generate AI context package** — artifacts + compression

## Verification tiers

| Tier | Meaning |
|------|---------|
| **A** | All gates pass — production-trustworthy |
| **B** | Strong partial |
| **C** | Weak — onboarding risk |
| **F** | Fail — adversarial trap or rubric miss |

## Quick start

```bash
npm run build

# Pin fixtures to dataset commit SHAs
npm run bench:pin -- express nestjs

# Independent ground-truth verification (grep only)
npm run bench:verify-gt -- express

# Run INFERNO harness
npm run bench:express
npm run bench:nestjs

# Verification unit tests (no clones needed)
npm run bench:verify

# Regression + leaderboard
npm run bench:regression
npm run bench:leaderboard
```

## Scoring signals

| Signal | Source benchmark inspiration |
|--------|------------------------------|
| Keyword AND | HumanEval functional checks |
| Keyword OR (`required_any`) | MMLU partial credit |
| Path assertions | SWE-bench file-level correctness |
| Forbidden traps | Adversarial GAIA-style failure modes |
| Context artifacts | Custom — task6 compression floor |

## AI model evaluation

Test LLMs without raw repo access — give `project.dna.json` + `agent_context.json`, score against ground truth:

```bash
npm run bench:ai-eval -- express
```

## Latest verified results

See [results/VERIFIED.md](./results/VERIFIED.md) and [results/leaderboard.json](./results/leaderboard.json).

## Killer metric: Time To Understanding (TTU)

How long until a new developer understands the repository? Modeled baseline vs tool-assisted path — see `ttu` block in each result file. Human gold standard: [blind-eval/](./blind-eval/).

---

*Mnemos Bench is the implementation harness. INFERNO-bench is the open standard name for enterprise model evaluation.*
