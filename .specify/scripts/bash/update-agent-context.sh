#!/bin/bash

# update-agent-context.sh <agent>
# Refreshes the agent-specific context file with the active feature's technical
# context. Content between the managed markers is regenerated; anything outside
# them is preserved.

set -e

AGENT="${1:-claude}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

case "$AGENT" in
    claude)  TARGET="${PROJECT_ROOT}/CLAUDE.md" ;;
    cursor)  TARGET="${PROJECT_ROOT}/.cursorrules" ;;
    copilot) TARGET="${PROJECT_ROOT}/.github/copilot-instructions.md" ;;
    *) echo "Error: unknown agent '${AGENT}' (claude|cursor|copilot)" >&2; exit 1 ;;
esac

PATHS_JSON="$("${SCRIPT_DIR}/check-prerequisites.sh" --json --paths-only)"
FEATURE_DIR="$(printf '%s' "$PATHS_JSON" | grep '"FEATURE_DIR"' | sed 's/.*: "//; s/",\{0,1\}$//')"
SLUG="$(printf '%s' "$PATHS_JSON" | grep '"SLUG"' | sed 's/.*: "//; s/",\{0,1\}$//')"
PLAN="${FEATURE_DIR}/plan.md"

if [ ! -f "$PLAN" ]; then
    echo "Error: plan.md not found. Run /speckit.plan first." >&2
    exit 1
fi

BEGIN="<!-- SPECIFY:BEGIN managed -->"
END="<!-- SPECIFY:END managed -->"

# Pull the Technical Context table rows out of plan.md
TECH_TABLE="$(awk '/^## Technical Context/{f=1;next} /^### Unresolved/{f=0} f' "$PLAN" | sed '/^$/d')"

MANAGED="$(cat << EOF
${BEGIN}
<!-- 이 블록은 update-agent-context.sh가 생성합니다. 직접 편집하지 마세요.
     블록 바깥의 내용은 보존됩니다. -->

## 활성 기능

**${SLUG}**

- 명세: \`.specify/features/${SLUG}/spec.md\`
- 계획: \`.specify/features/${SLUG}/plan.md\`
- 데이터 모델: \`.specify/features/${SLUG}/data-model.md\`
- API 계약: \`.specify/features/${SLUG}/contracts/openapi.yaml\`
- LLM 호출 계약: \`.specify/features/${SLUG}/contracts/llm-contract.md\`
- 시작 가이드: \`.specify/features/${SLUG}/quickstart.md\`

## 기술 컨텍스트

${TECH_TABLE}

${END}
EOF
)"

if [ -f "$TARGET" ] && grep -qF "$BEGIN" "$TARGET"; then
    # Replace the existing managed block, preserving everything around it.
    # The new block arrives on stdin so it never has to survive shell quoting.
    printf '%s' "$MANAGED" | python3 -c '
import sys
path, begin, end = sys.argv[1], sys.argv[2], sys.argv[3]
managed = sys.stdin.read().rstrip("\n")
text = open(path, encoding="utf-8").read()
head, _, rest = text.partition(begin)
_, _, tail = rest.partition(end)
open(path, "w", encoding="utf-8").write(head + managed + tail)
' "$TARGET" "$BEGIN" "$END"
    echo "Updated managed block in ${TARGET}"
else
    mkdir -p "$(dirname "$TARGET")"
    { [ -f "$TARGET" ] && cat "$TARGET" && echo; printf '%s\n' "$MANAGED"; } > "${TARGET}.tmp"
    mv "${TARGET}.tmp" "$TARGET"
    echo "Created managed block in ${TARGET}"
fi
