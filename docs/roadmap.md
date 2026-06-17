# Mnemos Roadmap

Public roadmap for Mnemos 1.x. Items may shift based on community feedback.

## Shipped (1.0)

- [x] Repository scanner + memory model (`.mnemos/`)
- [x] AI Pack v1 contract (`buildAiPack`, CLI `pack`, `/copilot/pack`, `/api/json`)
- [x] Dashboard redesign — Vibe / AI / Coder cockpits + React Router v7
- [x] Shared `MnemosRuntime` for REST + MCP
- [x] Report with `?mode=vibe|ai|coder` and Dashboard · Report · AI JSON legend
- [x] ScoreExplainer + IssueCard copy-ready for agents
- [x] Report design tokens aligned with dashboard (`packages/core/src/report/design-tokens.ts`)
- [x] **`mnemos sync`** — codegraph-style incremental graph rebuild on file changes
- [x] **`mnemos wrap`** — rtk-style token-compressed command output for AI agents
- [x] FAANG-grade CLI terminal output (`packages/cli/src/output/`)
- [x] Dashboard preview banner (report + CLI are stable surfaces)
- [x] **Fable 5 agent discipline** — mindset rules in `mnemos setup`, dataset tools in `scripts/discipline/`
- [x] **`fable-mindset` skill** — standalone Claude Code skill + `mnemos discipline` CLI research kit
- [x] Claude OSS application brief (`docs/claude-oss-application.md`)
- [x] Marketing site **New Gen** section (`MNEMOS-WEB/src/sections/FableMindset.tsx`)

## In progress

- [ ] Lighthouse a11y ≥ 95 on all three cockpits
- [ ] Keyboard shortcut map (`g o`, `g a`, `/`, `?`, `1/2/3`)
- [ ] AI Pack JSON schema published at `mnemos.dev/schemas/ai-pack/v1.json`
- [ ] Dashboard panel layout polish (community-driven)
- [ ] Claude for Open Source — finish dashboard with Claude Code before creator launch

## Planned (1.x)

- [ ] Workspace multi-repo polish (pinned repos, cross-repo compare)
- [ ] AI Pack diff between build snapshots
- [ ] `mnemos review` PR integration in dashboard
- [ ] Optional `@mnemos/sdk` for programmatic access
- [ ] Additional language parsers (Go, Rust, Python depth)
- [ ] `mnemos wrap` presets for common dev commands (test, lint, git)
- [ ] Fable discipline delta report in CLI (`mnemos discipline --compare`)

## Not planned (local-first promise)

- Cloud-hosted memory or sync
- Required API keys or telemetry
- Remote code execution from the dashboard

## How to influence the roadmap

Open an issue with `[roadmap]` in the title or comment on [Discussions](https://github.com/bitreonx/mnemos/discussions).
