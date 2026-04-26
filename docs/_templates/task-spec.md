<!--
Copy to docs/active/<plan-name>/<TASK-ID>.md when a task moves to IN-DEV.
Replace placeholders. Delete sections that genuinely don't apply (don't pad).
When the task ships, move this file to docs/active/<plan-name>/completed/
alongside the commit hash recorded in the plan's README.md tracker.
-->

# <TASK-ID> — <Short Title>

**Status:** <Pending | IN-DEV | Done>
**Effort:** <XS | S | M | L | XL>
**Blocked by:** <comma-separated TASK-IDs, or "—">

## Goal

<1–2 sentences. State the problem this task solves and the measurable outcome
that proves it's done. Avoid restating the plan; link to the relevant section
in plan.md instead.>

## Acceptance criteria

- <Bulleted, testable. Each item is something a reviewer can verify by running
  a command, reading a diff, or eyeballing a screen.>
- <Prefer "X happens when Y" over "X is implemented".>
- <Include a negative case where it sharpens the contract (e.g. "with no
  network, the feed plays from cache and emits no error toast").>

## Risks

- <What could surprise us. Platform quirks, schema migrations, dependency
  upgrades, ordering with other in-flight tasks.>
- <One line per risk. If a risk has a known mitigation, name it.>

## Test plan

- [ ] <Concrete checks. Mix of unit / integration / manual.>
- [ ] <For RN/UI tasks: which simulator(s), which OS version(s).>
- [ ] <For SDK tasks: which Vitest specs, which schema fixtures.>
- [ ] <Final: `pnpm -r typecheck && pnpm -r test && pnpm lint` clean.>
