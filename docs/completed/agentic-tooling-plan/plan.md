# Agentic Tooling Plan

> **Status:** PLANNING
> **Services:** repo-wide — `.claude/`, root markdown, `docs/` template
> **Estimated effort:** ~1.5 weeks across 10 tasks (most XS–S)
> **Cross-references:** [ai-travel-agent harness](../../../../ai-travel-agent/.claude/), [ai-travel-agent root docs](../../../../ai-travel-agent/), [docs/README.md](../../README.md)
>
> The `ai-travel-agent/` references assume the sibling repo is cloned next to `rcao-quiz/` in the same parent directory. Links resolve only on a local workstation that mirrors that layout; they're for human navigation, not CI.

---

## 1. Problem statement

rcao-quiz currently has **bare-minimum Claude Code harness config**: `.claude/{settings.json, settings.local.json, launch.json}` — permissions allowlist plus VSCode-style debug launchers. There are no project-level agents, no slash commands, no hooks, no skills, and no agent-facing documentation (no `CLAUDE.md`, `AGENTS.md`, etc.). The repo lives next to a heavily-tooled sibling (`../ai-travel-agent/`) which has built up an opinionated agentic stack over many months. We want to **import what scales down** without copy-pasting the parts that only make sense at ai-travel-agent's microservice scale.

