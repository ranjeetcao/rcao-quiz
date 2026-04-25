# Stats & Social-Proof Plan

> **Status:** PLANNING
> **Services:** apps/mobile, packages/sdk, scripts/
> **Estimated effort:** 1.5–2 weeks across 10 tasks
> **Cross-references:** [Architecture](../../reference/architecture.md), [ADR 0002](../../reference/adr/0002-client-heavy-cost-optimized.md), [ADR 0004](../../reference/adr/0004-statistical-percentile-leaderboards.md), [ADR 0005](../../reference/adr/0005-git-content-store.md), [MVP Skeleton Plan](../mvp-skeleton-plan/)

---

## 1. Problem statement

The MVP skeleton (Phase 0) proves the play loop — users scroll, answer, skip, flag. Phase 1 turns real events on (Firebase Analytics → GA4 → BigQuery export) and ships the AI content pipeline. That works, but it gives users nothing to come back for after novelty wears off. Traditional quiz products solve this with leaderboards. Our client-graded, server-less architecture (ADR 0002) makes ordinal rankings untrustworthy and expensive, but the event stream flowing through GA4 / BigQuery is perfectly legitimate in aggregate.

This plan turns aggregate events into **three retention surfaces** in the mobile app — per-question difficulty social-proof, per-pack percentile self-placement, and weekly subject-mastery buckets — without compromising the cost model (CDN artefacts stay cacheable), the offline story (stats are decoration, not required), or statistical honesty (min-sample thresholds, outlier filters, Wilson smoothing, distinct-user counting).

### Current state at plan start

- Phase 0 + Phase 1 complete: app is on TestFlight + Android internal testing; `anon_guest_id` is the sole identity; Firebase Analytics emits events to GA4; BigQuery free-tier export is landing events in `events_*`.
- Content pipeline is running daily; packs and the manifest live on R2.
- No stats builder. No stats packs on R2. No social-proof UI.

### Desired state at plan exit

- A daily `pnpm stats:build` (run on the same scheduled host as the content pipeline) queries BigQuery for the last-window events, computes per-question and per-pack aggregates, and writes stats packs to R2 with a 1-hour cache TTL.
- `manifest.json` on R2 includes stats entries alongside content entries (written as part of the same atomic pipeline update).
- The app downloads stats packs opportunistically, merges them into the feed, and renders: a difficulty pill after each answer, a percentile card every ~10 cards, and a weekly subject mastery summary on `/stats`.
- Sample-size rigour is built in: low-confidence stats are hidden; outlier user contributions are filtered; distinct-user counting defuses junk-event attacks.
- Privacy policy references aggregate stats in one honest paragraph; a settings toggle lets users opt out of contributing events to the stats rollup.

### Out of scope for Phase 2

- Ordinal leaderboards.
- Server-graded daily challenge mode (separate future plan; Phase 4+).
- Real-time push of stats updates.
- Cross-pack "global" leaderboards.

---

## 2. Goals

| # | Goal | Measured By |
|---|------|-------------|
| G1 | Retention hook end-to-end | Users see the difficulty pill, percentile card, and mastery summary during normal play |
| G2 | Stats are statistically honest | Pills hidden on low sample; Wilson smoothing prevents small-N noise; outlier users filtered; distinct-user counting applied |
| G3 | CDN economics preserved | Content packs remain immutable; stats packs have their own cache strategy |
| G4 | Offline play still works | Feed renders with no decorations when stats packs are absent |
| G5 | Privacy-defensible | All numbers aggregate; no individual user identifiable; opt-out exists |

---

## 3. Artefact shapes

### Stats pack JSON (v1)

```json
{
  "stats_pack_id": "stats_geography_v12_2026-04-20",
  "for_pack_id":   "pack_geography_v12_2026-04-19",
  "computed_at":   "2026-04-20T00:00:00Z",
  "schema_version": 1,
  "sample_size_global": 48231,
  "per_question": {
    "q_01HX3F...": {
      "attempts": 1842,
      "correct_count": 424,
      "skip_count": 160,
      "correct_rate": 0.23,
      "attempt_rate": 0.92,
      "skip_rate": 0.08,
      "sample_confidence": "high"
    }
  },
  "pack_score_distribution": {
    "attempts_considered": 9120,
    "window_size": 10,
    "percentile_by_score": [
      { "score": 0, "p": 0 },
      { "score": 1, "p": 2 },
      { "score": 5, "p": 42 },
      { "score": 7, "p": 68 },
      { "score": 10, "p": 98 }
    ]
  }
}
```

