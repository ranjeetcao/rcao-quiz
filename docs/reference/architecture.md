# rcao-quiz — Architecture

> **Status:** Approved v1 (incorporates review comments from 2026-04-18 architecture doc)
> **Date:** 2026-04-19
> **Scope:** MVP and near-term evolution

An AI-driven quiz app with **image snapshots** and **text questions** across subjects like math, history, and general knowledge, available on **web and mobile**. A **batch AI pipeline** produces questions in the background; a **human admin** approves them before they go live. Both **anonymous play** and **authenticated users with leaderboards** are supported.

Guiding principle: **stay boring and lean**. In-memory wherever we can, Redis only where we must, no external queue brokers until we actually need them.

---

## 1. High-level system

```
   Web (Next.js)            Mobile (React Native)
        │                          │
        │        shared SDK        │
        └────────────┬─────────────┘
                     ▼
           ┌──────────────────────┐
           │   API + Workers      │   (single Node/TS process;
           │   node-cron inside   │    in-memory queueing)
           └──┬────────┬─────────┬┘
              │        │         │
              ▼        ▼         ▼
          Postgres   Redis    S3 / R2 + CDN
                     (leaderboards only)
```

Three surfaces:

- **Play surface** — clients, API, DB, CDN.
- **Generation surface** — scheduled workers, LLM/image providers, validators, admin UI.
- **Ops surface** — auth, leaderboards, analytics.

---

## 2. Clients

Web is Next.js + Tailwind and hosts both the player UI and the `/admin` area (role-gated); it deploys on Vercel. Mobile is React Native with Expo. Both share a `@quiz/sdk` TypeScript package (Zod schemas, REST client, and question-rendering primitives for text and image cards) so they render identically.

Anonymous play is first-class: the client mints a guest JWT on first open and can upgrade it to a Google-linked account later without losing progress.

---

## 3. Backend API

Node 20 + TypeScript on Fastify. REST + JSON (tRPC if you want full end-to-end types later).

**Auth** — JWT access + refresh tokens, transported as `Authorization: Bearer <jwt>` from both web and mobile. Web stores the JWT in an httpOnly cookie that a Next.js route handler unwraps into a header before calling the API; mobile keeps it in Expo SecureStore and attaches the header directly. **Google login only for v1** (Clerk is the fastest path; NextAuth if you prefer self-hosted). Apple and email can come later. Anonymous users get a signed guest JWT containing a `guest_user_id` that upgrades into a Google account without losing progress.

**Admin role bootstrap** — `users.role = 'admin'` is set by manual SQL update for v1 (one-time, via the bastion or local `psql` against the prod DB). When the admin set grows past one or two people, replace with a CLI script that takes an email and flips the bit. No self-service admin signup, ever.

**Core endpoints (MVP):**

- `POST /auth/*` — login, refresh, anonymous, upgrade
- `GET /sessions/new?mode=image&subject=math` — start a session, return N questions (both params optional and multi-valued)
- `POST /sessions/:id/answer` — submit an answer, return correctness
- `POST /sessions/:id/complete` — finalize, update leaderboard
- `GET /leaderboards/:scope` — daily / weekly / all-time (optional `mode` / `subject` filters)
- `GET /admin/questions?status=pending` — review queue (role-gated)
- `POST /admin/questions/:id/approve` / `reject`

Scoring is server-side only; clients never submit a final score.

---

## 4. Data model

Postgres is the source of truth.

**Taxonomy — two independent axes.** A question has a *mode* (how it's shown) and a *subject* (what it's about). Keeping them separate lets leaderboards, filters, and generation each target whichever axis makes sense.

- **mode** ∈ `text | image | video`. Video is reserved for a future phase.
- **subject** ∈ `math | history | general_knowledge | geography | pop_culture | ...`. Stored as FK to a `subjects` reference table, so new subjects don't need migrations.

Examples: a word problem about trains → `mode=text, subject=math`; an Eiffel Tower snapshot → `mode=image, subject=geography`; a "count the apples" picture → `mode=image, subject=math`.

### Tables

