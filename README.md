# rcao-quiz

AI-powered quiz app with image-snapshot and text questions across multiple subjects. Web + mobile clients, single-process Node/TS backend, batch question generation with human review, Redis leaderboards.

**Status:** Pre-MVP. Architecture approved; Phase 0 skeleton scheduled next.

## Documentation

All planning and architecture lives in [`docs/`](docs/README.md).

- [Architecture](docs/reference/architecture.md) — the system design we're building against.
- [Active plans](docs/README.md#active-plans) — what we're working on now.
- [Completed plans](docs/README.md#completed-plans) — shipped work, archived.

## Running locally

Nothing to run yet — Phase 0 skeleton lands in [MVP-09](docs/active/mvp-skeleton-plan/plan.md). Node 20 (see `.nvmrc`) and `pnpm` will be the baseline once the workspace is scaffolded.

## Guiding principle

Stay boring and lean. In-memory wherever we can, Redis only for leaderboards, no external queue brokers until we actually need them.
