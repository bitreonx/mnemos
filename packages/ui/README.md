# Mnemos UI — Developer Cockpit

The Mnemos dashboard is an **AI-native repository intelligence cockpit** for humans and coding agents.

## Launch

```bash
# Single repository (reads ./.mnemos/)
MNEMOS_ROOT=/path/to/repo npm run dev --workspace=@mnemos/ui

# Multi-repo workspace (requires dabt.workspace.json or MNEMOS_WORKSPACE)
MNEMOS_WORKSPACE=./dabt.workspace.json npm run dev --workspace=@mnemos/ui
```

Or via CLI: `mnemos ui`

## Layout

| Zone | Purpose |
|------|---------|
| **Left rail** | All repos, pin/favorite, filter, sort, quick build |
| **Top bar** | Breadcrumbs, search, command palette (`Ctrl+K`), panel toggles |
| **Main workspace** | Platform overview or repo sections |
| **AI Inspector** | Auth summary, routes, architecture excerpt, start-here tasks (`Ctrl+I`) |
| **Bottom terminal** | Embedded Mnemos CLI scoped to active repo (`Ctrl+\`) |

## Repo workspace sections

1. **Overview** — health, stats, tech stack, quick navigation
2. **Architecture** — systems (auth/API/data detection), domains, graph, capabilities, canvas, smells
3. **Flows** — execution paths and user journeys
4. **Code Map** — inferred file tree and tech stack
5. **History** — build history, activity timeline, risk heatmap
6. **AI Context** — copilot (`mnemos ask`) and markdown context docs

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command palette |
| `Ctrl+I` | Toggle AI Inspector |
| `Ctrl+\`` | Toggle terminal panel |

## Command palette tasks

- Open repositories and views
- **Understand auth** — routes copilot to auth analysis
- **Trace routing** / **Impact analysis** / **Recent core changes**
- Run Mnemos build on active repo

## Terminal commands

Inside the bottom terminal (workspace mode):

```
help
build
ask "how does auth work?"
flows
score
dna
inspect <query>
impact <node>
```

## AI agents

Agents should:

1. Read `.mnemos/project.dna.json` and `agent_context.json`
2. Use the **AI Inspector** for auth entry points and related files
3. Run `ask` in the embedded terminal or `mnemos serve` for live queries
4. Navigate by **Architecture → Systems** before editing unfamiliar code

## Screenshots & sharing

Click **Capture** in the top bar to flash-highlight the main workspace for screenshots. Use with browser devtools or OS capture for docs, PRs, and demos.

For programmatic SVG cards: `mnemos snapshot`

## Modes

- **Workspace mode** — `/api/workspace` detected; multi-repo with build, terminal, ask APIs
- **Single-repo mode** — loads `/.mnemos/memory.json` from `MNEMOS_ROOT`; same cockpit layout, local static data
