# MVP Skeleton Plan — Status Tracker

Prove the entire rcao-quiz loop end-to-end on **iOS Simulator + Android Emulator**, with zero runtime services: an Expo app with a reels-style feed, content as JSON files in the git repo, a local pack builder, ~50 hand-written text questions across three subjects, client-side grading, two-tier dedupe, and event emission through an SDK abstraction (console logger in Phase 0; real Firebase Analytics lands in Phase 1).

**Master Plan:** [plan.md](plan.md)
**Status:** IN PROGRESS — 4 / 10 tasks done (MVP-01, MVP-02, MVP-03, MVP-04)
**Target Phase:** Phase 0 (2–3 weeks)
**Depends on:** [Architecture](../../reference/architecture.md), [ADRs 0001–0006](../../reference/adr/)

## Tasks at a glance

| Task | Title | Effort | Status | Blocked By |
|------|-------|--------|--------|------------|
| MVP-01 | Monorepo scaffold (pnpm workspaces: `apps/mobile` Expo app, `packages/sdk`, `scripts/`) | M | Done (`611c680`) | -- |
| MVP-02 | Content repo structure (`content/subjects.json`, `content/prompt_templates/`, `content/questions/`) + 50 hand-written text Qs across 3 subjects | S | Done (`a352ab5`) | -- |
| MVP-03 | `@quiz/sdk` — Zod schemas (Question, Pack, Manifest, GA4 events), grading helper, `QuestionCard` template renderer for RN, analytics abstraction (console logger in Phase 0) | M | Done (`7fdc174`) | MVP-01 |
| MVP-04 | Pack builder script (`scripts/packs-build.ts`) — reads `content/`, writes pack JSONs + manifest to local `./packs/`; Expo dev server serves them as static assets via `expo-asset` or a local HTTP server | S | Done (this PR) | MVP-02, MVP-03 |
| MVP-05 | Reels feed UI on `FlatList` with paging-snap — `QuestionCard`, subject templates (`expo-linear-gradient` + `react-native-svg`), report button, haptics on answer | L | Pending | MVP-03 |
| MVP-06 | App storage — `expo-sqlite` for pack cache + dedupe (acted ring buffer, bloom filter blob, flag-dedupe table); `react-native-mmkv` for personal stats; `expo-secure-store` for `anon_guest_id` | M | Pending | MVP-03 |
| MVP-07 | Wire app to packs — fetch manifest + packs from local pack server, feed picker with two-tier dedupe applied | M | Pending | MVP-04, MVP-05, MVP-06 |
| MVP-08 | Event emission via SDK abstraction (console in Phase 0); buffer events in memory between scrolls; flush triggers (idle, ceiling, app-background) all stubbed locally | S | Pending | MVP-03, MVP-06 |
| MVP-09 | Flag UX — report sheet with reason picker, client-side dedupe enforcement (one flag per `(question_id, anon_guest_id)` in SQLite) | S | Pending | MVP-05, MVP-06 |
| MVP-10 | Local dev tooling + QA pass — `.env.example`, README quickstart for Expo, end-to-end walk-through on iOS Simulator and one Android target | S | Pending | MVP-07, MVP-08, MVP-09 |

**Effort legend:** XS < 2h, S ≈ 2–4h, M ≈ 4–10h, L ≈ 10–20h, XL > 20h.

## Exit criteria

- `pnpm install && pnpm content:seed && pnpm packs:build && pnpm --filter mobile start` boots the Expo dev server.
- Pressing `i` opens the iOS Simulator; pressing `a` opens an Android emulator. The app loads in both.
- Vertical-scroll feed renders; 50 seed questions visible across 3 subjects, deterministically subject-themed.
- Tap an answer → correct/wrong styling + brief reveal; swipe to skip; tap report → reason picker → confirmation.
- Events stream to console via the SDK abstraction (Firebase Analytics SDK wiring is Phase 1).
- Personal stats (today's correct, streak) survive app restart (MMKV).
- `acted` ring buffer + `seen` bloom filter persist across sessions; same question never shows twice in the current session.
- No backend. No web app. No real GA4/R2/auth/admin.

## Explicitly out of scope for Phase 0

- Real Firebase Analytics setup, GA4 property, BigQuery export (Phase 1).
- Real Cloudflare R2 bucket + upload (Phase 1).
- AI content generation pipeline (Phase 1).
- Cascading AI review stages (Phase 1).
- Daily Slack digest + retirement CLI (Phase 1, once R2 is live).
- EAS Build / TestFlight / Play Store internal testing (Phase 1).
- Stats packs + social-proof rendering (Phase 2).
- Images (Phase 3).
- Web app of any kind — never.
- Google sign-in / admin UI — not planned (ADRs 0002, 0006).
