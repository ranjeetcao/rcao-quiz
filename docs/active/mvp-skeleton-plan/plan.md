# MVP Skeleton Plan

> **Status:** PLANNING
> **Author:** Ranjeet Kumar + Architecture review
> **Date:** 2026-04-19
> **Services:** apps/web, apps/api, packages/sdk
> **Estimated effort:** 1–2 weeks across 10 tasks
> **Cross-references:** [Architecture](../../reference/architecture.md)

---

## 1. Problem statement

rcao-quiz has an approved architecture but no code yet. Before we build the AI question pipeline or ship user accounts, we need to prove that the core loop — **pick a session, serve questions, grade answers, show a result** — actually works end-to-end. This plan produces the smallest scaffold that gets a user through a quiz round with hand-written content.

### Current state

- Empty repo with `docs/` only.
- No app code, no database, no CI.

### Desired state

- A user can open the web app locally, start a quiz (anonymous), play through ~10 questions, and see a score.
- Two question modes render: a text/math word problem and an image/geography snapshot.
- The API, DB schema, and SDK package are in place so Phase 1 (auth + leaderboards) and Phase 2 (AI pipeline) can build on top.

### Out of scope for Phase 0

- Google login, user profiles.
- Redis, leaderboards.
- Admin review UI.
- AI-generated questions.
- Mobile client.
- Production hosting.

---

## 2. Goals

| # | Goal | Measured By |
|---|------|-------------|
| G1 | End-to-end play flow on `localhost` | User completes a 10-question round and sees a score |
| G2 | Two modes render correctly | Text card and image card both display and accept answers |
| G3 | Shared type contract | Types from `packages/sdk` are used by both API and web |
| G4 | Seed pool exists | 20 human-written questions, 10 per bucket, approved by default |
| G5 | Zero external dependencies beyond Postgres | No Redis, no queue broker, no auth provider in Phase 0 |

---

## 3. Repo layout (target)

```
rcao-quiz/
├── apps/
│   ├── web/           Next.js 14 app (player UI + /admin stub)
│   └── api/           Fastify API + Postgres client + node-cron (stubbed)
├── packages/
│   └── sdk/           Shared Zod schemas, TS types, REST client
├── db/
│   ├── migrations/    SQL or node-pg-migrate files
│   └── seed/          JSON seed data + loader script
├── docker-compose.yml Postgres only
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── docs/              (already exists)
```

---

## 4. Tasks

### MVP-01 — Monorepo scaffold

**Effort:** S
**Goal:** Get `pnpm install` and `pnpm dev` working across the three workspaces.

