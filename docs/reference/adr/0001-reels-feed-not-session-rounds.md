# ADR 0001 — Reels-style feed, not session rounds

**Status:** ACCEPTED

## Context

The intended UX is casual scrolling — eye-catching cards that the user engages with when interested and skips when not. The classic exam-shape (start a session, answer N questions, see a score) fights this: the start/end ceremony is friction, the score-at-end flattens the loop, and a 30-second drop-in feels worse than it should.

The reference is Reels / TikTok / Shorts: an infinite vertical scroll where every card is both self-contained and part of a rhythm. That's the pattern users' thumbs already know.

## Decision

Play is an **infinite vertical feed of question cards**. No session start, no fixed N, no score-at-end. Each card has three possible interactions: **answer**, **skip**, or **impression** (seen but unacted). All three are first-class — skip is not failure.

Concretely:

- No `quiz_sessions`. Nothing to "complete."
- The unit of recorded play is an **interaction event** with `kind ∈ answered | skipped | impression`.
- "Score" means personal stats — today's correct count, current streak (consecutive correct), per-subject accuracy. Computed and displayed locally.
- The client uses scroll-snap; the next 3–5 cards are always preloaded so there's no visible delay between scrolls.

## Consequences

**Positive**

- UX matches a pattern users are already trained on, the strongest retention lever in casual content.
- The play loop has no ceremony state to manage — no per-session caches, no start/end endpoints. The architecture downstream of this gets simpler everywhere.
- Skip becomes the strongest content-quality signal — questions with high skip rates self-identify as dead weight.

**Negative**

- No natural "win condition." Users who want a defined ending aren't served by the feed alone. If product data ever supports it, a daily-challenge mode lands as a separate code path — it does not displace the feed.
- "Total score" loses meaning. We replace it with bounded scopes: today's count, streak, per-subject accuracy.

## Alternatives considered

- **Keep session rounds + add a "casual mode" on top.** Two code paths for one loop, and the session model still leaks into the schema. Rejected.
- **Reels feed with periodic forced-round interstitials.** Interrupts the rhythm; the products we're imitating don't do this. Rejected.
- **Fixed round of 10, auto-start the next.** Still carries session overhead. Rejected.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — how the feed is served and graded
- [Architecture](../architecture.md)
