# AGENTS.md

Read this at the start of every session. For project context, read [`CLAUDE.md`](CLAUDE.md) first.

## Startup checklist

In order, at the start of every session:

1. Read [`CLAUDE.md`](CLAUDE.md) — product, layout, dev commands, ADR pointers, conventions, known gaps.
2. If the user references a plan, read its `docs/active/<plan>/README.md` (status tracker), then the relevant `<TASK>.md` if one exists.
3. Run `git status` and `git log --oneline -5` to see where the branch is.
4. Skim any uncommitted changes before suggesting edits.

## Red lines

Never, without an explicit ask in the current conversation:

- Push to `main`.
- Force-push any branch.
- Edit anything under `docs/completed/` — that subtree is a read-only archive.
- Weaken a Zod `.strict()` schema to silence a parse error. Fix the data, not the schema.
- Byte-copy any file from `../ai-travel-agent/.claude/` (their `settings.local.json` allowlist contains a real-looking JWT — see `CLAUDE.md` SDK-purity / security section). Read for structure; write our own.
- Bypass pre-commit hooks (`git commit --no-verify`) without writing the reason in the commit body.

## When to ask vs proceed

**Proceed without asking:**

- Local file edits inside the working tree.
- Running `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`.
- Reading code, grepping, exploring the repo.
- Drafting commits (not pushing) on a feature branch.
- Creating a new feature branch off `main`.
- Scratch experiments that stay local.

**Ask first:**

- `git push` to a shared branch.
- `gh pr create`, `gh pr merge`, `gh pr close`.
- Adding a dependency or upgrading an existing one.
- Adding or amending an ADR under `docs/reference/adr/`.
- Pre-commit hook bypasses (`--no-verify`).
- Deleting a plan directory or moving one to `docs/completed/`.
- Anything that mutates an external system (npm publish, GitHub API writes, App Store, Play Store).

## Plan tracking

- When a task ships, mark it Done in the plan's `README.md` with the commit hash.
- Do not flip a plan to `COMPLETED` or move it to `docs/completed/` without explicit approval.
- The 3×-by-hand bar applies to adding new subagents, skills, and slash commands — see `CLAUDE.md` conventions.
