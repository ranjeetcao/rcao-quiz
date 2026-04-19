# ADR 0002 — Client-heavy architecture for lowest operating cost

**Status:** ACCEPTED
**Date:** 2026-04-19
**Related:** [ADR 0001](0001-reels-feed-not-session-rounds.md)

## Context

The product is a casual reels-style quiz app (see ADR 0001). There is no money on the line, no betting, no credentialing, and no competitive ranking worth protecting at MVP. At the same time, the operating cost envelope is tight — we want the system to remain essentially free to run at MVP scale and to scale roughly linearly with users rather than exponentially.

Image-heavy reels UIs have one overwhelming cost driver: **CDN egress**. Every scroll loads fresh media. A server-graded quiz has a second: an API on the hot path for every interaction. Both can be neutralised if we're willing to move authority to the client, which we are, because the product doesn't have the stakes that would make client-trust dangerous.

## Decision

We commit to a **client-heavy, CDN-fronted** architecture. The backend exists only for the things clients genuinely cannot do themselves.

### Content delivery: pre-built question packs on a zero-egress CDN

Questions are assembled into JSON **packs** by a nightly build script and uploaded to **Cloudflare R2**. Each pack contains the full payload the client needs to play offline — prompts, choices, correct answers, media URLs (when images land in Phase 2), and subject/difficulty tags. Packs are cached aggressively (`Cache-Control: public, max-age=31536000, immutable`, content-addressed URLs).

A tiny `GET /packs/manifest` endpoint returns the list of currently-live packs with their hashes. Clients fetch the manifest on app open, compare hashes against their local cache, and download only new or changed packs. The manifest is the only server call on the play hot path, and it's a flat JSON read cacheable at the edge.

### Grading: client-side

Packs ship the `correct_answer` field. The client grades answers locally. The server never sees "was this right or wrong" on the per-interaction hot path.

This is a deliberate trade: the answer key is no longer secret. In a casual app with no leaderboards-that-matter, we accept this. See "Cheating" under Consequences.

### State: client-owned

The following live in the client (IndexedDB on web, SQLite or MMKV on React Native), **not** in the server:

- Pack cache and manifest snapshot
- Seen-question set (recent ~1000 IDs, as a ring buffer)
- Personal stats: today's correct count, streak, per-subject accuracy
- User preferences: subject selection, mute, etc.

The server sees these only via periodic sync (below) and only for analytics / cross-device backup purposes.

### Server writes: batched

A single `POST /sync` endpoint accepts a batch of interactions (answered / skipped / impression events) plus an optional personal-stats blob. Clients buffer interactions locally and flush on one of:

- Every ~30 seconds of foreground activity
- Every ~20 buffered interactions
- App background / tab hidden

This reduces API request volume by roughly 50× versus per-event grading, and the server response is a tiny ack. Sampling is acceptable — we don't need to record every impression event, but we want enough signal to power question-quality retirement via `question_stats`.

### What the server still does

- **Auth** — Google OAuth callback, JWT issuance (`POST /auth/*`)
- **Pack manifest** — `GET /packs/manifest` (cached)
- **Sync** — `POST /sync`
- **Admin** — `GET /admin/questions?status=pending`, `POST /admin/questions/:id/approve|reject` (role-gated)
- **AI generation pipeline** — `node-cron` in-process, writes to `questions` with `status=pending`
- **Pack builder** — nightly/on-demand script that snapshots approved questions into pack JSONs and uploads to R2

Nothing on the hot path.

### Scraping

We accept that packs are trivially scrapeable. Mitigations are light and low-cost:

- **Batch fingerprinting** — each pack includes a `generation_batch` + `pack_id` so any reuse leaves a provable origin trail.
- **Hotlink protection on image CDN** — once images land in Phase 2, reject requests without a matching `Referer` via a Cloudflare WAF rule. Trivially bypassed by a determined actor but filters out lazy hotlinking.
- **Freshness** — the best anti-scrape. A fresh pool is always ahead of a stolen snapshot.

We do **not** add signed URLs, per-user tokens, pack fragmentation, or any other defence that would compromise CDN caching or add API round-trips. These are security theatre at MVP scale.

## Consequences

**Positive**

- Hot-path server cost per user approaches zero. The API is called once at app open (manifest) and once every ~30 seconds (sync). Everything else is a static CDN read.
- R2's zero-egress pricing means image-heavy growth doesn't create a hockey-stick bandwidth bill later.
- The API is stateless. No per-session caches, no process-memory that breaks on restart. Horizontal scaling is trivial when we need it.
- The client works offline after the first pack download. This is a real UX win for flaky mobile connections.
- We can host on Cloudflare Workers free tier or a $5/month Fly.io instance for a long time.

**Negative — cheating**

Anyone who opens devtools or inspects the RN bundle can see the correct answers. For casual play this doesn't hurt anyone, but we accept the following downstream constraints:

- **No real-stakes leaderboards.** If we ever want a trusted ranking, we add a separate **server-graded** mode (daily challenge, tournament) as a distinct code path with its own small surface area. The casual feed stays client-graded.
- **Self-reported personal stats.** Users can lie about their streak. At scale the lies are noise; at small scale, the only person harmed is the liar.
- **Aggregate question quality stats are honest enough.** Individual users can skew `question_stats` via the sync, but at N-users-per-question the signal washes out. Treat outlier reports as noise.

**Negative — operational**

- The pack build is a new piece of infrastructure: a script that queries Postgres, constructs JSON, uploads to R2, and updates the manifest. Cron-triggered, idempotent, straightforward — but it's a thing that can fail.
- Client state migrations become a thing. If we later add a new field to stats or change the pack schema, we need to handle "client has old schema, server has new" gracefully. Versioned pack schema + lenient client parsing is the pattern.

**Negative — observability**

- We learn about user behaviour only in batched form, delayed by up to 30 seconds. Real-time dashboards ("how many people are playing right now?") require a different signal (keep-alive ping, or accepting the batched-sync lag).

## Alternatives considered

- **Classic server-graded API with Redis cache.** Lower CDN cost but higher API compute and a stateful hot path. Fine at small scale, expensive and complex at medium scale. Rejected because we want the cost curve to stay flat.
- **Signed-URL per-user packs.** Preserves pack secrecy but kills CDN caching (every user gets a unique URL, cache hit rate drops to near-zero). Rejected — pays the biggest cost for the least durable defence.
- **GraphQL with persisted queries on the edge.** More flexible client-driven queries, but introduces a new runtime (GraphQL server) and moves us away from "boring and lean." Rejected for MVP.
- **Supabase or similar BaaS for everything.** Would work and might be even cheaper initially, but tightly couples to one vendor and makes the grading-on-client strategy awkward. Rejected to preserve flexibility.

## Cross-references

- [ADR 0001](0001-reels-feed-not-session-rounds.md) — product model that this serves
- [ADR 0003](0003-text-only-mvp-client-templates.md) — why we don't have image costs yet
- [Architecture](../architecture.md) — current system design reflecting this decision

## Amendments

### 2026-04-19 — Two-tier dedupe replaces the ring buffer

The "Seen-question set (recent ~1000 IDs, as a ring buffer)" bullet under **State: client-owned** above is superseded by a two-tier scheme: an exact `acted` ring buffer (10,000 capacity) for answered/skipped questions plus a `seen` bloom filter (~20,000 capacity, ~1% FPR, monthly rotation) for impressions. Live spec lives in [architecture §2](../architecture.md#2-clients). Driver: the impression/skip distinction (added when reels semantics were nailed down) needs a much larger capacity than the original spec, and bloom filtering keeps the storage cost flat.
