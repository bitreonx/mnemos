/**
 * Agent discipline rules distilled from observed Fable 5 behavior.
 * Source: Glint-Research Fable-5-traces + Fable_Mindset_public.md
 * Goal: lift weaker models (e.g. Opus 4.8) toward Fable-grade working habits.
 */

export const FABLE_DATASET_URL = 'https://huggingface.co/datasets/Glint-Research/Fable-5-traces'

/** Compact rules injected into AGENTS.md, Cursor rules, and platform skills. */
export function buildAgentDisciplineRules(): string[] {
  return [
    '## Agent Discipline (Fable-grade habits)',
    '',
    'Ethos: **be cautious, then decisive.** Reason before you move, ground in real state,',
    'decide from what you actually saw, verify what you changed, recover with method.',
    'Scale effort to the task — a one-line fix does not need a war room.',
    '',
    '### Decision loop (every non-trivial turn)',
    '',
    '1. **Ground** — `git status`, targeted grep, read the file region before editing.',
    '2. **Reason** — state goal, hypothesis, and plan before the first tool call.',
    '3. **Act** — batch independent reads/checks in parallel; never batch dependent steps.',
    '4. **Observe** — read every tool result; do not barrel through a pre-planned sequence.',
    '5. **Re-evaluate** — update the plan from results, not the other way around.',
    '6. **Verify** — run the project\'s real test/build/lint after code edits.',
    '7. **Narrate** — report outcomes faithfully; never claim success without evidence.',
    '',
    '### Non-negotiables',
    '',
    '- Read Mnemos DNA (`.mnemos/project.dna.json`) before random repo grepping.',
    '- Read exact lines you will edit, in this session, immediately before editing.',
    '- After `Edit`/`Write`, run the real verification command — not `ls` or `echo`.',
    '- On tool failure: diagnose → inspect state → corrected fix → re-verify. Never retry blind.',
    '- Use absolute paths in shell commands instead of chaining `cd`.',
    '- Match effort to scope: decompose large work, get plan approval, track steps.',
    '',
    '### What "done" means',
    '',
    'Goal met + real check passed + outcome reported honestly (including failures).',
    '"Probably works" is not done.',
    '',
  ]
}

/** Cursor rule frontmatter + discipline body for optional standalone install. */
export function buildDisciplineCursorRule(): string {
  const body = buildAgentDisciplineRules().join('\n')
  return `---
description: Agent working discipline — Fable-grade habits for coding agents
globs:
alwaysApply: true
---

${body}`
}

/** Short pointer block for Claude / Copilot project files. */
export function buildDisciplineSkillSection(): string {
  return [
    '## Working discipline',
    '',
    'Adopt Fable-grade habits: reason before acting, re-evaluate after every tool result,',
    'ground in real state before editing, run real tests after changes, diagnose failures',
    'instead of retrying blind. Full reference: `.mnemos/integrations/fable-mindset.md`.',
    '',
    'Measure your gap: `python3 scripts/discipline/fable_dataset_delta.py --opus`',
    '',
  ].join('\n')
}

/** Full Claude Code skill for Fable-grade working discipline. */
export function buildDisciplineSkillMd(): string {
  return [
    '# Mnemos — Fable-grade agent discipline',
    '',
    'Adopt cautious-then-decisive habits distilled from Fable 5 traces.',
    'Full operating manual: `.mnemos/integrations/fable-mindset.md`',
    '',
    buildDisciplineSkillSection(),
    '## Decision loop',
    '',
    '1. Ground — read real state before editing',
    '2. Reason — state goal and plan',
    '3. Act — parallel reads only when independent',
    '4. Observe — read every tool result',
    '5. Re-evaluate — update plan from evidence',
    '6. Verify — run real test/build/lint',
    '7. Narrate — report outcomes honestly',
    '',
    '## Measure your gap',
    '',
    '```bash',
    'python3 scripts/discipline/fable_dataset_delta.py --opus',
    '```',
    '',
    `Dataset: ${FABLE_DATASET_URL}`,
    '',
  ].join('\n')
}

/**
 * Self-contained Claude Code skill that makes any model adopt Fable-grade
 * working discipline. Unlike buildDisciplineSkillMd, this carries the
 * frontmatter Claude Code needs to auto-discover and trigger the skill, and
 * embeds the rules inline so it works as a true drop-in with no built repo.
 */
export function buildFableMindsetSkillMd(): string {
  const allRules = buildAgentDisciplineRules()
  // Drop the heading and the ethos preamble (we state our own intro above);
  // keep from the decision loop onward so nothing is duplicated.
  const loopStart = allRules.findIndex((l) => l.startsWith('### Decision loop'))
  const rules = allRules.slice(loopStart >= 0 ? loopStart : 0).join('\n')
  return `---
name: fable-mindset
description: Adopt Fable-grade working discipline on every turn — reason before acting, ground in real state before editing, verify changes with the real test, recover from failures with method instead of retrying blind, and report outcomes honestly. Use to lift any model (Opus 4.8, Sonnet, etc.) toward the disciplined habits measured across 4,665 public Fable 5 traces. Not a capability transplant — it ports the habits, not the weights.
---

# Fable Mindset

> Distilled from real Fable 5 Claude Code traces, not invented. This skill shapes
> *how you work*, not what you know. It ports discipline, not raw capability.

When this skill is active, hold these habits for the whole session. The ethos:
**be cautious, then decisive.** Speed comes from doing the right thing once, not
from skipping the thinking. Scale effort to the task — a one-line fix does not
need a war room.

${rules}

## Why this works (and what it is not)

Reasoning density is partly intrinsic to a model and not fully reproducible by
instruction alone. This skill closes the *behavioral* gap — the observe-then-decide
loop, recon-before-mutation, verify-after-edit — which is the portable part. Pair it
with a high effort level (\`/effort max\`) for best results. It does **not** make a
model equal to Fable 5; it makes a model *work* with Fable 5's discipline.

Measure your own gap honestly:

\`\`\`bash
python3 scripts/discipline/fable_dataset_delta.py --opus
\`\`\`

Dataset: ${FABLE_DATASET_URL}
`
}
