# rcao-quiz — Architecture

> **Status:** Approved v2
> **Date:** 2026-04-19
> **Scope:** MVP (Phase 0 + 1) and near-term evolution

A casual **reels-style quiz app**: vertical-scroll feed of text question cards, answered or skipped at the user's pace. Content is AI-generated in the background with human review. Web and mobile clients share a TypeScript SDK. The system is architected for **the lowest plausible operating cost**, pushing state and grading to the client and keeping the backend small and mostly read-only.

Three decisions shape everything that follows. Read these before reading the rest:

- **[ADR 0001](adr/0001-reels-feed-not-session-rounds.md)** — it's an infinite feed, not exam rounds
- **[ADR 0002](adr/0002-client-heavy-cost-optimized.md)** — packs on CDN, clients grade locally, batched sync
- **[ADR 0003](adr/0003-text-only-mvp-client-templates.md)** — text-only for MVP, images in Phase 2

Guiding principle: **stay boring and lean**. In-memory where we can, managed services where we must, no external queue brokers, no Redis until leaderboards actually arrive.

---

## 1. High-level system

```
   Web (Next.js)                Mobile (React Native)
        │                                │
        │         shared @quiz/sdk       │
        └───────────────┬────────────────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
    ┌─────────────┐ ┌─────────┐ ┌──────────────┐
    │ Cloudflare  │ │   API   │ │  (Phase 2)   │
    │ R2 — packs  │ │  (Node) │ │  R2 images   │
    └─────────────┘ └────┬────┘ └──────────────┘
       zero-egress       │       zero-egress
       read-only         │
                  ┌──────┴───────┐
                  ▼              ▼
              Postgres      (no Redis in MVP;
            (source of        added only when
              truth)           leaderboards
                                 arrive)
```

Four concerns, each isolated:

- **Play surface** — clients fetch pack JSON from R2 and grade locally. The API is not on the hot path.
- **Sync surface** — clients batch interactions and push them to the API every ~30s. The API persists them and updates `question_stats`.
- **Generation surface** — an in-process `node-cron` scheduler inside the API runs the AI pipeline, writes `status=pending` questions, admin review promotes them to `status=approved`, a separate build step snapshots approved questions into packs on R2.
- **Ops surface** — Google OAuth login (optional upgrade from anonymous), admin review UI, observability.

---

## 2. Clients

Web is Next.js + Tailwind, deployed on Vercel. Mobile is React Native with Expo. Both share `@quiz/sdk` — a TypeScript workspace package with Zod schemas, REST client, pack parser, and the `QuestionCard` template renderer.

**Anonymous play is first-class.** On first open the client mints a local `guest_user_id` (UUID stored in IndexedDB / SecureStore), no server round-trip. Personal stats, seen-set, and interaction buffer all live locally. If the user later signs in with Google, a one-time merge call uploads the local stats blob and the server records them against the real account.

**Local storage on each client:**

- **Web** — IndexedDB for pack cache, dedupe structures (below), personal stats, and the outbound interaction buffer.
- **Mobile** — SQLite via `expo-sqlite` (or MMKV for the small stuff). Same shapes.

**Dedupe — two-tier.** The feed picker needs to avoid showing the same question twice to the same user, across sessions. Two structures cooperate:

- **`acted` — exact ring buffer** of the last ~10,000 question IDs the user answered or skipped. Stored as IndexedDB rows (web) or SQLite rows (mobile) keyed by question_id, with a `seen_index` counter for FIFO eviction beyond the cap. **Hard exclusion**: a question in `acted` is never served again while it's in the buffer. Exact match, no false positives, footprint ~750KB at 10,000 UUID keys. **Known limit**: a user crossing 10,000 acted questions starts losing exact dedupe on the oldest entries; combined with bloom rotation an answered question can resurface after roughly 200 days of heavy daily play. We treat that as adjacent-to-spaced-repetition and revisit only if telemetry shows complaints.
- **`seen` — bloom filter** tracking impressioned cards (anything shown to the user, whether acted on or not). Serialised as a `Uint8Array` single row in IndexedDB / blob in SQLite. Target parameters: capacity ~20,000, false-positive rate ~1%, giving m ≈ 192,000 bits (~24KB) and k ≈ 7 hash functions. **Soft preference**: the picker prefers candidates the filter says are not seen, but will fall back to "possibly seen" candidates if the filtered pool is exhausted. False positives show up as "user sees a different card they haven't seen" — harmless. False negatives are impossible.
- **Rotation.** Bloom filters saturate with use. Maintain two generations (`current` + `previous`); rotate when `current` approaches ~80% of capacity (~16,000 adds) and check against both during lookup. Rotated filters age out naturally, giving older impressions a chance to resurface — desirable for spaced repetition in a reels feed.

