#!/bin/bash

# check-prerequisites.sh
# Resolves the active feature's paths and reports which artifacts exist

set -e

JSON_OUTPUT=false
PATHS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --paths-only)
            PATHS_ONLY=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FEATURES_ROOT="${PROJECT_ROOT}/.specify/features"

if [ ! -d "$FEATURES_ROOT" ]; then
    echo "Error: no feature directory found. Run /speckit.specify first." >&2
    exit 1
fi

# Resolve the active feature: prefer a branch named feature/<slug>, else the
# most recently modified feature directory.
FEATURE_DIR=""
BRANCH=""
if git -C "$PROJECT_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    case "$BRANCH" in
        feature/*)
            CANDIDATE="${FEATURES_ROOT}/${BRANCH#feature/}"
            [ -d "$CANDIDATE" ] && FEATURE_DIR="$CANDIDATE"
            ;;
    esac
fi

if [ -z "$FEATURE_DIR" ]; then
    FEATURE_DIR="$(ls -dt "${FEATURES_ROOT}"/*/ 2>/dev/null | head -1)"
    FEATURE_DIR="${FEATURE_DIR%/}"
fi

if [ -z "$FEATURE_DIR" ] || [ ! -d "$FEATURE_DIR" ]; then
    echo "Error: no feature directory found. Run /speckit.specify first." >&2
    exit 1
fi

SLUG="$(basename "$FEATURE_DIR")"
FEATURE_SPEC="${FEATURE_DIR}/spec.md"
IMPL_PLAN="${FEATURE_DIR}/plan.md"
TASKS="${FEATURE_DIR}/tasks.md"
CHECKLIST_DIR="${FEATURE_DIR}/checklists"

exists() { [ -f "$1" ] && echo true || echo false; }

if [ "$JSON_OUTPUT" = true ]; then
    if [ "$PATHS_ONLY" = true ]; then
        cat << EOF
{
  "FEATURE_DIR": "${FEATURE_DIR}",
  "FEATURE_SPEC": "${FEATURE_SPEC}",
  "IMPL_PLAN": "${IMPL_PLAN}",
  "TASKS": "${TASKS}",
  "CHECKLIST_DIR": "${CHECKLIST_DIR}",
  "SLUG": "${SLUG}",
  "BRANCH": "${BRANCH}"
}
EOF
    else
        cat << EOF
{
  "FEATURE_DIR": "${FEATURE_DIR}",
  "FEATURE_SPEC": "${FEATURE_SPEC}",
  "IMPL_PLAN": "${IMPL_PLAN}",
  "TASKS": "${TASKS}",
  "CHECKLIST_DIR": "${CHECKLIST_DIR}",
  "SLUG": "${SLUG}",
  "BRANCH": "${BRANCH}",
  "HAS_SPEC": $(exists "$FEATURE_SPEC"),
  "HAS_PLAN": $(exists "$IMPL_PLAN"),
  "HAS_TASKS": $(exists "$TASKS")
}
EOF
    fi
else
    echo "Feature dir: ${FEATURE_DIR}"
    echo "Spec:        ${FEATURE_SPEC} (exists: $(exists "$FEATURE_SPEC"))"
    echo "Plan:        ${IMPL_PLAN} (exists: $(exists "$IMPL_PLAN"))"
    echo "Tasks:       ${TASKS} (exists: $(exists "$TASKS"))"
fi
