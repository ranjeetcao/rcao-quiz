# Agentic Tooling Plan — Status Tracker

Import the agentic-architecture pattern from `../ai-travel-agent/` into rcao-quiz, **scaled down to a 2-package mobile-only repo**: a `CLAUDE.md` + `AGENTS.md` baseline, three core subagents (`code-reviewer`, `rn-frontend-lead`, `tech-lead`), two pre-commit hooks (typecheck + secrets), one slash command (`/review-pr`), one context rule (`plan-tracking`), a per-task `.md` spec template for forward use, and a committed policy on what in `.claude/` is tracked vs ignored.

**Master Plan:** [plan.md](plan.md)
**Status:** PLANNING — 0 / 9 tasks done
**Target Phase:** N/A (cross-cutting / DX)
**Depends on:** None. Independent of MVP Skeleton; harmless to land in parallel.

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| AGT-01 | `CLAUDE.md` baseline — product, layout, dev commands, conventions, ADR pointers, known gaps | S | Pending | -- |
| AGT-02 | `AGENTS.md` (compressed) — startup checklist, red lines, when-to-ask | XS | Pending | AGT-01 |
| AGT-03 | Three project-local subagents (`code-reviewer`, `rn-frontend-lead`, `tech-lead`) | S | Pending | AGT-01 |
| AGT-04 | Pre-commit hooks — typecheck (staged TS only) + secrets scan (regex set written from scratch) | S | Pending | -- |
| AGT-05 | `/review-pr` slash command — orchestrates `code-reviewer` against current branch | XS | Pending | AGT-03 |
| AGT-06 | Context rule `.claude/rules/plan-tracking.md` — lifecycle states + tracker conventions | XS | Pending | -- |
| AGT-07 | Per-task spec template (`docs/_templates/task-spec.md`) + Effort/Blocked-By columns on existing tracker | S | Pending | -- |
| AGT-08 | `.gitignore` policy for `.claude/` — track agents/commands/hooks/rules; ignore `*.local.*` + `worktrees/` | XS | Pending | AGT-03, AGT-04, AGT-05, AGT-06 |
| AGT-09 | QA pass + `docs/README.md` index update; flip plan to COMPLETED and move to `docs/completed/` | XS | Pending | AGT-01..AGT-08 |

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.
**Total estimated effort:** ~12–18h (~1.5 weeks at MVP-skeleton-plan cadence).

## Exit criteria

- `CLAUDE.md` answers "what is this project, what are the conventions, what's in flight?" in one read.
- The three subagents each invoke cleanly on a tiny scoped prompt.
- A planted secret in a staged file is blocked by the pre-commit hook.
- A planted type error in `packages/sdk/` is blocked by the pre-commit hook.
- `/review-pr` returns a clean findings checklist on the current branch.
- `git status` confirms the `.gitignore` policy: `agents/`, `commands/`, `hooks/`, `rules/` tracked; `settings.local.json`, `scheduled_tasks.lock`, `worktrees/` ignored.
- The `docs/README.md` index lists the plan; the per-task template is referenced from the lifecycle section.

## Explicitly out of scope

- Porting any of ai-travel-agent's microservice-shaped agents (`web-frontend-lead`, `design-system-owner`, `engineering-manager`, `legal-counsel`, `llm-ai-specialist`). No codebase parallels.
- Domain rules / skills for Kafka, Mongo, Kubernetes, Fastify, SEO, brand-voice. None apply here.
- Persistent agent worktrees in `.claude/worktrees/`. Disk + sync cost without the parallel-agent volume to justify it.
- Retroactive `<TASK>.md` files for MVP-01 / 02 / 03 (already shipped — template is forward-only).
- A marketing-site harness (`/blog-post`, `seo` skill, `web-frontend-lead`). Deferred with the marketing site itself to Phase 1 store submission.
- Subdirectory `CLAUDE.md` files in `apps/mobile/` or `packages/sdk/`. Repo's too small to warrant nesting.
- Any agent-injected ESLint rules. The SDK ban list in `eslint.config.mjs` (`9db7010`) stays as-is.

## Open questions (carry into implementation)

See [plan.md §5](plan.md#5-open-questions-decide-during-implementation) for the four decisions that need a sign-off before they bite:
- **A.** The bar for adding a 4th+ subagent (proposed: "done by hand 3× with a stable prompt").
- **B.** Skip `SOUL.md` / `IDENTITY.md` / `USER.md`? (Proposed: yes for now; revisit if multi-agent transcripts become a thing.)
- **C.** Ship a `react-native-expo-patterns` skill? (Proposed: defer to post-MVP-07.)
- **D.** Branch + PR strategy — fresh `feat/agentic-tooling` off `main`, or stack on `feat/mvp-03-sdk`? (Proposed: fresh branch.)
- **E.** (Reminder, not really a question) Don't inherit ai-travel-agent's `settings.local.json` byte-for-byte — their allowlist contains a real-looking JWT. Patterns yes, payloads no.
