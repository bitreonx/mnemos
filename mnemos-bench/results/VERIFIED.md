# Mnemos Bench — Verified Results

Re-run: `npm run bench:express` / `npm run bench:nestjs`

## Express — 2026-06-15 (v2 algorithms)

| Tool | Accuracy | Build | Tokens | Compression | TTU |
|------|----------|-------|--------|-------------|-----|
| **Mnemos** | **80%** | 600ms | 5,942 | 29.9× | 2 min |
| Gitingest | 0% | 6.3s | 1,100,000 | 0.16× | — |
| Graphify | 0% | 0.9s | 26 | — | — |

Per-task: login 100% · impact 83% · critical 50% · capabilities 100% · explain 67%

[express.json](./express.json)

## NestJS — 2026-06-15 (v2 algorithms)

| Tool | Accuracy | Build | Tokens | Compression | TTU |
|------|----------|-------|--------|-------------|-----|
| **Mnemos** | **72.4%** | 35.7s | 36,424 | 28.1× | 2.6 min |
| Gitingest | 0% | 300s | 5,200,000 | 0.20× | — |
| Graphify | 0% | N/A | 0 | — | — |

Per-task: login 75% · impact **100%** · critical 67% · capabilities 60% · explain 60%

[nestjs.json](./nestjs.json) · [nestjs-stress.json](./nestjs-stress.json)

## AI eval packs

- [ai-eval-express.json](./ai-eval-express.json) — golden Q&A for LLM testing

## Regression

```bash
npm run bench:regression
```

Thresholds: Express ≥75% accuracy, NestJS ≥65% accuracy.
