# Stats & Social-Proof Plan

> **Status:** PLANNING
> **Author:** Ranjeet Kumar + Architecture review (2026-04-19)
> **Date:** 2026-04-19
> **Services:** apps/web, apps/api, packages/sdk, scripts/stats-build
> **Estimated effort:** 1.5–2 weeks across 10 tasks
> **Cross-references:** [Architecture](../../reference/architecture.md), [ADR 0004](../../reference/adr/0004-statistical-percentile-leaderboards.md), [MVP Skeleton Plan](../mvp-skeleton-plan/)

---

## 1. Problem statement

The MVP skeleton (Phase 0) proves the play loop — users scroll, answer, skip, interactions sync to Postgres. That works, but it gives users nothing to come back for after the novelty wears off. Traditional quiz products solve this with leaderboards. Our client-graded architecture (ADR 0002) makes ordinal rankings untrustworthy, but the same data flowing through `/sync` is perfectly legitimate in aggregate.

This plan turns aggregate `interactions` into **three retention surfaces** — per-question difficulty social-proof, per-pack percentile self-placement, and weekly subject-mastery buckets — and does it without compromising the cost model (CDN artefacts stay cacheable), the offline story (stats are decoration, not required), or statistical honesty (min-sample thresholds, outlier filters, Wilson smoothing).

### Current state at plan start

- MVP skeleton is complete; `/sync` is live; `interactions` and `question_stats` are being written on every client flush.
- No stats builder exists. No stats packs on CDN. No rendering of any social-proof.
- `GET /packs/manifest` returns only content-pack entries.

### Desired state at plan exit

- A daily `pnpm stats:build` runs against Postgres, computes aggregates per question and per pack, and writes stats packs to R2 (or local disk in dev) with a 1-hour cache TTL.
- `GET /packs/manifest` includes stats entries alongside content entries.
- The client downloads stats packs opportunistically, merges them into the feed, and renders: a difficulty pill after each answer, a percentile card every ~10 cards, and a weekly subject mastery summary on `/stats`.
- Sample-size rigour is built in: low-confidence stats are hidden; outlier user contributions are filtered from aggregates.
- Privacy policy references aggregate stats in one honest paragraph; a settings toggle lets users opt out of contributing interactions to aggregates.

### Out of scope for Phase 2

