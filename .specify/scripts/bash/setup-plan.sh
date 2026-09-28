#!/bin/bash

# setup-plan.sh
# Resolves the active feature's paths and initializes plan.md from the template

set -e

JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --json) JSON_OUTPUT=true; shift ;;
        *) shift ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Reuse the prerequisite resolver so plan/tasks/analyze all agree on the active feature
PATHS_JSON="$("${SCRIPT_DIR}/check-prerequisites.sh" --json --paths-only)"

extract() { printf '%s' "$PATHS_JSON" | sed -n "s/.*\"$1\": \"\([^\"]*\)\".*/\1/p"; }

FEATURE_DIR="$(printf '%s' "$PATHS_JSON" | grep '"FEATURE_DIR"' | sed 's/.*: "//; s/",\{0,1\}$//')"
FEATURE_SPEC="$(printf '%s' "$PATHS_JSON" | grep '"FEATURE_SPEC"' | sed 's/.*: "//; s/",\{0,1\}$//')"
IMPL_PLAN="$(printf '%s' "$PATHS_JSON" | grep '"IMPL_PLAN"' | sed 's/.*: "//; s/",\{0,1\}$//')"
TASKS="$(printf '%s' "$PATHS_JSON" | grep '"TASKS"' | sed 's/.*: "//; s/",\{0,1\}$//')"
SLUG="$(printf '%s' "$PATHS_JSON" | grep '"SLUG"' | sed 's/.*: "//; s/",\{0,1\}$//')"
BRANCH="$(printf '%s' "$PATHS_JSON" | grep '"BRANCH"' | sed 's/.*: "//; s/",\{0,1\}$//')"

if [ ! -f "$FEATURE_SPEC" ]; then
    echo "Error: spec.md not found at ${FEATURE_SPEC}. Run /speckit.specify first." >&2
    exit 1
fi

SPECS_DIR="${PROJECT_ROOT}/.specify/features"
CONSTITUTION="${PROJECT_ROOT}/.specify/memory/constitution.md"
TEMPLATE_FILE="${PROJECT_ROOT}/.specify/templates/plan-template.md"

# Initialize plan.md from the template only if it does not already exist —
# never clobber an existing plan.
PLAN_CREATED=false
if [ ! -f "$IMPL_PLAN" ]; then
    if [ -f "$TEMPLATE_FILE" ]; then
        cp "$TEMPLATE_FILE" "$IMPL_PLAN"
    else
        printf '# Implementation Plan\n\n' > "$IMPL_PLAN"
    fi
    PLAN_CREATED=true
fi

exists() { [ -f "$1" ] && echo true || echo false; }

if [ "$JSON_OUTPUT" = true ]; then
    cat << EOF
{
  "FEATURE_DIR": "${FEATURE_DIR}",
  "FEATURE_SPEC": "${FEATURE_SPEC}",
  "IMPL_PLAN": "${IMPL_PLAN}",
  "TASKS": "${TASKS}",
  "SPECS_DIR": "${SPECS_DIR}",
  "CONSTITUTION": "${CONSTITUTION}",
  "SLUG": "${SLUG}",
  "BRANCH": "${BRANCH}",
  "PLAN_CREATED": ${PLAN_CREATED},
  "HAS_CONSTITUTION": $(exists "$CONSTITUTION")
}
EOF
else
    echo "Feature dir: ${FEATURE_DIR}"
    echo "Spec:        ${FEATURE_SPEC}"
    echo "Plan:        ${IMPL_PLAN} (created: ${PLAN_CREATED})"
    echo "Constitution:${CONSTITUTION} (exists: $(exists "$CONSTITUTION"))"
fi
