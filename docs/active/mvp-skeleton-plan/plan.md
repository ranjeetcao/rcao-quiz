# MVP Skeleton Plan

> **Status:** PLANNING
> **Author:** Ranjeet Kumar + Architecture review
> **Date:** 2026-04-19
> **Services:** apps/web, apps/api, packages/sdk
> **Estimated effort:** 1–2 weeks across 10 tasks
> **Cross-references:** [Architecture](../../reference/architecture.md), [ADR 0001](../../reference/adr/0001-reels-feed-not-session-rounds.md), [ADR 0002](../../reference/adr/0002-client-heavy-cost-optimized.md), [ADR 0003](../../reference/adr/0003-text-only-mvp-client-templates.md)

---

## 1. Problem statement

rcao-quiz has an approved architecture and three accepted ADRs but no code. Before we build the AI pipeline, ship accounts, or invest in images, we need to prove that the shape of the product — a **client-graded, reels-style, text-card feed** — actually works end-to-end. This plan produces the smallest scaffold that gets a user scrolling through hand-written questions on `localhost`, with interactions syncing to a real Postgres.

### Current state

- Empty repo with `docs/` only.
- No app code, no database, no CI.

### Desired state at plan exit

- A user can open `localhost:3000` and immediately land in a vertical-scroll quiz feed — no signup, no round start.
- Each card is a text question rendered over a subject-themed template; the user answers or skips.
- Personal stats (today's correct count, current streak) update live in the UI and persist in IndexedDB.
- Interactions flush every ~30 seconds to `POST /sync` and land in Postgres.
- The pack builder script produces pack JSONs on local disk that the client downloads via a simple manifest.
- Everything works offline after the first pack download.

### Out of scope for Phase 0

See the [README tracker](README.md#explicitly-out-of-scope-for-phase-0).

---

## 2. Goals

| # | Goal | Measured By |
|---|------|-------------|
| G1 | Reels-style play flow works end-to-end | User scrolls the feed, answers some cards, skips others, and their stats update |
| G2 | Client-graded correctness works | Client computes `is_correct` from the pack's `correct_answer`; server records it via `/sync` |
| G3 | Text templates render correctly | Questions display over subject-themed CSS/SVG templates; same question always gets the same look |
| G4 | Shared type contract | Types from `@quiz/sdk` are used by both web and api, and by the pack builder |
| G5 | Seed pool exists | 50+ hand-written text questions across 3 subjects, all `status=approved` |
| G6 | Zero non-essential infra | Single Node process + Postgres. No Redis, no queue broker, no auth provider |

---

## 3. Repo layout (target)

```
rcao-quiz/
├── apps/
│   ├── web/               Next.js 14 app (feed UI + /admin stub)
│   └── api/               Fastify API + pack builder + node-cron stubs
├── packages/
│   └── sdk/               Shared Zod schemas, REST client, QuestionCard + templates
├── db/
│   ├── migrations/        node-pg-migrate SQL files
│   └── seed/              JSON seed data + loader script
├── packs/                 Local-disk pack output (gitignored); served by web dev server in Phase 0
├── scripts/
│   ├── packs-build.ts     Pack builder
│   └── db-seed.ts         Seed loader
├── docker-compose.yml     Postgres only
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
└── docs/                  (already exists)
```

---

## 4. Tasks

### MVP-01 — Monorepo scaffold

**Effort:** S
**Goal:** `pnpm install` and `pnpm dev` work across three workspaces.

- Initialise root `package.json` with `"packageManager": "pnpm@9.x"`.
- `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
- `tsconfig.base.json` with strict TypeScript; per-workspace `tsconfig.json` extends it.
- TypeScript project references so `apps/web` and `apps/api` depend on `packages/sdk`.
- Shared tooling: ESLint (flat config), Prettier, `.editorconfig`, `.nvmrc` pinning Node 20.
- Root `README.md` quickstart section: clone → install → compose up → migrate → seed → packs:build → dev.

**Exit:** `pnpm install` succeeds. `pnpm -r typecheck` passes on an empty scaffold.

---

### MVP-02 — Postgres schema + migrations

**Effort:** M
**Goal:** The v2 schema from the architecture doc lands in Postgres via `node-pg-migrate`.

Migrations to create:

- **`users`** `(id uuid pk default gen_random_uuid(), email text unique, auth_provider text check (auth_provider = 'google'), role text not null default 'user' check (role in ('user','admin')), created_at timestamptz not null default now())`
  - No row is written for anonymous play. Only a completed Google sign-in creates one (Phase 1 concern, schema ready in Phase 0).
- **`subjects`** `(id smallserial pk, slug text unique not null, display_name text not null, created_at timestamptz not null default now())`
- **`questions`** `(id uuid pk default gen_random_uuid(), mode text not null check (mode in ('text','image','video')), subject_id smallint not null references subjects(id), prompt_text text not null, media_url text, choices jsonb not null, correct_answer text not null, difficulty smallint not null default 2, status text not null default 'pending' check (status in ('pending','approved','retired')), generator_meta jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), approved_by uuid references users(id), approved_at timestamptz)`
  - CHECK: `jsonb_typeof(choices) = 'array'` and `jsonb_array_length(choices) = 4` (MVP constraint).
  - CHECK: `choices ? correct_answer` — correct answer must be a member of choices (case-sensitive, trim-sensitive).
  - CHECK: `(mode = 'text' AND media_url IS NULL) OR (mode <> 'text' AND media_url IS NOT NULL)`.
- **`interactions`** `(id uuid pk default gen_random_uuid(), user_id uuid references users(id), anon_guest_id uuid, question_id uuid not null references questions(id), kind text not null check (kind in ('answered','skipped','impression')), chosen_answer text, client_correct boolean, seen_at timestamptz not null, client_batch_id uuid not null)`
  - CHECK: `(user_id IS NULL) <> (anon_guest_id IS NULL)` — exactly one of the two is set.
  - CHECK: `kind <> 'answered' OR (chosen_answer IS NOT NULL AND client_correct IS NOT NULL)`.
- **`question_stats`** `(question_id uuid pk references questions(id), shown_count bigint not null default 0, answered_count bigint not null default 0, correct_count bigint not null default 0, skipped_count bigint not null default 0, updated_at timestamptz not null default now())`

Indexes:

- `create index on questions (status, mode, subject_id, difficulty);`
- `create unique index on interactions (client_batch_id, question_id, kind);` — idempotency for resubmitted sync batches.
- `create index on interactions (user_id, seen_at) where user_id is not null;`
- `create index on interactions (anon_guest_id, seen_at) where anon_guest_id is not null;`

**Exit:** `pnpm db:migrate` applies cleanly on an empty Postgres. `\d+ questions` shows the columns and all CHECK constraints. `\d+ interactions` shows the exactly-one-of constraint.

---

### MVP-03 — `packages/sdk`

**Effort:** M
**Goal:** One source of truth for types, grading logic, and rendering primitives.

Zod schemas + inferred TS types for:

- `Mode` = `z.enum(['text','image','video'])`
- `SubjectSlug` = `z.enum(['math','history','general_knowledge',...])` (loaded from DB, hard-coded union for Phase 0)
- `Question` — `id, mode, subject, prompt_text, choices (array length 4), correct_answer, difficulty`
  - **Includes `correct_answer`** — the client grades locally (ADR 0002).
- `Pack` — `pack_id, generation_batch, schema_version, built_at, subjects[], questions[]`
- `PackManifestEntry` — `pack_id, url, hash, generation_batch, size_bytes`
- `InteractionKind` = `z.enum(['answered','skipped','impression'])`
- `Interaction` — `{question_id, kind, chosen_answer?, client_correct?, seen_at, client_batch_id}`
- `SyncRequest` — `{interactions: Interaction[], stats_snapshot?: PersonalStats}`
- `SyncResponse` — `{accepted: number}`
- `PersonalStats` — `{today_correct, today_answered, today_skipped, streak_current, streak_longest, per_subject_accuracy: Record<SubjectSlug, {correct, answered}>}`

Grading helper:

- `gradeAnswer(question, chosen): boolean` — case-sensitive, trim-sensitive string equality against `question.correct_answer`. Exported for both client and pack-builder tests.

Rendering primitives (used by `apps/web` in MVP, `apps/mobile` later):

- `TEMPLATES` — a typed registry keyed by subject slug, each with 2–3 variants. Each template is `{background: ReactNode | string (CSS), textColor, accentColor, fontClass}`.
- `pickTemplate(question): Template` — deterministic: `templates[question.subject][hash(question.id) % variants.length]`.
- `QuestionCard` component — takes `Question`, dispatches on `mode`, renders with `pickTemplate`. For MVP only `mode=text` is implemented; `mode=image` throws "not implemented in Phase 0".

REST client:

- `fetch`-based typed client, one method per endpoint. Token store injected by consumer (web cookie-handler; mobile `SecureStore` later).
- Published as `@quiz/sdk` workspace package (`workspace:*`).

**Exit:** Both `apps/web` and `apps/api` and the pack builder import `Question` from `@quiz/sdk` and share the type. Jest tests for `gradeAnswer` and `pickTemplate` pass.

---

### MVP-04 — Fastify API skeleton

**Effort:** M
**Goal:** The minimum server surface: auth anonymous stub, manifest, sync, health.

Bootstrap:

- Fastify + `@fastify/helmet`, `@fastify/cors`, structured JSON logs (`pino`).
- Zod request validation via `fastify-type-provider-zod`.
- Postgres access via `pg` (no ORM).

Endpoints:

- `GET /health` — returns `{status: 'ok', time}`.
- `POST /auth/anonymous` — **Phase 0 stub.** Accepts no body, returns a short-lived JWT containing a random `guest_user_id`. No `users` row written. (Google login lands in Phase 1.)
- `GET /packs/manifest` — reads the manifest file written by the pack builder (local disk in Phase 0, R2 in Phase 1). Returns `[PackManifestEntry]`. Cache-Control: `public, max-age=60`.
- `POST /sync` — Zod-validated `SyncRequest`. In a single transaction:
  1. Insert `interactions` rows; on conflict `(client_batch_id, question_id, kind)` do nothing (idempotency).
  2. Aggregate the batch and `UPDATE question_stats` using grouped counts.
  3. If `stats_snapshot` is present and the JWT has a `user_id` (Phase 1+), persist it to a `user_stats_snapshots` table (deferred schema — not in MVP-02).
  Returns `{accepted: <insertedCount>}`.
- Admin endpoints — scaffolded as `501 Not Implemented` placeholders; Phase 1 builds them out.

Middleware:

- JWT verification on `/sync` — reads `Authorization: Bearer`, verifies, attaches `{user_id | guest_id}` to `request`.
- Rate limit (in-memory, per-JWT-subject) on `/sync`: 4 requests / 30 seconds.

**Exit:** `curl` through `POST /auth/anonymous` → `GET /packs/manifest` → `POST /sync` (with a hand-crafted payload referencing a real seed question) all return 200 and rows appear in the DB.

---

### MVP-05 — Seed content

**Effort:** S
**Goal:** ~50 hand-written text questions across 3 subjects, loaded as `status='approved'`.

- JSON files under `db/seed/`:
  - `subjects.json` — `math`, `geography`, `general_knowledge` (3 subjects for Phase 0).
  - `questions-math.json` — 20 text/math questions, mixed difficulties 1–3, ages 10+ appropriate.
  - `questions-geography.json` — 15 text questions (capitals, rivers, borders) — no images, pure text (ADR 0003).
  - `questions-general_knowledge.json` — 15 text questions.
- Loader script (`pnpm db:seed`) upserts into `subjects` and `questions` with `status='approved'`, `approved_at=now()`, `approved_by=null` (system-seed).
- Schema validation against the Zod `Question` schema before insert — fail fast on malformed seeds.

**Exit:** After `db:seed`, `SELECT mode, subject_id, count(*) FROM questions WHERE status='approved' GROUP BY 1,2` returns three rows totalling ≥50.

---

### MVP-06 — Pack builder script

**Effort:** S
**Goal:** Turn approved DB rows into pack JSONs + a manifest on local disk.

- `pnpm packs:build` runs `scripts/packs-build.ts`:
  1. Query `questions` by `status='approved'`, grouped by subject.
  2. For each subject, build a pack: `{pack_id: "pack_<subject>_v<N>_<date>", generation_batch: "<date>-a", schema_version: 1, built_at, subjects: [<subject>], questions: [...]}`.
  3. Hash the pack content (SHA-256 of canonicalised JSON) for the manifest entry.
  4. Write each pack to `./packs/<pack_id>.json` and a `./packs/manifest.json` listing them. The web dev server serves `./packs/` as a static directory in Phase 0.
- **Storage abstraction.** The write step goes through a tiny interface `PackStorage { put(key, bytes): Promise<url> }`. Phase 0 uses `LocalDiskStorage`. Phase 1 swaps in `R2Storage`. No other code touches storage.
- Idempotency: rebuilding when nothing changed produces identical hashes; manifest output is stable.

**Exit:** Running `pnpm packs:build` on the seeded DB produces three pack files and a manifest. `curl http://localhost:3000/packs/manifest.json` returns them.

---

### MVP-07 — Next.js feed UI

**Effort:** L
**Goal:** A working reels-style feed on the web.

Pages:

- `/` — the feed. No landing page, no "start quiz" button. Open the app → see card #1.
- `/stats` — a minimal stats view (today's correct, streak, per-subject accuracy). Optional for MVP exit but nice.

Components (most imported from `@quiz/sdk`):

- `QuestionCard` — renders the current question with `pickTemplate`. Three states: idle (waiting for tap), answered (shows correct + chosen highlighted), skipped (brief flash, auto-advance).
- `FeedContainer` — scroll-snap vertical container. Keeps a mounted window of ~5 cards around the current index; scroll advances the index; bottom-bumping triggers a request for more cards from the client's picker.
- `ChoiceButton` — one of four. On tap: computes correctness via `gradeAnswer`, animates, dispatches an `answered` interaction, auto-advances after ~800ms.
- `SkipGesture` — swipe-down or a small skip-chip at the bottom of the card; dispatches a `skipped` interaction and advances.
- `ImpressionTimer` — if a card has been on screen for >2s without answer/skip and the user scrolls past, dispatch an `impression` interaction (captures "seen but didn't engage").

Feed picker (client-side):

- Reads the local pack cache, filters by the user's subject preferences (Phase 0: all three subjects equally).
- Applies the two-tier dedupe (MVP-08): hard-excludes anything in the `acted` ring buffer; partitions remaining candidates into "not in bloom filter" (preferred) and "possibly seen" (fallback).
- Balances subjects in the next batch (e.g. ~1/3 from each), with a small random jitter.
- When the next-batch queue drops below 3 cards, picks 20 more.
- Deterministic for tests via an injected RNG.

Stats display:

- A tiny header chip: "Today: 7 correct · 🔥 3". Updates on every answer.

Template pack for Phase 0 (in `@quiz/sdk`):

- Math: 3 variants — deep-blue geometric, graph-paper, abstract-number-pattern.
- Geography: 3 variants — topographic-contour, muted-earth-gradient, map-grid.
- General knowledge: 2 variants — warm-neutral, soft-purple.
- All pass WCAG AA text contrast with a single display font (Space Grotesk or similar, loaded once).

**Exit:** In a browser on `localhost:3000`, a fresh user sees the feed, answers a few, skips a few, and the UI stats chip updates. No API calls yet (client-side only; `/sync` lands in MVP-09).

---

### MVP-08 — Client storage (IndexedDB layer)

**Effort:** M
**Goal:** Persistent local state via IndexedDB, wrapped behind a typed interface, including the two-tier dedupe structures.

- Use `idb` (the tiny wrapper) for ergonomics.
- Object stores:
  - `packs` — key: `pack_id`, value: `Pack`. LRU-evicted at 50MB cap.
  - `manifest` — key: `'current'`, value: `{packs: PackManifestEntry[], retired_question_ids: string[]}`.
  - `acted` — exact ring buffer of question IDs the user has answered or skipped. Key: `question_id`, value: `{kind: 'answered'|'skipped', seen_at, seq}`. Capacity 10,000, FIFO eviction by `seq`. Hard exclusion in the feed picker — never serve an `acted` question again while it's in the buffer. Footprint ~750KB. See architecture §2 for the long-tail resurfacing limit.
  - `seen_filter` — key: `'current'`, value: `{generation: 'current'|'previous', current: Uint8Array, previous: Uint8Array | null, current_inserts: number}`. Bloom filter for impressions: capacity 20,000, target FP 1%, m ≈ 192,000 bits (~24KB), k = 7. Rotate when `current_inserts > 16000`: `previous := current; current := empty; current_inserts := 0`. Lookups check both filters when `previous` exists.
  - `stats` — key: `'current'`, value: `PersonalStats`.
  - `interaction_buffer` — key: auto-increment, value: `Interaction`. Drained on sync success.
  - `identity` — key: `'current'`, value: `{guest_user_id, jwt, jwt_expires_at}`.
- Bloom filter implementation: hash each question_id with two cheap functions (e.g. FNV-1a + Murmur3-style folding) and derive k positions via Kirsch-Mitzenmacher (`h_i = h1 + i * h2 mod m`). Encapsulated in `bloom.ts` inside `@quiz/sdk` so both web and mobile share the same impl.
- Dedupe API exposed by the store:
  - `markActed(question_id, kind)` — pushes to ring buffer (and bloom filter, since acted implies seen).
  - `markImpression(question_id)` — pushes to bloom filter only.
  - `isActed(question_id): boolean` — exact lookup.
  - `isPossiblySeen(question_id): boolean` — bloom lookup against both generations.
- Accessor module `clientStore.ts` in `@quiz/sdk` — platform-agnostic interface; web implementation uses IndexedDB, mobile implementation (Phase 4) uses SQLite (filter blob stored as a `BLOB` column). Phase 0 ships only the web impl.
- Stats computation is idempotent: `recomputeStats(interactions[]): PersonalStats` — pure function, tested.

**Exit:** Refresh the browser; feed, stats chip, `acted` and `seen_filter` all survive. Clear IndexedDB; the app starts fresh cleanly. Unit tests cover bloom filter false-positive rate within tolerance and the rotation behaviour.

---

### MVP-09 — Wire client to API

**Effort:** M
**Goal:** Real end-to-end with the API on the network.

- On app open:
  1. If no `identity` in store, call `POST /auth/anonymous` to get a JWT; persist.
  2. Call `GET /packs/manifest`.
  3. For each manifest entry not in the local `packs` store (or with mismatched hash), fetch the pack URL and insert. **Evict any cached pack whose `pack_id` is not in the fresh manifest** (retired content). Drop LRU entries to stay under the 50MB cap.
- During play:
  - Every `answered | skipped | impression` appends to `interaction_buffer` with a freshly-generated `client_batch_id` for the current flush window.
  - Flush trigger: timer (30s) OR buffer size ≥ 20 OR `document.visibilitychange → hidden`.
  - Flush posts `SyncRequest` to `/sync` with `Authorization: Bearer <jwt>`. On 200, delete flushed rows.
  - On network error, leave rows in the buffer; retry next flush. The idempotency index on `(client_batch_id, question_id, kind)` makes duplicate deliveries safe.
- Optionally include `stats_snapshot` in every 5th flush (or on Google upgrade, Phase 1) for soft cross-device backup.

**Exit:** Play a round of ~10 answers, wait 30s, see rows appear in the `interactions` table and `question_stats` incremented. Refresh the page mid-round — buffer survives, next flush sends the pending rows. Kill the API mid-flush — client retries, server receives exactly once.

---

### MVP-10 — Local dev tooling + QA pass

**Effort:** S
**Goal:** One-command dev loop, and a documented manual QA that validates the exit criteria.

Dev tooling:

- `docker-compose.yml` with just Postgres 16 + a named volume.
- `.env.example`: `DATABASE_URL`, `JWT_SECRET`, `API_PORT`, `WEB_URL`, `PACKS_DIR`.
- Root scripts:
  - `pnpm dev` — runs web + api concurrently (via `turbo run dev` or `concurrently`).
  - `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`.
  - `pnpm packs:build`.
- `.gitignore` already covers `packs/`, `node_modules`, `.env`, `.next`, `dist`, `.turbo`.
- GitHub Actions: a single workflow that runs `pnpm install && pnpm typecheck && pnpm -r test`. Skip deployments — Phase 0 is local-only.

QA walk-through (must all pass):

1. Fresh clone → `pnpm install && cp .env.example .env && docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm packs:build && pnpm dev`.
2. `localhost:3000` shows a card from the feed within 2 seconds.
3. Answer 5 cards correctly → stats chip reads "Today: 5 correct · 🔥 5".
4. Answer 1 incorrectly → streak resets to 0.
5. Skip 3 cards → no change to correct count; 3 rows with `kind=skipped` land in DB after 30s.
6. Reload page → stats persist; no duplicate interactions appear in DB.
7. `localhost:3000/stats` (or the stats chip) shows per-subject accuracy.
8. Stop API, play 3 more cards, restart API, next flush delivers all three cleanly.

README updates:

- Quickstart block pointing at the commands above.
- Link to architecture + ADRs.
- Mark MVP-01…10 as Done in [`README.md`](README.md); status flips to `SUBSTANTIALLY-COMPLETE` or `COMPLETED`.

**Exit:** QA walk-through passes end-to-end on a fresh clone. Plan moves to `docs/completed/mvp-skeleton-plan/`.

---

## 5. Open questions

- **Template design.** The 8 templates need actual visual design work. If design bandwidth is scarce, we can launch with 3 ugly-but-functional templates and iterate. Decide during MVP-07.
- **JWT lifetime for anonymous.** 30 days? 90? Longer means fewer `/auth/anonymous` calls but also a longer-lived token if one leaks. Recommend 30 days with silent refresh on each `/sync` response.
- **`user_stats_snapshots` table.** Deferred to Phase 1; if we want cross-device stats backup even for anonymous users, we need it in MVP-02. Flag for the review.
- **Pack-builder cadence.** Phase 0 is manual (`pnpm packs:build`). Phase 1 adds cron. No decision needed now.

## 6. Non-goals (explicitly)

- Google / Apple / email sign-in.
- Real R2 deployment (pack storage is local disk in Phase 0).
- Redis, BullMQ, node-cron AI runs.
- Leaderboards of any kind.
- AI question generation or admin review UI.
- Production deployment, CI beyond typecheck/test, monitoring.
- Mobile, PWA installability.
- Images or the image pipeline.

## 7. Done criteria

Plan is complete when all 10 tasks in [README.md](README.md) show `Done`, the QA walk-through in MVP-10 passes on a fresh clone, and this plan is moved to `docs/completed/mvp-skeleton-plan/`.
