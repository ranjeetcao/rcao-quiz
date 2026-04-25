# ADR 0002 — Client-graded play, server-less runtime

**Status:** ACCEPTED

## Context

Two non-negotiables shape the runtime architecture:

- **Casual play with no real stakes.** No money, no credentialing, no competitive ranking that needs protection. Client-side trust is fine — the worst case is a user lying to themselves about their streak.
- **Tight cost envelope.** The system should remain essentially free to run at MVP scale and scale roughly linearly with users, not exponentially.

The two cost drivers in image-heavy reels apps are CDN egress and a stateful API on the hot path of every interaction. Both can be neutralised if authority moves to the client. Once authority is on the client, the natural follow-on question is what the server is even *for* at MVP — and the answer turns out to be "nothing the CDN and a public analytics SDK can't handle."

## Decision

**Clients grade locally; there is no application server at runtime.** The MVP runs on zero hosted compute.

### Content delivery: pre-built immutable packs on a zero-egress CDN

Questions are assembled into JSON **packs** by a scheduled build script and uploaded to **Cloudflare R2**. Each pack contains everything the client needs to play offline — prompts, choices, **correct answers**, subject + difficulty tags, media URLs (when images land in Phase 3).

Packs are content-addressed and immutable. Cache headers: `public, max-age=31536000, immutable`.

A `manifest.json` on R2 lists the live packs by hash plus a `retired_question_ids` list. The manifest has a short cache (`max-age=300`) so retirements propagate in minutes. Clients fetch the manifest on app open, diff against their local cache, and download only new or changed packs.

R2 is "zero egress" — bandwidth reads cost nothing. Writes happen only from the scheduled pipeline host.

### Grading: on the client

Packs ship `correct_answer`. The client compares the chosen string and renders the result locally. The server never sees "was this right or wrong" on the per-interaction hot path because there is no server.

The trade is that the answer key is no longer secret. For casual play, this is acceptable. If a leaderboard ever earns its keep, it lives in a separate **server-graded** mode (Phase 5+) on its own surface — the casual feed stays client-graded.

### State: client-owned

These live in the app (`expo-sqlite` + `react-native-mmkv` + `expo-secure-store`), never on a server:

- The `anon_guest_id` UUID, minted on first open and stored in `expo-secure-store`. The sole identity in MVP.
- Pack cache + manifest snapshot (SQLite).
- Two-tier dedupe (exact ring buffer for acted-on questions, bloom filter for impressions).
- Personal stats (MMKV): today's correct count, streak, per-subject accuracy.
- Flag-dedupe table preventing one user from flagging one question twice.

### Events: GA4, not /sync

Every interaction (`question_answered`, `question_skipped`, `question_impression`, `question_flagged`, `pack_downloaded`) fires a Google Analytics 4 event via the Firebase Analytics SDK. Each event carries `anon_guest_id` as a user_property.

There is no `POST /sync`. There is no `client_batch_id`. The Firebase SDK handles batching, retry, and offline buffering — we don't reimplement that.

The BigQuery free-tier export of GA4 events is the queryable backing store for the daily stats and digest jobs. Nothing queries it at user-request time.

### Runtime touchpoints

From the app's point of view, "the backend" is exactly two systems:

1. **Cloudflare R2** — manifest + packs + (Phase 2+) stats packs. Static reads.
2. **GA4 / Firebase Analytics SDK** — write-only event firehose.

That's it. No `/auth`, no `/sync`, no `/admin`, no `/health`, no Node service. **No web app** — the product is mobile-only.

### Pipeline (everything not at runtime)

A scheduled host runs the daily batch work — see [ADR 0005](0005-git-content-store.md) for content storage and [ADR 0006](0006-ai-review-flag-digest.md) for the review pipeline. Stats and the user-flag digest run on the same cadence. The host itself is implementation choice (GitHub Actions, a small VM, a laptop on cron) — nothing in the product depends on which.

