# Agentic Tooling Plan — Status Tracker

Import the agentic-architecture pattern from `../ai-travel-agent/` into rcao-quiz, **scaled down to a 2-package mobile-only repo**: a `CLAUDE.md` + `AGENTS.md` baseline, three core subagents (`code-reviewer`, `rn-frontend-lead`, `tech-lead`), two pre-commit hooks (typecheck + secrets, run as both real Git pre-commit *and* registered `PreToolUse`), one slash command (`/review-pr`), one context rule (`plan-tracking`), one thin RN/Expo skill capturing patterns burned in by MVP-01..03, a per-task `.md` spec template for forward use, and a committed policy on what in `.claude/` is tracked vs ignored.

**Master Plan:** [plan.md](plan.md)
**Status:** COMPLETED — 10 / 10 tasks done. Plan retired; this directory is read-only as of the merge of PR #15 (`78ce5c8`).
**Target Phase:** N/A (cross-cutting / DX)
**Depends on:** None. Independent of MVP Skeleton; harmless to land in parallel.

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| AGT-01 | `CLAUDE.md` baseline — product, layout, dev commands, conventions (incl. 3×-by-hand bar), ADR pointers, known gaps | S | Done (`de06951`) | -- |
| AGT-02 | `AGENTS.md` (compressed) — startup checklist, red lines, when-to-ask | XS | Done (`fc9c428`) | AGT-01 |
| AGT-03 | Three project-local subagents (`code-reviewer`, `rn-frontend-lead`, `tech-lead`) | S | Done (`3e6389f`) | AGT-01, AGT-10 |
| AGT-04 | Pre-commit hooks (dual-lane: husky + `PreToolUse`) — typecheck (staged TS only) + secrets scan (regex set written from scratch) | S | Done (`20fd3bc`) | -- |
| AGT-05 | `/review-pr` slash command — orchestrates `code-reviewer` against current branch | XS | Done (`82c7da9`) | AGT-03 |
| AGT-06 | Context rule `.claude/rules/plan-tracking.md` — lifecycle states + tracker conventions | XS | Done (`2e7ee3b`) | -- |
| AGT-07 | Per-task spec template (`docs/_templates/task-spec.md`) + Effort/Blocked-By columns on tracker (MVP-04+ only; shipped rows stay `—`) | S | Done (`dd91f9a`) | -- |
| AGT-08 | `.gitignore` policy for `.claude/` — track agents/commands/hooks/rules/skills; ignore `*.local.*` + `worktrees/` | XS | Done (`47b067f`) | AGT-03, AGT-04, AGT-05, AGT-06, AGT-10 |
| AGT-09 | QA pass + `docs/README.md` index update; flip plan to COMPLETED and move to `docs/completed/` | XS | Done (`78ce5c8`) | AGT-01..AGT-08, AGT-10 |
| AGT-10 | Thin `react-native-expo-patterns` skill — three rules with commit precedent (added in PR #3 review; reverses original §5.C "defer all skills") | XS | Done (`24c7814`) | -- |

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.
**Total estimated effort:** ~13–19h (~1.5 weeks at MVP-skeleton-plan cadence; AGT-10 adds ~1h).

## Exit criteria

- `CLAUDE.md` answers "what is this project, what are the conventions, what's in flight?" in one read.
- The three subagents each invoke cleanly on a tiny scoped prompt.
- A planted secret in a staged file is blocked by the pre-commit hook.
- A planted type error in `packages/sdk/` is blocked by the pre-commit hook.
- `/review-pr` returns a clean findings checklist on the current branch.
- `git status` confirms the `.gitignore` policy: `agents/`, `commands/`, `hooks/`, `rules/`, `skills/` tracked; `settings.local.json`, `scheduled_tasks.lock`, `worktrees/` ignored.
- The `docs/README.md` index lists the plan; the per-task template is referenced from the lifecycle section.

## Explicitly out of scope

- Porting any of ai-travel-agent's microservice-shaped agents (`web-frontend-lead`, `design-system-owner`, `engineering-manager`, `legal-counsel`, `llm-ai-specialist`). No codebase parallels.
- Domain rules / skills for Kafka, Mongo, Kubernetes, Fastify, SEO, brand-voice. None apply here. (The one skill we *do* ship — AGT-10 — is RN/Expo patterns with concrete commit precedent.)
- Tracking ai-travel-agent upstream. This is a one-time pattern port; once AGT-10 ships, divergence is intentional.
- Persistent agent worktrees in `.claude/worktrees/`. Disk + sync cost without the parallel-agent volume to justify it.
- Retroactive `<TASK>.md` files for MVP-01 / 02 / 03 (already shipped — template is forward-only).
- A marketing-site harness (`/blog-post`, `seo` skill, `web-frontend-lead`). Deferred with the marketing site itself to Phase 1 store submission.
- Subdirectory `CLAUDE.md` files in `apps/mobile/` or `packages/sdk/`. Repo's too small to warrant nesting.
- Any agent-injected ESLint rules. The SDK ban list in `eslint.config.mjs` (`9db7010`) stays as-is.

## Decisions (resolved in PR #3 review)

The five items below were open at plan authoring; all five received decisions in PR #3 review. Full reasoning lives in [plan.md §5](plan.md#5-decisions-resolved-during-pr-3-review).

- **A. Subagent / skill bar — DECIDED.** "Done by hand 3× with a stable prompt." Lands in `CLAUDE.md` conventions as part of AGT-01.
- **B. SOUL / IDENTITY / USER docs — SKIP.** Multi-agent personality layer is noise in a solo repo.
- **C. Thin RN/Expo skill — REVERSED to SHIP NOW.** MVP-01..03 already burned in three patterns worth capturing as paid-for precedent (not fiction). Tracked as new task AGT-10.
- **D. Branch + PR strategy — DECIDED.** Fresh `feat/agentic-tooling` off `main`, **per-task PRs** (one PR per AGT-XX). Lets reviewers reject one task without dragging the rest down.
- **E. No byte-copy of `ai-travel-agent/.claude/settings.local.json` — PROMOTED to a hard rule.** Was never really a question. Now lives at the top of plan.md §3 as a security constraint, not an open question.