- Initialize `package.json` with `pnpm` as package manager.
- `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
- TypeScript project refs so `apps/web` and `apps/api` depend on `packages/sdk`.
- Shared tooling: ESLint, Prettier, `tsconfig.base.json`.
- Root `README.md` pointer (already exists) — add a quickstart section.

**Exit:** `pnpm install` succeeds. `pnpm -r typecheck` passes on an empty scaffold.

---

### MVP-02 — Postgres schema + migrations

**Effort:** M
**Goal:** Create the v1 schema described in the architecture doc.

- Migration tool: **`node-pg-migrate`** (decided 2026-04-19 — plain SQL migrations, no ORM, closest to "boring and lean").
- Create migrations for:
  - `users` (id, email, auth_provider, is_anonymous, role, created_at)
  - `subjects` (id, slug, display_name, created_at)
  - `questions` (id, mode, subject_id, prompt_text, media_url, choices jsonb, correct_answer text, difficulty, status, generator_meta jsonb, created_at, approved_by, approved_at)
    - `choices`: JSON array of strings, length 4 for MVP. Example: `["Paris", "Lyon", "Marseille", "Bordeaux"]`.
    - `correct_answer`: canonical string that must match exactly one entry in `choices`. Comparison is **case-sensitive, trim-sensitive** — authors and the AI generator must emit the canonical form. CHECK constraint enforces membership.
  - `quiz_sessions` (id, user_id, mode, subject_ids[], started_at, finished_at, total_score)
  - `answers` (id, session_id, question_id, chosen_answer, is_correct)
  - `question_stats` (question_id, shown_count, correct_count)
- Indexes on `questions(status, mode, subject_id, difficulty)` and `answers(session_id)`.
- CHECK constraints:
  - `media_url` non-null iff `mode != 'text'`.
  - `correct_answer` appears in `choices` (`choices ? correct_answer` against the jsonb array).

**Exit:** `pnpm db:migrate` applies cleanly on an empty Postgres. `\d+ questions` shows the expected columns and constraints.

---

### MVP-03 — packages/sdk

**Effort:** S
**Goal:** A single source of truth for API types.

- Zod schemas for: `Question`, `Session`, `AnswerSubmission`, `AnswerResult`, `SessionResult`, `Mode`, `SubjectSlug`.
  - `Question.choices`: `z.array(z.string()).length(4)`.
  - `Question` as served to the client **omits** `correct_answer` — the server-only variant lives in an internal type.
  - `AnswerSubmission.chosen_answer`: `z.string()` — client echoes the choice text it picked.
- Typed REST client (`fetch`-based) with one method per endpoint. Client attaches `Authorization: Bearer <jwt>` from a token store the consumer provides (web wraps cookie → header in a Next.js route handler; mobile uses Expo SecureStore).
- Published as a local workspace package (`workspace:*`).

**Exit:** `apps/web` and `apps/api` both import `Question` from `@quiz/sdk` and share the type.

---

### MVP-04 — Fastify API skeleton

**Effort:** M
**Goal:** The three endpoints needed for a round.

- Bootstrap Fastify with `@fastify/helmet`, `@fastify/cors`, structured JSON logs.
- `POST /auth/anonymous` — mints a guest JWT containing a fresh `guest_user_id`. No database user row yet (create on first `complete`).
- `GET /sessions/new?mode=&subject=` — picks N questions, creates a `quiz_sessions` row, caches the answer key in a **process-level** `Map<sessionId, Map<questionId, correctAnswer>>` so subsequent `/answer` calls grade without a DB round-trip. Entries evict on `/complete` or after a TTL (e.g. 30 min).
- `POST /sessions/:id/answer` — validates the guess against the cached key (case- and trim-sensitive string equality against `correct_answer`), stores an `answers` row, returns `is_correct` + running score. Falls back to a DB read if the cache entry is missing (e.g. after a process restart mid-session).
- `POST /sessions/:id/complete` — finalizes the session, stores `total_score`.
- JWT verification middleware on `/sessions/*`.

**Exit:** `curl` through a full round works against a local DB.

---

### MVP-05 — Seed data loader

**Effort:** S
**Goal:** 20 playable questions, hand-written.

- JSON files under `db/seed/`:
  - `subjects.json` — math, geography (2 subjects for Phase 0).
  - `questions-math.json` — 10 text/math questions, ages 10+.
  - `questions-geography.json` — 10 image/geography snapshots (using Wikimedia Commons public-domain URLs to start; revisit licensing per image before launch).
- Loader script (`pnpm db:seed`) upserts into `subjects` and `questions` with `status='approved'`.
- All 10 image questions use URLs we've confirmed are reusable; populate `generator_meta` with `{source_url, license, attribution, retrieved_at}` per Wikimedia's reuse terms. The schema for this object is shared with the AI pipeline in Phase 2.

**Exit:** After `db:seed`, `SELECT count(*) FROM questions WHERE status='approved'` returns 20.

---

### MVP-06 — Next.js player UI

**Effort:** M
**Goal:** A playable quiz screen.

- Pages:
  - `/` — landing with "Start Quiz" + mode/subject chooser (defaults: mixed).
  - `/play` — session screen. Shows question card, 4 choices, progress indicator.
  - `/result` — total score, "Play again" button.
- Components:
  - `TextQuestionCard` — prompt + 4 choice buttons.
  - `ImageQuestionCard` — `<img src={media_url}>` + prompt + 4 choice buttons.
- State: React Server Components for data loading, a client component for answer submission.
- Styling: Tailwind, mobile-first, plain but readable.

**Exit:** With the API mocked, the UI renders both card types and navigates through a fake round.

---

### MVP-07 — Wire web ↔ API

**Effort:** S
**Goal:** Real end-to-end flow.

- Web calls `/auth/anonymous` on first load. The Next.js route handler stores the JWT in an httpOnly cookie, then unwraps it into an `Authorization: Bearer <jwt>` header for every API call. Mobile (Phase 3) will store the JWT in Expo SecureStore and attach the same header directly.
- `/sessions/new`, `/answer`, `/complete` all go through the SDK client; the SDK accepts a `getToken()` callback so each surface (web route handler, mobile SecureStore) supplies tokens its own way.
- Error surfaces: a toast component for "session expired" / "network error".
- Remove the mock from MVP-06.

**Exit:** Opening `localhost:3000`, clicking Start, answering 10 questions, and reaching `/result` works end-to-end.

---

### MVP-08 — In-memory rate limit + recent-seen

**Effort:** XS
**Goal:** Prove the in-memory infra pattern from the architecture.

- Simple `Map<userId, { windowStart, count }>` rate limiter on `/answer` (e.g. 30/min).
- `Map<userId, LRU<questionId>>` of recently-seen questions, 100-deep. `/sessions/new` filters the pool against this.
- Reset on process restart is fine.

**Exit:** Two quick-fire rounds don't repeat a question for the same session.

---

### MVP-09 — Local dev tooling

**Effort:** S
**Goal:** One command to run everything.

- `docker-compose.yml` with just Postgres 16 + a volume.
- `.env.example` documenting `DATABASE_URL`, `JWT_SECRET`, `API_PORT`, `WEB_URL`.
- Root `package.json` scripts:
  - `pnpm dev` → runs web + api concurrently with `concurrently` or `turbo`.
  - `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`.
- `.gitignore` covers `node_modules`, `.env`, `.turbo`, `dist`.

**Exit:** A fresh clone → `pnpm install && cp .env.example .env && docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` gets the app running.

---

### MVP-10 — Manual QA + README update

**Effort:** XS
**Goal:** Confirm the exit criteria from the tracker hold.

- Run through a full round twice (text-only, image-only).
- Verify anonymous cookie persistence across page reloads.
- Update root `README.md` with the quickstart from MVP-09.
- Mark MVP-01 … MVP-10 as Done in the tracker README.

**Exit:** The plan's exit criteria in `README.md` are all green. Plan moves to `completed/`.

---

## 5. Open questions

- **Image hosting for seed data** — hot-link from Wikimedia Commons for Phase 0, or download + serve from our own bucket? Hot-linking is faster to ship; own-bucket is safer long-term. Recommend hot-link now, own-bucket in Phase 2 with the image pipeline.
- **JWT signing key management** — env var for Phase 0, rotate via KMS later. Fine.
- **Anonymous guest lifecycle** — do we persist a `users` row at anonymous creation or only at first `complete`? Lazy creation at first `complete` keeps the table cleaner.

### Resolved (2026-04-19)

- **Migration tool** → `node-pg-migrate`. Plain SQL, no ORM.
- **Auth transport** → `Authorization: Bearer <jwt>` for both web and mobile; web wraps cookie → header in a Next.js route handler.
- **Answer shape** → `choices: string[]` (length 4) + `correct_answer: string` matching one entry exactly. Case- and trim-sensitive grading; CHECK constraint enforces membership.

## 6. Non-goals (explicitly)

- Auth providers, OAuth, email signup.
- Redis, BullMQ, node-cron, any background worker.
- AI question generation, validation, or admin review.
- Production deployment, CI/CD.
- Mobile, PWA installability.
- Analytics beyond console logs.

## 7. Done criteria

Plan is complete when all 10 tasks in [README.md](README.md) show `Done`, the exit criteria there are met, and this plan is moved to `docs/completed/mvp-skeleton-plan/`.