### Anti-abuse

Defences live in client-side dedupe and BigQuery rollup logic, not in a runtime gate.

- Client-side: one flag per `(question_id, anon_guest_id)` enforced in local storage.
- BigQuery: every aggregate is `COUNT(DISTINCT anon_guest_id)`, never `COUNT(*)`. One attacker firing 10,000 events still counts as one. Per-question / per-day outlier filters drop users contributing above a threshold.
- Public GA4 measurement ID is accepted. If abuse turns material, a Cloudflare Worker rate-limit edge function is the escape hatch — it doesn't reintroduce a runtime server.

### Scraping

We accept that packs are trivially scrapeable. Mitigations are light:

- Each pack carries a `generation_batch` + `pack_id` so any reuse leaves a provable origin trail.
- Image hotlink protection on R2 (Phase 3 onward) via Cloudflare WAF rule rejecting requests without a matching `Referer`.
- Freshness — a fresh pool is always ahead of a stolen snapshot.

We do **not** add signed URLs, per-user tokens, or pack fragmentation. They compromise CDN cache reuse for marginal defence.

## Consequences

**Positive**

- Hot-path runtime cost per user approaches zero. R2 free + GA4/BQ free covers MVP indefinitely. App distribution is the App Store + Play Store (yearly developer-program fees only).
- The client works offline after the first pack download. Firebase Analytics buffers events and flushes on reconnect.
- No ops surface: no DB backups, no TLS rotation, no Node upgrades, no API deploys. Content updates are git commits and R2 uploads.
- Horizontal scale is the CDN's horizontal scale.
- The product keeps working against whatever's on R2 even if the pipeline host is down for days. Content generation stops; play continues.

**Negative — accepted trades**

- **Answer key is public.** Mitigated by the casual framing and the no-leaderboards-that-matter constraint. If competitive modes ever land, they're a separate code path (Phase 5+).
- **Personal stats are self-reported.** A user can lie to themselves via devtools. Nobody else is harmed; aggregate stats use distinct-user counting and are unaffected.
- **Event freshness lags up to ~24h** for stats and digest rollups (BQ export cadence + daily cron). Acceptable because difficulty recalibration and flag review don't need minute-level data; the manifest cache (5 min) means retirement propagates fast once triggered.
- **Public GA4 measurement ID** accepts junk events. Mitigated by distinct-user counting in BQ rollups.

**Negative — operational**

- Content updates require a CLI + git push, not a web form. Fine for solo operator; revisit if a content team materialises.
- No "live users right now" dashboard except whatever GA4 Realtime offers.
- GDPR deletion runs as a BQ scrub script keyed by `anon_guest_id`, not a `DELETE FROM users` query.

## Alternatives considered

- **Classic server-graded API with Redis cache.** Lower CDN volume but a stateful hot path that scales with users. Rejected — flat cost curve matters more.
- **Thin Fastify proxy in front of GA4 + a hosted DB for `interactions`.** Buys per-request rate limit and `client_batch_id` dedupe; pays for hosted compute + DB. Rejected — distinct-user counting in BQ replaces the rate-limit value, and freshness gain is freshness we don't need.
- **Signed-URL per-user packs.** Kills CDN caching for the least-durable defence (answer-key secrecy). Rejected.
- **Cloudflare Worker as a tiny rate-limit layer.** Attractive, but adds a hop + config surface for a marginal defence beyond BQ counting. Reserved as an escape hatch if abuse appears.
- **Supabase / Firebase Realtime / similar BaaS for everything.** Cheap initially; tight vendor lock-in and awkward fit with grading-on-client. Rejected.

## Cross-references

- [ADR 0001](0001-reels-feed-not-session-rounds.md) — product model this serves
- [ADR 0005](0005-git-content-store.md) — where content lives
- [ADR 0006](0006-ai-review-flag-digest.md) — how content is reviewed and how flags surface
- [Architecture](../architecture.md)
