# rcao-quiz — Architecture

A casual reels-style quiz app: vertical-scroll feed of text question cards, answered or skipped at the user's pace. **Mobile-only** (iOS + Android via React Native / Expo). AI-generated content with cascading AI review. The MVP runs zero hosted compute at runtime — the app talks only to a CDN and to Google Analytics; content generation and stats rollups are daily batch jobs on a scheduled host.

The six ADRs are the load-bearing decisions; everything below follows from them.

- [ADR 0001](adr/0001-reels-feed-not-session-rounds.md) — reels-style infinite feed, not exam rounds
- [ADR 0002](adr/0002-client-heavy-cost-optimized.md) — client-graded play, server-less runtime (CDN + GA4)
- [ADR 0003](adr/0003-text-only-mvp-client-templates.md) — text-only MVP with client-side subject templates
- [ADR 0004](adr/0004-statistical-percentile-leaderboards.md) — percentile social-proof, not ordinal leaderboards
- [ADR 0005](adr/0005-git-content-store.md) — content lives in git as JSON files
- [ADR 0006](adr/0006-ai-review-flag-digest.md) — AI-only review with user flags + Slack digest

Guiding principle: **stay boring and lean**. Don't introduce a runtime service until a real requirement forces one.

---

## 1. High-level system

```
            Mobile app (React Native + Expo, iOS + Android)
                              │
                       @quiz/sdk
                              │
                      ┌───────┴───────┐
                      ▼               ▼
                Cloudflare R2        GA4 (Firebase
                (packs +              Analytics SDK)
                 manifest +                │
                 stats packs)              ▼
                       ▲              BigQuery
                       │              (free-tier export)
                       │                   │
                       └─────────┬─────────┘
                                 │
                                 ▼
                ┌──────────────────────────────────┐
                │ Scheduled pipeline host          │
                │   • AI gen + cascading review    │
                │   • Pack builder → R2            │
                │   • Stats builder BQ → R2        │
                │   • Daily Slack digest           │
                └──────┬─────────────┬─────────────┘
                       │             │
                       ▼             ▼
                   git content    Slack
                     repo         webhook
```

Three concerns, isolated:

- **Play surface** — the app fetches pack JSON from R2 and grades locally. Interactions fire GA4 events. No application server on the hot path.
- **Pipeline surface** — a scheduled host runs content generation, cascading AI review, pack building, stats building, and the daily Slack digest. Reads LLM APIs; writes to the git content repo and to R2; reads from the BigQuery GA4 export.
- **Ops surface** — operator reads the Slack digest and runs a local CLI to retire questions. No admin UI, no auth.

---

## 2. Client

The app is React Native + Expo, targeting iOS and Android from one codebase. Styling is via NativeWind (Tailwind-compatible utility classes for RN) so design intent ports cleanly when we ever touch web again. Navigation uses Expo Router. Shared logic lives in `@quiz/sdk` — a TypeScript workspace package with Zod schemas, pack parser, the `QuestionCard` template renderer, the GA4 event abstraction, and the client-side dedupe + storage helpers.

### Identity

One UUID, client-minted. On first open the client creates an `anon_guest_id` (random UUID) and stores it in `expo-secure-store`. This is the only identity in MVP — there is no login. Every GA4 event carries `anon_guest_id` as a user_property. If a real login ever returns (Phase 4+ competitive modes), it co-exists with `anon_guest_id` rather than replacing it.

### Local storage

