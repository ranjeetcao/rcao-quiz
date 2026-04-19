# Documentation Index

## Plan Lifecycle

Plans progress through directories: `active/` → `completed/`.

- **`active/`**: Plans with work remaining (planning, approved, in-dev, substantially-complete, or deferred).
  - Within each plan: pending task specs live at plan root, shipped specs go to `completed/` subfolder.
- **`completed/`**: All tasks shipped. Entire plan directory archived here. Read-only.
- **`reference/`**: Non-plan docs (architecture, ADRs, long-lived specs).

**Valid status values:** `PLANNING` | `APPROVED` | `IN-DEV` | `SUBSTANTIALLY-COMPLETE` | `COMPLETED` | `DEFERRED`

---

## Active Plans

| Plan | Status | Progress | Priority | Next Action |
|------|--------|----------|----------|-------------|
| [MVP Skeleton](active/mvp-skeleton-plan/) | PLANNING | 0/10 | Must | MVP-01 (monorepo scaffold) |
| [Stats & Social-Proof](active/stats-and-social-proof-plan/) | PLANNING | 0/10 | Should | Queued behind MVP Skeleton |

## Completed Plans

_None yet._

## Reference

| Doc | Description |
|-----|-------------|
| [Architecture](reference/architecture.md) | Current system design: clients, API, data model, question pipeline, play flow, roadmap, risks. |
| [ADRs](reference/adr/) | Architecture Decision Records — the "why" behind load-bearing choices. |

### ADRs

Index, status, and links: [`reference/adr/README.md`](reference/adr/README.md).
