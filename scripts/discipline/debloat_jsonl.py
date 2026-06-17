#!/usr/bin/env python3
"""
debloat_jsonl.py - strip a Claude Code transcript down to its reasoning trace.

Usage:
    python3 scripts/discipline/debloat_jsonl.py session.jsonl > slim.jsonl
"""
import json
import sys

KEEP_TYPES = {"user", "assistant"}


def is_tool_result_user(obj):
    if obj.get("toolUseResult") is not None:
        return True
    c = obj.get("message", {}).get("content")
    if isinstance(c, list):
        return any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c)
    return False


def slim(obj):
    t = obj.get("type")
    if t not in KEEP_TYPES:
        return None
    msg = obj.get("message", {})
    if t == "user":
        if is_tool_result_user(obj):
            return None
        c = msg.get("content")
        text = c if isinstance(c, str) else " ".join(
            b.get("text", "") for b in c
            if isinstance(b, dict) and b.get("type") == "text")
        text = (text or "").strip()
        if not text:
            return None
        return {"role": "user", "ts": obj.get("timestamp"), "text": text}
    blocks = []
    for b in msg.get("content", []):
        if not isinstance(b, dict):
            continue
        if b.get("type") == "thinking":
            blocks.append({"thinking": b.get("thinking", "")})
        elif b.get("type") == "text":
            blocks.append({"text": b.get("text", "")})
        elif b.get("type") == "tool_use":
            blocks.append({"tool": b.get("name")})
    if not blocks:
        return None
    return {"role": "assistant", "model": msg.get("model"),
            "ts": obj.get("timestamp"), "blocks": blocks}


def main(path):
    turn = 0
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            s = slim(obj)
            if s is None:
                continue
            s["turn"] = turn
            turn += 1
            print(json.dumps(s, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 debloat_jsonl.py <session.jsonl> > slim.jsonl")
    main(sys.argv[1])