All counts are **`COUNT(DISTINCT anon_guest_id)`** in BigQuery, not raw event counts. One user firing many events counts as one.

Fields:

- `sample_confidence` bands: `low` (N < 50 or Wilson interval width > 0.2), `medium` (N 50–200 or width 0.1–0.2), `high` (N ≥ 200 and width < 0.1).
- `pack_score_distribution.window_size` is the rolling-N the distribution is built over. Must match what the app computes locally.
- `attempt_rate = attempts / (attempts + skips)` reported alongside `correct_rate` so self-selection bias is visible.

### Subject-percentiles (R2 artifact)

A small companion artifact built on the same cron cycle:

```json
{
  "stats_id": "stats_subject_percentiles_2026-04-20",
  "computed_at": "2026-04-20T00:00:00Z",
  "schema_version": 1,
  "window_days": 7,
  "per_subject": {
    "math":      { "p25": 0.40, "p50": 0.52, "p75": 0.67, "p90": 0.81 },
    "geography": { "p25": 0.35, "p50": 0.48, "p75": 0.61, "p90": 0.76 }
  }
}
```

Used by the `/stats` screen (STATS-09) to place the user's personal accuracy inside a weekly distribution bucket. Kept as a separate tiny artifact (not crammed into every stats pack) because it's aggregated across packs.

### Manifest (extended)

Already extensible via the `kind` discriminator in `ManifestEntry`. Pipeline writes all entries (content + stats + subject-percentiles) into the same `manifest.json` on R2 within one cron tick; the manifest is the last thing uploaded so the cutover is atomic.

---

## 4. Tasks

### STATS-01 — SDK schemas + helpers

**Effort:** S
**Goal:** Typed contracts for stats pack, subject-mastery stats, and manifest entries, plus the small helper functions the UI needs.

- Zod schemas in `@quiz/sdk`:
  - `SampleConfidence` = `z.enum(['low', 'medium', 'high'])`
  - `QuestionStats`, `PackScoreDistribution`, `StatsPack` — per §3.
  - `SubjectPercentiles` — `{stats_id, computed_at, schema_version, window_days, per_subject}`.
  - Extend `ManifestEntry` discriminated union with `kind: 'subject_percentiles'`.
- Helpers:
  - `lookupPercentile(distribution, score): number` — binary search with linear interpolation between buckets.
  - `shouldRenderPill(stats): boolean` — confidence policy; overridable by a flag.
  - `bucketAccuracy(accuracy, percentiles): 'top_10' | 'top_25' | 'top_50' | 'below_50'`.

**Exit:** Types compile across workspaces. Unit tests for helpers pass.

---

### STATS-02 — Stats builder (BigQuery)

**Effort:** M
**Goal:** `pnpm stats:build` computes stats packs from BigQuery GA4 events and writes them to R2 via the storage interface.

Script: `scripts/stats-build.ts`, run on the same scheduled host as the content pipeline.

For each content pack listed in the current manifest:

1. Query BQ for the last-30-days rolling window of `question_answered`, `question_skipped`, `question_impression` events where `question_id` is in this pack.
2. Apply the outlier filter (STATS-04) inside the SQL.
3. Compute per-question aggregates with **distinct-user counting**:
   - `attempts = COUNT(DISTINCT IF(event_name='question_answered', anon_guest_id, NULL))`
   - `correct_count`, `skip_count`, `impression_count` similarly.
   - `correct_rate = correct_count / attempts`; `attempt_rate = attempts / (attempts + skips)`; `skip_rate = skips / impressions`.
4. Compute `pack_score_distribution`:
   - For each `anon_guest_id` who answered ≥ window_size questions in this pack within the window, take the rolling-window correct counts as samples.
   - Bucket by score, compute the CDF, emit `percentile_by_score`.
5. Apply Wilson smoothing + sample-confidence banding (STATS-03).
6. Write `stats_<pack_id>_<YYYYMMDD>.json` to R2 via `PackStorage`. Hash the canonicalised JSON; populate the manifest entry.

Build the `subject_percentiles` artifact:

