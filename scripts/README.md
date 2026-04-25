# scripts/

Maintenance and pipeline scripts.

## Maintenance

| Script | Run as | Purpose |
|---|---|---|
| `generate-icons.py` | `python3 scripts/generate-icons.py` | Re-render `apps/mobile/assets/icon.png`, `splash.png`, `adaptive-icon.png` from the procedural design. Deterministic. Commit the outputs. |

## Pipeline (TS, run via `pnpm` + `tsx`)

| Script | Lands in | Purpose |
|---|---|---|
| `packs-build.ts` | MVP-04 | Read `content/questions/*.json`, write pack JSONs + `manifest.json` to `./packs/`. |
| `packs-serve.ts` | MVP-07 | Static-serve `./packs/` over HTTP for the Expo dev server to fetch. |
| `seed-questions.ts` | MVP-02 (optional) | Helper to convert hand-written content into the question file shape. |
| `stats-build.ts` | STATS-02 (Phase 2) | Query BigQuery, compute stats packs, upload to R2. |

Pipeline scripts are designed to be platform-agnostic where possible. Phase 0 implementations write to local disk; Phase 1+ swap in the R2 storage adapter behind the same interface.

Run via `pnpm <script-name>` (defined in the root `package.json`).
