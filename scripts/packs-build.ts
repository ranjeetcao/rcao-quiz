// Pack builder — turns approved question JSONs into per-subject pack
// files plus a manifest. Run via `pnpm packs:build`.
//
// Pipeline:
//   1. Read every `content/questions/*.json`. Validate against
//      QuestionSchema. Skip non-`approved` (questions in `pending`,
//      `flagged`, `retired` are excluded — that's the lifecycle gate).
//   2. Validate `content/subjects.json` against SubjectsFileSchema.
//   3. Group approved questions by subject.
//   4. For each subject, build a Pack (deterministic — see `built_at`
//      below). Validate against PackSchema. Canonicalise → SHA-256 →
//      write via PackStorage.
//   5. Build the manifest from the per-pack PutResults. Validate
//      against ManifestSchema. Write via PackStorage.
//
// Idempotency. Same input → byte-identical output, every run, on every
// machine. The two non-content fields that would otherwise drift are
// derived from the inputs themselves:
//   - `built_at` = max `generator_meta.approved_at` across the questions
//     in the pack. Manifest's `built_at` = max across all packs.
//   - The YYYYMMDD baked into `pack_id` and `generation_batch` is the
//     UTC date of that `built_at`.
// SHA-256 of the canonicalised pack JSON is recorded in the manifest so
// the app can verify the pack contents on download.

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PackSchema,
  QuestionSchema,
  ManifestSchema,
  ContentManifestEntrySchema,
  SubjectsFileSchema,
  type ContentManifestEntry,
  type Manifest,
  type Pack,
  type Question,
  type SubjectSlug,
} from '@rcao-quiz/sdk/schemas';

import { canonicalStringify } from './lib/canonicalise.js';
import { LocalDiskStorage, type PackStorage } from './lib/pack-storage.js';

// Resolve repo paths relative to this file rather than CWD so the
// script behaves the same whether you run it from the repo root, from
// `scripts/`, or via `pnpm packs:build` (which uses the script's own
// dir as CWD).
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const CONTENT_DIR = path.join(REPO_ROOT, 'content');
const QUESTIONS_DIR = path.join(CONTENT_DIR, 'questions');
const SUBJECTS_FILE = path.join(CONTENT_DIR, 'subjects.json');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'packs');

const PACK_SCHEMA_VERSION = 1 as const;
const MANIFEST_SCHEMA_VERSION = 1 as const;

// ---------- main ----------

async function main(): Promise<void> {
  const outDir = DEFAULT_OUT_DIR;
  const storage: PackStorage = new LocalDiskStorage(outDir);

  const subjects = await loadSubjects();
  const questions = await loadApprovedQuestions();

  if (questions.length === 0) {
    console.error('packs-build: no approved questions found in content/questions/');
    process.exitCode = 1;
    return;
  }

  const bySubject = groupBy(questions, (q) => q.subject);
  const orderedSubjects = subjects.map((s) => s.slug); // canonical order from subjects.json

  const entries: ContentManifestEntry[] = [];

  for (const subject of orderedSubjects) {
    const subjectQuestions = bySubject.get(subject);
    if (subjectQuestions === undefined || subjectQuestions.length === 0) {
      console.warn(`packs-build: skipping subject "${subject}" — no approved questions`);
      continue;
    }

    const pack = buildPack(subject, subjectQuestions);
    PackSchema.parse(pack); // belt-and-suspenders — should never fail at this point

    const bytes = new TextEncoder().encode(canonicalStringify(pack));
    const sha256 = sha256Hex(bytes);
    const filename = `${pack.pack_id}.json`;
    const { url } = await storage.put(filename, bytes);

    const entry: ContentManifestEntry = {
      kind: 'content',
      pack_id: pack.pack_id,
      subject,
      url,
      sha256,
      bytes: bytes.byteLength,
      question_count: pack.questions.length,
      built_at: pack.built_at,
    };
    ContentManifestEntrySchema.parse(entry);
    entries.push(entry);

    console.log(
      `packs-build: ${pack.pack_id} — ${pack.questions.length} questions, ${bytes.byteLength}B, sha256=${sha256.slice(0, 12)}…`,
    );
  }

  if (entries.length === 0) {
    console.error('packs-build: no packs were built (all subjects empty?)');
    process.exitCode = 1;
    return;
  }

  const manifest: Manifest = {
    schema_version: MANIFEST_SCHEMA_VERSION,
    built_at: maxIso(entries.map((e) => e.built_at)),
    packs: entries,
    retired_question_ids: [], // Phase 0: no retirement yet (ADR 0006)
  };
  ManifestSchema.parse(manifest);

  const manifestBytes = new TextEncoder().encode(canonicalStringify(manifest));
  await storage.put('manifest.json', manifestBytes);

  console.log(
    `packs-build: manifest.json — ${entries.length} packs, ${manifestBytes.byteLength}B, built_at=${manifest.built_at}`,
  );
}

