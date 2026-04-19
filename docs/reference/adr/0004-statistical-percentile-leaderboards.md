# ADR 0004 — Statistical percentile leaderboards, not ordinal ranking

**Status:** ACCEPTED
**Date:** 2026-04-19
**Related:** [ADR 0001](0001-reels-feed-not-session-rounds.md), [ADR 0002](0002-client-heavy-cost-optimized.md)

## Context

Casual reels apps live or die by retention, and the single strongest retention lever in quiz products is some variant of "how do I stack up against other people." The original architecture (v1) planned global leaderboards served from Redis. Once we committed to client-graded play (ADR 0002), authoritative per-user ranking became untrustworthy — a user can self-report any score they want, and we shouldn't put unverifiable numbers into a ranking that implies they mean something.

At the same time, the `interactions` data that flows through `/sync` *is* legitimately useful in aggregate. Individual users can lie about their own outcomes, but the distribution of outcomes across thousands of players washes out small-scale lying. That lets us compute statistically honest things — per-question difficulty, per-pack score distributions, per-subject accuracy benchmarks — without relying on trust.

The product question is whether a statistics-based leaderboard-equivalent provides enough of the motivational hit of real leaderboards to move retention, given we're giving up ordinal bragging rights. Evidence from Duolingo XP leagues, Codeforces rating bands, 23andMe percentile reports, and Wordle's "you're in the top N%" screens strongly suggests yes — what actually motivates most users is **self-placement inside a distribution**, not knowing they're #14 vs #15.

## Decision

**Replace ordinal leaderboards with statistical percentile social-proof for the casual feed.** Concretely:

### Shape of the feature

- **Per-question difficulty pill** — shown after a card is answered. "Only 23% of players got this right — nice one" or "Most people nail this, you'll get the next." Powered by per-question aggregate correct-rate.
- **Pack-level percentile card** — shown at natural client-side breakpoints (every ~10 answered cards or after a pause). "You got 7 of your last 10 — better than 68% of players on this pack." User's score is client-computed from the local interaction buffer; the distribution to compare against is server-computed.
- **Weekly subject mastery summary** — "Top 15% this week in geography." Non-ordinal framing by bucket, not position.
- **No ordinal global leaderboards for casual play.** If a competitive use case ever earns its keep, it lands as a separate **server-graded** daily-challenge / tournament mode with its own code path and its own small surface area. The casual feed stays client-graded and stats-decorated.

### How stats are delivered

Stats live in **separate CDN artefacts** distinct from content packs. For each content pack `pack_X` there is a companion `stats-{pack_X}-{date}.json` on R2, rebuilt daily (or on demand) and served with a shorter cache TTL (`max-age=3600`).

Content packs remain immutable and infinitely cacheable. Stats packs refresh often. The two live on the same CDN but with opposing cache strategies, which is easy to do when they're different objects and impossible to do when they're one object.

A client fetches the stats pack lazily: it downloads the content pack first (needed to play), and fetches stats opportunistically (needed only to render pills). If the stats pack is missing or stale, the client renders without decorations — graceful degradation, offline play still works.

### Stats pack schema (v1)

```
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
      "skip_rate": 0.08,
      "sample_confidence": "high"   // "low" | "medium" | "high"
    }
  },
  "pack_score_distribution": {
    "attempts_considered": 9120,
    "percentile_by_score": [
      { "score": 0, "p": 0 },
      { "score": 5, "p": 42 },
      { "score": 10, "p": 98 }
    ]
  }
}
```

`sample_confidence` is a coarse banding computed from the Wilson score interval width (tight = high, wide = low). Clients may choose to hide the pill when confidence is `low`.

### Statistical rigour baked into the builder