- Ordinal leaderboards.
- Server-graded daily challenge mode (separate future plan).
- Real-time push of stats updates.
- Cross-pack "global" leaderboards. Stats are always scoped to a pack or a subject or a week.
- Personal cross-device sync of stats (relies on logged-in users — Phase 1's account work handles it).

---

## 2. Goals

| # | Goal | Measured By |
|---|------|-------------|
| G1 | Retention hook works end-to-end | Users see the difficulty pill, percentile card, and mastery summary during normal play |
| G2 | Stats are statistically honest | Pills hidden on low sample; Wilson smoothing prevents small-N noise; outlier users filtered |
| G3 | CDN economics preserved | Content packs remain immutable; stats packs have their own cache strategy; no extra egress on content pack refresh |
| G4 | Offline play still works | Feed renders with no decorations when stats packs are absent |
| G5 | Privacy-defensible | All numbers aggregate; no individual user identifiable in any rendered surface; opt-out exists |

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

Fields:

- `sample_confidence` is a coarse banding — `low` (N < 50 or Wilson interval wider than 0.2), `medium` (N 50–200 or interval 0.1–0.2), `high` (N ≥ 200 and interval < 0.1). Tunable.
- `pack_score_distribution.window_size` is the rolling-N the distribution is built over (e.g. "score out of last 10 answered cards"). Must match what the client computes locally.
- `attempt_rate = attempts / (attempts + skips)`. Reported alongside `correct_rate` so the self-selection bias is visible rather than hidden.

### Manifest (extended)

```json
[
  { "kind": "content", "pack_id": "pack_geography_v12_...",       "url": "...", "hash": "...", "cache_ttl_seconds": 31536000 },
  { "kind": "stats",   "stats_pack_id": "stats_geography_v12_...", "url": "...", "hash": "...", "cache_ttl_seconds": 3600, "for_pack_id": "pack_geography_v12_..." }
]
```

Clients filter by `kind` and diff per `hash`.

---

## 4. Tasks

### STATS-01 — SDK schemas + types

**Effort:** S
**Goal:** Typed contract for the stats pack, manifest entries, and sample-confidence bands.

- Zod schemas in `@quiz/sdk`:
  - `SampleConfidence` = `z.enum(['low', 'medium', 'high'])`
  - `QuestionStats` — `{attempts, correct_count, skip_count, correct_rate, attempt_rate, skip_rate, sample_confidence}`
  - `PackScoreDistribution` — `{attempts_considered, window_size, percentile_by_score: Array<{score, p}>}`
  - `StatsPack` — `{stats_pack_id, for_pack_id, computed_at, schema_version, sample_size_global, per_question: Record<QuestionId, QuestionStats>, pack_score_distribution}`
  - `ManifestEntry` — tagged union over `kind: 'content' | 'stats'`; the existing entry schema gets a `kind: 'content'` discriminator for backwards-compat.
  - `StatsManifestEntry` — `{kind: 'stats', stats_pack_id, url, hash, cache_ttl_seconds, for_pack_id}`
- Helpers:
  - `lookupPercentile(distribution, score): number` — O(log N) binary search over `percentile_by_score`, linear-interpolate between buckets.
  - `shouldRenderPill(stats): boolean` — encapsulates the confidence policy; can be overridden by client flag.

**Exit:** Types compile across all workspaces. Unit tests for `lookupPercentile` and `shouldRenderPill` pass.

---

### STATS-02 — Stats builder script

**Effort:** M
**Goal:** `pnpm stats:build` computes stats packs from real DB data and uploads them via the storage interface.

Script: `scripts/stats-build.ts`, runnable manually and from a cron trigger in Phase 2+.

Per content pack (looked up from the current manifest):

1. Query `interactions` joined to `questions`, filtered to approved questions in this pack, with a configurable time window (e.g. last 30 days rolling).
2. Compute per-question aggregates: `attempts`, `correct_count`, `skip_count`, `correct_rate`, `skip_rate`, `attempt_rate`.
3. Compute the pack score distribution:
   - For each `(user_id | anon_guest_id)`, group their last-N answered questions from this pack by sliding window of `window_size` (default 10).
   - Record the correct-count score for each window.
   - Build the CDF as `percentile_by_score`.
4. Apply outlier filter (STATS-04) before aggregation.
5. Attach `sample_confidence` bands (STATS-03).
6. Write stats pack JSON via `PackStorage.put()` with a content-addressed filename that includes the current date (so daily rebuilds produce new hashes).
7. Update the manifest file with the new stats entry; overwrite the previous day's stats entry for the same `for_pack_id` atomically.

Idempotency: running twice in a day on unchanged data produces byte-identical output.

**Exit:** Run against the dev DB with a few thousand seeded `interactions` rows; verify a stats pack is written and passes Zod validation.

---

### STATS-03 — Wilson smoothing + sample-confidence bands

**Effort:** S
**Goal:** Make the reported numbers statistically honest.

- Implement `wilsonInterval(positives, total, z = 1.96): {lower, upper, width}` in `packages/sdk/stats`.
- Banding policy:
  - `high` — `total >= 200` and `width < 0.10`
  - `medium` — `total >= 50` and `width < 0.20`
  - `low` — otherwise
- The builder records the band; the client uses `shouldRenderPill` to decide.
- Add a per-pack "cold start" mode: first 7 days after a pack goes live, all `sample_confidence` caps at `medium` regardless of N, so nothing reads as rock-solid until it's seen real play.

**Exit:** Unit tests with known inputs produce expected bands. Manual inspection of a stats pack with synthetic data shows pills correctly hidden on low-N questions.

---

### STATS-04 — Outlier user filter

**Effort:** S
**Goal:** Prevent any single user from dominating a question's aggregate.

- Per-question per-day cap on per-user contributions (default: 5 interactions per user per question per day).
- Per-user per-day global cap on `/sync` volume that feeds aggregates (default: 500 interactions per user per day into aggregates; rows beyond that stay in the DB for audit but are excluded from stats rollup).
- Filter is applied in the SQL query in STATS-02 (using a `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY seen_at)` filter), not by deleting rows.
- Configuration via env vars so the thresholds can tighten if abuse appears.

**Exit:** With 10,000 synthetic rows of which 5,000 come from one abusive `anon_guest_id`, the rollup shows the abusive user's contributions capped at the threshold per question per day.

---

### STATS-05 — Manifest extension

**Effort:** S
**Goal:** `/packs/manifest` returns both content and stats entries.

- Backend: `GET /packs/manifest` reads the manifest file (produced by the pack builder and stats builder) and returns it unchanged. Cache headers: `Cache-Control: public, max-age=60`.
- The manifest file itself is written atomically by the latest build (content or stats) — both builders write to a shared `manifest.json` with a read-modify-write under a file lock (local disk) or using R2's conditional put in production.
- Extend the Zod schema consumed by the API to validate the tagged-union shape.

**Exit:** `curl /packs/manifest` returns entries of both kinds. Schema validation accepts the mixed response.

---

### STATS-06 — Client stats cache

**Effort:** M
**Goal:** Download and store stats packs alongside content packs.

- Add a `stats` object store to IndexedDB keyed by `for_pack_id`.
- Manifest-diff flow (from MVP-09) extended to handle both kinds:
  - For each content entry, fetch and store as today (unchanged behaviour).
  - For each stats entry, fetch (lower priority — yield to content downloads), validate with Zod, store by `for_pack_id`.
- If a stats pack is missing, stale, or fails validation, clear it and continue. The rendering path must tolerate absence.
- Eviction: when a content pack is evicted from cache (LRU), its companion stats pack is evicted too.

**Exit:** Refresh the app; content pack plus its stats pack are both fetched and stored. Delete the stats file on the server; refresh again; content still works, pills silently disappear.

---

### STATS-07 — QuestionCard difficulty pill

**Effort:** S
**Goal:** Render the pill after an answer is revealed.

- Extend `QuestionCard` in `@quiz/sdk` to accept an optional `stats?: QuestionStats` prop.
- When the user answers or skips, transition the card into a revealed state that shows:
  - For correct answers: `"Only 23% got this right — nice one."` or `"Most people nail this — you're in good company."`
  - For wrong answers: `"Most people miss this one too (only 23% correct)."` or `"Tricky — 63% got it. You'll remember it now."`
  - For skipped: no pill (skipping is neutral).
- Use `shouldRenderPill(stats)` to gate visibility on confidence.
- Copy variants are picked by a small rule set; document them in a `copy.ts` file so they can be tuned without code churn.
- Accessibility: pill is announced to screen readers via `aria-live="polite"` when revealed.

**Exit:** Visual QA on a dev pack with seeded stats. Pills appear only when confidence permits; copy reads naturally for at least three stats scenarios (hard, normal, easy).

---

### STATS-08 — End-of-streak percentile card

**Effort:** M
**Goal:** Show self-placement inside the pack's score distribution at natural breakpoints.

- Client-side detector: when the user has answered ≥ `window_size` cards from a given pack (default 10), or when the feed pauses (no interaction for ~10s), emit a `percentile_card_opportunity` event.
- Card renderer computes the user's last-`window_size` score from the local interaction buffer, looks up the percentile from `pack_score_distribution.percentile_by_score`, renders an inline card between questions.
- Copy examples: `"Your last 10: 7 correct — better than 68% of players on this pack."` `"Last 10: 5/10 — that's right around the middle."` `"Last 10: 9/10 — top 5% on this pack, nice."`
- Dismissible; does not block the feed. If dismissed three times in a session, stop showing it until next app open (prevents nagging).

**Exit:** Play 15 cards in a row; percentile card appears after card #10 with the correct number. Dismiss it; it doesn't reappear until next opportunity.

---

### STATS-09 — Subject mastery summary

**Effort:** M
**Goal:** A `/stats` screen surfacing weekly, subject-bucketed progress.

- Route: `/stats`. Navigable from a small chip in the feed header.
- Content:
  - Per subject the user has played this week: `"Geography — Top 15% · 42 played · 73% correct"`.
  - Streak display: current, longest.
  - Total played today / this week (from local stats).
- Data flow: per-subject accuracy from the local personal-stats store; per-subject percentile bucket is computed server-side via a new `GET /stats/subject-percentiles` endpoint that returns `{[subject]: {p25, p50, p75, p90}}` for the past rolling week. The client compares its own accuracy against those thresholds to place itself in a bucket.
- The subject-percentiles endpoint is cached on the API for 1 hour (in-memory) since it's derived from the same rollup the stats builder uses.

**Exit:** `/stats` renders on a dev DB with seeded interactions; shows "Top X%" buckets that change as the user's local accuracy crosses thresholds.

---

### STATS-10 — Privacy copy, opt-out, QA

**Effort:** S
**Goal:** Be honest about what we collect and give users a meaningful opt-out.

- Privacy policy paragraph (drafted and added to the existing privacy page, or a new `/privacy` stub for Phase 2): one honest paragraph explaining that interactions (answered / skipped / impression) are collected in aggregate to compute question difficulty and pack statistics, and that no individual user is identifiable in any displayed statistic.
- Settings toggle: "Include me in community stats" — default on. When off, the client still posts interactions to `/sync` (they're useful for personal stats backup and retirement signal) but includes a `contribute_to_stats: false` flag. The stats builder's SQL excludes those rows from aggregates.
- QA walk-through:
  1. Play 30 cards across two packs; verify percentile card fires and difficulty pills render on eligible questions.
  2. Toggle opt-out; play 10 more; confirm aggregates on the next stats build exclude those rows.
  3. Delete the stats pack on the server; verify the client falls back to no decorations without errors.
  4. Simulate a low-sample pack (new subject, few attempts); confirm pills are hidden for questions with `sample_confidence: "low"`.
  5. Measure cold page load with stats on: confirm it doesn't visibly slow the first card render (stats fetch is deferred).

**Exit:** All five QA steps pass. Privacy copy reviewed by Ranjeet. Plan moves to `docs/completed/stats-and-social-proof-plan/`.

---

## 5. Open questions

- **Window size.** `pack_score_distribution` is built over a rolling window of N answered cards. Default 10 feels right for casual play (a natural "round"). Should we support multiple window sizes (5, 10, 20) so different surfaces can reuse distributions? Defer unless we have a need.
- **Cross-pack aggregates.** "You're in the top 20% for geography across all packs" is a richer framing than per-pack. Deferred — adds complexity to the builder and the distribution schema. Revisit if per-pack percentiles feel too noisy.
- **Stats pack on Google sign-in.** Do we give logged-in users a "best-ever" bar they're racing against? Nice but off-scope for Phase 2.
- **Anti-abuse escalation path.** If we see coordinated attempts to poison stats for specific questions (e.g. someone trying to inflate a particular question's correct-rate), do we add a "verified users only" stats variant? Flag; address when concrete evidence appears.

## 6. Non-goals (explicitly)

- Ordinal global leaderboards.
- Server-graded daily challenge mode (separate future plan).
- Real-time stats updates.
- Per-user comparison ("you beat @alice by 3 cards").
- Streak-length rankings.
- Multi-pack achievements / badges (nice-to-have, a later plan).

## 7. Done criteria

Plan is complete when all 10 tasks in [README.md](README.md) show `Done`, the QA walk-through in STATS-10 passes, and this plan moves to `docs/completed/stats-and-social-proof-plan/`.
