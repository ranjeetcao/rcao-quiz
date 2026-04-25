# rcao-quiz

Casual, reels-style quiz app for **iOS and Android**. Vertical-scroll feed of text question cards; answer or skip at your pace. AI-generated content with cascading AI review. Zero hosted compute at runtime — the app reads packs from a CDN and fires GA4 events. Content generation, stats, and the daily flag digest run on a scheduled host.

**Status:** Pre-MVP. Architecture approved; Phase 0 scaffolding next.

**License:** Proprietary — see [LICENSE](LICENSE). Not for redistribution.

## Documentation

All planning and architecture lives in [`docs/`](docs/README.md).

- [Architecture](docs/reference/architecture.md) — the system we're building against.
- [Active plans](docs/README.md#active-plans) — what we're working on now.
- [ADRs](docs/reference/adr/) — load-bearing decisions and the why behind them.

### Key decisions

- [ADR 0001](docs/reference/adr/0001-reels-feed-not-session-rounds.md) — reels feed, not exam rounds
- [ADR 0002](docs/reference/adr/0002-client-heavy-cost-optimized.md) — client-graded play, server-less runtime
- [ADR 0003](docs/reference/adr/0003-text-only-mvp-client-templates.md) — text-only MVP with client templates
- [ADR 0004](docs/reference/adr/0004-statistical-percentile-leaderboards.md) — percentile social-proof, not ordinal leaderboards
- [ADR 0005](docs/reference/adr/0005-git-content-store.md) — content as JSON in the git repo
- [ADR 0006](docs/reference/adr/0006-ai-review-flag-digest.md) — AI-only review with user flags + Slack digest

## Running locally

Quickstart lands in [MVP-10](docs/active/mvp-skeleton-plan/plan.md#mvp-10--local-dev-tooling--qa-pass). Phase 0 baseline: Node 20 (see `.nvmrc`), `pnpm`, an Expo dev environment (Xcode for iOS Simulator, Android Studio for one Android target).

## Guiding principle

Stay boring and lean. No runtime backend until a real requirement forces one. Mobile-only — no web app.
