# Fable 5 Agent Discipline

Mnemos ships **Fable-grade working habits** for coding agents — distilled from [Glint-Research Fable-5-traces](https://huggingface.co/datasets/Glint-Research/Fable-5-traces) and the public Fable Mindset operating manual.

## What you get

After `npx mnemos .`:

| Artifact | Path |
|----------|------|
| Full mindset manual | `.mnemos/integrations/fable-mindset.md` |
| Cursor discipline rule | `.cursor/rules/mnemos-discipline.mdc` (via `mnemos setup`) |
| Claude discipline skill | `.claude/skills/mnemos-discipline/SKILL.md` (via `mnemos setup --platform claude`) |
| AGENTS.md section | Injected into generated `AGENTS.md` |

## Install

```bash
npx mnemos .
mnemos setup --platform all    # architecture + discipline for every platform
mnemos setup --platform claude # Claude Code skill + CLAUDE.md + discipline skill
```

## The decision loop

Every non-trivial agent turn should follow:

1. **Ground** — read real state (`git status`, targeted reads) before editing
2. **Reason** — state goal, hypothesis, plan
3. **Act** — parallel reads only when independent
4. **Observe** — read every tool result
5. **Re-evaluate** — update plan from evidence
6. **Verify** — run real test/build/lint
7. **Narrate** — report outcomes honestly

## Measure your gap vs Fable 5

Scripts live in `scripts/discipline/`:

```bash
# Extract conversation corpus from a model's logs
bash scripts/discipline/extract_model_corpus.sh <model-id> > /tmp/corpus.jsonl

# Compare discipline metrics vs baseline
python3 scripts/discipline/analyze_discipline.py <target> <baseline>

# Quick delta report (Opus vs Fable defaults)
python3 scripts/discipline/fable_dataset_delta.py --opus
```

See also `skills/extract-mindset/SKILL.md` for the full extract-mindset workflow.

## Source code

- Rules: `packages/core/src/discipline/agent-discipline.ts`
- Mindset: `packages/core/src/discipline/fable-mindset.md`
- Tests: `packages/core/src/discipline/discipline.test.ts`
