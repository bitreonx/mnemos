/**
 * The Loom — dynamic agent loop skill (Theo "loops that prompt agents" pattern).
 * No hardcoded personas; topology emerges from task shape.
 */

export function buildLoomSkillMd(): string {
  return `---
name: mnemos-loom
description: Design dynamic agent loops that prompt themselves — PR stacks, review cycles, heartbeat monitors. Uses Mnemos memory shards, Spiralfuse token budgets, and Provenance honest recall. Use when building multi-PR workflows, overnight agent runs, or review-fix-merge loops. No fixed personas — shape follows the work.
---

# The Loom

> Loops prompt agents. You design the topology — not every prompt.

## Before any loop

\`\`\`bash
npx mnemos .
npx mnemos memory build .
npx mnemos memory loop start --max-tokens 250000 --label "my-workflow"
\`\`\`

Read \`.mnemos/project.dna.json\` first. Load shards — never grep the whole repo:

\`\`\`bash
curl -s http://127.0.0.1:4000/domain/auth | jq '.estimatedTokens'
mnemos memory context "task description" --budget 8000
\`\`\`

## Dynamic workflow (no hardcoded reviewers)

When given a multi-stage task:

1. **Shape** — Break into PRs/stacks based on blast radius (\`mnemos impact <node>\`)
2. **Implement thread** — One worktree per PR; \`mnemos sync\` after each merge
3. **Review thread** — Spawn fresh reviewer with shard context only
4. **Ouroboros** — Monitor PR comments; fix; re-review until clean or Spiralfuse fuses
5. **Stackforge** — Merge → sync DNA → spawn next stack piece

Record failures for the next loop:

\`\`\`bash
mnemos memory remember "PR2 failed because X" --tag loop,postmortem
mnemos memory ask "what went wrong with PR2?"
\`\`\`

## Spiralfuse (token fuse)

Every sub-loop tick:

\`\`\`bash
mnemos memory loop tick --tokens <estimate>
\`\`\`

If fused — stop, summarize for human. Do not burn 3M tokens on three comments.

Compress verify output for parent threads:

\`\`\`bash
mnemos wrap -- npm test
\`\`\`

## Human gates (non-negotiable)

- **You** merge to main on production codebases
- **You** ACK when \`impact_analysis\` shows high blast radius
- **Provenance** may admit "I don't know" — respect that, don't hallucinate

## Heartbeat pattern (Pulseweave)

\`\`\`
every 5-10 min:
  check PR / CI status
  if comments → load domain shard → fix → mnemos sync → re-review
  mnemos memory loop tick --tokens <used>
\`\`\`

## Ashfall (post-mortem)

On human intervention or fuse:

\`\`\`bash
mnemos memory remember "Loop fused: <reason>. Next time: <fix>" --tag ashfall,loop
\`\`\`

## Frozen snapshot (session start)

Inject at session start from \`.mnemos/engine/frozen/\`:

- \`soul.md\` — discipline
- \`user.md\` — who you work for
- \`memory.md\` — capped recent decisions
- \`today.md\` — today's captures

Regenerate: \`mnemos memory frozen\`
`;
}

export function buildLoomCursorRule(): string {
  return `---
description: Mnemos Loom — dynamic agent loops with memory shards and token fuse
alwaysApply: false
---

# The Loom (Mnemos)

When running multi-step agent workflows:

1. Read \`.mnemos/project.dna.json\` before exploring source
2. Use \`mnemos memory context\` or domain shards — not whole-repo grep
3. Tick Spiralfuse: \`mnemos memory loop tick --tokens N\` each iteration
4. On failure: \`mnemos memory remember\` with tag \`ashfall\`
5. Ask with honesty: \`mnemos memory ask "question"\` — admit gaps if confidence low
6. Human merges production PRs; agent stops at "ready to merge"
`;
}
