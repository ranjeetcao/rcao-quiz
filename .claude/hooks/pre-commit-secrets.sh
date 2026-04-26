#!/usr/bin/env bash
# AGT-04 lane-shared: scan staged-added lines for credential patterns.
# Both .husky/pre-commit (humans) and .claude/settings.json PreToolUse (agents)
# shell out to this same file — single source of truth.
#
# Patterns are written from scratch (no inherited test JWT). They cover the
# six credential shapes most likely to slip into a commit by hand or by a
# careless paste from a vendor dashboard.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Files we deliberately skip: the entire .claude/hooks/ subtree. The regex
# literals live in this script (a naive scan would self-block), the README
# documents the patterns, and any future fixtures or test files in this
# directory should also be exempt by design.
SKIP_RE='^\.claude/hooks/'

# Build the diff body restricted to non-skip files. -U0 emits no context
# lines; --diff-filter=ACM drops deletions/renames-without-content.
STAGED_FILES="$(git diff --cached --name-only --diff-filter=ACM | grep -vE "$SKIP_RE" || true)"

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Pull just the added lines (start with '+', not '+++') and strip the leading
# '+' so patterns don't have to anchor on it.
ADDED="$(git diff --cached --diff-filter=ACM -U0 -- $STAGED_FILES \
  | grep -E '^\+' \
  | grep -Ev '^\+\+\+' \
  | sed 's/^+//' || true)"

if [ -z "$ADDED" ]; then
  exit 0
fi

# Pattern table — name + extended-regex. We report all matches in one
# pass so a single commit doesn't need six round-trips to clean, then
# exit non-zero if any pattern hit.
PATTERNS=(
  "anthropic_api_key|sk-ant-api03-[A-Za-z0-9_-]{20,}"
  "openai_style_key|sk-[A-Za-z0-9]{32,}"
  "aws_access_key|AKIA[0-9A-Z]{16}"
  "github_pat|ghp_[A-Za-z0-9]{36}"
  "jwt|eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"
  "mongodb_conn_with_creds|mongodb(\+srv)?://[^/[:space:]]*:[^@[:space:]]*@"
)

HIT=0
for entry in "${PATTERNS[@]}"; do
  NAME="${entry%%|*}"
  RE="${entry#*|}"
  if echo "$ADDED" | grep -qE "$RE"; then
    HIT=1
    echo "[pre-commit-secrets] BLOCKED: pattern '$NAME' matched in staged added lines."
    # Print the file(s) where the pattern lives — re-scan per-file so we can
    # name them. -I skips binaries; we already filtered to staged files.
    for f in $STAGED_FILES; do
      if git diff --cached --diff-filter=ACM -U0 -- "$f" \
        | grep -E '^\+' | grep -Ev '^\+\+\+' | sed 's/^+//' \
        | grep -qE "$RE"; then
        echo "  - $f"
      fi
    done
  fi
done

if [ "$HIT" -ne 0 ]; then
  echo
  echo "[pre-commit-secrets] If this is a false positive, redact and commit."
  echo "[pre-commit-secrets] Bypass policy: '--no-verify' requires the reason in the commit body (see AGENTS.md)."
  exit 1
fi

exit 0
