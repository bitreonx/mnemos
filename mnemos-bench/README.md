# Mnemos Bench

Open, reproducible benchmark for codebase understanding tools.

**No subjective scores.** Every number comes from measured wall-clock time, byte counts, and keyword coverage against per-repo ground truth verified by manual grep.

## Structure

```
mnemos-bench/
├── repos/           # Real cloned repositories (not simulated)
├── tasks/           # Universal questions + per-repo ground truth
├── results/         # Measured JSON outputs (committed after runs)
├── scorer/          # Objective benchmark runner
└── blind-eval/      # Blind A/B evaluation protocol
```

## Repository tiers

| Tier | Repository | Purpose |
|------|------------|---------|
| Small | [expressjs/express](https://github.com/expressjs/express) | Fast regression, capability accuracy |
| Medium | [nestjs/nest](https://github.com/nestjs/nest) | Auth, DI, modules |
| Large | [vercel/next.js](https://github.com/vercel/next.js) | Stress: performance, compression |
| Huge | [microsoft/vscode](https://github.com/microsoft/vscode) | Maximum scale (optional) |

## The six universal tasks

Every tool answers the same questions:

1. **Where does login start?** — Route, controller, service
2. **What breaks if X changes?** — Dependencies, APIs, flows
3. **Explain the repository** — Under 300 words, accurate architecture
4. **Find the most critical subsystem** — Centrality-based
5. **List business capabilities** — Not folder names
6. **Generate AI context package** — Size, coverage, token count

## Scoring (objective)

| Metric | How it's measured |
|--------|-------------------|
| **Accuracy** | % of ground-truth keywords found in tool output |
| **Coverage** | Count of required concepts matched |
| **Latency** | Wall-clock `Date.now()` around each tool invocation |
| **Token compression** | `raw_repo_tokens / tool_output_tokens` |
| **TTU** | Time To Understanding: baseline (90s/file + 45s/search) vs Mnemos (build + ask + 120s read DNA) |

## Run a benchmark

```bash
# From Mnemos repo root
npm run build

# Clone repos (first time)
git clone --depth 1 https://github.com/expressjs/express.git mnemos-bench/repos/express

# Run measured benchmark
node mnemos-bench/scorer/run.mjs express
```

Results are written to `mnemos-bench/results/express.json`.

## Competitors

| Tool | What we measure | Limitations (documented honestly) |
|------|-----------------|-----------------------------------|
| **Mnemos** | Full pipeline: build, ask, explain, context | Local static analysis only |
| **Gitingest** | Raw digest size + latency | No structured Q&A |
| **Graphify** | lib/ code-only extract + query | Full repo needs LLM API key for docs |

## AI model evaluation

Test any LLM against Mnemos Bench without raw repo access:

```bash
npm run bench:express          # generates results + rebuilds .mnemos
node mnemos-bench/scorer/ai-eval.mjs express
```

Give the model only `project.dna.json` + `agent_context.json`, ask the 6 universal tasks, score with keyword coverage against ground truth.

## Regression gate

```bash
npm run bench:regression
```

Fails if accuracy/compression drops below verified thresholds.

## Blind evaluation

See [blind-eval/README.md](./blind-eval/README.md) — hide tool names, ask developers which report helped them understand fastest.

## Reproducibility

- Ground truth includes `verified_at` and `verification_method`
- Results include `measured_at` ISO timestamp
- Re-run anytime; diff `results/*.json` for regression detection

## Killer metric: Time To Understanding (TTU)

> How long until a new developer understands the repository?

Measured, not claimed. See `ttu` block in each result file.
