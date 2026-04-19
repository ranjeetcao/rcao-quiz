# MVP Skeleton Plan — Status Tracker

Scaffold the minimum end-to-end loop for rcao-quiz: a Next.js player, a Fastify API, a Postgres schema, anonymous play, and a hand-curated pool of ~20 seed questions spread across text/math and image/geography. Proves the play flow before any AI pipeline work.

**Master Plan:** [plan.md](plan.md)
**Created:** 2026-04-19
**Status:** PLANNING — 0 / 10 tasks started
**Target Phase:** Phase 0 (1–2 weeks)
**Depends on:** [Architecture](../../reference/architecture.md)

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| MVP-01 | Monorepo scaffold (pnpm workspaces: `apps/web`, `apps/api`, `packages/sdk`) | S | Pending | -- |
| MVP-02 | Postgres schema + migration tool (users, subjects, questions, quiz_sessions, answers, question_stats) | M | Pending | MVP-01 |
| MVP-03 | `packages/sdk` — Zod schemas for Question, Session, Answer, plus typed REST client | S | Pending | MVP-01 |
| MVP-04 | Fastify API skeleton with anonymous guest-JWT, `/sessions/new`, `/answer`, `/complete` | M | Pending | MVP-02, MVP-03 |
| MVP-05 | Seed data loader — 20 hand-written questions (10 text/math + 10 image/geography) | S | Pending | MVP-02 |
| MVP-06 | Next.js player UI — session screen, question card (text + image), result screen | M | Pending | MVP-03 |
| MVP-07 | Wire Next.js to API with SDK; anonymous play end-to-end | S | Pending | MVP-04, MVP-06 |
| MVP-08 | In-memory rate limit + recent-seen tracker on API | XS | Pending | MVP-04 |
| MVP-09 | Local dev tooling — docker-compose (Postgres), `.env.example`, `pnpm dev` orchestration | S | Pending | MVP-01 |
| MVP-10 | Manual QA pass + README updates | XS | Pending | MVP-07 |

## Exit criteria

- A user can open `localhost:3000`, start a quiz, answer ~10 questions (mix of text/math + image/geography), see their score, and start again — all anonymously.
- API runs as a single Node process with Postgres as the only backing service.
- No Redis, no external queue, no auth provider wired up yet (Phase 1 concern).
- Seed pool is human-written — no AI generation yet (Phase 2 concern).
