# ADR 0005 — Warm-start from bundled packs (mobile)

**Status:** ACCEPTED
**Date:** 2026-04-19
**Related:** [ADR 0002](0002-client-heavy-cost-optimized.md), [ADR 0003](0003-text-only-mvp-client-templates.md)
**Implementation phase:** Phase 4 (mobile). Captured now to freeze the reasoning.

## Context

Packs are already immutable and content-addressed (ADR 0002). That makes them *physically* trivial to ship inside the app binary alongside the JS — any pack file that lives on R2 can equally well live as an asset inside the APK / IPA / AAB. The question is whether doing so buys us anything.

For **mobile specifically**, it buys three real things:

- **Instant first-open.** A freshly-installed user sees a card before any network round-trip. No manifest fetch, no pack download, nothing. The first-scroll moment is where a huge chunk of potential retention leaks; eliminating network latency there is a genuine UX improvement.
- **Resilience.** The app works cold on a metro, in a plane, on a patchy connection. CDN becomes a top-up mechanism, not a gate.
- **Reduced CDN egress at the upstream edge.** If a large fraction of what a casual user sees in week one is content that existed at install time, that content doesn't hit R2 at all for them. Even at R2's zero egress, the secondary costs (origin reads for cache misses, pack build cadence, etc.) go down.

For **web**, the math is different: browsers already cache packs aggressively after first fetch, Vercel's edge is fast, and we'd be paying ~3MB of extra JS bundle for a benefit that largely evaporates after first visit. We skip web bundling.

## Decision

We adopt **seed-don't-mirror bundled packs on mobile** — implemented in Phase 4 when the React Native client lands. Specifically:

### What gets bundled

A **curated starter set**, not a full mirror of every published pack. Target: ~200–500 questions total across all MVP subjects, chosen for quality and evergreen appeal, not recency. Sized to a few MB uncompressed (text-only) — negligible APK weight.

Not a full "last 30 days of everything" mirror, for three reasons:

1. Total bundle weight grows with subject/time and gets expensive to ship on every release.
2. Curated selection lets us hand-pick the best "first impression" questions rather than whatever the pack builder happened to include.
3. Simpler release process — the curated seed changes slowly; the CDN packs refresh independently.

### Image packs — bundled with care, or not at all

Text-only packs are tiny (~50KB compressed per pack). Image packs are two orders of magnitude larger. The policy:

- **MVP + Phase 2 (text-only):** bundle freely; size is a non-issue.
- **Phase 3 onward (images):** default to **not bundling image packs.** Reassess at Phase 4 with real size numbers. If we do bundle image packs, bundle at most the most recent single month, or a subset curated for engagement, and set an explicit APK-size budget (e.g. 50MB of content maximum).

### Retirement after release

A bundled pack is permanent on the device until the next app update ships. If a question in a bundled pack is later retired — because it's wrong, offensive, or copyright-problematic — we cannot remove it from installed APKs. So the architecture must respect retirement signals from the CDN side.

Add a **`retired_question_ids`** list to `/packs/manifest`:

```json
{
  "packs": [ ... ],
  "retired_question_ids": ["q_01HX...", "q_01HY..."]
}
```

The client's feed picker filters out any question ID in this list, regardless of which pack (bundled or fetched) it came from. Retirement becomes a manifest update, zero binary changes.

### Client boot sequence

1. On first run of a new app version (detected by a `bundled_version` marker in local storage), seed IndexedDB/SQLite from the bundled pack assets. One-time copy; the `bundled_version` marker prevents re-seeding on every subsequent boot.
2. Fetch `/packs/manifest` in the background.
3. Diff: any packs in the live manifest not already present locally → download from CDN. Any question IDs in `retired_question_ids` → add to the client's retirement filter.
4. Feed picker treats bundled and fetched packs identically.

### Dedup

The feed picker already dedupes by `question_id`. Since bundled pack IDs and CDN pack IDs never collide (content-addressed filenames), and question IDs are UUIDs, there is zero risk of duplicates being presented to the user — even if the same question appears in both a bundled pack and a later CDN pack.

### Release cadence implication

Monthly app releases are the natural cadence for refreshing the bundle. Slipping a release doesn't hurt users on CDN — they keep getting fresh content. The app doesn't go stale between releases because the CDN fills in. The bundled content is a warm start, not a content commitment.

## Consequences

**Positive**

- Time-to-first-card on mobile first launch drops from "manifest-fetch + pack-download + render" to "render." For users on poor connections, this is the difference between "works instantly" and "spinner on a fresh install."
- Offline-first stops being a degraded mode. The app is fully functional until the bundled pool is exhausted, which for most users takes several sessions.
- Lower pressure on the CDN cold-cache path for new users.
- Forces us to make retirement a first-class manifest concept, which is a good discipline anyway.

**Negative**

- New build-pipeline step. The mobile CI job needs to pull a snapshot of curated packs from R2 (or the pack builder's output) and vendor them into `assets/` at release time. Not hard, but it's a new step that has to not-break.
- APK size grows by a few MB. Negligible for text-only, worth watching for image packs.
- Retirement list grows over time. If it ever gets long (thousands of entries), we paginate or age out via a "only retired in the last N days" rule.
- A bug in a bundled question can't be fixed without either an app update or a retirement entry. Favours light-touch bundling.

**Operational**

- Curated-seed selection is a per-release human decision in Phase 4 onwards. In practice the admin reviewer flags "bundle-worthy" questions during review, and the build script picks those at cut.
- If the APK bundle gets out of sync with the live Postgres (e.g. a bundled question was later edited in the DB), the CDN manifest wins — we ship a "retired then re-added with new ID" flow rather than allowing in-place edits to bundled content.

## Alternatives considered

- **Full mirror (every pack up to release date bundled).** Rejected — grows without bound, prohibitively large once images land, bundles stale content we may not want as a first impression.
- **No bundling ever, CDN-only.** Current behaviour. Works fine on good networks but leaves the first-open UX improvement on the table. We prefer warm-start where it's cheap.
- **Web-side bundling via Next.js static assets.** Considered and rejected for now. Benefit is marginal (browser cache already helps, Vercel edge is close), cost is initial JS bundle bloat. Revisit only if telemetry shows repeat-visit users cold-fetching packs meaningfully.
- **On-demand delivery (Android Asset Delivery, iOS On-Demand Resources).** Mobile platforms support post-install asset delivery. Fancier but more complex, and doesn't help the first-open "just installed, no network" case. Deferred.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — immutable packs on R2, the property that makes bundling cheap
- [ADR 0003](0003-text-only-mvp-client-templates.md) — text-only MVP explains why bundle size stays small through early phases
- [Architecture](../architecture.md) §2 (Clients), §9 (Phased roadmap)
- Mobile plan (future) — implementation lives here when Phase 4 gets written
