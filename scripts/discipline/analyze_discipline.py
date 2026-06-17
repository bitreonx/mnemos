#!/usr/bin/env python3
"""
analyze_discipline.py - measure one model's working discipline, side by side.

Usage:
    python3 scripts/discipline/analyze_discipline.py <target-model-id> <baseline-model-id>
    python3 scripts/discipline/analyze_discipline.py claude-fable-5 claude-opus-4-8
"""
import json
import os
import subprocess
import sys
import re

PROJECTS = os.path.expanduser("~/.claude/projects")

REAL_TEST_RE = re.compile(
    r"\b(test|build|lint|pytest|jest|vitest|tsc)\b"
    r"|npm (run )?test"
    r"|go test"
    r"|cargo (test|build)",
    re.IGNORECASE,
)

EDIT_TOOLS = {"Edit", "Write", "MultiEdit"}


def sessions_with_model(model):
    try:
        out = subprocess.run(
            ["grep", "-rl", f'"model":"{model}"', PROJECTS],
            capture_output=True, text=True, check=False,
        ).stdout
    except FileNotFoundError:
        return []
    return [p for p in out.splitlines() if p.strip()]


def iter_records(path):
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def record_kind(obj):
    t = obj.get("type")
    if t == "assistant":
        msg = obj.get("message", {})
        return ("assistant", msg.get("model"), msg.get("content", []) or [])
    if t == "user":
        if obj.get("toolUseResult") is not None:
            return ("tool_result", _result_is_error(obj), None)
        c = obj.get("message", {}).get("content")
        if isinstance(c, list) and any(
            isinstance(b, dict) and b.get("type") == "tool_result" for b in c
        ):
            return ("tool_result", _result_is_error(obj), None)
        return ("user", None, None)
    return ("other", None, None)


def _result_is_error(obj):
    c = obj.get("message", {}).get("content")
    if isinstance(c, list):
        for b in c:
            if isinstance(b, dict) and b.get("type") == "tool_result":
                if b.get("is_error"):
                    return True
    return False


class Counter:
    def __init__(self):
        self.turns = 0
        self.turns_with_reasoning = 0
        self.reason_before_action = 0
        self.turns_with_action = 0
        self.reeval_opportunities = 0
        self.reeval_did = 0
        self.tool_results = 0
        self.tool_errors = 0
        self.sessions = 0
        self.sessions_read_before_edit = 0
        self.sessions_with_edit = 0
        self.sessions_check_after_edit = 0
        self.sessions_test_after_edit = 0


def analyze_session(path, target, counters):
    c = counters
    c.sessions += 1

    beats = []
    cur = None
    boundary = "user"
    uuid_to_beat = {}

    saw_edit = False
    read_before_first_edit = False
    seen_read_yet = False
    check_after_edit = False
    test_after_edit = False

    for obj in iter_records(path):
        t = obj.get("type")

        if t == "assistant" and obj.get("message", {}).get("model") == target:
            blocks = []
            for b in obj.get("message", {}).get("content", []):
                if isinstance(b, dict) and b.get("type") in ("thinking", "text", "tool_use"):
                    blocks.append((b.get("type"), b.get("name")))
            leads_with_reasoning = bool(blocks) and blocks[0][0] in ("thinking", "text")

            if cur is None or (leads_with_reasoning and boundary in ("user", "result")):
                cur = {"blocks": [], "followed_result": (boundary == "result")}
                beats.append(cur)
            cur_idx = len(beats) - 1
            uuid_to_beat[obj.get("uuid")] = cur_idx
            cur["blocks"].extend(blocks)
            boundary = None

            for kind, name in blocks:
                if kind != "tool_use":
                    continue
                if name == "Read":
                    seen_read_yet = True
                elif name in EDIT_TOOLS:
                    if not saw_edit:
                        read_before_first_edit = seen_read_yet
                    saw_edit = True
                elif name == "Bash":
                    cmd = ""
                    for b in obj.get("message", {}).get("content", []):
                        if (isinstance(b, dict) and b.get("type") == "tool_use"
                                and b.get("name") == "Bash"):
                            cmd = (b.get("input", {}) or {}).get("command", "") or ""
                            break
                    if saw_edit:
                        check_after_edit = True
                        if REAL_TEST_RE.search(cmd):
                            test_after_edit = True
            continue

        kind, is_err, _ = record_kind(obj)
        if kind == "tool_result":
            owner = uuid_to_beat.get(obj.get("parentUuid"))
            if owner is not None:
                beats[owner].setdefault("results", 0)
                beats[owner]["results"] += 1
                if is_err:
                    beats[owner].setdefault("errors", 0)
                    beats[owner]["errors"] += 1
            boundary = "result"
        elif kind == "user":
            boundary = "user"
            cur = None

    if saw_edit:
        c.sessions_with_edit += 1
        if read_before_first_edit:
            c.sessions_read_before_edit += 1
        if check_after_edit:
            c.sessions_check_after_edit += 1
        if test_after_edit:
            c.sessions_test_after_edit += 1

    for beat in beats:
        kinds = [k for k, _ in beat["blocks"]]
        has_think = "thinking" in kinds
        c.turns += 1
        if has_think:
            c.turns_with_reasoning += 1

        if "tool_use" in kinds:
            c.turns_with_action += 1
            first_tool_idx = kinds.index("tool_use")
            if has_think and kinds.index("thinking") < first_tool_idx:
                c.reason_before_action += 1

        if beat.get("followed_result"):
            c.reeval_opportunities += 1
            if has_think:
                c.reeval_did += 1

        c.tool_results += beat.get("results", 0)
        c.tool_errors += beat.get("errors", 0)