The risk of doing nothing: every new conversation re-discovers the same context (mobile-only, no web app, six ADRs, two-tier dedupe) from scratch, and the SDK guardrails enforced in [`9db7010`](https://github.com/ranjeetcao/rcao-quiz/commit/9db7010) (no NativeWind / no router / no haptics inside `packages/sdk/`) live only in ESLint and one PR description — invisible to a fresh agent until something breaks.

The risk of over-doing it: ai-travel-agent runs **13 subagents, 14 skills, 6 pre-commit hooks, 4 long-lived worktrees**. Cargo-culting that into a 2-package mobile-only repo would cost more in maintenance friction than it pays back in agent quality. We are a small repo with a small team; the harness should match.

### Current state at plan start

- `.claude/settings.json` + `settings.local.json` — permissions only, no `hooks` key, no model pin, no env block.
- `.claude/launch.json` — Expo Metro / iOS / Android debug launchers.
- `.claude/` is untracked (in `git status`'s `??` list) and **not in `.gitignore`** — it is currently neither shared nor explicitly excluded. Decision pending.
- No `CLAUDE.md`. The `README.md` is product-level (a third party clone-and-build doc), not an agent context doc.
- No `AGENTS.md`, `IDENTITY.md`, `ONBOARDING.md`, `HEARTBEAT.md`, `SOUL.md`, `USER.md`, `TOOLS.md`.
- One *de facto* agent guardrail in `eslint.config.mjs`: SDK ban list on `expo-router`, `expo-haptics`, `nativewind`, `react-native-mmkv`, `expo-secure-store`, `expo-sqlite` (added in `9db7010`).
- Plan-tracking convention is established but not codified for an agent: `active/<plan>/{plan.md, README.md}`, status values `PLANNING | APPROVED | IN-DEV | SUBSTANTIALLY-COMPLETE | COMPLETED | DEFERRED`.

### Desired state at plan exit

- A **150–250 line `CLAUDE.md`** at the repo root that any incoming agent can read in one breath: product, layout, dev commands, ADR pointers, conventions (mobile-only / no web / SDK purity / plan lifecycle), known gaps.
- A **compressed `AGENTS.md`** (~60 lines): session startup checklist, red lines, when-to-ask-vs-proceed.
- **Three project-local subagents** in `.claude/agents/`: `code-reviewer`, `rn-frontend-lead`, `tech-lead`. Triggers scoped to this repo's scope (no microservice routing).
- **Two project-local pre-commit hooks** in `.claude/hooks/`: typecheck (staged `.ts`/`.tsx` only, calls `pnpm -r typecheck`) and secrets scan (regex-based, modeled on ai-travel-agent's pattern but written from scratch — no inherited test JWT).
- **One project-local slash command**: `/review-pr` (orchestrates the `code-reviewer` subagent across the current branch). `/test` is omitted — `pnpm test` is two characters longer and works today.
- **One context rule**: `.claude/rules/plan-tracking.md` — the lifecycle promise from `docs/README.md`, written for an agent.
- **Decision committed** on what in `.claude/` is tracked vs gitignored, with the chosen list landing in `.gitignore`.
- **Per-task spec template** added (one of the universally-recommended docs improvements): each `MVP-NN`-style task gets its own `<TASK>.md` once it lands `IN-DEV`, with acceptance criteria, risks, blocked-by. Existing MVP-01 / 02 / 03 stay as-is (already shipped); template is for forward use.

### Out of scope for this plan

See §6 below.

---

## 2. Goals

| # | Goal | Measured By |
|---|------|-------------|
| G1 | A fresh agent in a fresh conversation has the project context in <30s of reading | `CLAUDE.md` exists, is current, and is referenced from `AGENTS.md` |
| G2 | The SDK purity guardrail is visible to agents *before* they touch the file | `code-reviewer` agent prompt + `CLAUDE.md` both name the ESLint ban list |
| G3 | Pre-commit hooks block secret leaks and broken types without blocking iteration | Both hooks installed; both have a documented bypass for emergencies |
| G4 | The harness scales with the project (add agents/hooks/skills as need arises, not as ceremony) | Plan ships with 3 agents (not 13) and 1 skill (not 14). §5.A codifies the bar for adding more: "done by hand 3× with a stable prompt" |
| G5 | The port reuses ai-travel-agent's *patterns*, not its secrets | Zero strings copied verbatim from `ai-travel-agent/.claude/settings.local.json` (which contains a real-looking JWT in the allowlist — see the **Hard rule** at the top of §3) |
| G6 | The plan-tracking template upgrade lands without rewriting completed plans | MVP-01 / 02 / 03 are not edited; new tasks adopt the per-task `.md` format going forward |

---

## 3. Repo layout (target)

> **Hard rule (security):** **Do not byte-copy `ai-travel-agent/.claude/settings.local.json` or any of its hook scripts.** That file's allowlist contains what looks like a real JWT (`TOKEN="eyJhbGciOiJSUzI1NiJ9..."`) and we don't know if it's a fixture or a leaked credential. For every file we author under `.claude/` (especially `settings.json`, `settings.local.json`, and `hooks/*`): read the sibling for *structure*, then write our copy from scratch — no `cp`, no `cat >>`, no editor-paste of the file contents. This is a constraint, not an open question.


```
rcao-quiz/
├── CLAUDE.md                                NEW — primary agent context
├── AGENTS.md                                NEW — startup checklist + red lines
├── .claude/
│   ├── settings.json                        UNCHANGED — permissions
│   ├── settings.local.json                  UNCHANGED — local perms (audit, no secrets)
│   ├── launch.json                          UNCHANGED — debug launchers
│   ├── agents/                              NEW
│   │   ├── code-reviewer.md
│   │   ├── rn-frontend-lead.md
│   │   └── tech-lead.md
│   ├── commands/                            NEW
│   │   └── review-pr.md
│   ├── hooks/                               NEW
│   │   ├── pre-commit-typecheck.sh
│   │   └── pre-commit-secrets.sh
│   ├── rules/                               NEW
│   │   └── plan-tracking.md
│   └── skills/                              NEW
│       └── react-native-expo-patterns/
│           └── SKILL.md
├── .husky/                                  NEW
│   └── pre-commit                           wires the two hook scripts above
├── docs/
│   ├── _templates/                          NEW
│   │   └── task-spec.md                     per-task template
│   └── (existing tree unchanged)
├── .gitignore                               EDITED — explicit policy on .claude/*
├── package.json                             EDITED — adds husky to devDependencies + prepare script
└── (existing tree unchanged)
```

Seven new directories, ten new files, three edits to existing files (`.gitignore`, `docs/README.md`, `package.json`). Nothing in `apps/`, `packages/`, `content/`, or `scripts/` moves.

---

## 4. Tasks

### AGT-01 — `CLAUDE.md` baseline

**Effort:** S
**Goal:** Single agent-context document any new conversation can read in 30 seconds.

Sections, in order:
- **Product overview** — three sentences. Reels-style mobile quiz, client-graded, zero runtime backend.
- **Architecture at a glance** — small ASCII box of the four boxes that exist (Expo app, SDK, content store, pack builder). Cross-link to [`docs/reference/architecture.md`](../../reference/architecture.md) for the deep version.
- **Repo layout** — `apps/mobile`, `packages/sdk`, `content/`, `scripts/`, `docs/`. One line each.
- **Tech stack** — pnpm 9, Node 20, Expo SDK 51 + Expo Router, NativeWind 4, react-native-svg, expo-linear-gradient, MMKV, SQLite, Zod, Vitest.
- **Dev commands** — `pnpm install`, `pnpm dev`, `pnpm packs:build`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm lint`. The exact form documented in root `package.json` already.
- **Conventions** — six bullets max:
  1. Mobile-only. **No web app, ever.** (Reference [README.md](../../../README.md) and the plan non-goals.)
  2. SDK purity: `packages/sdk/` may not import `expo-router`, `expo-haptics`, `nativewind`, `react-native-mmkv`, `expo-secure-store`, `expo-sqlite`. (Enforced by `eslint.config.mjs`.)
  3. Strict Zod schemas at every IO boundary (content files → pack builder → app → analytics). `.strict()` is mandatory on every object schema; the recent fix in `9db7010` makes this load-bearing, not stylistic.
  4. Deep imports off `@rcao-quiz/sdk` over barrel imports for non-RN consumers (`scripts/`, Vitest), so they don't pay the `react-native` resolution cost.
  5. Plan lifecycle is `PLANNING → APPROVED → IN-DEV → SUBSTANTIALLY-COMPLETE → COMPLETED`; plans live in `docs/active/<plan>/` and move to `docs/completed/` when done.
  6. **Bar for adding a new subagent or skill: done by hand 3× with a stable prompt.** Until then, the work goes through `tech-lead` or `rn-frontend-lead`. (See §5.A.)
- **ADR pointers** — table of ADRs 0001–0006 with one-line summaries. (Lift from `docs/reference/adr/README.md`.)
- **Known gaps** — dated section. Today's bullets:
  - `bloom.ts` is referenced by MVP-06 but doesn't exist yet (`./bloom` was dropped from the SDK exports map in `9db7010`).
  - Real Firebase Analytics is Phase 1; analytics adapter currently `console.log`s.
  - No EAS Build / TestFlight pipeline yet (Phase 1).
  - Marketing site at `quiz.rcao.in` deferred to Phase 1 alongside store submission.

**Exit:** A new `claude` session opened in this repo, asked "what is this project?", produces a coherent answer without reading anything but `CLAUDE.md`. File is ≤ 250 lines.

---

### AGT-02 — `AGENTS.md` (compressed)

**Effort:** XS
**Goal:** Operating instructions for the agent — startup checklist, red lines, when to ask vs proceed.

Adapt ai-travel-agent's `AGENTS.md` aggressively. Drop: SOUL.md / USER.md / IDENTITY.md / TOOLS.md / heartbeat-state references / group-chat rules — none apply to a single-developer code repo.

Keep, in this order:
- **Startup** — read `CLAUDE.md` first. If the conversation references a plan, read its `README.md` (status tracker) and the relevant `<TASK>.md`.
- **Red lines** — never push to `main`, never force-push without explicit ask, never edit `docs/completed/` (read-only), never weaken a Zod `.strict()` to silence a parse error (fix the data, not the schema).
- **When to ask vs proceed** — local file edits and tests proceed; `git push`, `gh pr create`, dependency upgrades, ADR additions, hook bypasses ask first.
- **Plan tracking** — when finishing a task, mark it Done in the plan's `README.md` with the commit hash. Don't move the plan to `completed/` without explicit approval.

**Exit:** ≤ 80 lines. Linked from `CLAUDE.md`.

---

### AGT-03 — Three project-local subagents

**Effort:** S
**Goal:** Three subagent definitions in `.claude/agents/`, each scoped to this repo.

Why three, not thirteen: the survey of `ai-travel-agent/.claude/agents/` listed thirteen — half are microservice-shaped (engineering-manager for routing across gateways, web-frontend-lead for `website/`, design-system-owner for a shared design system, legal-counsel for India compliance, llm-ai-specialist for the AI service). Those don't have a parallel in rcao-quiz today. The three that do:

- **`code-reviewer.md`** — review the staged diff or the current branch against `main`. Must check: (1) Zod schemas have `.strict()`, (2) SDK imports respect the ESLint ban list, (3) no secrets in any staged content (defense-in-depth alongside AGT-04's pre-commit hook, which the bypass policy in AGENTS.md requires a reason for), (4) tests added for new **non-component** public SDK exports (components are verified on simulator, not Vitest), (5) `correct_answer ∈ choices` invariant unbroken in any new question file. Tools: Read, Grep, Glob, Bash. No Write/Edit.
- **`rn-frontend-lead.md`** — Expo + Expo Router + NativeWind specialist. Owns `apps/mobile/` and the RN-rendering surface of the SDK at `packages/sdk/src/components/` (i.e. `QuestionCard`, `ChoiceButton`, anything that paints pixels). Reads `react-native-expo-patterns` skill (AGT-10) before any work on this surface. Knows: vertical FlatList paging-snap (MVP-05), the iOS 26.2 layout fix from `2e26276`. Tools: Read, Write, Edit, Glob, Grep, Bash.
- **`tech-lead.md`** — task breakdown, plan authoring, ADR drafting. Knows the plan template format. Routes implementation to the other two. Tools: Read, Glob, Grep, Write, Edit (for `docs/` only), Bash (read-only `git status` / `git log` for tracker maintenance).

Each agent's frontmatter pins the tool list; body is ≤ 60 lines, leans on `CLAUDE.md` for project context rather than restating it.

Defer: `quality-assurance-tester`, `security-auditor`, `system-architect`, `product-owner`. Add when the work calls for them, not before. (See §5.A.)

**Exit:** Three `.md` files validated by an agent invocation each (`Agent({subagent_type: 'code-reviewer', prompt: 'review HEAD'})`).

---

### AGT-04 — Pre-commit hooks (typecheck + secrets), dual-lane

**Effort:** S
**Goal:** Two pre-commit checks that block the two failure modes that bite hardest, and *cover both humans and agents*. Claude Code's `PreToolUse` matcher only fires on agent tool calls — a developer typing `git commit` in their terminal never trips it. So we need a real Git pre-commit hook for human coverage, and we register the same scripts under `PreToolUse` so the agent lane is explicit too.

#### The two scripts (single source of truth)

Both live under `.claude/hooks/` and are pure bash; both lanes shell out to the same files.

`.claude/hooks/pre-commit-typecheck.sh`:
- Read staged file list (`git diff --cached --name-only`). If any `.ts` / `.tsx` is staged in `apps/mobile/`, `packages/sdk/`, or `scripts/`, run `pnpm -r typecheck`. Otherwise no-op.
- Exit non-zero on failure (blocks the commit in both lanes).

`.claude/hooks/pre-commit-secrets.sh`:
- Scan staged content (not all files) for: `sk-ant-api03-`, `sk-`, `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, JWT pattern (`eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`), `mongodb(\+srv)?://[^/]*:[^@]*@`. Block on any hit.
- **Pattern set written from scratch** — do not copy ai-travel-agent's hook file verbatim. (Their `settings.local.json` allowlist contains a real-looking JWT; we don't want to inherit any artefact from that.)

#### Lane 1 — Real Git pre-commit (covers humans)

Use **husky** (already a thin layer; no new daemon) wired in `package.json`:
- `pnpm dlx husky init` once; commit the generated `.husky/pre-commit`.
- `.husky/pre-commit` body is two lines: `bash .claude/hooks/pre-commit-typecheck.sh && bash .claude/hooks/pre-commit-secrets.sh`.
- Husky exits non-zero → commit aborts. Same for an agent that runs `git commit` in a Bash tool call (Git's hook fires regardless of who invoked it), so this lane alone is technically sufficient for blocking — lane 2 just makes the contract visible to the agent.

#### Lane 2 — Claude Code `PreToolUse` (covers agents, makes contract discoverable)

Wire via `settings.json` `hooks.PreToolUse` matcher on `Bash(git commit*)` — the same two scripts. Two reasons to keep this lane even though lane 1 already blocks:
- The agent sees the registration in `settings.json` and learns the contract without having to discover it via failure.
- A `--no-verify` flag bypasses lane 1 silently; lane 2 still fires (matcher is on the command, not the hook), so an agent attempting bypass without an explicit ask gets caught.

#### Bypass policy (tightened per review)

- `--no-verify` is **not** a soft "ask first" — it is a `git` flag that, if used, must be accompanied by a one-line reason in the commit body (e.g. `Bypass: pre-existing typecheck failure in unrelated file X, fixed in branch Y`). No reason → reject in code review. Documented in `CLAUDE.md` red-lines and `AGENTS.md` "when to ask vs proceed".
- The agent does not get to add `--no-verify` on its own under any circumstance; it must be requested by the user in conversation, with reason, and the reason goes in the commit body.

**Exit:** `git commit` (run by either a human or the agent) with a fake `sk-ant-api03-XXXXX` in a staged file is blocked by lane 1. `git commit` with a deliberate type error in `packages/sdk/src/grading.ts` is blocked. An agent attempting `git commit --no-verify` without a documented ask is caught by lane 2.

---

### AGT-05 — `/review-pr` slash command

**Effort:** XS
**Goal:** One project-local slash command — orchestrates `code-reviewer` over the current branch.

`.claude/commands/review-pr.md`:
- Body is the prompt: "Compare current branch against `main`. Run `code-reviewer` against the diff. Surface findings as a checklist. Don't push, don't open a PR."
- No bash. The agent does the work; the command is a one-line trigger.

Skip `/test` (just type `pnpm test`), `/deploy` (no deploy target yet), `/build-mobile` (Expo's `i` / `a` already cover it). Add later if the typing actually shows up as friction.

**Exit:** `/review-pr` invokes `code-reviewer` and prints a findings checklist.

---

### AGT-06 — Context rule: `plan-tracking.md`

**Effort:** XS
**Goal:** Codify the plan lifecycle for agents so they don't have to re-derive it from `docs/README.md` each time.

`.claude/rules/plan-tracking.md`:
- Lifecycle states + transition rules.
- "Status tracker README must show `Done (<commit-hash>)` once a task ships."
- "Don't move a plan to `completed/` without explicit approval."
- "Active plan trackers live in `docs/active/<plan>/README.md`; that's the one to update."

Skip ai-travel-agent's other seven rules. `auth-flow`, `mongodb-patterns`, `kafka-messaging-patterns`, `kubernetes-patterns`, `fastify-patterns`, `website` — none have a parallel here. `tool-calling.md` and `memory-system.md` are arguably useful but built-in to Claude Code today; revisit if a need surfaces.

**Exit:** File exists, ≤ 60 lines.

---

### AGT-07 — Per-task spec template + adoption

**Effort:** S
**Goal:** One of the two universally-recommended docs improvements lands: per-task `<TASK>.md` files with acceptance criteria, risks, blocked-by.

- Create `docs/_templates/task-spec.md` with sections: **Goal**, **Acceptance criteria**, **Risks**, **Effort** (XS/S/M/L/XL), **Blocked by**, **Implementation notes**.
- Update `docs/README.md` lifecycle section to reference the template.
- **Do not retroactively expand MVP-01 / 02 / 03** — they're shipped, the plan tracker already captures their commit hashes, and edits to completed work add no value.
- Going forward: when a task moves to `IN-DEV`, the implementing agent creates `<TASK>.md` next to `plan.md`. When the task ships, that file moves into the plan's local `completed/` subfolder (per the lifecycle rule already in `docs/README.md`).
- Update `docs/active/mvp-skeleton-plan/README.md` to add **Effort** and **Blocked By** columns. **Scope-limited per the non-goal in §6:** fill the columns for MVP-04+ only; leave the rows for shipped MVP-01 / 02 / 03 with `—` in both new cells. (The Effort label and blocked-by chain for shipped tasks live in `plan.md` history; lifting them into the tracker would be the kind of retroactive rewrite the non-goal forbids.)

**Exit:** Template exists. The README tracker has the two new columns; rows for MVP-04..MVP-10 are filled, rows for shipped MVP-01..MVP-03 show `—`. Pattern is documented for forward use without invalidating shipped tasks.

---

### AGT-08 — `.gitignore` policy for `.claude/`

**Effort:** XS
**Goal:** Decide what in `.claude/` is committed vs ignored, and write that down.

Default position (recommend):

| Path | Tracked? | Why |
|---|---|---|
| `.claude/settings.json` | ✅ | Shared permissions baseline |
| `.claude/settings.local.json` | ❌ | Local-only overrides; pattern matches `*.local.*` in many setups |
| `.claude/launch.json` | ✅ | Shared debug configs |
| `.claude/agents/` | ✅ | Shared subagent definitions |
| `.claude/commands/` | ✅ | Shared slash commands |
| `.claude/hooks/` | ✅ | Shared pre-commit hooks |
| `.claude/rules/` | ✅ | Shared context rules |
| `.claude/skills/` | ✅ | Shared skills (AGT-10 ships `react-native-expo-patterns`) |
| `.claude/scheduled_tasks.lock` | ❌ | Local lock file |
| `.claude/worktrees/` | ❌ | Per-machine sandboxes |

Edit `.gitignore`:
```
.claude/settings.local.json
.claude/scheduled_tasks.lock
.claude/worktrees/
```

(Single change. Everything else under `.claude/` becomes tracked.)

**Exit:** `git status` shows the kept files as tracked, the ignored ones absent.

---

### AGT-09 — QA pass + index update

**Effort:** XS
**Goal:** Verify the harness works end-to-end and the docs index is honest.

QA walk-through:
1. Open a fresh `claude` session in a fresh terminal. Ask "what does this project do, what's the SDK purity rule, what's the bar for adding a subagent, and what's currently in flight?" — answer is correct from `CLAUDE.md` + the active plan tracker, no other reads.
2. `git commit` with a planted `sk-ant-api03-FAKE_KEY_FOR_TESTING_ONLY` — blocked by the secrets hook (lane 1, husky). Same `git commit` invoked via the agent's Bash tool — blocked by lane 2 (`PreToolUse`).
3. `git commit` with a planted `as any` in `packages/sdk/src/grading.ts` that breaks types — blocked by the typecheck hook.
4. Invoke `/review-pr` on a no-op branch — agent reports "no findings" cleanly.
5. Invoke each of the three subagents with a tiny scoped prompt — each runs without error.
6. Ask `rn-frontend-lead` to make a layout change to `QuestionCard.tsx` — agent cites the `react-native-expo-patterns` skill (AGT-10) without prompting.

Docs index:
- Update `docs/README.md` "Active Plans" table: add this plan with `SUBSTANTIALLY-COMPLETE` (or whatever state we're at) once AGT-01 through AGT-08 + AGT-10 ship.
- When all tasks are Done and the QA pass passes, flip to `COMPLETED` and move the directory to `docs/completed/agentic-tooling-plan/`.

**Exit:** All six QA steps pass. Plan moves to `docs/completed/`.

---

### AGT-10 — Thin `react-native-expo-patterns` skill

**Effort:** XS
**Goal:** Capture the three RN/Expo patterns that MVP-01 / 02 / 03 already burned in, so the next agent touching `apps/mobile/` or `packages/sdk/src/components/` doesn't re-discover them through bug reports.

(Reverses the original §5.C "defer all skills" position — see resolution above. We are not writing fiction here; every rule below has a concrete commit precedent.)

`.claude/skills/react-native-expo-patterns/SKILL.md`, ~40 lines, three rules:

1. **Layout-critical props go in `style={}`, not NativeWind classes.** Source: `2e26276` (the iOS 26.2 home-screen + `QuestionCard` layout fix). NativeWind compilation is fine for static styling, but anything load-bearing for layout (flex, dimensions, absolute positioning) needs to go via `style` so RN's measure pass sees it before NativeWind rewrites the class.
2. **No function-as-style on `Pressable`.** Source: the `ChoiceButton` invisibility bug fixed during MVP-03. RN's `Pressable` accepts `style={({pressed}) => ...}`, but combining that with NativeWind className interop produces an invisible button under certain prop orderings. Use a state hook + plain object style instead. Likely to recur in MVP-05's vertical pager — load-bearing.
3. **`useWindowDimensions()` over `Dimensions.get()` at module scope.** Source: `packages/sdk/src/components/QuestionCard.tsx:64`. Module-scope `Dimensions.get()` snapshots once at JS load and is wrong after rotation, split-screen, or simulator resize. `useWindowDimensions()` re-renders on change.

**Owner:** `rn-frontend-lead` reads the skill before any work that touches the components surface.

**Exit:** Skill file exists, ≤ 50 lines, each rule cites its precedent commit or file path. Mentioned by name in `rn-frontend-lead.md` (AGT-03) and `CLAUDE.md` conventions (AGT-01).

---

## 5. Decisions (resolved during PR #3 review)

The four open questions raised at plan authoring all received decisions in PR #3 review. Recording them here so subsequent task PRs don't re-litigate.

### A. The bar for adding a 4th, 5th, Nth subagent — **DECIDED**

> **Add a subagent only when the same kind of task has been done by hand three times and the prompt for it is stable.** Until then, the work goes through the `tech-lead` or `rn-frontend-lead` generalist.

This rule lands in `CLAUDE.md`'s conventions section as part of AGT-01.

### B. SOUL.md / IDENTITY.md / USER.md — **SKIP**

Skipped. The personality / identity layer is useful in a multi-agent group-chat setup (which ai-travel-agent has) and noise in a solo coding repo (which we are). Revisit only if we add agents that need to "feel" distinct in transcripts.

### C. Ship a thin RN/Expo skill — **REVERSED FROM "DEFER" TO "SHIP NOW"**

The PR-3 review observed that MVP-01 / 02 / 03 *already* burned in three patterns worth capturing as paid-for precedent — not fiction:
- Layout-critical props belong in `style={}`, not NativeWind classes (lesson from `2e26276`).
- No function-as-style on `Pressable` (the `ChoiceButton` invisibility bug — likely to recur in MVP-05's vertical pager).
- Prefer `useWindowDimensions()` over `Dimensions.get()` at module scope (precedent: `packages/sdk/src/components/QuestionCard.tsx:64`).

Ship a thin (~40 line) `react-native-expo-patterns` skill capturing exactly these three rules. Expand post-MVP-07 as more patterns burn in. New task: **AGT-10**, below.

### D. Branch + PR strategy — **DECIDED: fresh branch, per-task PRs**

Use a fresh `feat/agentic-tooling` branch off `main`. Ship **per-task PRs** (one PR per AGT-XX task) rather than one rolled-up PR. Reason: lets a reviewer reject AGT-07 (per-task spec template) on its own without dragging AGT-01..AGT-06 down with it, and keeps each diff small enough to read in one sitting.

(The current PR #3 — plan-only — does not block this; AGT-01 implementation opens off `main` as `feat/agentic-tooling-AGT-01`.)

### E. ~~No byte-copy of `ai-travel-agent/.claude/settings.local.json`~~ — **PROMOTED to a hard rule**

Was never really a question. Moved up to §3 as a hard security rule.

---

## 6. Non-goals (explicit)

- **No port of ai-travel-agent's microservice agents.** `web-frontend-lead`, `design-system-owner`, `engineering-manager` (multi-service router), `legal-counsel`, `llm-ai-specialist` — none ship in this plan. The first three have no codebase to own here; the last two are domain-specific to ai-travel-agent's product.
- **No Kubernetes / Kafka / Mongo / Fastify rules or skills.** rcao-quiz has none of those.
- **Don't track ai-travel-agent upstream.** This is a one-time pattern port, not a fork that follows upstream. Once AGT-01..AGT-10 ship, divergence is intentional; do not periodically diff against `../ai-travel-agent/.claude/` looking for things to pull in.
- **Skills are scoped, not banned.** AGT-10 ships exactly one (`react-native-expo-patterns`). New skills follow the §5.A bar (3× by hand, stable prompt) — same rule as subagents.
- **No persistent worktrees.** Long-lived `.claude/worktrees/agent-XXXX/` clones are a pattern that pays back when many agents work in parallel on a long-lived branch. We don't have the work volume to justify the disk + sync cost.
- **No retroactive task-spec rewrites.** MVP-01 / 02 / 03 are shipped; the per-task `.md` template is forward-only.
- **No website skill / `/blog-post` command.** Marketing-site work is deferred to Phase 1 per the prior conversation; harness for it lands then.
- **No agent-injected ESLint rules in this plan.** The SDK ban list in `eslint.config.mjs` (`9db7010`) stays. Adding more guardrails belongs in MVP / phase plans, not the harness plan.
- **No CLAUDE.md in subdirectories yet.** ai-travel-agent has per-service `CLAUDE.md` snippets; we have one big `apps/mobile` and one `packages/sdk` — too small to warrant nested context files. Revisit if `apps/` grows to >2 packages.

---

## 7. Done criteria

Plan is complete when all 10 tasks in [README.md](README.md) show `Done`, the QA walk-through in AGT-09 passes, and the plan directory has been moved to `docs/completed/agentic-tooling-plan/`. The harness is then *the* harness; further changes go through new plans or one-shot edits, not amendments to this one.
