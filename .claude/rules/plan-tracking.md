# Plan tracking

How rcao-quiz tracks multi-task plans. Extends the "Plan lifecycle" section
of [`CLAUDE.md`](../../CLAUDE.md) without contradiction. Source of truth for
the directory layout is [`docs/README.md`](../../docs/README.md).

## Where plans live

- **In-flight:** `docs/active/<plan-name>/` containing at least
  `plan.md` (the master spec) and `README.md` (the status tracker).
  Per-task specs sit at the plan root while pending; once the **task's
  PR** ships (not the whole plan), the spec moves into a `completed/`
  subfolder under the plan directory.
- **Shipped:** `docs/completed/<plan-name>/` — the entire plan directory
  is moved here when every task is Done and exit criteria pass.
- Real in-flight examples: [`docs/active/mvp-skeleton-plan/`](../../docs/active/mvp-skeleton-plan/),
  [`docs/active/stats-and-social-proof-plan/`](../../docs/active/stats-and-social-proof-plan/).
- Real shipped example: [`docs/completed/agentic-tooling-plan/`](../../docs/completed/agentic-tooling-plan/).

## Lifecycle states

- **PLANNING** — being authored; not yet approved.
- **APPROVED** — sign-off received; ready to enter IN-DEV.
- **IN-DEV** — work has started; PRs are landing against it.
- **SUBSTANTIALLY-COMPLETE** — most tasks shipped; only polish remains.
- **COMPLETED** — every task shipped and exit criteria met.
- **DEFERRED** — paused or abandoned; left in `docs/active/` with the
  state set so the reason stays visible.

## State transitions

- PLANNING → APPROVED: human owner flips after review sign-off.
- APPROVED → IN-DEV: implementing agent flips when the first task PR
  opens.
- IN-DEV → SUBSTANTIALLY-COMPLETE: implementing agent flips once the
  remaining work is polish-only.
- SUBSTANTIALLY-COMPLETE → COMPLETED **and** moving the plan directory
  from `docs/active/` to `docs/completed/`: **never do this without
  explicit user approval**, even if every task row says Done. This
  mirrors the AGENTS.md red line and the conventions block in
  [`CLAUDE.md`](../../CLAUDE.md).
- → DEFERRED: human owner only.

## README.md tracker conventions

Every plan's `README.md` carries a "Tasks at a glance" table with these
columns, in order:

| Task | Title | Effort | Status | Blocked By |

- **Task** — the task ID (e.g. `MVP-04`, `AGT-06`).
- **Title** — one-line summary.
- **Effort** — XS/S/M/L/XL using the legend below.
- **Status** — `Pending`, `In progress`, `Done (<short-hash>)`, or one of
  the lifecycle states above. Individual tasks use `Done`; the plan as
  a whole uses the lifecycle states.
- **Blocked By** — comma-separated task IDs, `--` (two hyphens) if
  independent (an active task with no blocker), or `—` (em dash) for
  shipped rows where the field is intentionally not backfilled. The
  same em-dash convention applies to **Effort** on shipped rows per
  plan-tracker §6 (no retroactive task-spec rewrites). Worked example
  in [`docs/active/mvp-skeleton-plan/README.md`](../../docs/active/mvp-skeleton-plan/README.md).

When a task ships, mark it `Done (<merge-commit-short-hash>)` — e.g.
`Done (7fdc174)`. The hash is the merge commit on `main`, not the
feature-branch tip. See
[`docs/active/mvp-skeleton-plan/README.md`](../../docs/active/mvp-skeleton-plan/README.md)
for a worked example (rows for MVP-01/02/03).

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.

## Per-task `<TASK-ID>.md` spec

Each task gets its own `<TASK-ID>.md` (e.g. `AGT-04.md`) next to
`plan.md` once it enters IN-DEV. The template ships in **AGT-07**
(`docs/_templates/task-spec.md`) with sections: Goal, Acceptance
criteria, Risks, Effort, Blocked by, Implementation notes.

This applies to **forward work only**. MVP-01, MVP-02, and MVP-03 are
already shipped (`611c680`, `a352ab5`, `7fdc174`) and do **not** get
retroactive specs — see
[`docs/completed/agentic-tooling-plan/plan.md`](../../docs/completed/agentic-tooling-plan/plan.md)
§6 ("No retroactive task-spec rewrites"). Their record is the tracker
row plus the commit history; that is sufficient.

## `docs/completed/` is read-only

Anything under `docs/completed/` is the historical record of what was
shipped and why. **Do not edit it** — not to fix typos, not to backfill
context, not to reformat. Rewriting an archived plan invalidates its
audit trail and makes the commit it was archived in misleading. If a
shipped plan needs amendment, open a new plan that supersedes it; leave
the original in `completed/` untouched.

**One narrow exception: the archival commit itself.** When the final
task PR for a plan merges and the plan moves from `docs/active/` to
`docs/completed/`, that same commit may flip the tracker `README.md`
status to `COMPLETED` and mark the closing task `Done (<merge-hash>)`.
After that commit lands, the read-only rule applies in full — no
follow-up edits, no typo fixes inside `docs/completed/`. This carve-out
exists because the closing-entry has to live somewhere; placing it on
the archival commit keeps it in the audit trail.
