#!/bin/bash
# extract_model_corpus.sh - pull every reasoning turn from ONE model out of Claude Code history.
#
# Usage:
#   bash scripts/discipline/extract_model_corpus.sh claude-fable-5   > fable_reasoning.jsonl
#   bash scripts/discipline/extract_model_corpus.sh claude-opus-4-8  > opus_reasoning.jsonl

set -euo pipefail
MODEL="${1:?usage: ./extract_model_corpus.sh <model-id>}"
HERE="$(cd "$(dirname "$0")" && pwd)"

grep -rl "\"model\":\"$MODEL\"" ~/.claude/projects/ 2>/dev/null | while read -r f; do
  python3 "$HERE/debloat_jsonl.py" "$f"
done | python3 -c "
import sys, json
M = '$MODEL'
for line in sys.stdin:
    o = json.loads(line)
    if o.get('role') == 'assistant' and o.get('model') == M:
        print(json.dumps(o, ensure_ascii=False))
"