- **users** `(id, email, auth_provider='google'|'guest', is_anonymous, role, created_at)`
- **subjects** `(id, slug, display_name, created_at)`
- **questions** `(id, mode, subject_id, prompt_text, media_url, choices jsonb, correct_answer text, difficulty, status, generator_meta jsonb, created_at, approved_by, approved_at)`
  - `media_url` only when `mode` is `image` or `video`
  - `choices` is a JSON array of strings (length 4 for MVP, may grow later)
  - `correct_answer` is the canonical string that matches exactly one entry in `choices` — graded with case- and trim-sensitive equality. A CHECK constraint enforces membership. The server **never returns `correct_answer` to clients**; scoring happens server-side only.
  - `status` ∈ `pending | approved | retired`
  - `generator_meta` captures model name, prompt, cost, validation scores; for curated/seed images it also carries `{source_url, license, attribution, retrieved_at}`.
- **quiz_sessions** `(id, user_id, mode, subject_ids[], started_at, finished_at, total_score)`
- **answers** `(id, session_id, question_id, chosen_answer, is_correct)`
- **question_stats** `(question_id, shown_count, correct_count)` — rolled up from `answers`, used to recalibrate difficulty and retire bad questions.

Redis is used **only for leaderboards** (sorted sets keyed like `lb:daily:YYYY-MM-DD`, `lb:subject:math:alltime`). Everything else — seen-question tracking, short caches, rate-limit counters, the per-session answer-key cache — lives in the API process's memory. **This commits us to a single API instance** for as long as those features matter; horizontal scale requires moving them to Redis (or accepting sticky sessions). The constraint is documented as a Phase 1 watch item in §10.

---

## 5. Question generation pipeline

Batch, in-process. No external queue broker. `node-cron` inside the worker process fires periodically and generates a few new questions per `(mode, subject, difficulty)` bucket.

### Generator

Each run carries `(mode, subject, difficulty)` and picks a template accordingly. Cron ticks are **not crash-safe** by design (no broker, no persistent job table). Each tick must therefore be: (a) idempotent — safe to skip if a previous tick is still mid-flight, gated by an in-process mutex; (b) bounded — capped at a small batch size and a per-tick spend ceiling so a crash mid-batch can't burn unbounded LLM budget; (c) checkpointed — partial progress is committed to `questions` rows as `status='pending'` after each LLM call, so a crash loses at most one question's worth of work. Phase 2 will revisit if this becomes a real source of waste.

- **Text mode** — prompt an LLM with a *subject-specific* template, required JSON output `{prompt, choices, correct_answer, explanation}`. Math uses a constraint-based template (ranges, operators, step count); history and general-knowledge use a "fact + plausible distractors" template; other subjects have their own. Templates live in a `prompt_templates` table and can be versioned.
- **Image mode** — two steps:
  1. LLM proposes a concept appropriate to the subject (a landmark for `geography`, an animal for `biology`, a movie still for `pop_culture`, a count-the-objects scene for `math`) plus right/wrong choices.
  2. An image model (DALL·E / Imagen / Stable Diffusion) renders it, or a curated source (Unsplash / Wikimedia) is queried. Image goes to object storage; URL attached as `media_url`.
- **Video mode** — out of scope for MVP; the schema reserves space.

Curated image sources are often cheaper and clearer than generation for landmark / animal categories — lean on them wherever they beat generation.

### Auto-validator (before humans see it)

- **Math subject** — re-solve with a symbolic/numeric engine (mathjs / SymPy); reject if the answer is wrong or ambiguous.
- **Other text subjects** — a second LLM pass rates answer uniqueness and checks that distractors aren't also plausibly correct.
- **Image mode** — we rely on the image provider's built-in safety layer and **skip a dedicated NSFW stage**. Instead we run a **similarity score** — perceptual hash plus a CLIP-embedding distance — to catch near-duplicates of existing images and keep the pool visually diverse. A quick LLM coherence check ("does this image match the caption, and is only one answer right?") wraps it up.
- Outputs a confidence score attached to the question row.

### Human review

`/admin` area inside the Next.js app, gated by `users.role = 'admin'`. Pending questions sorted by confidence (lowest first). Admin can approve, reject, edit, retag difficulty, or bulk-approve high-confidence items. Approved questions flip to `status = approved` and become eligible to serve.

### Live feedback loop

A nightly rollup on `answers` updates `question_stats`, recalibrates difficulty from real accuracy rates, and auto-retires questions with suspiciously low accuracy or repeated complaints. This is what makes the pipeline self-improving.

---

## 6. Play flow

