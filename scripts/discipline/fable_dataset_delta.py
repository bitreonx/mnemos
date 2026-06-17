#!/usr/bin/env python3
"""
fable_dataset_delta.py - profile Fable 5 public traces and compare to local Opus logs.

Dataset: https://huggingface.co/datasets/Glint-Research/Fable-5-traces
License: AGPL-3.0 (link only; we do not redistribute the data)

Usage:
    python3 scripts/discipline/fable_dataset_delta.py
    python3 scripts/discipline/fable_dataset_delta.py --sample 400
    python3 scripts/discipline/fable_dataset_delta.py --opus
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from typing import Any, Iterator

DATASET_ID = "Glint-Research/Fable-5-traces"
FABLE_MODEL = "claude-fable-5"
OPUS_MODEL = "claude-opus-4-8"
EDIT_TOOLS = {"Edit", "Write", "MultiEdit"}
REAL_TEST_RE = re.compile(
    r"\b(test|build|lint|pytest|jest|vitest|tsc)\b"
    r"|npm (run )?test"
    r"|go test"
    r"|cargo (test|build)",
    re.IGNORECASE,
)


def pct(num: int, den: int) -> float:
    return (100.0 * num / den) if den else 0.0


def fmt(p: float) -> str:
    return f"{p:.0f}%"


def event_index(uid: str) -> int:
    if "#" not in uid:
        return 0
    try:
        return int(uid.rsplit("#", 1)[-1])
    except ValueError:
        return 0


def parse_output(row: dict[str, Any]) -> dict[str, Any]:
    raw = row.get("output")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return {}


def tool_name(row: dict[str, Any]) -> str | None:
    if row.get("output_type") != "tool_use":
        return None
    out = parse_output(row)
    return out.get("tool") or out.get("name")


def bash_command(row: dict[str, Any]) -> str:
    if tool_name(row) != "Bash":
        return ""
    out = parse_output(row)
    inp = out.get("input") or {}
    if isinstance(inp, dict):
        return str(inp.get("command") or "")
    return ""


def load_fable_rows(sample: int | None = None) -> tuple[list[dict[str, Any]], str]:
    rows: list[dict[str, Any]] = []
    source = ""

    try:
        from datasets import load_dataset  # type: ignore

        ds = load_dataset(DATASET_ID, split="train", streaming=bool(sample))
        it: Iterator[dict[str, Any]] = iter(ds)
        if sample:
            for _ in range(sample):
                rows.append(next(it))
        else:
            rows = list(ds)
        source = "datasets library"
        return rows, source
    except Exception:
        pass

    try:
        import subprocess as sp

        sp.check_call(
            [sys.executable, "-m", "pip", "install", "-q", "datasets", "pyarrow", "huggingface_hub"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        from datasets import load_dataset  # type: ignore

        ds = load_dataset(DATASET_ID, split="train", streaming=bool(sample))
        it = iter(ds)
        if sample:
            for _ in range(sample):
                rows.append(next(it))
        else:
            rows = list(ds)
        source = "datasets library (auto-installed)"
        return rows, source
    except Exception:
        pass

    try:
        import pandas as pd  # type: ignore
        from huggingface_hub import hf_hub_download  # type: ignore

        path = hf_hub_download(DATASET_ID, "train-00000-of-00001.parquet", repo_type="dataset")
        df = pd.read_parquet(path)
        if sample:
            df = df.head(sample)
        rows = df.to_dict(orient="records")
        return rows, "parquet via huggingface_hub"
    except Exception as exc:
        sys.exit(f"Could not load dataset. Install datasets or huggingface_hub+pandas. ({exc})")


def profile_fable_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_session[str(row.get("session") or "unknown")].append(row)

    total_events = len(rows)
    tool_events = sum(1 for r in rows if r.get("output_type") == "tool_use")
    text_events = sum(1 for r in rows if r.get("output_type") == "text")
    reasoned = sum(1 for r in rows if str(r.get("cot") or "").strip())

    tool_mix: Counter[str] = Counter()
    for r in rows:
        name = tool_name(r)
        if name:
            tool_mix[name] += 1

    sessions_with_edit = 0
    sessions_read_before_edit = 0
    sessions_check_after_edit = 0
    sessions_test_after_edit = 0
    tool_calls_per_session: list[int] = []

    for _sid, events in by_session.items():
        events.sort(key=lambda r: event_index(str(r.get("uid") or "")))
        tool_calls = sum(1 for e in events if e.get("output_type") == "tool_use")
        tool_calls_per_session.append(tool_calls)

        saw_edit = False
        seen_read = False
        read_before_first_edit = False
        check_after_edit = False
        test_after_edit = False

        for e in events:
            if e.get("output_type") != "tool_use":
                continue
            name = tool_name(e)
            if name == "Read":
                seen_read = True
            elif name in EDIT_TOOLS:
                if not saw_edit:
                    read_before_first_edit = seen_read
                saw_edit = True
            elif name == "Bash" and saw_edit:
                check_after_edit = True
                if REAL_TEST_RE.search(bash_command(e)):
                    test_after_edit = True

        if saw_edit:
            sessions_with_edit += 1
            if read_before_first_edit:
                sessions_read_before_edit += 1
            if check_after_edit:
                sessions_check_after_edit += 1
            if test_after_edit:
                sessions_test_after_edit += 1

    avg_tools = (
        sum(tool_calls_per_session) / len(tool_calls_per_session)
        if tool_calls_per_session
        else 0.0
    )

    return {
        "events": total_events,
        "sessions": len(by_session),
        "tool_share": pct(tool_events, total_events),
        "text_share": pct(text_events, total_events),
        "reasoning_share": pct(reasoned, total_events),
        "avg_tool_calls_per_session": avg_tools,
        "tool_mix": tool_mix,
        "read_before_edit": pct(sessions_read_before_edit, sessions_with_edit),
        "check_after_edit": pct(sessions_check_after_edit, sessions_with_edit),
        "test_after_edit": pct(sessions_test_after_edit, sessions_with_edit),
        "sessions_with_edit": sessions_with_edit,
    }


def load_opus_profile() -> dict[str, float] | None:
    here = os.path.dirname(os.path.abspath(__file__))
    analyzer = os.path.join(here, "analyze_discipline.py")
    if not os.path.isfile(analyzer):
        return None
    try:
        out = subprocess.run(
            [sys.executable, analyzer, FABLE_MODEL, OPUS_MODEL],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    if out.returncode != 0 or "|" not in out.stdout:
        return None

    metrics: dict[str, float] = {}
    for line in out.stdout.splitlines():
        if not line.startswith("|") or "---" in line or "Habit" in line:
            continue
        parts = [p.strip() for p in line.strip("|").split("|")]
        if len(parts) < 3:
            continue
        label, _target, baseline = parts[0], parts[1], parts[2]
        val = baseline.rstrip("%")
        try:
            metrics[label] = float(val)
        except ValueError:
            continue
    return metrics or None


def print_fable_profile(profile: dict[str, Any], source: str) -> None:
    print(f"# Fable 5 behavioural profile\n")
    print(f"Loaded {profile['events']} events across {profile['sessions']} sessions via {source}.\n")
    print("| Metric | Value |")
    print("|---|---|")
    print(f"| tool_use events | {fmt(profile['tool_share'])} |")
    print(f"| text events | {fmt(profile['text_share'])} |")
    print(f"| events with reasoning (cot) | {fmt(profile['reasoning_share'])} |")
    print(f"| avg tool calls / session | {profile['avg_tool_calls_per_session']:.1f} |")
    print(f"| reads before first edit | {fmt(profile['read_before_edit'])} |")
    print(f"| runs a check after editing | {fmt(profile['check_after_edit'])} |")
    print(f"| runs real test after editing | {fmt(profile['test_after_edit'])} |")

    print("\n## Tool mix (top 10)\n")
    print("| Tool | Count |")
    print("|---|---|")
    for name, count in profile["tool_mix"].most_common(10):
        print(f"| {name} | {count} |")


def print_delta(profile: dict[str, Any], opus: dict[str, float]) -> None:
    print("\n# Fable vs local Opus 4.8 delta\n")
    print("Compare columns — samples differ in size and task mix.\n")
    print("| Habit | Fable (dataset) | Opus (local logs) | Delta |")
    print("|---|---|---|---|")

    pairs = [
        ("events with reasoning", profile["reasoning_share"], opus.get("turns containing reasoning")),
        ("reads before first edit", profile["read_before_edit"], opus.get("reads the file before editing")),
        ("runs a check after editing", profile["check_after_edit"], opus.get("runs a check after editing")),
        ("runs real test after editing", profile["test_after_edit"], opus.get("runs the real test after editing")),
    ]
    for label, fable_val, opus_val in pairs:
        if opus_val is None:
            continue
        delta = fable_val - opus_val
        sign = "+" if delta >= 0 else ""
        print(f"| {label} | {fmt(fable_val)} | {fmt(opus_val)} | {sign}{delta:.0f}pp |")

    if opus.get("reasons before the first action") is not None:
        print(
            f"\nOpus local-only signals: reason-before-action {fmt(opus['reasons before the first action'])}, "
            f"re-evaluate-after-result {fmt(opus.get('re-evaluates after a result', 0))}."
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile Fable 5 dataset and compare to local Opus logs")
    parser.add_argument("--sample", type=int, default=None, help="Stream only N events (smoke test)")
    parser.add_argument("--opus", action="store_true", help="Also scan local claude-opus-4-8 sessions")
    args = parser.parse_args()

    rows, source = load_fable_rows(args.sample)
    profile = profile_fable_rows(rows)
    print_fable_profile(profile, source)

    if args.opus:
        opus = load_opus_profile()
        if opus:
            print_delta(profile, opus)
        else:
            print(
                f"\nNo local {OPUS_MODEL} sessions found (or analyze_discipline.py unavailable). "
                f"Run some Claude Code work on Opus 4.8, then rerun with --opus."
            )


if __name__ == "__main__":
    main()