def pct(num, den):
    return (100.0 * num / den) if den else 0.0


def analyze(model):
    c = Counter()
    files = sessions_with_model(model)
    for f in files:
        analyze_session(f, model, c)
    return c, len(files)


def fmt(p):
    return f"{p:.0f}%"


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: python3 analyze_discipline.py <target-model> <baseline-model>")
    target, baseline = sys.argv[1], sys.argv[2]

    tc, tf = analyze(target)
    bc, bf = analyze(baseline)

    def row(label, tnum, tden, bnum, bden, note):
        return (f"| {label} | {fmt(pct(tnum, tden))} | "
                f"{fmt(pct(bnum, bden))} | {note} |")

    print(f"# Discipline · {target} vs {baseline}\n")
    print(f"Target  {target}: {tc.turns} beats across {tf} sessions")
    print(f"Baseline {baseline}: {bc.turns} beats across {bf} sessions")
    print("Measured over all matching sessions on disk. Rates shift with the "
          "window you scan, so compare the two columns, not the absolutes.\n")
    print(f"| Habit | {target} | {baseline} | Note |")
    print("|---|---|---|---|")
    print(row("turns containing reasoning",
              tc.turns_with_reasoning, tc.turns,
              bc.turns_with_reasoning, bc.turns,
              "reason on nearly every turn"))
    print(row("reasons before the first action",
              tc.reason_before_action, tc.turns_with_action,
              bc.reason_before_action, bc.turns_with_action,
              "plan precedes action"))
    print(row("re-evaluates after a result",
              tc.reeval_did, tc.reeval_opportunities,
              bc.reeval_did, bc.reeval_opportunities,
              "the observe then decide loop"))
    print(row("reads the file before editing",
              tc.sessions_read_before_edit, tc.sessions_with_edit,
              bc.sessions_read_before_edit, bc.sessions_with_edit,
              "fresh read prevents stale edits"))
    print(row("runs a check after editing",
              tc.sessions_check_after_edit, tc.sessions_with_edit,
              bc.sessions_check_after_edit, bc.sessions_with_edit,
              "do something every time"))
    print(row("runs the real test after editing",
              tc.sessions_test_after_edit, tc.sessions_with_edit,
              bc.sessions_test_after_edit, bc.sessions_with_edit,
              "the shared blind spot, fix it"))
    te_t = pct(tc.tool_errors, tc.tool_results)
    te_b = pct(bc.tool_errors, bc.tool_results)
    print(f"| tool error rate | {te_t:.1f}% | {te_b:.1f}% | low, recovery is methodical |")


if __name__ == "__main__":
    main()
