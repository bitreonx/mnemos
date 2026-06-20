# INFERNO-bench Governance

**INFERNO** — *Independent Framework for Evaluating Repository Navigation Objectives*

The adversarial codebase understanding benchmark. Where SWE-bench verifies *patch correctness*, INFERNO verifies *comprehension under fire*.

## Design lineage

We studied how the most trusted open benchmarks earn credibility, then adapted their patterns to codebase understanding (not code repair):

| Benchmark | What we borrowed | INFERNO adaptation |
|-----------|------------------|-------------------|
| [SWE-bench](https://www.swebench.com/) | Pinned commits, deterministic harness, pass/fail gates | Pinned fixture SHAs in `dataset/v1.0.0.json`; multi-signal gates in `scorer/verify.mjs` |
| [HumanEval](https://github.com/openai/human-eval) | Functional correctness over vibes | Each task has explicit rubric fields — not a single subjective score |
| [MMLU](https://github.com/hendrycks/test) | Exact-match with partial credit bands | Tier A/B/C/F instead of one accuracy number |
| [GAIA](https://huggingface.co/gaia-benchmark) | Multi-step reasoning checks | Six universal tasks spanning auth, impact, overview, critical path, capabilities, context export |
| [LiveCodeBench](https://livecodebench.github.io/) | Contamination-resistant pinned snapshots | Fixtures frozen at commit SHA; re-pin only on dataset version bump |

## Verification protocol

Every ground-truth file MUST include:

```json
{
  "verified_at": "ISO date",
  "verification_method": "human description",
  "independent_checks": ["grep pattern → expected hit"],
  "commit_sha": "pinned in dataset manifest"
}
```

### Three-layer verification

1. **Independent checks** — `scripts/verify-ground-truth.mjs` greps the fixture *without* running Mnemos. Ground truth must match raw repo evidence.
2. **Harness scoring** — `scorer/verify.mjs` applies keyword AND/OR, path assertions, forbidden traps, and context artifact gates.
3. **Regression gate** — `scorer/regression.mjs` fails CI if committed results drop below tier thresholds.

### Verification tiers

| Tier | Meaning | Gate |
|------|---------|------|
| **A** | Verified | All rubric gates pass, no forbidden hits, min task accuracy ≥95% |
| **B** | Strong partial | Average ≥80%, weakest task ≥70% |
| **C** | Weak | Average ≥50% |
| **F** | Fail | Adversarial trap or rubric miss |

Tools and models should report **tier + accuracy**, not accuracy alone.

## Adversarial design ("devil's advocate")

INFERNO is intentionally hostile to weak tools:

- **Forbidden traps** — answers citing test dirs, wrong domains, or hallucinated capabilities lose tier
- **OR vs AND semantics** — `required_any` is true OR; `required_keywords` is true AND (documented, tested)
- **Path assertions** — answers must cite real file paths, not vague folder names
- **Context budget** — task6 fails if artifacts missing or compression below floor
- **Fair digest baseline** — Gitingest scored via keyword search over digest, not hardcoded 0%

## Dataset releases

- Version format: `MAJOR.MINOR.PATCH` in `dataset/vX.Y.Z.json`
- **MAJOR** — new tasks, breaking rubric changes
- **MINOR** — new fixtures (nextjs, vscode)
- **PATCH** — ground-truth fixes with evidence

Pin fixtures:

```bash
npm run bench:pin -- express nestjs
```

Verify ground truth independently:

```bash
npm run bench:verify-gt -- express
```

## Leaderboard rules

1. Same six universal tasks for every entrant
2. Document LLM budget if using models (tokens in / tokens out)
3. Publish `verification_tier` alongside accuracy
4. Results must include `measured_at`, `dataset_version`, `commit_sha`
5. Disputes filed as GitHub issues with grep evidence

## What INFERNO is NOT

- Not a replacement for SWE-bench (different task: understanding vs patching)
- Not proof for all codebases (currently 2 verified fixtures)
- Not a subjective "vibes" leaderboard — every gate is reproducible

## Blind human eval

Human preference data (10+ developers, anonymized reports) is the gold standard for TTU claims. Protocol: [blind-eval/README.md](./blind-eval/README.md). Results publish separately from harness tiers.
