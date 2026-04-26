# CLAUDE.md

Primary agent context for `rcao-quiz`. Read this first; everything else is one
hop away. Target read time: under thirty seconds.

For session-startup ritual (red lines, ask-vs-proceed, push policy) see
[`AGENTS.md`](AGENTS.md) — lands in AGT-02.

---

## What rcao-quiz is

A casual, reels-style mobile quiz app for **iOS and Android** — vertical-scroll
feed of text question cards; answer or skip at your pace. Content is
AI-generated upstream and shipped as static JSON packs; the app reads packs
from a CDN and grades answers client-side. **Zero hosted compute at runtime**
(see [ADR 0002](docs/reference/adr/0002-client-heavy-cost-optimized.md)).
Mobile-only, by deliberate scope choice — there is no web app and there is
not going to be one. Status: pre-MVP, Phase 0 scaffolding (3 of 10 MVP tasks
shipped).

Product overview: [`README.md`](README.md). System design:
[`docs/reference/architecture.md`](docs/reference/architecture.md).

---

## Repo layout

```
apps/mobile/      Expo app — Expo Router, NativeWind, the only RN binary
packages/sdk/     @rcao-quiz/sdk — Zod schemas, grading, RN UI primitives,
                  analytics adapter. Consumed by the app and by scripts.
content/          Subject metadata + hand-written question JSON (the seed
                  corpus; AI generation pipeline lands in Phase 1).
scripts/          Node-side tooling (pack builder, icon generator).
docs/             ADRs, architecture, plans (active/ + completed/).
.claude/          Agent harness — currently sparse. Being built out by
                  docs/active/agentic-tooling-plan/ (this is task AGT-01).
```

Workspaces are declared in [`pnpm-workspace.yaml`](pnpm-workspace.yaml):
`apps/*` and `packages/*`. There are exactly two workspace packages today
(`@rcao-quiz/mobile`, `@rcao-quiz/sdk`).

---

## Dev commands

From the repo root, via pnpm 9 (declared in `package.json`,
`packageManager: pnpm@9.12.0`; Node `>=20`):

| Command | What it does |
|---|---|
| `pnpm install` | Install workspace deps. |
| `pnpm dev` | Start the Expo dev server (`pnpm --filter @rcao-quiz/mobile start`). Press `i` for iOS Simulator, `a` for Android emulator. |
| `pnpm typecheck` | `tsc --noEmit` across every workspace, in parallel. |
| `pnpm test` | Vitest across every workspace, in parallel. |
| `pnpm lint` | Flat-config ESLint over the whole tree. |
| `pnpm format` / `pnpm format:check` | Prettier write / check. |
| `pnpm packs:build` | `tsx scripts/packs-build.ts` — reads `content/`, writes `./packs/`. (MVP-04 — script not present yet, command stub-listed.) |
| `pnpm packs:serve` | Local static server for built packs (MVP-04). |
| `pnpm mobile <args>` | Forward args to the mobile workspace. |
| `pnpm sdk <args>` | Forward args to the SDK workspace. |

Single source of truth for the above is the `scripts` block in
[`package.json`](package.json).

---

## ADRs

Six load-bearing decisions live under
[`docs/reference/adr/`](docs/reference/adr/). Read the relevant ADR before
touching the area it covers; do not relitigate decisions in code.

| ID | Title |
|----|-------|
| [0001](docs/reference/adr/0001-reels-feed-not-session-rounds.md) | Reels-style feed, not session rounds |
| [0002](docs/reference/adr/0002-client-heavy-cost-optimized.md) | Client-graded play, server-less runtime |
| [0003](docs/reference/adr/0003-text-only-mvp-client-templates.md) | Text-only MVP with client templates; images deferred to Phase 3 |
| [0004](docs/reference/adr/0004-statistical-percentile-leaderboards.md) | Percentile social-proof, not ordinal leaderboards |
| [0005](docs/reference/adr/0005-git-content-store.md) | Git as content store |
| [0006](docs/reference/adr/0006-ai-review-flag-digest.md) | AI-only content review with user flags + Slack digest |

---

## Conventions

These are the rules a fresh agent has to know before touching anything. Each
one has a precedent in the codebase or in an ADR — they are not aspirational.

### Mobile-only. No web app, ever.

iOS and Android, full stop. There is no `website/`, no marketing site in this
repo, and no plan to add one in Phase 0. The marketing landing at
`quiz.rcao.in` is deferred to Phase 1 alongside store submission and lives
outside this repo if/when it appears. Spotting a violation: any new top-level
directory named `web/`, `website/`, `landing/`, or any dependency on `next`,
`vite`, `react-dom` outside of Expo's web-export path. Anchor:
[`README.md`](README.md) "Guiding principle" and the non-goals in
`docs/active/agentic-tooling-plan/plan.md` §6.

### SDK purity.

`packages/sdk/` is the shared library that both the Expo app and the Node-side
scripts consume. It cannot import any of:

- `expo-router`
- `expo-haptics`
- `nativewind`
- `react-native-mmkv`
- `expo-secure-store`
- `expo-sqlite`

Why: those modules pull in app-only or native-only surfaces that break the
SDK's promise of being usable from a Node/Vitest context (`scripts/`, tests).
The SDK is allowed to depend on `react`, `react-native`, `react-native-svg`,
`expo-linear-gradient`, and `zod` only.

