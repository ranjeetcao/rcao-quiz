#!/usr/bin/env bash
# AGT-04 lane-shared: typecheck staged TS/TSX in apps/mobile, packages/sdk, scripts.
# Both .husky/pre-commit (humans) and .claude/settings.json PreToolUse (agents)
# shell out to this same file — single source of truth.

set -euo pipefail

# Find repo root so the hook works from any cwd (worktrees, subdirs).
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Staged files added/copied/modified. -z would be safer for spaces, but our
# tree has no spaced paths and the regex below assumes newline separation.
STAGED="$(git diff --cached --name-only --diff-filter=ACM)"

if [ -z "$STAGED" ]; then
  exit 0
fi

# Match TS/TSX under the three workspace dirs we typecheck.
if echo "$STAGED" | grep -qE '^(apps/mobile|packages/sdk|scripts)/.*\.(ts|tsx)$'; then
  echo "[pre-commit-typecheck] staged TS/TSX detected; running pnpm -r typecheck"
  pnpm -r typecheck
else
  # No relevant files staged — no-op so commits with only docs/JSON are fast.
  exit 0
fi
