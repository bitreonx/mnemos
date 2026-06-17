---
name: extract-mindset
description: Mine your own Claude Code conversation logs to extract one model's reasoning discipline and port it to the model you run now. Use when someone wants to capture how a model like Fable 5 or Opus thinks, measure its working habits from real session logs, or turn that into a Mindset.md operating manual another model can adopt. Triggers include "extract the mindset", "study how Fable thinks", "port the discipline", "measure my model's habits", "what made that model good", "build a mindset file from my logs".
---

# Extract Mindset

You cannot clone a model's raw capability. When a model gets suspended or you
switch off it, the weights are gone. But the model left a paper trail in your own
Claude Code logs, and that trail holds something portable. Not the talent, the
DISCIPLINE. How it reasoned before acting. How it re-read results before deciding.
How it grounded before it touched anything. That discipline can be measured from
the logs and written down as an operating manual the model you run now can adopt.

This skill does that end to end. It builds a corpus of one model's turns from your
history, measures its habits against a baseline model so you have evidence and not
vibes, then has the current model read that corpus and write a Mindset.md you point
sessions at. It works for ANY model id on your disk, not just Fable.

The scripts live in `scripts/discipline/` at the Mnemos repo root. The blank
manual to fill in lives in `skills/extract-mindset/references/mindset_template.md`.

---

## Step 0. Ask one thing first, full walkthrough or fast track

Before anything else, ask the person one question and wait.

> "Do you want the full walkthrough where I explain each step as we go, or the
> fast track where I just build the corpus, measure the habits, and hand you the
> Mindset.md."

On fast track, run Steps 2 through 5 back to back with short status lines and skip
the teaching asides. On full walkthrough, pause after each step, show what came
back, and explain it in one or two plain sentences before moving on.

---

## Step 1. Pick the model to study

List every model id on disk:

```bash
grep -rho '"model":"[^"]*"' ~/.claude/projects/ 2>/dev/null \
  | sort | uniq -c | sort -rn | head -20
```

Ask which model to study (TARGET, e.g. `claude-fable-5`) and which baseline
(e.g. `claude-opus-4-8`).

---

## Step 2. Build the corpus

```bash
bash scripts/discipline/extract_model_corpus.sh <target-model-id> > /tmp/<target>_corpus.jsonl
wc -l /tmp/<target>_corpus.jsonl
```

---

## Step 3. Measure the habits

```bash
python3 scripts/discipline/analyze_discipline.py <target-model-id> <baseline-model-id>
```

Save the table for the Mindset appendix.

---

## Step 4. Write the Mindset.md

Use `skills/extract-mindset/references/mindset_template.md` as the shape.
Distill from the corpus — do not invent. Paste the measured table into the appendix.

---

## Step 5. Wire it in

Offer to:
1. Reference the Mindset in `CLAUDE.md` or point Cursor at `.mnemos/integrations/fable-mindset.md`
2. Set effort level to `max` on the adopting model
3. Add a PostToolUse hook on Edit|Write|MultiEdit that runs the project test command

Mnemos users can also run `mnemos setup --platform cursor` to install
`mnemos-discipline.mdc` with Fable-grade habits baked in.
