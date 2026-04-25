# ADR 0004 — Percentile social-proof, not ordinal leaderboards

**Status:** ACCEPTED

## Context

Casual reels apps live or die by retention, and the strongest retention lever in quiz products is "how do I stack up against other people." But:

- We grade on the client (ADR 0002) and ship answer keys to clients. Authoritative per-user ranking would be untrustworthy — users can self-report any score.
- We don't run a server (ADR 0002). There's no place to enforce ranking integrity even if we wanted to.

What we *do* have is the GA4 / BigQuery event firehose. Individual users can lie about their own outcomes, but the distribution of outcomes across thousands of players washes out small-scale lying. That lets us compute statistically honest aggregates — per-question difficulty, per-pack score distributions, per-subject accuracy benchmarks — without relying on trust.

The product question is whether statistics-based social proof provides enough motivational hit to move retention given we're giving up ordinal bragging rights. Evidence from Duolingo XP leagues, Codeforces rating bands, 23andMe percentile reports, and Wordle's "top N%" screen says yes — what motivates most users is **self-placement inside a distribution**, not knowing they're #14 vs #15.

## Decision

**Statistical percentile social-proof for the casual feed**, in three shapes:

- **Per-question difficulty pill** — shown after a card is answered. "Only 23% of players got this right — nice one" or "Most people nail this, you'll get the next." Powered by aggregate correct-rate.
- **Pack-level percentile card** — shown at natural client-side breakpoints (every ~10 answered cards or after a pause). "You got 7 of your last 10 — better than 68% of players on this pack." User's score is computed locally from the recent interaction buffer; the distribution comes from the stats pack.
- **Weekly subject mastery summary** — "Top 15% this week in geography." Bucket-based, not ordinal.

**No global ordinal leaderboards.** If a competitive use case ever earns its keep, it lands as a separate **server-graded** mode (Phase 5+) on its own surface. The casual feed stays client-graded and stats-decorated.

### Stats artefacts on R2

For each content pack `pack_X` there is a companion **stats pack** `stats_<pack_id>_<date>.json` on R2. Rebuilt daily by a scheduled job that reads from BigQuery; served with `max-age=3600` so it refreshes faster than content packs but isn't on the user-request hot path.

A second small artefact, **`stats_subject_percentiles_<date>.json`**, carries cross-pack subject-level percentiles (`p25/p50/p75/p90` per subject) for the weekly mastery summary.

Content packs stay infinitely cacheable; stats packs are decoration. If a stats pack is missing or stale, the client renders the feed without pills and percentiles — graceful degradation, offline play still works.

### Stats pack shape (v1)

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
      { "score": 5, "p": 42 },
      { "score": 7, "p": 68 },
      { "score": 10, "p": 98 }
    ]
  }
}
```

All counts are **`COUNT(DISTINCT anon_guest_id)`** in the BigQuery rollup, not raw event counts. One user firing many events counts as one.

### Statistical rigour in the builder

- **Distinct-user counting everywhere.** Defeats the most obvious junk-event attack.
- **Minimum-sample threshold.** Per-question pills require ≥ 50 distinct attempters before they're exposed. Below that, `sample_confidence: "low"` and the client hides the pill.
- **Wilson score smoothing.** Coarse confidence bands (`low | medium | high`) computed from the Wilson-interval width prevent "11 of 12 got it right = 92%" from reading as a strong signal.
- **Cold-start cap.** First 7 days after a pack goes live, `sample_confidence` is capped at `medium` regardless of N — no hard claims until real play accumulates.
- **Outlier user filter.** Any single `anon_guest_id` contributing more than a configurable threshold per question per day is dropped from rollups. Raw rows stay in BQ for audit.
- **Self-selection bias disclosure.** `correct_rate` is reported alongside `attempt_rate` so consumers can see that "% correct" is among attempters, not all viewers.

### Privacy

All reported numbers are aggregate. No individual user is identifiable from any pill, card, or summary — same category as "5.2M users played last month" analytics most apps publish. A settings toggle lets a user opt out of contributing their events to aggregates (the rollup query filters them).

## Consequences

**Positive**

- Real retention hook without trustworthy client-graded scores.
- Cost model preserved: content packs stay immutable and infinitely cacheable; only the small stats artefact refreshes daily.
- Offline play continues to work — stats are decoration, not required.
- Stats schema evolves independently of content schema. Adding `p50_response_ms` or `streak_percentile` later doesn't churn content packs.
- Foundation for richer social-proof later (subject-level rivals, "harder than X% of players" achievements).

**Negative**

- New CDN artefact category and a new build step. More moving pieces than pure-static content.
- Cold-start: first day a pack is live, most questions are below sample threshold and pills hide. Acceptable; pack matures, stats fill in.
- Weaker motivational hit than ordinal rivalry for users who specifically crave competition. That audience is served later by a server-graded mode, not by this feature.

**Operational**

- Stats builder is a daily job. Idempotent — same inputs produce the same stats pack on a given day. Runs on the same scheduled host as the content pipeline.
- Abuse monitoring shifts to "watch for users trying to inflate aggregate stats." Outlier filter handles the baseline; serious campaigns would need targeted response if they appear.

## Alternatives considered

- **Bake stats into the content pack.** Rejected — content packs and stats packs have opposing cache strategies (immutable forever vs. refresh daily). Mixing them defeats CDN reuse and breaks offline play.
- **Trust-based ordinal leaderboards on client-graded play.** Inherently untrustworthy. Would publish numbers that don't mean anything.
- **Real ordinal leaderboards on a separate server-graded path now.** Deferred, not rejected — see Phase 5+ in the roadmap. Stats-based social proof ships first because it's cheaper and serves the larger casual audience.
- **Skip leaderboard-equivalent entirely; lean on personal streaks.** Streaks alone flatten retention past the first week. Need the comparison axis.

## Cross-references

- [ADR 0001](0001-reels-feed-not-session-rounds.md) — feed model that this serves
- [ADR 0002](0002-client-heavy-cost-optimized.md) — why aggregate stats are honest while ordinal isn't
- [Architecture](../architecture.md) — data flow + stats pipeline
- [Stats & Social-Proof Plan](../../active/stats-and-social-proof-plan/) — implementation