The picker logic: candidate pool = approved questions not in `acted`. Partition into "not in `seen`" (preferred) and "possibly in `seen`" (fallback). Serve from preferred, backfill from fallback if the preferred set is empty.

**Offline** — after the first pack download, the feed works with no connectivity. Interactions queue in the buffer and flush on next network.

**Feed rendering** — scroll-snap vertical feed. The client maintains a lazy window: the next 3–5 cards are pre-rendered (text + template) and mounted just off-screen, so the first pixel of the next card appears during scroll, not after. No image preloads in MVP; Phase 3 adds image prefetch to this window.

**Warm-start from bundled packs (Phase 4, mobile).** The APK/IPA ships a small curated starter set of packs as bundled assets. On first run of a new app version, the bundled packs seed the local cache so the first card renders with zero network calls. CDN tops up with newer packs in the background. See [ADR 0005](adr/0005-warm-start-bundled-packs.md).

---

## 3. Backend API

Node 20 + TypeScript on Fastify. REST + JSON. Single process (API + cron worker colocated).

**Auth** — JWT access + refresh tokens, transported as `Authorization: Bearer <jwt>`. Web stores the JWT in an httpOnly cookie that a Next.js route handler unwraps into a header before each call; mobile keeps it in Expo SecureStore and attaches the header directly. **Google login only for v1** (Clerk is the fastest path; NextAuth if you prefer self-hosted). Apple and email can come later. Anonymous users are tracked client-side only — no `users` row is written until a Google upgrade happens.

**Admin role bootstrap** — `users.role = 'admin'` is set by manual SQL update for v1 (one-time, via `psql`). When the admin set grows past two, replace with a small CLI. No self-service admin signup, ever.

**Core endpoints (MVP):**