1. Client calls `POST /sessions/new?mode=image&subject=geography` (or an anonymous bootstrap first). Both params are optional and multi-valued.
2. API picks N questions balancing difficulty, respects the user's recent-seen list (stored in process memory), caches the answer key server-side.
3. Client renders the question.
4. Each `POST /answer` returns `is_correct` and the running score.
5. `POST /complete` finalizes the session, writes the score row, `ZADD`s the Redis leaderboards, emits a `session_completed` event.
6. Leaderboard endpoints read directly from Redis sorted sets with `ZREVRANGE`.

---

## 7. Anti-abuse and fairness

Keep it simple for v1 — no response-time heuristics, no real-time signals.

- Scoring is server-side only; the client never submits a final score.
- Per-user and per-IP rate limits on `/answer` and `/sessions/new`, with in-memory counters per API instance (fine at MVP scale).
- Leaderboard entries are accepted only if the session has a valid start → answers → complete sequence.
- Anonymous accounts are limited to daily-window leaderboards to discourage sybil spam.

We don't track response latency and we don't push live updates; polling the leaderboard is enough. We revisit when there's real product pressure.

---

## 8. Tech stack

| Layer | Recommendation |
| :---- | :---- |
| Web | Next.js + TypeScript + Tailwind |
| Mobile | React Native (Expo) |
| API + workers | Node 20 + Fastify + TypeScript (single process) |
| Scheduling | `node-cron` in-process (no external queue) |
| DB | Postgres |
| Cache / rate-limit | In-memory in the API process |
| Leaderboards | Redis sorted sets (the *only* Redis use) |
| Object storage | S3 or Cloudflare R2 + CDN |
| Auth | Clerk or self-hosted NextAuth — Google only |
| LLM | Claude or GPT for text and validation |
| Image gen | DALL·E / Imagen / SD, or Unsplash for curated |
| Hosting | Vercel (web) + Fly.io or Railway (API + workers) |
| Observability | Sentry + PostHog |

Nothing here is load-bearing. The design matters more than the picks.

---

## 9. Phased roadmap

- **Phase 0 — skeleton (1–2 weeks).** Next.js app, Fastify API, Postgres, anonymous play, ~20 hand-written seed questions across 2 modes × 2 subjects (e.g. text/math + image/geography). Proves the play flow. See [`active/mvp-skeleton-plan/`](../active/mvp-skeleton-plan/).
- **Phase 1 — accounts + leaderboards (2 weeks).** Google sign-in, guest-to-user upgrade, Redis leaderboards (scoped by subject and by mode), basic admin review UI.
- **Phase 2 — AI pipeline (3–4 weeks).** `node-cron` generator, auto-validator (math solver + text LLM check + image similarity score), admin queue, cost dashboard. Seed the pool across launch subjects.
- **Phase 3 — mobile (2–3 weeks).** React Native client against the same API, shared SDK.
- **Phase 4 — self-tuning + expansion (ongoing).** Difficulty recalibration, auto-retirement, A/B on formats. Add video mode and grow the subject catalog once the core loop is humming.

---

## 10. Risks to watch

**Upfront AI generation spend, not per-play cost.** Because one approved question is served to many users, per-play AI cost amortizes to near zero. The real spend is the drafts we discard while seeding each new subject. Cap the generation budget per approved question and lean on curated image sources where they beat generation.

**Copyright on images** — licensed or public-domain sources only; log provenance in `generator_meta`.

**Answer ambiguity** — the validator plus admin review exist for this; telemetry catches what slips through.

**Cold-start quality** — don't launch with an under-reviewed pool. 200 hand-approved questions beat 2,000 auto-approved ones.

**Leaderboard cheating** — server-side scoring is the single most important control.

**Single-instance assumption** — in-memory rate limits, recent-seen tracking, and the per-session answer-key cache all assume one API process. Adding a second instance silently breaks them (rate limits halve, recent-seen resets, mid-session `/answer` calls miss the cache and fall through to DB). When that day comes, promote each of these to Redis explicitly — don't reach for sticky sessions as a shortcut.

**Cron-driven generation has no broker safety net** — a crash mid-batch can lose work and waste LLM spend. Mitigated by per-tick spend caps and checkpointing partial progress as `status='pending'` rows; revisit if the loss rate becomes material.

---

## Review history

| Date | Reviewer | Outcome |
|------|----------|---------|
| 2026-04-18 | Ranjeet Kumar (6 comments on Drive doc) | APPROVE with changes: Google-only auth, mode/subject taxonomy split, drop BullMQ (node-cron in-process), drop NSFW classifier in favor of similarity score, remove response-time tracking, reframe AI cost risk as upfront pool-generation spend. All incorporated in this version. |
