# Documentation Index

## Plan Lifecycle

Plans progress through directories: `active/` → `completed/`.

- **`active/`** — plans with work remaining (planning, approved, in-dev, substantially-complete, or deferred). Within each plan: pending task specs at the plan root (template: [`docs/_templates/task-spec.md`](_templates/task-spec.md)), shipped specs in a `completed/` subfolder.
- **`completed/`** — all tasks shipped. Entire plan directory archived here. Read-only.
- **`reference/`** — non-plan docs (architecture, ADRs, long-lived specs).

**Valid status values:** `PLANNING` | `APPROVED` | `IN-DEV` | `SUBSTANTIALLY-COMPLETE` | `COMPLETED` | `DEFERRED`

---

## Active Plans

| Plan | Status | Progress | Priority | Next Action |
|------|--------|----------|----------|-------------|
| [MVP Skeleton](active/mvp-skeleton-plan/) | IN-DEV | 3/10 | Must | MVP-04 (pack builder script) — [PR #5](https://github.com/ranjeetcao/rcao-quiz/pull/5) open |
| [Stats & Social-Proof](active/stats-and-social-proof-plan/) | PLANNING | 0/10 | Should | Queued behind MVP Skeleton + Phase 1 |

## Completed Plans

| Plan | Tasks | Notes |
|------|-------|-------|
| [Agentic Tooling](completed/agentic-tooling-plan/) | 10/10 | Imported the agentic-architecture pattern from `ai-travel-agent` scaled down to a 2-package mobile-only repo. Retired in PR #15 (`78ce5c8`). |

## Reference

| Doc | Description |
|-----|-------------|
| [Architecture](reference/architecture.md) | System design — clients, runtime surfaces, data model, pipeline, play flow, anti-abuse, roadmap, risks. |
| [ADRs](reference/adr/) | Architecture Decision Records — six load-bearing decisions. See [`reference/adr/README.md`](reference/adr/README.md) for the index. |