// ---------- builders ----------

function buildPack(subject: SubjectSlug, questions: Question[]): Pack {
  // Deterministic ordering — packs differing only in question order
  // would hash differently otherwise.
  const sortedQuestions = [...questions].sort((a, b) => a.id.localeCompare(b.id));

  const builtAt = maxIso(
    sortedQuestions
      .map((q) => q.generator_meta.approved_at)
      .filter((v): v is string => typeof v === 'string'),
  );
  if (builtAt === undefined) {
    throw new Error(
      `packs-build: subject "${subject}" has no approved_at timestamps; cannot derive built_at deterministically. Add generator_meta.approved_at to the question files.`,
    );
  }

  const yyyymmdd = isoToYyyymmdd(builtAt);
  const packId = `pack_${subject}_v${PACK_SCHEMA_VERSION}_${yyyymmdd}`;
  const generationBatch = `${yyyymmdd}-a`;

  return {
    pack_id: packId,
    generation_batch: generationBatch,
    schema_version: PACK_SCHEMA_VERSION,
    built_at: builtAt,
    subjects: [subject],
    questions: sortedQuestions,
  };
}

// ---------- IO ----------

async function loadSubjects() {
  const raw = await fs.readFile(SUBJECTS_FILE, 'utf8');
  return SubjectsFileSchema.parse(JSON.parse(raw));
}

async function loadApprovedQuestions(): Promise<Question[]> {
  const files = (await fs.readdir(QUESTIONS_DIR)).filter((f) => f.endsWith('.json'));
  const out: Question[] = [];
  for (const file of files.sort()) {
    const full = path.join(QUESTIONS_DIR, file);
    const raw = await fs.readFile(full, 'utf8');
    let parsed: Question;
    try {
      parsed = QuestionSchema.parse(JSON.parse(raw));
    } catch (err) {
      // Re-throw with the file path so the failure is debuggable. Zod's
      // own error message is good but rooted at `<root>` — naming the
      // file is what makes it actionable.
      throw new Error(
        `packs-build: invalid question file ${path.relative(REPO_ROOT, full)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (parsed.status !== 'approved') continue;
    out.push(parsed);
  }
  return out;
}

// ---------- helpers ----------

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const bucket = m.get(k);
    if (bucket === undefined) m.set(k, [item]);
    else bucket.push(item);
  }
  return m;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function maxIso(values: string[]): string {
  // The Zod schema permits any offset on the input timestamps, so a
  // lexicographic compare on the raw strings would silently pick a
  // wrong "max" the day someone commits e.g.
  // `2026-04-25T17:30:00+05:30` next to `2026-04-25T11:00:00Z` (same
  // instant, different string ordering). Parse to milliseconds-since-
  // epoch, take the max, then re-serialise to canonical UTC `…Z` form
  // so the output is stable regardless of input style.
  if (values.length === 0) {
    throw new Error('packs-build: maxIso called with no values');
  }
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    const ms = Date.parse(v);
    if (Number.isNaN(ms)) {
      throw new Error(`packs-build: invalid ISO timestamp ${JSON.stringify(v)}`);
    }
    if (ms > bestMs) bestMs = ms;
  }
  return new Date(bestMs).toISOString();
}

function isoToYyyymmdd(iso: string): string {
  // The Zod schema guarantees `iso` is a valid ISO 8601 datetime with
  // offset. We slice the date portion in UTC so the YYYYMMDD baked into
  // pack_id is stable regardless of the dev machine's TZ.
  const d = new Date(iso);
  const year = d.getUTCFullYear().toString().padStart(4, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
