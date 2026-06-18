# Mnemos Bench — Verified Results

Re-run: `npm run bench:express` / `npm run bench:nestjs`

Fresh rebuild (Windows PowerShell):

```powershell
Remove-Item -Recurse -Force mnemos-bench\repos\express\.mnemos -ErrorAction SilentlyContinue
npm run bench:express
```

Cross-platform: `npm run bench:fresh:express`

## Express — 2026-06-18 (v3 — CommonJS import fix)

| Tool | Accuracy | Build | Tokens | Compression | TTU |
|------|----------|-------|--------|-------------|-----|
| **Mnemos** | **100%** | 500ms | 8,901 | 19.9× | 2 min |
| Gitingest | 0% | 3.5s | 1,100,000 | 0.16× | — |
| Graphify | 0% | 1.2s | 26 | — | — |

Per-task: login 100% · impact 100% · critical 100% · capabilities 100% · explain 100%

[express.json](./express.json)

## NestJS — 2026-06-18 (v3 — CommonJS import fix)

| Tool | Accuracy | Build | Tokens | Compression | TTU |
|------|----------|-------|--------|-------------|-----|
| **Mnemos** | **100%** | 73s | 212,366 | 4.8× | 3.3 min |
| Gitingest | 0% | 304s | 6,000,000 | 0.17× | — |
| Graphify | 0% | N/A | 0 | — | — |

Per-task: login 100% · impact 100% · critical 100% · capabilities 100% · explain 100%

NestJS compression is lower because the richer dependency graph produces larger flow/context docs — accuracy is the primary gate.

[nestjs.json](./nestjs.json) · [nestjs-stress.json](./nestjs-stress.json)

## AI eval packs

- [ai-eval-express.json](./ai-eval-express.json) — golden Q&A for LLM testing

## Regression

```bash
npm run bench:regression
```

Thresholds: Express ≥95% accuracy & ≥15× compression · NestJS ≥95% accuracy & ≥4× compression.