- **`expo-secure-store`** — `anon_guest_id`, anything else that should be encrypted at rest.
- **`expo-sqlite`** — pack cache (one row per pack id, JSON blob), `acted` ring buffer, `seen` bloom filter blob, flag-dedupe table.
- **`react-native-mmkv`** — personal stats (today's correct, streak, per-subject accuracy). Synchronous reads, very fast, fine for hot UI updates.

### Two-tier dedupe

The picker needs to avoid showing the same question twice. Two structures cooperate:

- **`acted` — exact ring buffer** of the last ~10,000 question IDs the user answered or skipped, stored as rows in a SQLite table keyed by `question_id` with a `seen_index` for FIFO eviction. Hard exclusion: a question in `acted` is never served again while it's in the buffer. Footprint ~750KB at 10k UUID keys.
- **`seen` — bloom filter** for impressions (cards shown but not acted on), serialised as a `BLOB` row in SQLite. Capacity ~20,000, FP rate ~1%, m ≈ 192,000 bits (~24KB), k = 7. Two generations (`current` + `previous`); rotate when `current_inserts > 16,000`. Lookups consult both. Soft preference: picker prefers candidates the filter says aren't seen, falls back to "possibly seen" if the preferred set is empty. False positives mean "user sees a different unseen card" — harmless.

Picker logic: candidate pool = approved questions not in `acted`. Partition into "not in `seen`" (preferred) and "possibly in `seen`" (fallback). Serve from preferred, backfill from fallback.

### Flag UX

Each card has a "report" affordance. Tap opens a sheet with a reason enum (`offensive | incorrect | confusing | other`). Submit fires a GA4 `question_flagged` event and stores `(question_id, anon_guest_id)` locally so the same user can't flag the same question twice. No server round-trip.

### Offline + feed rendering

After the first pack download, the feed works with no connectivity. Firebase Analytics buffers events locally and flushes on reconnect.

The feed is a `FlatList` (or `react-native-pager-view`) with `pagingEnabled` + vertical orientation, snapping one card per viewport. `windowSize` and `initialNumToRender` are tuned so 3–5 cards are mounted just off-screen — the first pixel of the next card appears during scroll, not after. No image preloads in MVP (no images yet); Phase 3 adds image prefetch.

---

## 3. Runtime surfaces

There is no application server. At user-request time, the app talks to exactly two systems.

### 3.1 Cloudflare R2

Hosts every public artefact:

- **`packs/manifest.json`** — short cache (`max-age=300`). The app fetches on open and on scheduled refresh. Shape: `{ packs: [...], retired_question_ids: [...] }`. See §4.
- **`packs/<pack_id>.json`** — immutable content packs, long cache (`max-age=31536000, immutable`). Content-addressed filenames; the app diffs by hash.
- **`packs/stats_<pack_id>_<date>.json`** — stats packs (Phase 2+). `max-age=3600` since they refresh daily. Schema in [ADR 0004](adr/0004-statistical-percentile-leaderboards.md).

R2 is "zero egress" — no bandwidth bill for reads. Writes happen only from the scheduled pipeline host.

### 3.2 Google Analytics 4 (Firebase Analytics SDK)

Captures every interaction. Event schema in §4.4. The Firebase SDK handles batching, retry, and offline buffering. The GA4 measurement ID is public (baked into the app bundle); anti-abuse relies on distinct-user counting in BQ rollups (§7).

### 3.3 What does not exist

No `/sync`, `/auth/*`, `/admin/*`, `/packs/manifest` HTTP endpoints. No Fastify or Node service. No hosted Postgres or Redis. No JWTs, no sessions, no OAuth. **No web app** — the product is mobile-only. A future server-graded competitive mode (Phase 4+ if ever) would reintroduce a server, but it would run alongside this surface, not in place of it.

---

## 4. Data model

The source of truth for **content** is the git repository (ADR 0005). The source of truth for **events** is GA4 / BigQuery (ADR 0002). There is no relational database.

### 4.1 Content (git repo)

```
content/
├── subjects.json
├── prompt_templates/
│   └── <subject>-v<N>.json
└── questions/
    └── <question_id>.json
```

`subjects.json`:

```json
[
  { "slug": "math", "display_name": "Math" },
  { "slug": "geography", "display_name": "Geography" },
  { "slug": "general_knowledge", "display_name": "General Knowledge" }
]
```

Each question file:

```json
{
  "id": "q_01HX3F7Z8K...",
  "mode": "text",
  "subject": "geography",
  "prompt_text": "Which river flows through Paris?",
  "choices": ["Seine", "Rhône", "Loire", "Garonne"],
  "correct_answer": "Seine",
  "difficulty": 2,
  "status": "approved",
  "generator_meta": { "model": "claude-sonnet-4-6", "validation_scores": { ... } },
  "retired_at": null,
  "retired_reason": null
}
```

`status ∈ {pending | approved | flagged | retired}`. Only `approved` lands in packs. `choices` is a 4-element string array; `correct_answer` is the canonical string that matches one entry exactly (case- and trim-sensitive). Grading is client-side. `generator_meta.validation_scores` records per-stage AI review scores ([ADR 0006](adr/0006-ai-review-flag-digest.md)).

### 4.2 Content pack (R2 artifact)

```json
{
  "pack_id": "pack_geography_v12_2026-04-21",
  "generation_batch": "2026-04-21-a",
  "schema_version": 1,
  "built_at": "2026-04-21T03:00:00Z",
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

Only fields the client needs for play ship in packs; `generator_meta`, `status`, and retirement fields stay in the git file and never go to R2. Packs are content-addressed and immutable.

### 4.3 Manifest (R2 artifact)

```json
{
  "packs": [
    { "kind": "content", "pack_id": "pack_geography_v12_2026-04-21", "url": "...", "hash": "sha256:...", "size_bytes": 18234 },
    { "kind": "stats",   "stats_pack_id": "stats_geography_v12_2026-04-21", "for_pack_id": "pack_geography_v12_2026-04-21", "url": "...", "hash": "sha256:...", "size_bytes": 4120 }
  ],
  "retired_question_ids": ["q_01HX...", "q_02HY..."]
}
```

`retired_question_ids` is the suppression list for clients with cached pack versions containing those questions.

### 4.4 Event schema (GA4)

The SDK exposes one `analytics.emit(event, params)` function. Events:

| Event name | Params | When fired |
|---|---|---|
| `session_start` | (GA4 built-in) | App open |
| `question_answered` | `question_id, subject, chosen_answer, correct, difficulty` | User picks an option |
| `question_skipped` | `question_id, subject` | User scrolls past without answering |
| `question_impression` | `question_id, subject` | Card on-screen >2s without engagement |
| `question_flagged` | `question_id, subject, reason` | User taps report + picks reason |
| `pack_downloaded` | `pack_id, size_bytes, duration_ms` | Client finished fetching a pack |

Every event carries `anon_guest_id` as a user_property. Client-side dedupe (flag-dedupe table) prevents the same `(question_id, anon_guest_id)` flag from firing twice.

### 4.5 Stats pack (R2 artifact, Phase 2+)

Per [ADR 0004](adr/0004-statistical-percentile-leaderboards.md). Per-question aggregates + pack-level score distribution, computed daily from the BQ export by the stats builder. Every count is `COUNT(DISTINCT anon_guest_id)`, not raw event count.

### 4.6 What is explicitly not here

No `users` table. No `interactions` table. No `quiz_sessions` / `answers` / `question_stats` in Postgres. No Redis. No relational database anywhere.

---

## 5. Pipeline (scheduled host)

Everything that isn't "client talks to CDN" runs here. Host choice is open — Lightsail, a tiny VM, GitHub Actions, or a laptop on a cron. What matters is that it runs on a schedule and has git + LLM API + R2 access.

### 5.1 Daily cron stages

1. **AI generation + cascading review** ([ADR 0006](adr/0006-ai-review-flag-digest.md))
   - Generate candidates per `(subject, difficulty)` bucket from `prompt_templates`.
   - Red-line keyword prefilter — deterministic, zero LLM cost.
   - Haiku-class pass — topic sensitivity (religion, culture, politics).
   - Sonnet-class pass — safety-critical (child safety, NSFW). Only on candidates that survived stage 2.
   - Coherence/correctness — `mathjs` re-solve for math; LLM coherence pass for text.
   - Approved → write `content/questions/<id>.json` with `status=approved` + scores in `generator_meta.validation_scores`. Flagged → same file, `status=flagged`; digest picks it up.
   - Commit + push.

2. **Pack builder**
   - Read `content/questions/*.json` where `status=approved`.
   - Group by subject; build packs; hash; upload to R2 with content-addressed URLs.
   - Regenerate `manifest.json` including `retired_question_ids` from files with `status=retired`.
   - Upload manifest last (atomic cutover).

3. **Stats builder** (Phase 2+)
   - Query BigQuery for the last-day events per pack; apply distinct-user + outlier-filter rules ([ADR 0004](adr/0004-statistical-percentile-leaderboards.md), §7).
   - Compute per-question aggregates + pack-level score distribution.
   - Write `stats_<pack_id>_<date>.json` to R2; append to manifest.

4. **Daily Slack digest** (ADR 0006)
   - Query BQ for `question_flagged` events grouped by `question_id`, distinct-user-counted, threshold-filtered.
   - Query content repo for questions with `status=flagged` created in last 24h.
   - Query content repo for questions retired in last 24h.
   - Compute pipeline stats: candidates / approved / flagged / LLM spend.
   - Post one message to the Slack webhook.

### 5.2 Retirement CLI (operator-driven)

- `pnpm questions:inspect <id>` — prints the question file, last 7 days of flag events (via local BQ query), recent stats data.
- `pnpm questions:retire <id> --reason "<reason>"` — updates `content/questions/<id>.json` to `status=retired`, commits, pushes. Next pipeline run rebuilds packs + manifest; clients pick up retirement within the 5-minute manifest cache window.

### 5.3 Runner host options

No architectural dependency on which host runs the cron. Rough order of least-to-most ops:

- **Laptop on cron** — works for solo operator; fragile (laptop offline = pipeline stops).
- **GitHub Actions** — free tier (~2000 min/month). Good default.
- **AWS Lightsail / tiny VM** — ~$3–5/month, fully in-hand, good when pipeline grows beyond Actions limits.
- **Managed cron services** — Phase 5+ if ever.

---

## 6. Play flow

From the app's perspective:

1. **App open** — read local state (`anon_guest_id`, pack cache, dedupe, personal stats). Fire `session_start`. Fetch `https://packs.<domain>/manifest.json` in background.
2. **Manifest diff** — for each manifest entry not in the local cache (or with a different hash), download and store. Evict cached packs whose `pack_id` is no longer in the manifest. Still-listed packs evicted by LRU under a 50MB cap.
3. **Feed start** — pick questions from local pack cache, filtered by subject preference, two-tier dedupe applied.
4. **User interacts**:
   - **Answer** — app checks `chosen === correct_answer`, fires `question_answered`. Haptic tap.
   - **Skip** — fires `question_skipped`.
   - **Impression** — on-screen >2s without engagement → fires `question_impression`.
   - **Flag** — tap report → pick reason → fires `question_flagged`, stores dedupe entry locally.
5. **Personal stats** — updated live in MMKV. Never leave the device.

The runtime is touched twice during a session: fetch manifest on open, fetch pack(s) when new ones appear. GA4 events flush in their own cadence per the Firebase SDK.

---

## 7. Anti-abuse and fairness

There is no server to enforce rate limits; defences live in (a) what the client SDK does, (b) what BQ queries count.

### 7.1 Client-side

- **Flag-dedupe.** One flag per `(question_id, anon_guest_id)` enforced in local storage.
- **Answer grading is honest to the user.** Users can lie to themselves about their streak via devtools; aggregate stats don't care.

### 7.2 BigQuery rollup defences

- **Distinct-user counting everywhere.** Every aggregate counts `COUNT(DISTINCT anon_guest_id)`, never `COUNT(*)`.
- **Minimum-sample gates** ([ADR 0004](adr/0004-statistical-percentile-leaderboards.md)). Per-question pills exposed only for questions with ≥ 200 distinct attempters at the high-confidence threshold.
- **Outlier-user filter.** Any single `anon_guest_id` contributing > threshold events per question per day is dropped from rollups.

### 7.3 Accepted

- **Public GA4 measurement ID.** Can't prevent junk events. Mitigated by distinct-user counting. If abuse turns material, a Cloudflare Worker rate-limit edge function is the escape hatch — doesn't reintroduce a runtime server.
- **Coordinated small-group attacks on flags.** ≥ 5 distinct accounts flagging a good question can push it into the digest, but final retirement is manual — noise-not-outcome.
- **Client-side anti-cheat is fragile.** A future server-graded competitive mode would run on a separate endpoint with its own trust model.

---

## 8. Tech stack

| Layer | Choice |
| :---- | :---- |
| App | React Native + Expo (iOS + Android, single codebase) |
| Routing | Expo Router |
| Styling | NativeWind (Tailwind for RN) |
| Shared SDK | TypeScript + Zod (`@quiz/sdk`) |
| Content store | git repository (`content/`) |
| CDN | Cloudflare R2 (zero egress) |
| Analytics | Firebase Analytics SDK → GA4 → BigQuery free export |
| Pipeline host | GitHub Actions / Lightsail / laptop cron (host choice open) |
| LLM | Claude (Haiku 4.5 for cheap pass, Sonnet 4.6 for nuanced pass) |
| Math validator | `mathjs` (deterministic re-solve) |
| App storage | `expo-secure-store` (identity), `expo-sqlite` (packs + dedupe), `react-native-mmkv` (personal stats) |
| Notifications | Slack incoming webhook |
| Distribution (Phase 1+) | Expo EAS Build → TestFlight (iOS) + Internal Testing (Android) |

Not in the stack: web app of any kind (Next.js, Vite, anything). Fastify / Express / Node web service. Postgres / Neon / Supabase. Redis. Auth provider (Clerk, NextAuth, Auth0). Job queue (BullMQ etc.). Sentry.

---

## 9. Phased roadmap

- **Phase 0 — Expo scaffolding + local dev (2–3 weeks).** Monorepo (Expo app + SDK + scripts), Expo Router, NativeWind, content dir with 50 hand-written text questions across 3 subjects, pack builder writing to local disk, reels feed UI on `FlatList` with paging-snap, app storage (SQLite + MMKV) with two-tier dedupe, GA4 event abstraction stubbed to console. Proves the full play loop on iOS Simulator + Android Emulator with zero network services. See [`active/mvp-skeleton-plan/`](../active/mvp-skeleton-plan/).
- **Phase 1 — AI pipeline + real GA4 + cron host + EAS Build (3–4 weeks).** Cascading review pipeline, Firebase Analytics real setup, R2 bucket + upload, scheduled cron on a runner, Slack webhook for the digest, retirement CLI. EAS Build configured for TestFlight + Android internal testing so the app reaches a small group of real users. Replaces dev stubs with real analytics and lands the content pipeline.
- **Phase 2 — stats & social-proof (1.5–2 weeks).** Daily stats builder reading from BigQuery, stats packs on R2, per-question difficulty pills, pack-level percentile cards, weekly subject-mastery summary on `/stats`. See [ADR 0004](adr/0004-statistical-percentile-leaderboards.md) and [`active/stats-and-social-proof-plan/`](../active/stats-and-social-proof-plan/).
- **Phase 3 — images (3–4 weeks).** Image generation pipeline (LLM concept → image model → R2 upload), image-card template in the app, perceptual-hash dedupe, hotlink protection on R2. Schema already supports this — no migration needed. Optional warm-start by bundling a curated starter pack into the binary so first launch renders without network — decision made when planning the phase.
- **Phase 4 — self-tuning + optional competitive modes (ongoing).** Difficulty recalibration from stats, auto-retirement of bad questions. If product data supports it, introduce a server-graded competitive mode as a new surface (and that's when real auth, Redis leaderboards, and a hosted service return — not before). The casual feed stays server-less and client-graded.

---

## 10. Risks to watch

**Flag-to-retirement latency (~24h).** Daily digest cadence is the floor. Mitigated by short manifest cache (5 min) so retirements propagate fast once triggered, and by the manual CLI for live incidents. A viral-bad-question scenario still requires the operator to be paying attention.

**Pipeline runner as single point of failure for content updates.** Host dies → play keeps working (clients use whatever's on R2) → content generation stops until restored. The pipeline is a deterministic script; recovery is "push from another box."

**Git scale ceiling (~100k questions).** Mitigation in [ADR 0005](adr/0005-git-content-store.md): shard by id prefix, then JSONL per subject. Phase 5+ problem.

**Public GA4 measurement ID accepts junk events.** Distinct-user counting in BQ is the defence; Cloudflare Worker rate-limit is the escape hatch.

**LLM cost overshoot during generation.** Per-run spend ceiling in pipeline config hard-stops it.

**Upfront AI generation spend, not per-play cost.** One approved question serves many users via a pack, so per-play cost amortises to effectively zero. The real spend is the drafts we discard.

**Content in git is in history forever.** Red-line prefilter + sonnet safety pass catches the worst before commit; retired content never ships in a pack. `git filter-repo` is the nuclear option for actionable content.

**Copyright on future images.** Phase 3 problem. Decide licensing policy before generation starts.
