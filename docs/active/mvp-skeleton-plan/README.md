# MVP Skeleton Plan — Status Tracker

Prove the entire rcao-quiz loop end-to-end, locally, with no AI and no accounts: a Next.js reels-style feed, a tiny Fastify API, a Postgres schema, a pack builder, and ~50 hand-written text questions across three subjects. Text-only (images deferred to Phase 2). Client-graded. Batched sync.

**Master Plan:** [plan.md](plan.md)
**Created:** 2026-04-19
**Status:** PLANNING — 0 / 10 tasks started
**Target Phase:** Phase 0 (1–2 weeks)
**Depends on:** [Architecture](../../reference/architecture.md), [ADR 0001](../../reference/adr/0001-reels-feed-not-session-rounds.md), [ADR 0002](../../reference/adr/0002-client-heavy-cost-optimized.md), [ADR 0003](../../reference/adr/0003-text-only-mvp-client-templates.md)

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| MVP-01 | Monorepo scaffold (pnpm workspaces: `apps/web`, `apps/api`, `packages/sdk`) | S | Pending | -- |
| MVP-02 | Postgres schema + `node-pg-migrate` migrations (users, subjects, questions, interactions, question_stats) | M | Pending | MVP-01 |
| MVP-03 | `packages/sdk` — Zod schemas for Question, Pack, Interaction, SyncRequest; template renderer primitives | M | Pending | MVP-01 |
| MVP-04 | Fastify API skeleton — `/auth/anonymous`, `/auth/google` (stub), `/packs/manifest`, `/sync`, health | M | Pending | MVP-02, MVP-03 |
| MVP-05 | Seed content — 50+ hand-written text questions across 3 subjects, loaded as `status='approved'` | S | Pending | MVP-02 |
| MVP-06 | Pack builder script (`pnpm packs:build`) — snapshots approved questions to pack JSONs + manifest on local disk for MVP, R2 plumbing stubbed | S | Pending | MVP-02, MVP-05 |
| MVP-07 | Next.js feed UI — scroll-snap vertical feed, `QuestionCard` with template renderer, answer / skip / impression interactions | L | Pending | MVP-03 |
| MVP-08 | Client storage — IndexedDB layer for pack cache, two-tier dedupe (acted ring buffer + impressions bloom filter), personal stats, interaction buffer | M | Pending | MVP-03 |
| MVP-09 | Wire client to API — manifest fetch, pack download, batched `/sync` flush on timer + backgrounding | M | Pending | MVP-04, MVP-07, MVP-08 |
| MVP-10 | Local dev tooling + QA pass — docker-compose Postgres, `.env.example`, `pnpm dev`, manual walk-through of the whole loop, README update | S | Pending | MVP-09 |

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.

## Exit criteria

- A user opens `localhost:3000`, scrolls a vertical feed of text-card questions styled by subject-themed templates, taps an answer or skips, and sees their personal stats (today's correct count, current streak) update live.
- Interactions flush to `POST /sync` every ~30s, land in the `interactions` table, and update `question_stats`.
- Everything survives a browser refresh (pack cache + stats persisted in IndexedDB).
- The whole thing runs on a single Node process + a local Postgres container. No Redis, no external queue, no auth provider, no AI generation.
- Content is ~50 hand-approved seed questions across 3 subjects; packs are written to local disk (R2 plumbing is stubbed behind an interface, swapped in during Phase 1).

## Explicitly out of scope for Phase 0

- Google sign-in (Phase 1)
- AI question generation and admin review (Phase 1)
- Real R2 deployment — the pack builder writes to a local `./packs/` directory that the web app serves (Phase 1 swaps in the real R2 upload)
- Leaderboards of any kind (deferred to Phase 4+)
- Mobile client (Phase 3)
- Images and image generation pipeline (Phase 2)
- Production hosting, CI/CD
- Analytics beyond console logs + rows in the `interactions` table