1. Query BQ for the last 7 days of `question_answered` events grouped by `(anon_guest_id, subject)`.
2. Compute each user's accuracy per subject.
3. Compute the `p25/p50/p75/p90` distribution per subject across users.
4. Write `stats_subject_percentiles_<YYYYMMDD>.json` to R2.

Append both kinds of entries to the manifest (atomic put after content + stats are uploaded).

**Exit:** Run against the dev BQ (with seeded events from a Phase 1 staging environment). All artefacts validate against the Zod schemas. Manifest contains content + stats + subject_percentiles entries.

---

### STATS-03 — Wilson smoothing + sample-confidence bands

**Effort:** S
**Goal:** Statistical honesty in the bands the UI consumes.

- Implement `wilsonInterval(positives, total, z = 1.96): {lower, upper, width}` in `packages/sdk/stats`.
- Banding policy in the builder:
  - `high` — `total >= 200` and `width < 0.10`.
  - `medium` — `total >= 50` and `width < 0.20`.
  - `low` — otherwise.
- Cold-start cap: the first 7 days after a pack first appears in BQ events, cap `sample_confidence` at `medium` regardless of N.

**Exit:** Unit tests with synthetic inputs produce expected bands. A run against real (or simulated) data shows pills correctly hidden on low-N questions.

---

### STATS-04 — Outlier filter

**Effort:** S
**Goal:** Prevent any single `anon_guest_id` from dominating an aggregate.

- Per-question per-day cap on per-user contributions (default: 5 events per user per question per day).
- Per-user per-day cap on total events feeding aggregates (default: 500 events per user per day; events beyond that are dropped from rollups but stay in BQ for audit).
- Both filters are applied as `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY event_timestamp)` filters in the BQ query — never delete rows.
- Thresholds are env vars so they can tighten if abuse appears.

**Exit:** With a synthetic abusive `anon_guest_id` firing 10,000 events per question, the rollup shows the user capped at the threshold per question per day.

---

### STATS-05 — Manifest extension

**Effort:** S
**Goal:** Manifest carries content + stats + subject-percentiles entries.

- The pipeline's manifest writer reads the discriminated union from `@quiz/sdk` so the schema validates new kinds at build time.
- Atomic put pattern preserved: content packs uploaded first, then stats packs, then subject-percentiles, then the manifest with all entries last.
- App-side parsing tolerates unknown `kind` values (logs and ignores) so future kinds don't break old app builds.

**Exit:** A run produces a manifest with all three kinds of entries. Old app builds continue to function; new app builds parse the new entries.

---

### STATS-06 — App stats cache + manifest-diff download

**Effort:** M
**Goal:** Download stats packs and the subject-percentiles artifact alongside content packs.

- Add a `stats` table to SQLite keyed by `for_pack_id`, storing the full stats-pack JSON blob + hash.
- Add a `subject_percentiles` MMKV key storing the most recent artifact JSON.
- The manifest-diff flow (built in MVP-07) is extended to handle both kinds:
  - For each `kind: 'content'` entry → existing behaviour.
  - For each `kind: 'stats'` entry → fetch (lower priority — yield to content downloads), validate with Zod, store keyed by `for_pack_id`.
  - For each `kind: 'subject_percentiles'` entry → fetch, validate, store in MMKV.
- If a stats pack or subject_percentiles fetch fails or fails validation, clear it and continue. Rendering must tolerate absence.
- Eviction: when a content pack is evicted (LRU), its companion stats entry is evicted too.

**Exit:** Restart the app — content + stats + subject_percentiles all hydrate. Delete the stats artifact on R2 — feed continues to play, pills silently disappear at next refresh.

---

### STATS-07 — `QuestionCard` difficulty pill

**Effort:** S
**Goal:** Render a difficulty pill after the user answers, when sample confidence permits.

- Extend `QuestionCard` to accept an optional `stats?: QuestionStats` prop.
- After answer reveal, transition into a state that shows:
  - For correct: "Only 23% got this right — nice one." or "Most people nail this — you're in good company."
  - For wrong: "Most people miss this one too (only 23% correct)." or "Tricky — 63% got it. You'll remember it now."
  - For skipped: no pill (skipping is neutral).
