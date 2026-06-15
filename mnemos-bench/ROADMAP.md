# Mnemos Roadmap (from verified benchmarks)

Ordered by impact. Weaknesses discovered during Mnemos Bench runs — not hidden.

## P0 — Accuracy gaps (benchmark-measured)

| Issue | Evidence | Status |
|-------|----------|--------|
| Impact analysis routed to auth instead of blast radius | NestJS task2 was 0% | **Fixed** — impact intent priority + graph-aware `analyzeImpact` (100%) |
| Login answers pointed to e2e test files | NestJS task1 cited e2e-spec | **Fixed** — exclude e2e/spec from production login flows |
| Graphify path assumed `lib/` | NestJS failed (no lib/) | **Fixed** — auto-resolve `packages/core`, `src`, `lib` |

## P1 — Remaining accuracy gaps

| Issue | Evidence | Target |
|-------|----------|--------|
| Express impact task2 | 83% — missing "depend" keyword in some paths | Wire dependency.json explicitly |
| NestJS explain task3 | 60% — missing "nestjs" in output | Enrich architecture summary with repo name |
| Capability precision on large monorepos | NestJS task5 60% | Tune signature thresholds per repo size |

## P1 — Architecture discovery

| Issue | Evidence | Fix |
|-------|----------|-----|
| Domain clustering polluted by test/example dirs | Pre-fix: "Test", "Acceptance", "Mvc" as top domains | Fixed: exclude test/example from cluster domains |
| `lib/` not recognized as domain | Pre-fix: no Core domain on Express | Fixed: `lib/` path hints + cluster filter |
| Capability false positives from substring match | Pre-fix: "School Administration" on Express | Fixed: word boundaries, exclude examples/, core file boost |

## P2 — Scale (NestJS stress test)

| Metric | Measured | Target |
|--------|----------|--------|
| Build time (1,724 files) | 62.7s | <30s (incremental cache) |
| Domains discovered | 49 | Review precision on monorepos |
| DNA size | 9,875 bytes (~2,469 tokens) | Keep <10k bytes at 2k files |

## P3 — AI readiness

| Issue | Evidence | Fix |
|-------|----------|-----|
| Copilot is rule-based, not LLM | By design — fast, local, no API key | Optional LLM backend for `ask` |
| Route/API extraction on non-Next repos | Express: 0 APIs | Enhance Express/Fastify route regex |
| Blind eval not yet run | Protocol ready in `blind-eval/` | Run with 10+ developers |

## Completed (v2 algorithm sprint)

- [x] Graph-aware impact analysis via `analyzeImpact` + `graph.json`
- [x] Impact intent priority over auth (97% weight)
- [x] Monorepo domain naming (`packages/core` → Core)
- [x] Middleware pipeline flow discovery (Express)
- [x] AI eval pack generator (`scorer/ai-eval.mjs`)
- [x] Regression gate (`npm run bench:regression`)
- [x] Express accuracy: 73% → **80%**
- [x] NestJS accuracy: 47% → **72.4%**
- [x] NestJS impact task: 0% → **100%**

## Signature metric: AI Context Efficiency

**Express (measured 2026-06-15 v2):**

| Source | Tokens | Compression |
|--------|--------|-------------|
| Raw repository | 177,553 | 1× |
| Gitingest digest | 1,100,000 | 0.16× |
| Mnemos DNA + context | 5,942 | **29.9×** |

**NestJS (measured 2026-06-15 v2):**

| Source | Tokens | Compression |
|--------|--------|-------------|
| Raw repository | 1,024,722 | 1× |
| Gitingest digest | 5,200,000 | 0.20× |
| Mnemos DNA + context | 36,424 | **28.1×** |

## Signature metric: Time To Understanding (TTU)

**Express (measured):**

| Method | Time |
|--------|------|
| Manual onboarding (28 files + 12 searches) | 51 min (3,060s) |
| Mnemos (build + ask + read DNA) | 2 min (122s) |
| **Savings** | **96%** |