The rule is enforced by an ESLint ban-list override on `packages/sdk/**` in
[`eslint.config.mjs`](eslint.config.mjs) (added in `8ce7a66`, expanded in
`8bd3d3b` to cover seven more app-only packages plus subpath imports).
Spotting a violation: a new `import` line in `packages/sdk/src/**` that names
any of the banned modules. `pnpm lint` will fail before review.

### Strict Zod schemas at IO boundaries.

Every object schema in `packages/sdk/src/schemas/` is `.strict()`. Unknown
keys reject at parse time so a typo in a content JSON file fails the
pack-build step instead of silently dropping the field. **Don't weaken a
schema to silence a parse error — fix the data.** This was made load-bearing
by `8ce7a66` (Question, Pack, Manifest, GA4 event payloads); the
single-source-of-truth promise from ADR-0002 is enforced, not just stated.

### Plan lifecycle.

Plans live in `docs/active/<plan>/{plan.md, README.md}`. The lifecycle states
are:

```
PLANNING → APPROVED → IN-DEV → SUBSTANTIALLY-COMPLETE → COMPLETED
                                                      ↘ DEFERRED
```

When all tasks ship and the QA pass passes, the entire plan directory moves
from `docs/active/<plan>/` to `docs/completed/<plan>/`. **Anything in
`docs/completed/` is read-only** — do not edit shipped plans, even to fix
typos. Treat that subtree as the historical record. The lifecycle definition
lives in [`docs/README.md`](docs/README.md) and (after AGT-06) in
`.claude/rules/plan-tracking.md`.

### The 3-times-by-hand bar for adding harness.

> Add a subagent only when the same kind of task has been done by hand three
> times and the prompt for it is stable. Until then, the work goes through
> the `tech-lead` or `rn-frontend-lead` generalist.

Same rule applies to skills and slash commands. This is the harness's
anti-cargo-cult guardrail — the sibling repo `ai-travel-agent/` runs 13
subagents and 14 skills, and copying that wholesale into a 2-package mobile
repo costs more in maintenance than it pays back. Source: agentic-tooling
plan §5.A.

### No retroactive task-spec rewrites.

MVP-01, MVP-02, and MVP-03 are shipped (commits `611c680`, `a352ab5`,
`7fdc174`). The per-task `<TASK>.md` template lands in AGT-07 and applies to
**forward** work only. Do not back-fill task specs for shipped tasks; their
record is the plan tracker plus the commit history.

### Hard security rule: never byte-copy from `ai-travel-agent/.claude/`.

A sibling repo (`../ai-travel-agent/`) has a mature Claude Code harness we
are deliberately learning from. **Read it for structure; write our own
files.** Never `cp`, `cat >>`, or paste from any file under
`ai-travel-agent/.claude/` — especially `settings.local.json` and any
`hooks/*` script. Reason: the sibling's `settings.local.json` permission
allowlist contains a real-looking JWT (`TOKEN="eyJhbGci..."`) and we don't
want to inherit any artefact from that file, even by accident. This is a
constraint, not an open question. Source: agentic-tooling plan §3 (hard
rule) and §6 non-goals.

---

## Known gaps (as of 2026-04-26)

Honest list. These are not bugs to ambush; they are scoped-out items.

- **MVP-04 through MVP-10** have no per-task `.md` specs yet. The template
  ships in AGT-07; until then, the plan tracker at
  [`docs/active/mvp-skeleton-plan/README.md`](docs/active/mvp-skeleton-plan/README.md)
  is the authoritative scope description per task.
- **`bloom.ts`** is referenced by MVP-06 (the `seen` impressions tier in
  `apps/mobile/`'s SQLite cache) but does not exist in the SDK source tree.
  The `./bloom` slot in `packages/sdk/package.json` `exports` was dropped
  in `8ce7a66` to avoid being a ship-blocker for external imports; the
  slot gets re-added when MVP-06 lands the file.
- **No production analytics wiring.** The SDK's `analytics.ts` ships a
  `ConsoleAnalyticsAdapter` that validates payloads against the GA4 Zod
  schemas and `console.log`s them. Real Firebase Analytics is Phase 1
  (MVP-15-ish, not in this plan).
- **No EAS Build / TestFlight / Play Store** pipeline. Phase 1.
- **No app store presence.** No bundle ID reservations, no listings.
- **No CI** running lint / typecheck / tests on PRs yet. Pre-commit hooks
  arrive in AGT-04; CI is a later concern.
- **`.claude/`** is currently a thin permissions-only setup
  (`settings.json`, `settings.local.json`, `launch.json`). The agents,
  hooks, slash commands, rules, and skills directories are being added
  task-by-task across AGT-03 through AGT-10.

---

## Where to look next

- **First tool call of a session:** read [`AGENTS.md`](AGENTS.md) for the
  startup checklist and red lines (lands in AGT-02; forward-reference is
  fine — until then, this file plus the active plan tracker are enough).
- **What is in flight now:** [`docs/README.md`](docs/README.md) "Active
  Plans" table, then the relevant `docs/active/<plan>/README.md` tracker.
- **Why a thing is the way it is:**
  [`docs/reference/adr/`](docs/reference/adr/) — six ADRs, indexed in
  [`docs/reference/adr/README.md`](docs/reference/adr/README.md).
- **Architecture deep-dive:**
  [`docs/reference/architecture.md`](docs/reference/architecture.md).
- **Plan-tracking rules for an agent:** `.claude/rules/plan-tracking.md`
  (lands in AGT-06).
