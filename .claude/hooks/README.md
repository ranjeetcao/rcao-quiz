# `.claude/hooks/`

Pre-commit checks for `rcao-quiz`. **Dual-lane** — both lanes call the same
two scripts in this directory; the scripts are the single source of truth.

## The two scripts

- **`pre-commit-typecheck.sh`** — if any staged file matches
  `^(apps/mobile|packages/sdk|scripts)/.*\.(ts|tsx)$`, runs `pnpm -r
  typecheck`. Otherwise no-op. Exits non-zero on type error.
- **`pre-commit-secrets.sh`** — scans staged-added diff lines for
  Anthropic / OpenAI-style / AWS / GitHub PAT / JWT / MongoDB-connection
  credential shapes. Exits non-zero on any match and names the offending
  file(s). The hook's own files are skipped so the regex literals don't
  self-block.

## Lane 1 — humans (husky)

`.husky/pre-commit` is a thin shim that runs both scripts via `bash`. It
fires on every `git commit` invocation, regardless of whether the commit
came from a terminal or from an agent's Bash tool call. Husky 9 is wired
through `package.json` (`"prepare": "husky"`).

## Lane 2 — agents (Claude Code `PreToolUse`)

`.claude/settings.json` registers a `PreToolUse` hook on the `Bash` tool
that grep-filters tool-input for `git commit` and runs the same two
scripts. Reasons to keep this lane even though lane 1 already blocks:

- The agent sees the registration in the (tracked) `settings.json` and
  learns the contract without having to discover it via failure.
- A `--no-verify` flag bypasses lane 1 silently; lane 2 fires on the
  command shape, not on the git hook, so it still catches an unauthorised
  bypass attempt.

## Bypass policy

`git commit --no-verify` is **not** a soft "ask first" — it is a flag
that, if used, must be accompanied by a one-line reason in the commit
body (e.g. `Bypass: pre-existing typecheck failure in unrelated file X,
fixed in branch Y`). No reason → reject in code review. The agent does
not get to add `--no-verify` on its own; it must be requested by the user
in conversation, with reason. See [`AGENTS.md`](../../AGENTS.md) red
lines.

## Editing these scripts

- Both scripts are pure bash, `set -euo pipefail`, under 80 lines each.
- No node, no Python, no external tools beyond `git`, `grep`, `sed`,
  `pnpm`. Keep it that way.
- If you add a new pattern to `pre-commit-secrets.sh`, plant a fake match
  in a temp file and verify it blocks before committing.
