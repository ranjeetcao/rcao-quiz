# rcao-quiz

Casual, reels-style quiz app. Vertical-scroll feed of text question cards; answer or skip at your pace. AI-generated content behind the scenes with human review. Web + mobile clients, tiny Node/TS backend, question packs served from a zero-egress CDN, client-side grading.

**Status:** Pre-MVP. Architecture v2 approved; Phase 0 skeleton scheduled next.

**License:** Proprietary — see [LICENSE](LICENSE). Not for redistribution.

**Key decisions:** [ADR 0001 (reels, not rounds)](docs/reference/adr/0001-reels-feed-not-session-rounds.md) · [ADR 0002 (client-heavy, cost-optimized)](docs/reference/adr/0002-client-heavy-cost-optimized.md) · [ADR 0003 (text-only for MVP)](docs/reference/adr/0003-text-only-mvp-client-templates.md)

## Documentation

All planning and architecture lives in [`docs/`](docs/README.md).

- [Architecture](docs/reference/architecture.md) — the system design we're building against.
- [Active plans](docs/README.md#active-plans) — what we're working on now.
- [Completed plans](docs/README.md#completed-plans) — shipped work, archived.

## Running locally

Nothing to run yet — the full Phase 0 quickstart lands in [MVP-10](docs/active/mvp-skeleton-plan/plan.md#mvp-10--local-dev-tooling--qa-pass). Node 20 (see `.nvmrc`) and `pnpm` will be the baseline once the workspace is scaffolded.

## Guiding principle

Stay boring and lean. In-memory wherever we can, Redis only for leaderboards, no external queue brokers until we actually need them.
