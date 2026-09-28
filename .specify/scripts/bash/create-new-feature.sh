#!/bin/bash

# create-new-feature.sh
# Creates a new feature branch and initializes spec file

set -e

# Parse arguments
JSON_OUTPUT=false
FEATURE_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --json)
            JSON_OUTPUT=true
            shift
            FEATURE_NAME="$1"
            shift
            ;;
        *)
            FEATURE_NAME="$1"
            shift
            ;;
    esac
done

if [ -z "$FEATURE_NAME" ]; then
    echo "Error: Feature name is required"
    exit 1
fi

# Generate slug from feature name
# Convert to lowercase, replace spaces with hyphens, remove special characters
SLUG=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9가-힣]/-/g' | sed 's/-\+/-/g' | sed 's/^-//' | sed 's/-$//')

# Limit slug length
SLUG=$(echo "$SLUG" | cut -c1-50)

# Generate branch name
BRANCH_NAME="feature/${SLUG}"

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Create feature directory
FEATURE_DIR="${PROJECT_ROOT}/.specify/features/${SLUG}"
mkdir -p "${FEATURE_DIR}/checklists"

# Spec file path
SPEC_FILE="${FEATURE_DIR}/spec.md"

# Initialize spec file from template
TEMPLATE_FILE="${PROJECT_ROOT}/.specify/templates/spec-template.md"
if [ -f "$TEMPLATE_FILE" ]; then
    cp "$TEMPLATE_FILE" "$SPEC_FILE"
else
    # Create minimal spec file if template doesn't exist
    cat > "$SPEC_FILE" << 'EOF'
# Feature Specification: [FEATURE NAME]

**Status**: Draft
**Version**: 1.0
**Created**: [DATE]
**Last Updated**: [DATE]

## Overview

### Problem Statement
[What problem does this feature solve?]

### Target Users
[Who will use this feature?]

### Business Value
[What value does this deliver?]

## Functional Requirements

## User Scenarios & Testing

## Success Criteria

## Assumptions

## Risks & Mitigations
EOF
fi

# Output result
if [ "$JSON_OUTPUT" = true ]; then
    cat << EOF
{
  "BRANCH_NAME": "${BRANCH_NAME}",
  "SPEC_FILE": "${SPEC_FILE}",
  "FEATURE_DIR": "${FEATURE_DIR}",
  "SLUG": "${SLUG}",
  "FEATURE_NAME": "${FEATURE_NAME}"
}
EOF
else
    echo "Created feature: ${FEATURE_NAME}"
    echo "Branch: ${BRANCH_NAME}"
    echo "Spec file: ${SPEC_FILE}"
fi
