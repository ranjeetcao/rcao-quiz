# Stats & Social-Proof Plan — Status Tracker

Add the retention hook: per-question difficulty pills, pack-level percentile cards, and weekly subject-mastery summaries. All powered by a separately-built **stats pack** on R2 computed from real `interactions` data. No ordinal leaderboards, no client trust required — just honest aggregate statistics rendered as social proof.

**Master Plan:** [plan.md](plan.md)
**Created:** 2026-04-19
**Status:** PLANNING — 0 / 10 tasks started
**Target Phase:** Phase 2 (after MVP skeleton; before images)
**Depends on:** [MVP Skeleton Plan](../mvp-skeleton-plan/) (needs `interactions` flowing), [Architecture](../../reference/architecture.md), [ADR 0004](../../reference/adr/0004-statistical-percentile-leaderboards.md)

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| STATS-01 | Stats pack schema + Zod types in `@quiz/sdk` (StatsPack, QuestionStats, PackScoreDistribution, StatsManifestEntry) | S | Pending | MVP-03 |
| STATS-02 | Stats builder script (`pnpm stats:build`) — queries `interactions` + `question_stats`, computes per-question + pack-level distributions, writes stats pack via `PackStorage` interface | M | Pending | STATS-01, MVP-09 |
| STATS-03 | Wilson-interval smoothing + minimum-sample thresholds in builder (N ≥ 50; `sample_confidence` banding) | S | Pending | STATS-02 |
| STATS-04 | Outlier filter in builder — exclude `(user_id \| anon_guest_id)` contributions above configurable per-question-per-day cap | S | Pending | STATS-02 |
| STATS-05 | Manifest extension — `GET /packs/manifest` returns both content and stats entries, each with its own cache hint | S | Pending | STATS-01, MVP-04 |
| STATS-06 | Client stats cache in IndexedDB + manifest-diff download alongside content packs | M | Pending | STATS-05, MVP-08 |
| STATS-07 | `QuestionCard` difficulty pill — render after answer revealed; hide on `sample_confidence: "low"` | S | Pending | STATS-01, STATS-06, MVP-07 |
| STATS-08 | End-of-streak percentile card — shown at every 10 answered cards or on natural pause; looks up percentile from stats pack's distribution | M | Pending | STATS-06, MVP-07 |
| STATS-09 | `/stats` screen — weekly subject-mastery summary ("Top 15% this week in geography") | M | Pending | STATS-06 |
| STATS-10 | Privacy copy + stats opt-out toggle + QA pass | S | Pending | STATS-07, STATS-08, STATS-09 |

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.

## Exit criteria

- After playing a card, the user sees a difficulty pill ("Only 23% got this right") when the stats pack has enough samples; pill is hidden when sample confidence is low.
- After every ~10 answered cards, the user sees a percentile card ("You got 7/10 — better than 68% of players on this pack").
- The `/stats` screen shows a weekly mastery summary per subject as a bucket ("Top 15%") rather than an ordinal rank.
- The stats builder runs cleanly on a Postgres with real `interactions` rows and produces a stats pack that validates against the Zod schema.
- Offline play still works: if the stats pack is missing or stale, the feed renders with no decorations and no errors.

## Explicitly out of scope

- Ordinal global leaderboards of any form (deferred; may return via separate server-graded mode later).
- Real-time stats updates (websocket / push). Batch refresh on a daily cadence is sufficient.
- Per-user scoreboards — users don't get told about other specific users; only distributions.
- Multiple-competitive tournament modes (separate future plan).
- Streak-length leaderboards (streaks are client-computed and not trustworthy for ranking).
