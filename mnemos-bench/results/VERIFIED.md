# INFERNO-bench — Verified Results

**Independent Framework for Evaluating Repository Navigation Objectives**

Re-run: `npm run bench:express` / `npm run bench:nestjs`

Pin fixtures first: `npm run bench:pin -- express nestjs`

## Verification methodology (v1.0.0)

| Layer | Command | Purpose |
|-------|---------|---------|
| Harness tests | `npm run bench:verify` | OR/AND semantics, traps, tiers |
| Independent grep | `npm run bench:verify-gt -- express` | Ground truth vs raw repo (no Mnemos) |
| Multi-signal score | `scorer/verify.mjs` | Keywords + paths + forbidden + context |
| Regression gate | `npm run bench:regression` | Tier A + accuracy floors |

**Report verification tier alongside accuracy.** Tier A = all gates pass.

## Express — dataset v1.0.0 @ `18e5985`

| Tool | Tier | Accuracy | Build | Tokens | Compression | TTU |
|------|------|----------|-------|--------|-------------|-----|
| **Mnemos** | **A** | **100%** | 500ms | 8,493 | 20.9× | 2 min |
| Mnemos Full Burn | A | 100% | +instant | 11,734 | 15.1× | — |
| Understand-Anything (structural) | B/C | 42% | 789ms | 14,981 | 11.9× | — |
| Gitingest (digest search) | varies | digest-dependent | 14.6s | 1,100,000 | 0.16× | — |
| Graphify (lib/) | F | 0% | 1.7s | 26 | — | — |

Per-task (Mnemos): login · impact · critical · capabilities · explain · context export

[express.json](./express.json)

## NestJS — dataset v1.0.0 @ `6859216`

| Tool | Tier | Accuracy | Build | Tokens | Compression | TTU |
|------|------|----------|-------|--------|-------------|-----|
| **Mnemos** | **A** | **100%** | 53s | 210,409 | 4.9× | 3 min |
| Mnemos Full Burn | A | 100% | +instant | 40,507 | 25.3× | — |
| Understand-Anything (structural) | F | 17% | 3.6s | 496,748 | 2.1× | — |
| Gitingest (digest search) | varies | digest-dependent | 373s | 6,500,000 | 0.16× | — |
| Graphify | F | 0% | N/A | 0 | — | — |

Per-task (Mnemos): login · impact · critical · capabilities · explain · context export

[nestjs.json](./nestjs.json) · [nestjs-stress.json](./nestjs-stress.json)

## Leaderboard

Auto-generated: `npm run bench:leaderboard` → [leaderboard.json](./leaderboard.json)

## AI eval packs

- [ai-eval-express.json](./ai-eval-express.json) — golden Q&A for LLM testing (SWE-bench-style model eval)

## Regression thresholds

```bash
npm run bench:regression
```

Express: tier A · ≥95% accuracy · ≥15× compression · ≥5/6 tasks verified  
NestJS: tier A · ≥95% accuracy · ≥4× compression · ≥5/6 tasks verified

## Positioning vs SWE-bench

| | SWE-bench | INFERNO-bench |
|---|-----------|---------------|
| Task | Fix GitHub issues | Understand architecture |
| Verification | Test suite pass/fail | Multi-signal rubrics + tiers |
| Fixtures | 2,000+ instances | 2 verified (v1.0), expanding |
| Use case | Agent coding | Onboarding, context, navigation |

Complementary — not competitive.
