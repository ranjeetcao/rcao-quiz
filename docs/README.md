# Documentation Index

## Plan Lifecycle

Plans progress through directories: `active/` → `completed/`.

- **`active/`**: Plans with work remaining (planning, approved, in-dev, substantially-complete, or deferred).
  - Within each plan: pending task specs live at plan root, shipped specs go to `completed/` subfolder.
- **`completed/`**: All tasks shipped. Entire plan directory archived here. Read-only.
- **`reference/`**: Non-plan docs (architecture, taxonomies, long-lived specs).

**Valid status values:** `PLANNING` | `APPROVED` | `IN-DEV` | `SUBSTANTIALLY-COMPLETE` | `COMPLETED` | `DEFERRED`

---

## Active Plans

| Plan | Status | Progress | Priority | Next Action |
|------|--------|----------|----------|-------------|
| [MVP Skeleton](active/mvp-skeleton-plan/) | PLANNING | 0/10 | Must | MVP-01 (monorepo scaffold) |

## Completed Plans

_None yet._

## Reference

| Doc | Description |
|-----|-------------|
| [Architecture](reference/architecture.md) | System architecture: clients, API, data model, question pipeline, anti-abuse, roadmap, risks. |