- **Minimum-sample threshold.** Per-question pills require `attempts >= 50` before they're exposed; below that, the per-question entry marks `sample_confidence: "low"` and clients may hide.
- **Wilson score smoothing.** Correct-rate is reported as a point estimate plus a coarse confidence band rather than raw `correct/attempts`. This prevents "11 of 12 = 92%" from reading as a strong signal.
- **Outlier user filtering.** Any `(user_id | anon_guest_id)` contributing more than a configurable threshold of interactions per question per day is excluded from the stats rollup. Raw rows stay in `interactions` for audit; they just don't distort aggregates.
- **Self-selection bias disclosure.** Reported `correct_rate` is *among attempters* (skippers don't answer). The stats pack also carries `attempt_rate = attempts / (attempts + skips)` so both numbers are available and the framing is honest.

### Privacy

All reported numbers are aggregate; no individual user is identifiable from any pill, card, or summary. Same category as "5.2M users played last month" analytics surfaces everyone publishes. Users retain the right to delete their account and have their attributed interactions de-attributed (or purged) per the privacy policy.

## Consequences

**Positive**

- Gives the product a real retention hook without demanding trustworthy client-graded scores.
- Preserves the cost model: immutable content packs keep their infinite cache lifetime; only the small stats artefact refreshes.
- Offline play continues to work — stats are decoration, not required for the core loop.
- Stats schema evolves independently of content schema. Adding `p50_response_ms` or `streak_percentile` later doesn't require rebuilding content packs.
- Opens a path to more sophisticated social-proof features later (pack rankings, subject-level rivals, "harder than X% of players" achievements) on the same foundation.

**Negative**

- Introduces a new CDN artefact category (stats packs) and a new build step. More moving pieces than a pure-static content model.
- Small-sample handling is a real concern during cold-start. The first day a new pack goes live, most questions will have low sample sizes and pills will be hidden or faint. Acceptable — as the pack matures, stats fill in.
- The "social proof" motivational hit is weaker than ordinal rivalry for users who specifically crave competition. That audience is served later by a separate server-graded mode, not by this feature.

**Operational**

- The stats builder is a nightly job (or on-demand). Idempotent: rebuilding on the same day produces the same stats pack (given same inputs). Runs on the same single-process host as the API for MVP; moves to a scheduled worker when volume warrants.
- Abuse monitoring shifts slightly: we now watch for users trying to inflate a question's aggregate stats (via mass-submitted fake interactions). The outlier filter handles baseline cases; serious abuse campaigns would need targeted response if they ever appear.

## Alternatives considered

- **Bake stats into the content pack (user's Proposal B).** Rejected — stats change often, content doesn't. Mixing them wastes egress and breaks CDN cache reuse every time stats refresh. Offline play becomes harder too, because "play" now requires fresh stats.
- **Trust-based ordinal leaderboards on client-graded play.** Rejected — inherently untrustworthy given answer keys ship to clients. Would either require removing answer keys from packs (killing the cost model of ADR 0002) or knowingly publishing fake rankings.
- **Real ordinal leaderboards on a separate server-graded code path, instead of stats.** Deferred, not rejected. The stats-based social-proof is cheaper to build, serves more users (casual > competitive), and doesn't foreclose the server-graded mode later. We can have both.
- **Skip leaderboard-equivalent entirely and lean on personal streaks.** Rejected — streaks alone flatten retention past the first week. Social proof is what keeps casual users coming back after novelty wears off.

## Cross-references

- [ADR 0001](0001-reels-feed-not-session-rounds.md) — casual feed model that this serves
- [ADR 0002](0002-client-heavy-cost-optimized.md) — cost constraints this must respect
- [Architecture](../architecture.md) — system design that now includes stats packs as a first-class artefact (§5, §9)
- [`active/stats-and-social-proof-plan/`](../../active/stats-and-social-proof-plan/) — the plan that implements this decision

## Amendments

### 2026-04-19 — Coordinated bot mitigation

The single-user outlier filter under **Statistical rigour** above handles one attacker; coordinated low-volume bots minting fresh anonymous JWTs are a separate threat (anon JWT issuance is unauthenticated and per-IP rate-limited only). Two additional defences:

- **Hardened minimum-attempts gate when pills are user-facing.** Per-question pills require `attempts ≥ 200` before exposure (raised from the `≥ 50` used internally for `sample_confidence` banding). Below the threshold pills are hidden client-side. The gate raises the cost of moving a single question's published rate.
- **Authed-vs-anon weighting in the rollup.** Authed `user_id` interactions count for **3× the weight** of `anon_guest_id` interactions when computing aggregate rates. Anon contributions still count — they just need 3× the volume to move the distribution. Cheap-JWT attacks pay the cost.

Both thresholds (`200`, `3×`) are config in the stats builder, not hard-coded — tunable without an ADR change. We watch real abuse signals before tightening further; over-tightening starves cold-start packs of stats.
