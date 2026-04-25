# MVP Skeleton Plan

> **Status:** PLANNING
> **Services:** apps/mobile (Expo), packages/sdk, scripts/
> **Estimated effort:** 2–3 weeks across 10 tasks
> **Cross-references:** [Architecture](../../reference/architecture.md), [ADRs 0001–0006](../../reference/adr/)

---

## 1. Problem statement

rcao-quiz has approved architecture (Phase 0–4 roadmap, six ADRs) but no code. Before we build the AI pipeline, ship real GA4, or invest in images, we need to prove that the shape of the product — a **client-graded, reels-style, text-card feed running on iOS + Android** — actually works end-to-end. This plan produces the smallest scaffold that gets a user scrolling through hand-written questions on the simulator, with all storage and dedupe primitives in place so Phase 1 can plug real services into the seams.

### Current state at plan start

- Empty repo with `docs/`, `LICENSE`, and the v1 ADR set.
- No app code, no Expo project, no content.

### Desired state at plan exit

- An Expo app that runs on iOS Simulator and Android Emulator.
- The user opens it and immediately lands in a vertical scroll-snap feed of 50 hand-written text questions.
- Each card renders as a text question over a subject-themed template (gradient + SVG shapes + display font).
- Answer / skip / impression / flag interactions all work, all hit the SDK analytics abstraction (logging to console in Phase 0).
- Personal stats (today's correct count, current streak) update live in MMKV and persist across app restarts.
- Two-tier dedupe (SQLite `acted` ring buffer + bloom filter for `seen`) survives across sessions.
- Pack JSON + manifest are produced by a local script and served to the app (no R2 yet).

### Out of scope for Phase 0

See the [README tracker](README.md#explicitly-out-of-scope-for-phase-0).

---

## 2. Goals

| # | Goal | Measured By |
|---|------|-------------|
| G1 | Reels-style play loop works on iOS + Android | User scrolls the feed, answers some cards, skips others, stats update |
| G2 | Client-graded correctness works | App computes `is_correct` from the pack's `correct_answer`; no server involved |
| G3 | Text templates render correctly | Subject-themed CSS-equivalent templates display; same question always gets the same look |
| G4 | Shared type contract | Types from `@quiz/sdk` are used by both app and pack builder |
| G5 | Seed pool exists | 50+ hand-written text questions across 3 subjects, all `status=approved` |
| G6 | Zero non-essential infra | Expo app + local content + local pack builder. No backend, no real services |

---

## 3. Repo layout (target)

```
rcao-quiz/
├── apps/
│   └── mobile/             Expo app (Expo Router, NativeWind)
├── packages/
│   └── sdk/                Shared Zod schemas, RN QuestionCard, SDK helpers
├── content/
│   ├── subjects.json
│   ├── prompt_templates/   (Phase 1 seed; not exercised in Phase 0)
│   └── questions/<id>.json (50 hand-written)
├── packs/                  Local pack output (gitignored)
├── scripts/
│   ├── packs-build.ts      Pack builder
│   └── seed-questions.ts   Convert hand-written content into the question file shape
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
└── docs/                   (already exists)
```

---

## 4. Tasks

### MVP-01 — Monorepo scaffold

**Effort:** M
**Goal:** `pnpm install` works; the Expo app boots in iOS Simulator and Android Emulator.

- Initialise root `package.json` with `"packageManager": "pnpm@9.x"`.
- `pnpm-workspace.yaml` lists `apps/*`, `packages/*`, `scripts/`.
- `tsconfig.base.json` with strict TypeScript; per-workspace `tsconfig.json` extends it.
- TypeScript project references so `apps/mobile` depends on `packages/sdk`.
- Shared tooling: ESLint (flat config), Prettier, `.editorconfig`, `.nvmrc` pinning Node 20.
- Bootstrap `apps/mobile` via `npx create-expo-app@latest` + Expo Router template + NativeWind.
- Verify `pnpm --filter mobile start` brings up the Expo dev server.

**Exit:** `pnpm install` succeeds. `pnpm -r typecheck` passes on the empty scaffold. `i` and `a` keys in the Expo dev server open simulators that show the default Expo home screen.

---

### MVP-02 — Content repo structure + 50 seed questions

**Effort:** S
**Goal:** Hand-written content lives in the right shape on disk.

- Create `content/subjects.json`:
  ```json
  [
    { "slug": "math", "display_name": "Math" },
    { "slug": "geography", "display_name": "Geography" },
    { "slug": "general_knowledge", "display_name": "General Knowledge" }
  ]
  ```
- Create `content/questions/` with ≥ 50 hand-written questions split across the three subjects (~17 each).
- Each file follows the schema in [ADR 0005](../../reference/adr/0005-git-content-store.md):
  - `id`: ULID-ish (`q_<26-char>`)
  - `mode: "text"`
  - `subject`: one of the three slugs
  - `prompt_text`: the question
  - `choices`: 4 strings
  - `correct_answer`: one of the choices, exact match
  - `difficulty`: 1–3
  - `status: "approved"`
  - `generator_meta: { "source": "hand-written-mvp", "approved_at": "<ISO>" }`
  - `retired_at: null, retired_reason: null`
- Optional helper `scripts/seed-questions.ts` to take a CSV/markdown input and emit the JSON files (useful when batch-seeding from a doc).

**Exit:** `find content/questions -name '*.json' | wc -l` ≥ 50. Each file validates against the Zod `Question` schema once MVP-03 lands.

---

### MVP-03 — `@quiz/sdk`

**Effort:** M
**Goal:** Single source of truth for types, grading logic, RN rendering primitives, and the analytics abstraction.

Zod schemas + inferred TS types for:

- `Mode` = `z.enum(['text','image','video'])`
- `SubjectSlug` (loaded from `content/subjects.json`)
- `Question` — `id, mode, subject, prompt_text, choices (length 4), correct_answer, difficulty`
  - **Includes `correct_answer`** — the app grades locally (ADR 0002).
- `Pack` — `pack_id, generation_batch, schema_version, built_at, subjects[], questions[]`
- `ManifestEntry` — discriminated union `{kind: 'content'|'stats', ...}`
- `Manifest` — `{packs: ManifestEntry[], retired_question_ids: string[]}`
- GA4 event payloads: `QuestionAnsweredParams`, `QuestionSkippedParams`, `QuestionImpressionParams`, `QuestionFlaggedParams`, `PackDownloadedParams`

Helpers:

- `gradeAnswer(question, chosen): boolean` — case- and trim-sensitive equality.
- `pickTemplate(question): Template` — deterministic by `question.id` hash; subject-themed registry with 2–3 variants per subject.

RN components (NativeWind classes, `react-native-svg`, `expo-linear-gradient`):

- `QuestionCard` — takes `Question`, dispatches on `mode`, renders text mode with the picked template. Image mode throws "not implemented in Phase 0".
- `ChoiceButton` — handles answer state (idle / chosen / revealed-correct / revealed-wrong).
- `ReportButton` — opens the flag sheet (MVP-09).

Analytics abstraction:

- `analytics.emit(event, params)` — Phase 0 logs to console. Phase 1 swaps in the Firebase Analytics call. Same signature.

Published as `@quiz/sdk` workspace package (`workspace:*`).

**Exit:** Both `apps/mobile` and `scripts/packs-build.ts` import `Question` from `@quiz/sdk`. Jest tests for `gradeAnswer` and `pickTemplate` pass.

---

### MVP-04 — Pack builder script

**Effort:** S
**Goal:** Turn approved JSON files into pack JSONs + a manifest on local disk.

- `pnpm packs:build` runs `scripts/packs-build.ts`:
  1. Read every `content/questions/*.json` with `status=approved`. Validate against the `Question` Zod schema.
  2. Group by subject.
  3. For each subject, build a `Pack`: `pack_id = "pack_<subject>_v1_<YYYYMMDD>"`, `generation_batch = "<YYYYMMDD>-a"`, `schema_version: 1`, `built_at`, `subjects: [<subject>]`, `questions: [...]`.
  4. Hash the canonicalised pack JSON (SHA-256). Write to `./packs/<pack_id>.json`.
  5. Write `./packs/manifest.json` listing all packs + `retired_question_ids: []` for Phase 0.
- Storage is abstracted behind `PackStorage { put(key, bytes): Promise<url> }`. Phase 0 implementation = `LocalDiskStorage`. Phase 1 swaps in `R2Storage`.
- Idempotency: same input → byte-identical output.

**Exit:** `pnpm packs:build` produces 3 pack files and a manifest. Files validate against the Zod `Pack` schema.

---

### MVP-05 — Reels feed UI on FlatList

**Effort:** L
**Goal:** A working scroll-snap reels feed in the Expo app.

Routing (`apps/mobile/app/`):

- `index.tsx` — the feed (no landing screen; open → see card #1).
- `stats.tsx` — minimal stats screen (today's correct, streak; per-subject accuracy bars). Optional for exit but strongly recommended.
- `(modals)/report.tsx` — flag sheet (MVP-09).

Feed implementation:

- Vertical `FlatList` with `pagingEnabled`, `snapToInterval={SCREEN_HEIGHT}`, `decelerationRate="fast"`. (Or `react-native-pager-view` with vertical orientation if `FlatList` snap behavior is rough on Android.)
- `windowSize=5`, `initialNumToRender=3`, `removeClippedSubviews=true` so 3–5 cards stay mounted around the current.
- `keyExtractor` by `question.id`.
- `onViewableItemsChanged` drives:
  - `question_impression` event after a card is on-screen >2s without engagement.
  - Updates the feed picker's "current index" so it knows when to extend the buffer.

`QuestionCard` (from `@quiz/sdk`):

- Full-bleed background (`expo-linear-gradient` + `react-native-svg` shapes per template).
- Prompt text in the picked display font.
- Four `ChoiceButton`s.
- Three states: idle, revealing-correct, revealing-wrong. Reveal lasts ~800ms (correct) or ~1.2s (wrong) then auto-advance.
- Haptic tap on answer (`expo-haptics`).
- A small report icon in the top-right.

Stats chip (always-visible header):

- "Today: 7 · 🔥 5" — touchable, navigates to `/stats`.

Picker logic:

- Reads from local pack cache (MVP-06), filters by user subject preference (Phase 0: all three on equally), excludes `acted`.
- Partitions into "not in `seen`" preferred / "possibly seen" fallback per ADR 0002 §dedupe.
- Refills the feed buffer when current index passes 60% of buffer length.

**Exit:** With the API wired in MVP-07 mocked by static fixtures, the feed renders both subjects and templates correctly on iOS Simulator and Android Emulator. Snap behaviour is smooth on both.

---

### MVP-06 — App storage layer

**Effort:** M
**Goal:** Persistent local state via SQLite + MMKV + SecureStore, wrapped behind a typed interface in `@quiz/sdk`.

- `expo-secure-store` for the `anon_guest_id` UUID. Mint on first open, persist forever.
- `expo-sqlite` schemas (lazy-created at app start):
  - `packs(pack_id PRIMARY KEY, hash, json_blob, last_used_at)` — pack cache; LRU evicted at 50MB total.
  - `acted(question_id PRIMARY KEY, kind, seen_at, seq)` — exact ring buffer; FIFO eviction by `seq` when count > 10,000.
  - `seen_filter(generation TEXT PRIMARY KEY, blob BLOB, current_inserts INTEGER)` — two rows: `'current'` and `'previous'`. Bloom blob serialised with `Kirsch-Mitzenmacher` parameters from `@quiz/sdk`.
  - `flag_dedupe(question_id PRIMARY KEY, anon_guest_id, flagged_at)` — one flag per `(question_id, anon_guest_id)`.
  - `manifest(key TEXT PRIMARY KEY, json_blob)` — single row `'current'` holding the most recent manifest snapshot.
- `react-native-mmkv` for personal stats (sync reads, fast):
  - `today_date`, `today_correct`, `today_skipped`, `streak_current`, `streak_longest`, `per_subject_accuracy: Record<SubjectSlug, {correct, answered}>`.
- Bloom filter implementation in `@quiz/sdk/bloom.ts`: hash question_id with FNV-1a + Murmur-style folding, derive k positions via Kirsch-Mitzenmacher (`h_i = h1 + i * h2 mod m`).
- Dedupe API exposed by the store:
  - `markActed(question_id, kind)` — pushes to `acted` ring + `seen_filter` (acted implies seen).
  - `markImpression(question_id)` — pushes to `seen_filter` only.
  - `isActed(question_id)` — exact lookup.
  - `isPossiblySeen(question_id)` — bloom lookup against both generations.
- `clientStore.ts` in `@quiz/sdk` — platform-agnostic interface; only the RN impl ships in MVP.
- Stats computation is idempotent: `recomputeStats(events[]): PersonalStats` — pure function, tested.

**Exit:** Restart the app — feed picker, stats chip, `acted` and `seen_filter` all survive. Wipe app data — fresh start works cleanly. Unit tests cover bloom FP rate within tolerance and ring-buffer eviction at the 10k boundary.

---

### MVP-07 — Wire app to packs

**Effort:** M
**Goal:** App fetches pack JSONs from a local source and plays through them.

Phase 0 has no R2; the simplest path is to serve `./packs/` from a local HTTP file server during development:

- A small `scripts/packs-serve.ts` runs `npx serve ./packs --port 8787` (or equivalent) on `pnpm dev`.
- The app reads `EXPO_PUBLIC_PACKS_BASE_URL=http://<dev-machine-IP>:8787` from `.env`.
- On app open: fetch `/manifest.json`, store snapshot in SQLite. Diff entries against the local pack cache. For each new/changed entry, fetch and persist.
- Manifest fetch is "best effort, refresh in background." If it fails (no network, dev server down), the app plays from whatever's already cached.

The same code path will swap to R2 in Phase 1 with no shape changes — only the base URL changes.

**Exit:** Start the dev server + pack server + app. Open the app: it fetches the manifest, downloads three packs, opens the feed, and plays. Kill the pack server mid-session: the feed keeps working from cache. Run `pnpm packs:build` again with one new question added: next manifest poll picks up the new pack version.

---

### MVP-08 — Event emission via SDK abstraction

**Effort:** S
**Goal:** Every interaction fires through `analytics.emit` so Phase 1 can swap implementations.

- In `apps/mobile`, the analytics provider is set up at the root layout to a `ConsoleAnalytics` impl from `@quiz/sdk`.
- Wire emissions:
  - On answer → `question_answered`
  - On skip (scroll past or skip-chip tap) → `question_skipped`
  - On impression timer fire → `question_impression`
  - On flag submit → `question_flagged`
  - On pack download finish → `pack_downloaded`
- Optional in-memory buffer with idle / ceiling / `AppState.background` flush triggers all stubbed locally — the buffer pattern is the same one Firebase will use, just printed to console for now.
- Every event carries `anon_guest_id` as a user-property-like field in the payload so Phase 1 can map it cleanly.

**Exit:** Play 10 cards. Each interaction prints a structured log line to the Metro bundler console with the right event name and params. Background the app — flush trigger fires.

---

### MVP-09 — Flag UX

**Effort:** S
**Goal:** Report button opens a reason picker, fires the flagged event, dedupes future flags from the same user on the same question.

- `ReportButton` opens `(modals)/report.tsx` with the active question id.
- Modal contents: a sheet with four reason chips (`offensive | incorrect | confusing | other`) and a Cancel button.
- On submit:
  - Check `flag_dedupe` — if `(question_id, anon_guest_id)` already exists, show a toast "you already reported this" and dismiss.
  - Else insert the row, fire `question_flagged({question_id, subject, reason})`, dismiss with a toast confirmation.
- Same-card flag attempt → blocked silently after the first one.

**Exit:** Tap report on three different cards, pick three different reasons, see three log lines. Tap report on the same card twice — second tap shows the dedupe toast and emits no event.

---

### MVP-10 — Local dev tooling + QA pass

**Effort:** S
**Goal:** One-command dev loop and a documented manual QA that validates the exit criteria.

Dev tooling:

- `.env.example` documenting `EXPO_PUBLIC_PACKS_BASE_URL`.
- Root `package.json` scripts:
  - `pnpm dev` — runs the pack-serve + the Expo dev server concurrently.
  - `pnpm packs:build`, `pnpm content:seed` (if seed-from-doc helper landed in MVP-02).
  - `pnpm typecheck`, `pnpm test`, `pnpm lint`.
- `.gitignore` already covers `packs/`, `node_modules`, `.env`, Expo build artefacts.
- GitHub Actions: a single workflow runs `pnpm install && pnpm typecheck && pnpm -r test`. No deployments; Phase 0 is local-only.

QA walk-through (must pass on iOS Simulator and one Android target):

1. Fresh clone → `pnpm install && cp .env.example .env && pnpm packs:build && pnpm dev`. Open the app.
2. Card #1 visible within 2 seconds of cold launch.
3. Answer 5 cards correctly → stats chip reads "Today: 5 · 🔥 5".
4. Answer 1 incorrectly → streak resets to 0.
5. Skip 3 cards → console logs 3 `question_skipped` events.
6. Tap report on a card → reason picker opens → submit → console logs `question_flagged`.
7. Tap report on the same card → blocked with toast.
8. Restart the app → stats persist, no duplicate dedupe rows.
9. Stop the pack-serve script → keep playing → feed continues from local cache.
10. Restart pack-serve → manifest poll succeeds quietly.

README updates:

- Quickstart pointing at the commands above.
- Link to architecture + ADRs.
- Mark MVP-01…10 as Done in [`README.md`](README.md); flip plan status to `SUBSTANTIALLY-COMPLETE` or `COMPLETED`.

**Exit:** QA walk-through passes on iOS Simulator and one Android target. Plan moves to `docs/completed/mvp-skeleton-plan/`.

---

## 5. Open questions (decide during implementation)

- **Snap library.** `FlatList` + `pagingEnabled` is built-in but Android paging-snap can be jittery. `react-native-pager-view` (vertical) is more robust but adds a dep. Default to `FlatList`; fall back to PagerView at MVP-05 if the snap feel is poor on Android.
- **Display font.** Suggest Space Grotesk or Instrument Serif (both free via Google Fonts → loadable via `expo-font`). Pick one at MVP-05.
- **`anon_guest_id` lifetime.** No expiry in Phase 0. Phase 1 may add a "reset device" affordance for testers.
- **Pack-serve from a port vs `expo-asset` bundling.** Port-served is simpler in dev (one URL, hot reload of new pack builds). Bundle-served works without network for fresh installs. Default to port-served Phase 0; revisit when EAS Build lands in Phase 1.

## 6. Non-goals (explicit)

- Web app of any kind. Never.
- Real R2 deployment, real Firebase Analytics, real cron host (all Phase 1).
- AI question generation, admin review, daily Slack digest (Phase 1).
- Stats packs, social-proof rendering (Phase 2).
- Images (Phase 3).
- Server-graded competitive modes, Redis leaderboards, auth (Phase 4+).

## 7. Done criteria

Plan is complete when all 10 tasks in [README.md](README.md) show `Done`, the QA walk-through in MVP-10 passes on iOS Simulator and one Android target, and this plan is moved to `docs/completed/mvp-skeleton-plan/`.
