# Stats & Social-Proof Plan — Status Tracker

Add the retention hook: per-question difficulty pills, pack-level percentile cards, and a weekly subject-mastery summary. Powered by stats packs on R2 computed daily from BigQuery GA4 events. No ordinal leaderboards, no client trust required — just honest aggregate statistics rendered as social proof in the mobile app.

**Master Plan:** [plan.md](plan.md)
**Status:** PLANNING — 0 / 10 tasks started
**Target Phase:** Phase 2 (after MVP skeleton + Phase 1 AI pipeline + real GA4/BQ are live)
**Depends on:** Phase 1 (AI pipeline + Firebase Analytics + BQ export flowing), [Architecture](../../reference/architecture.md), [ADR 0002](../../reference/adr/0002-client-heavy-cost-optimized.md), [ADR 0004](../../reference/adr/0004-statistical-percentile-leaderboards.md), [ADR 0005](../../reference/adr/0005-git-content-store.md)

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| STATS-01 | Stats pack + subject-percentiles Zod schemas in `@quiz/sdk`; `lookupPercentile`, `shouldRenderPill`, `bucketAccuracy` helpers | S | Pending | MVP-03 |
| STATS-02 | Stats builder script (`pnpm stats:build`) — queries BigQuery GA4 events with distinct-user counting, computes per-question + pack-level distributions + subject-percentiles, writes via `PackStorage` interface | M | Pending | STATS-01, Phase 1 BQ export |
| STATS-03 | Wilson-interval smoothing + min-sample thresholds in builder (N ≥ 50; `sample_confidence` banding; cold-start cap) | S | Pending | STATS-02 |
| STATS-04 | Outlier filter in BQ SQL — exclude `anon_guest_id` contributions above configurable per-question-per-day cap | S | Pending | STATS-02 |
| STATS-05 | Manifest extension — single `manifest.json` on R2 with content + stats + subject-percentile entries (no API) | S | Pending | STATS-01 |
| STATS-06 | App stats + subject-percentiles cache in SQLite + manifest-diff download alongside content packs | M | Pending | STATS-05, MVP-06 |
| STATS-07 | `QuestionCard` difficulty pill — render after answer revealed; hide on `sample_confidence: "low"` | S | Pending | STATS-01, STATS-06, MVP-05 |
| STATS-08 | End-of-streak percentile card — shown at every 10 answered cards or on natural pause; looks up percentile from stats pack | M | Pending | STATS-06, MVP-05 |
| STATS-09 | `/stats` screen — weekly subject-mastery summary using `subject_percentiles` artifact (no server endpoint) | M | Pending | STATS-06 |
| STATS-10 | Privacy copy + stats opt-out toggle + QA pass | S | Pending | STATS-07, STATS-08, STATS-09 |

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.

## Exit criteria

- After playing a card, the user sees a difficulty pill ("Only 23% got this right") when the stats pack has enough distinct-user samples; pill hidden when sample confidence is low.
- After every ~10 answered cards, the user sees a percentile card ("You got 7/10 — better than 68% of players on this pack").
- `/stats` shows a weekly mastery summary per subject as a bucket ("Top 15%") rather than an ordinal rank.
- The stats builder runs cleanly against the BigQuery GA4 export and produces stats packs that validate against the Zod schema.
- Offline play still works: if stats packs are missing or stale, the feed renders with no decorations and no errors.

## Explicitly out of scope

- Ordinal global leaderboards of any form (deferred; may return via server-graded mode in Phase 4+).
- Real-time stats updates (websocket / push). Daily refresh is sufficient.
- Per-user scoreboards — users only see distributions, never other specific users.
- Multi-pack tournament / competitive modes (separate future plan).
- Streak-length leaderboards (streaks are client-computed and not trustworthy for ranking).
- Web app of any kind.