- Use `shouldRenderPill(stats)` to gate visibility on confidence.
- Copy variants live in a `copy.ts` so they can be tuned without code churn.
- Accessibility: pill announced via `accessibilityLiveRegion="polite"` (Android) / `accessibilityElementsHidden=false` semantics (iOS) when revealed.

**Exit:** Visual QA on a dev pack with seeded stats. Pills appear only when confidence permits; copy reads naturally for the three scenarios.

---

### STATS-08 — End-of-streak percentile card

**Effort:** M
**Goal:** Show self-placement inside the pack's score distribution at natural breakpoints.

- Client detector: when the user has answered ≥ `window_size` cards from a pack (default 10), or when the feed pauses (no interaction for ~10s), emit a `percentile_card_opportunity` signal.
- Card renderer:
  - Compute the user's last-`window_size` correct count from the local interaction buffer in MMKV.
  - Look up the percentile from `pack_score_distribution.percentile_by_score`.
  - Render an inline card between questions with copy like "Your last 10: 7 correct — better than 68% of players on this pack."
- Dismissible; doesn't block the feed. If dismissed three times in a session, suppress for the rest of the session.

**Exit:** Play 15 cards; percentile card appears after card #10 with the correct number. Dismiss it three times — it doesn't reappear until next app open.

---

### STATS-09 — `/stats` screen with subject mastery

**Effort:** M
**Goal:** A dedicated stats screen showing weekly bucketed mastery per subject.

- Route: `/stats` (Expo Router). Reachable from the always-visible stats chip in the feed header.
- Sections:
  - **Today / This week.** Big number for correct count, smaller for attempted, skip rate.
  - **Streaks.** Current streak (flame), longest-ever.
  - **By subject.** A row per subject the user has played this week:
    - Personal accuracy bar (from MMKV stats).
    - "Top X%" chip computed by `bucketAccuracy(personal_accuracy, subject_percentiles[subject])`.
    - Plays this week.
- Bucketing only displays once the user has crossed a minimum-plays threshold per subject (e.g. 20). Below that, the chip reads "Keep playing".

**Exit:** `/stats` renders against seeded stats and seeded MMKV. Buckets change as the user's accuracy crosses thresholds.

---

### STATS-10 — Privacy copy + opt-out + QA

**Effort:** S
**Goal:** Be honest about what's collected; give users a meaningful opt-out.

- Privacy paragraph in the app's privacy screen (or the existing `/about`): one paragraph explaining that interactions (answered / skipped / impression) are collected in aggregate to compute question difficulty and pack statistics, with no individual user identifiable.
- Settings toggle: "Include me in community stats" — default on. When off, the SDK adds `contribute_to_stats: false` to every event. The stats builder's BQ query filters on this flag.
- QA walk-through:
  1. Play 30 cards across two packs; verify percentile card fires and difficulty pills render.
  2. Toggle opt-out; play 10 more; confirm aggregates on the next stats build exclude those rows.
  3. Delete the stats artifact on R2; verify the app falls back to no decorations without errors.
  4. Simulate a low-sample pack (new subject, few attempts); confirm pills hidden when `sample_confidence: "low"`.
  5. Cold launch with stats present: confirm first card render is not blocked by stats fetch (stats fetch is deferred).

**Exit:** All five QA steps pass. Privacy copy reviewed and approved. Plan moves to `docs/completed/stats-and-social-proof-plan/`.

---

## 5. Open questions

- **Window size.** `pack_score_distribution` is built over a rolling window of N answered cards. Default 10. Multiple sizes (5/10/20) is a possible future extension; deferred.
- **Cross-pack aggregates.** "You're in the top 20% across all geography packs" is richer than per-pack. Deferred — adds complexity; revisit if per-pack percentiles feel too noisy.
- **Anti-abuse escalation.** If we see coordinated stats poisoning, do we add a "verified users only" stats variant? Flag; address if it appears.

## 6. Non-goals (explicit)

- Ordinal global leaderboards.
- Server-graded daily challenge mode.
- Real-time stats updates.
- Per-user comparison ("you beat @alice").
- Streak-length rankings.
- Multi-pack achievements / badges (later plan).
- Web app.

## 7. Done criteria

Plan is complete when all 10 tasks in [README.md](README.md) show `Done`, the QA walk-through in STATS-10 passes, and this plan moves to `docs/completed/stats-and-social-proof-plan/`.
