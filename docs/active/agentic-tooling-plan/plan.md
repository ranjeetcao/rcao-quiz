# Agentic Tooling Plan

> **Status:** PLANNING
> **Services:** repo-wide — `.claude/`, root markdown, `docs/` template
> **Estimated effort:** ~1.5 weeks across 9 tasks (most XS–S)
> **Cross-references:** [ai-travel-agent harness](/Users/ranjeet/workspace/ai-travel-agent/.claude/), [ai-travel-agent root docs](/Users/ranjeet/workspace/ai-travel-agent/), [docs/README.md](../../README.md)

---

## 1. Problem statement

rcao-quiz currently has **bare-minimum Claude Code harness config**: `.claude/{settings.json, settings.local.json, launch.json}` — permissions allowlist plus VSCode-style debug launchers. There are no project-level agents, no slash commands, no hooks, no skills, and no agent-facing documentation (no `CLAUDE.md`, `AGENTS.md`, etc.). The repo lives next to a heavily-tooled sibling (`../ai-travel-agent/`) which has built up an opinionated agentic stack over many months. We want to **import what scales down** without copy-pasting the parts that only make sense at ai-travel-agent's microservice scale.

The risk of doing nothing: every new conversation re-discovers the same context (mobile-only, no web app, six ADRs, two-tier dedupe) from scratch, and the SDK guardrails enforced in [`9db7010`](../../../README.md) (no NativeWind / no router / no haptics inside `packages/sdk/`) live only in ESLint and one PR description — invisible to a fresh agent until something breaks.

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
| G4 | The harness scales with the project (add agents/hooks/skills as need arises, not as ceremony) | Plan ships with 3 agents, not 13. Open Question §5.A documents the bar for adding more |
| G5 | The port reuses ai-travel-agent's *patterns*, not its secrets | Zero strings copied verbatim from `ai-travel-agent/.claude/settings.local.json` (which contains a real-looking JWT in the allowlist — see §5.D) |
| G6 | The plan-tracking template upgrade lands without rewriting completed plans | MVP-01 / 02 / 03 are not edited; new tasks adopt the per-task `.md` format going forward |

---

