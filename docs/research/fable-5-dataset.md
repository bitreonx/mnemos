# The Open Fable 5 Dataset, and How to Compare It Against Your Own Opus 4.8

You never needed Fable access to study how it worked. Someone published real Fable
5 Claude Code traces as a public dataset. Mnemos ships a tool that profiles that
public Fable behaviour, then profiles your own local Opus 4.8 sessions the exact
same way, so you can read the behavioural gap with your own eyes.

## The dataset

Link: https://huggingface.co/datasets/Glint-Research/Fable-5-traces

What it is: 4,665 public Fable 5 Claude Code traces, captured as per-event rows
with reasoning and tool calls intact (~69.8 MB JSON/Parquet). It is the Fable
half of the comparison. There is no Opus data inside it — you bring the Opus half
from your own machine.

License: AGPL-3.0. We link and read locally; we do not bundle or redistribute the data.

## Quick start (Mnemos)

```bash
# Profile Fable from the public dataset
python3 scripts/discipline/fable_dataset_delta.py

# Smoke test without downloading the full dataset
python3 scripts/discipline/fable_dataset_delta.py --sample 400

# Add your local Opus 4.8 side and read the gap
python3 scripts/discipline/fable_dataset_delta.py --opus
```

## Measure your own model habits

```bash
python3 scripts/discipline/analyze_discipline.py claude-fable-5 claude-opus-4-8
```

## Install discipline rules in your repo

Mnemos embeds Fable-grade agent habits into generated AI integrations:

```bash
npx mnemos .
mnemos setup --platform cursor   # installs mnemos-discipline.mdc + architecture rule
```

Full operating manual: `.mnemos/integrations/fable-mindset.md`

## Extract a custom mindset from your logs

Use the `skills/extract-mindset` skill (or ask Cursor to "extract the mindset")
to mine your own Claude Code history and write a `Mindset.md` for any model.

## Schema (dataset rows)

| Field | Description |
|---|---|
| `uid` | Event id `<session>#<n>` — sort by `n` for execution order |
| `session` | Session id for grouping |
| `model` | Always `claude-fable-5` |
| `cot` | Chain-of-thought — non-empty means the event reasoned |
| `output_type` | `text` or `tool_use` |
| `output` | JSON `{tool, input}` for tool_use, `{text}` for text |

## What Mnemos adds for weaker models

The Fable 5 traces show where discipline gaps hurt quality most:

| Habit | Fable | Typical baseline | What to enforce |
|---|---|---|---|
| Reason before acting | ~86% | ~39% | Effort level + standing rules |
| Re-evaluate after results | ~87% | ~39% | Cursor rule / AGENTS.md loop |
| Read before edit | ~88% | varies | Always read exact region first |
| Real test after edit | ~65% | varies | PostToolUse hook on Edit/Write |

Mnemos `mnemos setup` writes these rules into `.cursor/rules/mnemos-discipline.mdc`,
`AGENTS.md`, and platform skills so Opus 4.8 (and other models) adopt Fable-grade
habits without switching models.