- `POST /auth/google` — Google OAuth callback, mints JWT
- `POST /auth/upgrade` — anonymous → Google-linked. Body carries the client's `anon_guest_id` and the local stats blob. In one transaction: insert the new `users` row; `UPDATE interactions SET user_id = $new, anon_guest_id = NULL WHERE anon_guest_id = $old` (history follows the user); merge the stats blob into the user-stats backup table. The `interactions` XOR CHECK is satisfied throughout because both columns flip in the same statement.
- `GET /packs/manifest` — returns `{ packs: [...], retired_question_ids: [...] }`. Packs are `{ pack_id, url, hash, generation_batch, size_bytes, kind: 'content' | 'stats' }`. `retired_question_ids` is the suppression list the feed picker filters against (relevant from Phase 4 onwards when bundled packs exist in APKs that can't be edited post-release). Cached at the edge; clients diff against their local cache.
- `POST /sync` — accepts a batch of interactions plus optional personal-stats blob. Returns `200 { accepted: N }`. Writes to `interactions`, aggregates into `question_stats` in a transaction.
- `GET /admin/questions?status=pending&cursor=` — review queue, role-gated
- `POST /admin/questions/:id/approve` — sets `status=approved`, `approved_by`, `approved_at`
- `POST /admin/questions/:id/reject` — sets `status=retired` with a reason

**What the API does NOT expose** — no `/sessions/*`, no `/answer`, no `/complete`, no `/leaderboards` yet. All play is client-side.

**Rate limiting** — in-memory counter per JWT on `/sync` (one flush per ~30s is normal; more than ~4 per 30s is abusive). Per-IP counter on `/auth/*` to blunt guest-JWT spamming. Both reset on process restart — fine at MVP scale on a single instance.

---

## 4. Data model

Postgres is the source of truth. Packs on R2 are a derived, read-only projection. Stats packs (ADR 0004, Phase 2) are a second derived projection — computed daily from `interactions` — with a shorter cache lifetime.

### Taxonomy — two independent axes

A question has a *mode* (how it's shown) and a *subject* (what it's about). Independence lets filters, leaderboards (when they arrive), and generation each target whichever axis makes sense.

- **mode** ∈ `text | image | video`. **MVP writes only `text`.** Image and video are reserved for Phase 2+.
- **subject** ∈ `math | history | general_knowledge | geography | pop_culture | ...`. Stored as FK to a `subjects` reference table so new subjects don't need migrations.

Examples: a word problem about trains → `mode=text, subject=math`. An Eiffel Tower snapshot (Phase 2) → `mode=image, subject=geography`.

### Tables

- **users** `(id, email, auth_provider='google', role, created_at)`
  - Anonymous users are **not** stored. A row is written only when a Google sign-in completes.
- **subjects** `(id, slug, display_name, created_at)`
- **questions** `(id, mode, subject_id, prompt_text, media_url, choices jsonb, correct_answer text, difficulty, status, generator_meta jsonb, created_at, approved_by, approved_at)`
  - `choices` — JSON array of strings, length 4 for MVP
  - `correct_answer` — canonical string that matches exactly one entry in `choices`. Case- and trim-sensitive equality. Enforced by a CHECK constraint using `choices ? correct_answer`.
  - `media_url` — populated only when `mode ∈ {image, video}`. CHECK constraint: `media_url IS NULL iff mode = 'text'`.
  - `status` ∈ `pending | approved | retired`
  - `generator_meta` — `{model, prompt, cost_cents, validation_scores}` for AI-generated; `{source_url, license, attribution, retrieved_at}` for any future curated content
- **interactions** `(id, user_id, anon_guest_id, question_id, kind, chosen_answer, client_correct, seen_at, client_batch_id)`
  - `user_id` is nullable; for anonymous play, `anon_guest_id` (the client-minted UUID) is populated instead. A CHECK constraint enforces exactly one is non-null.
  - `kind` ∈ `answered | skipped | impression`
  - `chosen_answer` nullable; populated only when `kind=answered`
  - `client_correct` — what the client computed. We record it for stats but it's not authoritative; we can cross-check during admin review if anomalies appear.
  - `client_batch_id` — idempotency token from the client to deduplicate retries of the same `/sync` batch.
- **question_stats** `(question_id, shown_count, answered_count, correct_count, skipped_count, updated_at)`
  - Rolled up from `interactions` inside the `/sync` transaction. Skip rate ≈ `skipped_count / shown_count` is a primary question-quality signal.

Indexes:

- `interactions(client_batch_id, question_id, kind)` **unique** — idempotency for resubmitted `/sync` batches. The composite key is required because a single batch contains many rows; a unique index on `client_batch_id` alone would reject every row but the first.
- `interactions(user_id, seen_at)` / `interactions(anon_guest_id, seen_at)` for per-user queries
- `questions(status, mode, subject_id, difficulty)` for the pack builder and admin queue

### What is explicitly NOT in the schema

- No `quiz_sessions` — sessions don't exist (ADR 0001)
- No `answers` — replaced by `interactions` which records skips and impressions too
- No Redis-backed tables — Redis is not used at MVP

### Pack schema (R2 artifacts)

Packs are plain JSON uploaded to `r2://packs/{pack_id}.json`:

```json
{
  "pack_id": "pack_geography_v12_2026-04-19",
  "generation_batch": "2026-04-19-a",
  "schema_version": 1,
  "built_at": "2026-04-19T03:00:00Z",
  "subjects": ["geography"],
  "questions": [
    {
      "id": "q_01HX3F...",
      "mode": "text",
      "subject": "geography",
      "prompt_text": "Which river flows through Paris?",
      "choices": ["Seine", "Rhône", "Loire", "Garonne"],
      "correct_answer": "Seine",
      "difficulty": 2
    }
  ]
}
```

`correct_answer` is shipped. This is intentional (ADR 0002).

Clients compare pack hashes against the manifest to avoid re-downloading unchanged content. When a pack is rebuilt (new questions added, old retired), it gets a new `pack_id` and a new URL — the old pack remains on R2 with its immutable cache headers so clients that haven't upgraded yet keep working.

### Stats pack schema (R2 artefacts, Phase 2+)

Stats packs live alongside content packs on R2, with a shorter cache TTL (`max-age=3600`) since they refresh daily. Each stats pack is keyed to exactly one content pack via `for_pack_id`, carries per-question aggregates (attempts, correct_rate, skip_rate, sample_confidence) and a pack-level score distribution used for percentile lookups. Clients fetch stats packs lazily and render gracefully when absent. See [ADR 0004](adr/0004-statistical-percentile-leaderboards.md) for the full schema and rationale.

---

## 5. Question generation pipeline

Batch, in-process inside the API. No external queue broker. `node-cron` inside the same Node process fires periodically and generates a few new questions per `(subject, difficulty)` bucket.

**Crash-safety.** Cron ticks are not crash-safe by design — there's no persistent job table. Each tick is therefore:

- **Idempotent** — gated by an in-process mutex; overlapping ticks skip rather than double-run.
- **Bounded** — capped at a small batch size per tick and a per-tick spend ceiling so a crash mid-batch can't burn unbounded LLM budget.
- **Checkpointed** — each generated question is committed as `status='pending'` immediately after the LLM call, so a crash loses at most one question's worth of work.

Phase 2 will revisit if waste becomes visible.

### Generator (MVP — text only)

Each run carries `(subject, difficulty)` and picks a subject-specific prompt template. LLM output is constrained to JSON `{prompt, choices, correct_answer, explanation}`. Math uses a constraint-based template (ranges, operators, step count); history / general-knowledge use a "fact + plausible distractors" template. Templates live in a `prompt_templates` table and are versioned — a change is a new row, old rows stay for audit.

Image mode is deferred to Phase 2 (ADR 0003). The code path dispatching on `mode` is a single `switch` so adding the image case later is a localised change.

### Auto-validator

- **Math subject** — re-solve with a symbolic/numeric engine (`mathjs`) and confirm the answer matches the LLM's claim. Reject if wrong or ambiguous.
- **Other text subjects** — a second LLM pass rates answer uniqueness and checks that distractors aren't also plausibly correct. Outputs a confidence score.
- Confidence is stored in `generator_meta.validation_scores` and drives admin review ordering.

### Human review

`/admin` area inside the Next.js app, gated by `users.role = 'admin'`. Pending questions are listed in ascending confidence order (lowest first — those most likely to be bad). Admin can approve, reject (with reason), edit the text/choices/answer, retag subject or difficulty, or bulk-approve high-confidence batches. Approved questions flip to `status=approved` and become eligible for the next pack build.

### Pack builder

A separate script (`pnpm packs:build`) — runs on the same cron tick or manually — queries approved questions grouped by subject and difficulty, constructs pack JSONs, and uploads to R2 with content-addressed filenames. The manifest is regenerated and uploaded last (atomic cutover). If the build fails partway, the old manifest keeps pointing at the old packs — no client disruption.

### Live feedback loop

`question_stats` is updated on every `/sync` call. A nightly rollup:

- Recalibrates `difficulty` from actual accuracy rates (Elo-ish update, small learning rate)
- Auto-retires questions with suspiciously high skip rate or suspiciously low accuracy (thresholds tuned from real data)
- Retired questions fall out of the next pack build — clients see them drop off at the next manifest refresh

---

## 6. Play flow

From the client's perspective:

1. **App open** — client reads local state (guest_id, seen-set, stats, pack cache). Fires `GET /packs/manifest` in the background.
2. **Manifest diff** — for each pack in the manifest not in the local cache (or with a different hash), download and store. **Cached packs whose `pack_id` no longer appears in the manifest are evicted immediately** — retired content shouldn't keep occupying the cache, and relying on LRU alone lets stale packs squat there indefinitely. Still-listed packs are evicted by LRU under a size cap (e.g. 50MB).
3. **Feed start** — client picks questions from its local pack cache, filtered by user's subject preference and excluding the seen-set. The `QuestionCard` component dispatches on `mode` and renders with the deterministic template.
4. **User interacts** — answer (client checks `chosen === correct_answer`), skip (scroll past), or impression (card was seen but user scrolled past without engaging quickly).
5. **Buffer** — each interaction appends to an in-memory + persisted buffer with a `client_batch_id`.
6. **Flush** — every ~30 seconds or every ~20 interactions or on backgrounding, client posts the buffer to `POST /sync`. Server writes `interactions` rows and updates `question_stats` in one transaction. Client drops the buffer on 200.
7. **Personal stats** — updated live in local storage as the user plays. The flush sync also sends an optional snapshot for cross-device backup.

The server is touched exactly three ways during an active session: the manifest fetch at the start, periodic `/sync` calls, and the initial pack download. A user who plays offline for an hour and comes back online syncs cleanly with a batch.

---

## 7. Anti-abuse and fairness

Keep it simple for v1.

- **Client-graded play is trusted for personal stats.** Users can lie to themselves about their streak; that's fine.
- **`/sync` rate limit** — per JWT or per guest_id, in-memory counter. More than ~4 flushes in 30 seconds is abusive.
- **`client_batch_id` deduplication** — the unique index on `interactions.client_batch_id` makes retries safe. A resubmitted batch from a flaky network upserts cleanly.
- **`question_stats` outlier filter** — if a single `anon_guest_id` claims 10,000 interactions in an hour, drop them from the stats rollup but keep the rows. Real users don't play at that rate.
- **No leaderboards in MVP** — so no cheating to prevent. When a leaderboard lands, it will be a separate **server-graded** code path (see ADR 0002).

We do not track response latency, we do not push live updates, and we do not use websockets. Polling the manifest occasionally is enough.

---

## 8. Tech stack

| Layer | Choice |
| :---- | :---- |
| Web | Next.js 14 + TypeScript + Tailwind |
| Mobile | React Native (Expo) |
| API + cron workers | Node 20 + Fastify + TypeScript (single process) |
| Scheduling | `node-cron` in-process |
| DB | Postgres (Neon free tier to start) |
| Migrations | `node-pg-migrate` (plain SQL, no ORM) |
| CDN | Cloudflare R2 (zero egress) |
| Client storage | IndexedDB (web), SQLite / MMKV (mobile) |
| Auth | Clerk or self-hosted NextAuth — Google only |
| LLM | Claude or GPT for text generation + validation |
| Image gen (Phase 2) | DALL·E / Imagen / SD, with Cloudflare R2 for storage |
| Hosting | Vercel (web) + Fly.io (API, $5/mo tier) |
| Observability | Sentry + PostHog |

Nothing here is load-bearing. The design matters more than the picks.

---

## 9. Phased roadmap

- **Phase 0 — skeleton (1–2 weeks).** Monorepo + Postgres schema + `@quiz/sdk` + Fastify API (auth, manifest, sync only) + pack builder + ~50 hand-written text seed questions across 3 subjects + Next.js feed UI with scroll-snap + client pack cache + template renderer + batched sync. Proves the entire loop end-to-end, locally, with no AI and no accounts. See [`active/mvp-skeleton-plan/`](../active/mvp-skeleton-plan/).
- **Phase 1 — AI text pipeline + accounts + admin review (3–4 weeks).** Google sign-in, anonymous→Google upgrade merge, `node-cron` text-only generator with mathjs validator and LLM coherence check for other subjects, admin review UI at `/admin`, cost dashboard. Pool grows from hand-curated to AI-authored.
- **Phase 2 — stats & social-proof (1.5–2 weeks).** Daily stats builder that snapshots `interactions` into stats packs on R2. Client-side rendering of per-question difficulty pills, end-of-streak percentile cards, and weekly subject-mastery buckets. Wilson-interval smoothing and outlier-user filtering in the builder. See [ADR 0004](adr/0004-statistical-percentile-leaderboards.md) and [`active/stats-and-social-proof-plan/`](../active/stats-and-social-proof-plan/).
- **Phase 3 — images (3–4 weeks).** Image generation pipeline (LLM concept → image model → R2 upload), image-card template in the client, perceptual-hash dedupe, hotlink protection on R2. Schema already supports this — no migration needed.
- **Phase 4 — mobile (2–3 weeks).** React Native client against the same API. Shared SDK; only `QuestionCard` and storage adapters are platform-specific.
- **Phase 5 — self-tuning + optional competitive modes (ongoing).** Difficulty recalibration from real data, auto-retirement of bad questions. If product data supports it, add a server-graded **daily challenge** mode with Redis leaderboards (the first real reason to introduce Redis). The casual feed stays client-graded and stats-decorated; competitive modes live in their own code path.

---

## 10. Risks to watch

**Upfront AI generation spend, not per-play cost.** Because one approved question is served to many users via a pack, per-play AI cost amortises to effectively zero. The real spend is generating and discarding drafts while seeding each new subject. Cap generation budget per approved question, and keep the human admin tight during seeding.

**Client-server state drift.** Clients own state; servers see only what's synced. If a client corrupts its local DB, the user loses stats. Mitigation: the `/sync` stats snapshot is a soft backup, eventually consistent. Not bulletproof, fine for MVP.

**Answer-key visibility.** Accepted trade (ADR 0002). If a leaderboard ever matters, it lives in a separate server-graded mode.

**Copyright on future images.** Phase 2 problem, but decide licensing policy before generation starts. Image provenance goes in `generator_meta`.

**Template monotony.** 2–3 templates per subject may feel repetitive to heavy users. Adding templates is cheap — just design work. Watch retention, expand if needed.

**Scraping.** Packs are scrapeable. Accepted. Freshness + fingerprinting is the defence. Add real image-URL signing only if R2 egress ever shows up in the bill in a way that matters.

**Single API instance implied by in-memory rate limits + cron.** Fine for MVP. Horizontal scale requires moving rate-limit counters to Redis (or using sticky sessions) and moving cron to a locked leader (or a managed scheduler). Document-and-defer.

---

## Review history

| Date | Reviewer | Outcome |
|------|----------|---------|
| 2026-04-18 | Ranjeet Kumar (6 comments on Drive doc) | APPROVE with changes: Google-only auth, mode/subject taxonomy split, drop BullMQ (node-cron in-process), drop NSFW classifier in favour of similarity score, remove response-time tracking, reframe AI cost risk as upfront pool-generation spend. All incorporated in v1. |
| 2026-04-19 | Brainstorm session | **Three ADRs adopted** — see [`adr/`](adr/). Product pivots to reels-style feed (drops sessions), architecture goes client-heavy with R2 packs and batched sync (drops per-event API grading), MVP ships text-only with client templates (drops images to Phase 2). This v2 doc reflects all three. |
| 2026-04-19 | Follow-up on retention | **ADR 0004 adopted** — statistical percentile leaderboards via separate stats packs on R2. Adds a new Phase 2 (stats & social-proof) between the AI pipeline and images. Phases 2–4 renumbered. |
| 2026-04-19 | Follow-up on mobile UX + client dedupe | **ADR 0005 adopted** — warm-start from bundled packs in APK/IPA (Phase 4 implementation, decision captured now). Client-storage section gains a two-tier dedupe spec: exact ring buffer for acted-on questions, bloom filter for impressions with monthly rotation. Manifest endpoint extended with `retired_question_ids` for post-release content suppression. |