## 3. Repo layout (target)

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
│   └── rules/                               NEW
│       └── plan-tracking.md
├── docs/
│   ├── _templates/                          NEW
│   │   └── task-spec.md                     per-task template
│   └── (existing tree unchanged)
├── .gitignore                               EDITED — explicit policy on .claude/*
└── (existing tree unchanged)
```

Five new directories, eight new files, two edits to existing files (`.gitignore`, `docs/README.md`). Nothing in `apps/`, `packages/`, `content/`, or `scripts/` moves.

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
- **Conventions** — five bullets max:
  1. Mobile-only. **No web app, ever.** (Reference [README.md](../../../README.md) and the plan non-goals.)
  2. SDK purity: `packages/sdk/` may not import `expo-router`, `expo-haptics`, `nativewind`, `react-native-mmkv`, `expo-secure-store`, `expo-sqlite`. (Enforced by `eslint.config.mjs`.)
  3. Strict Zod schemas at every IO boundary (content files → pack builder → app → analytics). `.strict()` is mandatory on every object schema; the recent fix in `9db7010` makes this load-bearing, not stylistic.
  4. Deep imports off `@rcao-quiz/sdk` over barrel imports for non-RN consumers (`scripts/`, Vitest), so they don't pay the `react-native` resolution cost.
  5. Plan lifecycle is `PLANNING → APPROVED → IN-DEV → SUBSTANTIALLY-COMPLETE → COMPLETED`; plans live in `docs/active/<plan>/` and move to `docs/completed/` when done.
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

- **`code-reviewer.md`** — review the staged diff or the current branch against `main`. Must check: (1) Zod schemas have `.strict()`, (2) SDK imports respect the ESLint ban list, (3) no secrets in env files, (4) tests added for new public SDK functions, (5) `correct_answer ∈ choices` invariant unbroken in any new question file. Tools: Read, Grep, Glob, Bash. No Write/Edit.
- **`rn-frontend-lead.md`** — Expo + Expo Router + NativeWind specialist. Owns `apps/mobile/`. Knows: vertical FlatList paging-snap (MVP-05), the iOS 26.2 layout fix from `2e26276`, the `useWindowDimensions` (vs `Dimensions.get`) preference from `QuestionCard.tsx:64`. Tools: Read, Write, Edit, Glob, Grep, Bash.
- **`tech-lead.md`** — task breakdown, plan authoring, ADR drafting. Knows the plan template format. Routes implementation to the other two. Tools: Read, Glob, Grep, Write, Edit (for `docs/` only).

Each agent's frontmatter pins the tool list; body is ≤ 60 lines, leans on `CLAUDE.md` for project context rather than restating it.

Defer: `quality-assurance-tester`, `security-auditor`, `system-architect`, `product-owner`. Add when the work calls for them, not before. (See §5.A.)

**Exit:** Three `.md` files validated by an agent invocation each (`Agent({subagent_type: 'code-reviewer', prompt: 'review HEAD'})`).

---

### AGT-04 — Pre-commit hooks (typecheck + secrets)

**Effort:** S
**Goal:** Two pre-commit hooks that block the two failure modes that bite hardest.

`.claude/hooks/pre-commit-typecheck.sh`:
- Read staged file list. If any `.ts` / `.tsx` is staged in `apps/mobile/`, `packages/sdk/`, or `scripts/`, run `pnpm -r typecheck`. Otherwise no-op.
- Exit 2 on failure (blocks commit per Claude Code hook contract).
- Bypass: documented in `CLAUDE.md` as `git commit --no-verify` with the rule that bypasses require an explicit ask in conversation first (per the Claude Code system rules already in effect).

`.claude/hooks/pre-commit-secrets.sh`:
- Scan staged content (not all files) for: `sk-ant-api03-`, `sk-`, `AKIA[0-9A-Z]{16}`, `ghp_[A-Za-z0-9]{36}`, JWT pattern (`eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`), `mongodb(\+srv)?://[^/]*:[^@]*@`. Block on any hit.
- **Pattern set written from scratch** — do not copy ai-travel-agent's hook file verbatim. (Their `settings.local.json` allowlist contains a real-looking JWT; we don't want to inherit any artefact from that.)

Wire both via `settings.json` `hooks.PreToolUse` matcher on `Bash(git commit*)`. (ai-travel-agent uses filesystem-only hooks with no settings registration; we register so the hook contract is explicit and discoverable.)

**Exit:** `git commit` with a fake `sk-ant-api03-XXXXX` in a staged file is blocked. `git commit` with a deliberate type error in `packages/sdk/src/grading.ts` is blocked. `git commit --no-verify` bypasses both.

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
- Update `docs/active/mvp-skeleton-plan/README.md` to add **Effort** and **Blocked By** columns. (Effort labels are already in `plan.md` per task; blocked-by is captured per-task there too. Lifting both into the tracker table is mechanical.)

**Exit:** Template exists. The README tracker for the MVP skeleton plan has the two new columns filled in for all 10 tasks. Pattern is documented for forward use without invalidating shipped tasks.

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
1. Open a fresh `claude` session in a fresh terminal. Ask "what does this project do, what's the SDK purity rule, and what's currently in flight?" — answer is correct from `CLAUDE.md` + the active plan tracker, no other reads.
2. `git commit` with a planted `sk-ant-api03-FAKE_KEY_FOR_TESTING_ONLY` — blocked by the secrets hook.
3. `git commit` with a planted `as any` in `packages/sdk/src/grading.ts` that breaks types — blocked by the typecheck hook.
4. Invoke `/review-pr` on a no-op branch — agent reports "no findings" cleanly.
5. Invoke each of the three subagents with a tiny scoped prompt — each runs without error.

Docs index:
- Update `docs/README.md` "Active Plans" table: add this plan with `SUBSTANTIALLY-COMPLETE` (or whatever state we're at) once AGT-01 through AGT-08 ship.
- When all tasks are Done and the QA pass passes, flip to `COMPLETED` and move the directory to `docs/completed/agentic-tooling-plan/`.

**Exit:** All five QA steps pass. Plan moves to `docs/completed/`.

---

## 5. Open questions (decide during implementation)

### A. The bar for adding a 4th, 5th, Nth subagent

We're shipping three. ai-travel-agent has thirteen. The middle ground is unprincipled without a rule. Proposed bar:

> **Add a subagent only when the same kind of task has been done by hand three times and the prompt for it is stable.** Until then, the work goes through the `tech-lead` or `rn-frontend-lead` generalist.

Decide before AGT-03 lands. If we accept this rule, write it into `CLAUDE.md`'s conventions section.

### B. SOUL.md / IDENTITY.md / USER.md — really skip?

The agent surveys split: one called them "barely scales" / "skip", another called SOUL.md "universal — keep stripped". Recommend skipping all three for now. The personality / identity layer is genuinely useful in a multi-agent group-chat setup (which ai-travel-agent has) and noise in a solo coding repo (which we are). Revisit if/when we add `quality-assurance-tester` + `security-auditor` and want them to "feel" distinct in transcripts.

### C. Skills — none, or one?

Recommend none initially. The 14 skills in `ai-travel-agent/.claude/skills/` are domain libraries (Mongo, Kafka, Fastify, K8s, SEO) — none have a parallel here. The closest match would be a `react-native-expo-patterns/SKILL.md` skill that lifts the conventions from MVP-05 / MVP-06 / MVP-07 into one place. But those plans haven't shipped yet — writing the skill now would be writing fiction. Defer to post-MVP-07.

### D. Don't inherit ai-travel-agent's `settings.local.json` payload

Their `settings.local.json` allowlist contains what looks like a real JWT (`TOKEN="eyJhbGciOiJSUzI1NiJ9..."`). We don't know if it's a test fixture or a leaked credential. Hard rule for AGT-04 / AGT-08: read their files for *structure*, write our files from scratch. No `cp`, no `cat >>`. Document this in the implementation note for AGT-04.

### E. Should the harness be a separate `feat/agentic-tooling` branch or land on `feat/mvp-03-sdk`?

`feat/mvp-03-sdk` is post-PR-#2 review and substantially MVP-03 work. Adding 8+ files of harness scaffolding muddies the diff for any future revert. Recommend a fresh branch off `main` (`feat/agentic-tooling`) and a small PR per task or one rolled-up PR for the lot. Decide at AGT-01.

---

## 6. Non-goals (explicit)

- **No port of ai-travel-agent's microservice agents.** `web-frontend-lead`, `design-system-owner`, `engineering-manager` (multi-service router), `legal-counsel`, `llm-ai-specialist` — none ship in this plan. The first three have no codebase to own here; the last two are domain-specific to ai-travel-agent's product.
- **No Kubernetes / Kafka / Mongo / Fastify rules or skills.** rcao-quiz has none of those.
- **No persistent worktrees.** Long-lived `.claude/worktrees/agent-XXXX/` clones are a pattern that pays back when many agents work in parallel on a long-lived branch. We don't have the work volume to justify the disk + sync cost.
- **No retroactive task-spec rewrites.** MVP-01 / 02 / 03 are shipped; the per-task `.md` template is forward-only.
- **No website skill / `/blog-post` command.** Marketing-site work is deferred to Phase 1 per the prior conversation; harness for it lands then.
- **No agent-injected ESLint rules in this plan.** The SDK ban list in `eslint.config.mjs` (`9db7010`) stays. Adding more guardrails belongs in MVP / phase plans, not the harness plan.
- **No CLAUDE.md in subdirectories yet.** ai-travel-agent has per-service `CLAUDE.md` snippets; we have one big `apps/mobile` and one `packages/sdk` — too small to warrant nested context files. Revisit if `apps/` grows to >2 packages.

---

## 7. Done criteria

Plan is complete when all 9 tasks in [README.md](README.md) show `Done`, the QA walk-through in AGT-09 passes, and the plan directory has been moved to `docs/completed/agentic-tooling-plan/`. The harness is then *the* harness; further changes go through new plans or one-shot edits, not amendments to this one.
