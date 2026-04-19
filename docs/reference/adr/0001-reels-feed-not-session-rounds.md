# ADR 0001 — Reels-style feed, not session rounds

**Status:** ACCEPTED
**Date:** 2026-04-19
**Supersedes:** the session/round model in architecture v1 (2026-04-19)

## Context

The original architecture modelled play as an exam-style round: start a session, serve N questions, grade each answer, show a score at the end. That works for a test-prep or trivia-gameshow product, but the intended experience is casual — eye-catching snapshots scrolling past, user interacts when interested, skips when not. The session framing fights the intended UX: the "start" and "end" ceremonies are friction, the score-at-end flattens the loop, and users who want to dip in for 30 seconds find a round model annoying.

The competing reference is Reels / TikTok / YouTube Shorts: an infinite vertical scroll where every card is both self-contained and part of a rhythm. That pattern is where users already live on their phones, and it matches the "eye-catching snapshot" goal of the original pitch.

## Decision

We model play as an **infinite vertical feed of question cards**. There is no session start, no fixed N, no score-at-end ceremony. A user can open the app, scroll through as many cards as they like, and close it. Each card has three possible interactions: **answer**, **skip**, or simply **impression** (seen but unacted). All three are first-class — skip is not a failure.

Concretely:

- The `quiz_sessions` table does not exist. There is nothing to "complete."
- `answers` is replaced by an `interactions (user_id, question_id, kind, chosen_answer?, seen_at)` table where `kind ∈ answered | skipped | impression`.
- `/sessions/new`, `/sessions/:id/answer`, `/sessions/:id/complete` are removed. They're replaced by a client-driven feed (see ADR 0002 for how the feed itself is served).
- "Score" is redefined as personal stats — today's correct count, streak (consecutive correct, broken by wrong), accuracy by subject. Global leaderboards are deferred past MVP.
- The client-side feed uses scroll-snap; the next 3–5 cards are always preloaded so there's never a visible delay between scrolls.

## Consequences

**Positive**

- UX matches the platform users are already trained on, which is the single biggest retention lever in the casual-content category.
- The server gets simpler because session state stops existing. No per-session answer-key cache, no start/complete endpoints.
- "Session length" becomes a derived analytics metric (time between first and last interaction in an idle window) rather than a data-model concern.
- Skip becomes the strongest quality signal — questions with high skip rates self-identify as dead weight.

**Negative**

- No natural "win condition" for casual players. Some users want a defined end — we address this in a future plan by adding an optional **daily challenge** mode as a second code path, not as the default.
- Global leaderboards lose their natural boundary. We accept this by deferring them and using personal streaks / daily correct counts as the core motivator.
- Migration from session-shaped code on other projects doesn't port over — every instinct about "when the round is over" has to be unlearned.

## Alternatives considered

- **Keep session rounds, add a "casual mode" on top.** Rejected — two code paths for the same loop, and the session model would still leak into the data schema and endpoint shape. Do one thing well.
- **Reels feed with occasional forced-round interstitials** (like ad breaks). Rejected — interrupts the flow, and the thing we're imitating doesn't do this either.
- **Fixed round of 10, but auto-start the next round on finish.** Rejected — still carries session overhead and the score/finish ceremony that we want to eliminate.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — how the feed is actually served (packs on CDN, batched sync)
- [Architecture](../architecture.md) — current system design reflecting this decision
