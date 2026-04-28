// Zod schemas + inferred types for the rcao-quiz domain model.
//
// The shapes here are the contract between:
//   - hand-written / pipeline-generated content files in `content/questions/`
//   - the pack builder (`scripts/packs-build.ts`, MVP-04)
//   - the mobile app feed picker + QuestionCard renderer
//   - GA4 event payloads
//
// Anything that crosses one of those boundaries goes through a Zod parse so
// that bad data fails loudly at the seam, not three layers later when it
// renders as `undefined`.

import { z } from 'zod';

// ---------- primitives ----------

/**
 * Render mode for a question. Only `text` ships in Phase 0 (ADR 0003).
 * `image` and `video` are reserved so adding them later is a code change,
 * not a schema change.
 */
export const ModeSchema = z.enum(['text', 'image', 'video']);
export type Mode = z.infer<typeof ModeSchema>;

/**
 * Subject slug. Phase 0 ships three subjects (see content/subjects.json).
 * Kept as a string union — adding a subject is a one-line change here +
 * a new entry in subjects.json + a content batch.
 */
export const SubjectSlugSchema = z.enum(['math', 'geography', 'general_knowledge']);
export type SubjectSlug = z.infer<typeof SubjectSlugSchema>;

/**
 * Question lifecycle (ADR 0005). Only `approved` questions go into packs;
 * `flagged` shows up in the daily AI digest; `retired` is the tombstone.
 */
export const QuestionStatusSchema = z.enum(['pending', 'approved', 'flagged', 'retired']);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

/** Difficulty bucket: 1 easy, 2 medium, 3 hard. */
export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Difficulty = z.infer<typeof DifficultySchema>;

/** ULID-shaped id with a `q_` prefix — see ADR 0005. */
export const QuestionIdSchema = z
  .string()
  .regex(/^q_[0-9A-HJKMNP-TV-Z]{26}$/, 'expected ULID-shaped id, e.g. q_01HX3F7Z8K...');
export type QuestionId = z.infer<typeof QuestionIdSchema>;

// ---------- generator_meta ----------

/**
 * Provenance for a question. The hand-written seed batch uses a minimal
 * shape; the AI pipeline writes the richer shape. Both are valid — the app
 * never reads `generator_meta` at runtime, but the pack builder validates
 * it so a malformed file fails the build instead of shipping silently.
 */
export const GeneratorMetaSchema = z
  .object({
    source: z.string().optional(),
    model: z.string().optional(),
    prompt_template_id: z.string().optional(),
    validation_scores: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    cost_cents: z.number().optional(),
    created_at: z.string().datetime({ offset: true }).optional(),
    approved_at: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough(); // forward-compat: tolerate extra fields the pipeline adds later
export type GeneratorMeta = z.infer<typeof GeneratorMetaSchema>;

// ---------- Question ----------

/**
 * The full on-disk shape for a question file (`content/questions/<id>.json`).
 *
 * `correct_answer` is included — the app grades locally (ADR 0002). There is
 * no runtime API to "submit" an answer to.
 *
 * `.strict()` rejects unknown keys at parse time so a typo in a content
 * file fails loud at the pack-build step rather than silently dropping
 * the field. This is the single-source-of-truth promise from ADR 0002.
 *
 * The two `.refine` checks cover invariants Zod can't express structurally:
 *   - `correct_answer` must equal one of the four `choices` exactly.
 *   - `choices` must contain four distinct strings (otherwise grading is
 *     ambiguous when the correct answer matches two slots).
 */
export const QuestionSchema = z
  .object({
    id: QuestionIdSchema,
    mode: ModeSchema,
    subject: SubjectSlugSchema,
    prompt_text: z.string().min(1),
    choices: z.array(z.string().min(1)).length(4),
    correct_answer: z.string().min(1),
    difficulty: DifficultySchema,
    status: QuestionStatusSchema,
    generator_meta: GeneratorMetaSchema,
    retired_at: z.string().datetime({ offset: true }).nullable(),
    retired_reason: z.string().nullable(),
  })
  .strict()
  .refine((q) => q.choices.includes(q.correct_answer), {
    message: 'correct_answer must match one of choices exactly',
    path: ['correct_answer'],
  })
  .refine((q) => new Set(q.choices).size === q.choices.length, {
    message: 'choices must be distinct',
    path: ['choices'],
  })
  .refine(
    (q) => q.status !== 'approved' || typeof q.generator_meta.approved_at === 'string',
    {
      // The pack builder (MVP-04) derives `Pack.built_at` from
      // `max(generator_meta.approved_at)` across the questions in a
      // pack. Without this guard, a question that's marked `approved`
      // but missing `approved_at` would slip past schema validation
      // and fail the build at `maxIso(...)` with a less actionable
      // error. Pre-approval lifecycle states (`pending`/`flagged`/
      // `retired`) don't need it because they never reach the builder.
      message: 'approved questions must have generator_meta.approved_at set',
      path: ['generator_meta', 'approved_at'],
    },
  );
export type Question = z.infer<typeof QuestionSchema>;

// ---------- Pack ----------

/**
 * A built content pack — a snapshot of approved questions for one subject,
 * produced by the pack builder (MVP-04) and consumed by the app feed picker.
 *
 * `pack_id` convention: `pack_<subject>_v1_<YYYYMMDD>`.
 * `generation_batch` groups packs built in the same run (`<YYYYMMDD>-a`).
 * `schema_version` is bumped on incompatible Pack-shape changes.
 */
export const PackSchema = z
  .object({
    pack_id: z.string().regex(/^pack_[a-z_]+_v\d+_\d{8}$/),
    generation_batch: z.string().regex(/^\d{8}-[a-z]$/),
    schema_version: z.literal(1),
    built_at: z.string().datetime({ offset: true }),
    subjects: z.array(SubjectSlugSchema).min(1),
    questions: z.array(QuestionSchema).min(1),
  })
  .strict();
export type Pack = z.infer<typeof PackSchema>;

// ---------- Manifest ----------

/**
 * A manifest entry points the app at one downloadable artefact. The
 * discriminated union leaves room for `stats` packs (Phase 2) without
 * inventing a second manifest format.
 */
export const ContentManifestEntrySchema = z
  .object({
    kind: z.literal('content'),
    pack_id: z.string(),
    subject: SubjectSlugSchema,
    url: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().positive(),
    question_count: z.number().int().positive(),
    built_at: z.string().datetime({ offset: true }),
  })
  .strict();
export type ContentManifestEntry = z.infer<typeof ContentManifestEntrySchema>;

export const StatsManifestEntrySchema = z
  .object({
    kind: z.literal('stats'),
    pack_id: z.string(),
    url: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: z.number().int().positive(),
    built_at: z.string().datetime({ offset: true }),
  })
  .strict();
export type StatsManifestEntry = z.infer<typeof StatsManifestEntrySchema>;

export const ManifestEntrySchema = z.discriminatedUnion('kind', [
  ContentManifestEntrySchema,
  StatsManifestEntrySchema,
]);
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z
  .object({
    schema_version: z.literal(1),
    built_at: z.string().datetime({ offset: true }),
    packs: z.array(ManifestEntrySchema),
    retired_question_ids: z.array(QuestionIdSchema),
  })
  .strict();
export type Manifest = z.infer<typeof ManifestSchema>;

// ---------- subjects.json ----------

/**
 * Shape of `content/subjects.json`. The app never depends on this at
 * runtime (subjects are baked into `SubjectSlugSchema`), but the pack
 * builder validates it so the file can't drift silently.
 */
export const SubjectEntrySchema = z
  .object({
    slug: SubjectSlugSchema,
    display_name: z.string().min(1),
  })
  .strict();
export type SubjectEntry = z.infer<typeof SubjectEntrySchema>;

export const SubjectsFileSchema = z.array(SubjectEntrySchema).min(1);
export type SubjectsFile = z.infer<typeof SubjectsFileSchema>;

// ---------- GA4 event payloads ----------

/**
 * Shared fields on every question-level event. Mirrors the GA4 dimensions
 * we want to slice on in BigQuery.
 */
const QuestionEventBase = z.object({
  question_id: QuestionIdSchema,
  subject: SubjectSlugSchema,
  difficulty: DifficultySchema,
  pack_id: z.string(),
  anon_guest_id: z.string().min(1),
});

export const QuestionImpressionParamsSchema = QuestionEventBase.extend({
  dwell_ms: z.number().int().nonnegative(),
}).strict();
export type QuestionImpressionParams = z.infer<typeof QuestionImpressionParamsSchema>;

export const QuestionAnsweredParamsSchema = QuestionEventBase.extend({
  chosen_index: z.number().int().min(0).max(3),
  correct: z.boolean(),
  time_to_answer_ms: z.number().int().nonnegative(),
}).strict();
export type QuestionAnsweredParams = z.infer<typeof QuestionAnsweredParamsSchema>;

export const QuestionSkippedParamsSchema = QuestionEventBase.extend({
  dwell_ms: z.number().int().nonnegative(),
}).strict();
export type QuestionSkippedParams = z.infer<typeof QuestionSkippedParamsSchema>;

/**
 * Flag reasons match the MVP-09 reason picker exactly. The four chips in
 * the UI (`offensive | incorrect | confusing | other`) are this enum's
 * values verbatim. Don't add a new value without updating the picker
 * sheet copy in `apps/mobile/app/(modals)/report.tsx`.
 */
export const FlagReasonSchema = z.enum(['offensive', 'incorrect', 'confusing', 'other']);
export type FlagReason = z.infer<typeof FlagReasonSchema>;

export const QuestionFlaggedParamsSchema = QuestionEventBase.extend({
  reason: FlagReasonSchema,
  note: z.string().max(280).optional(),
}).strict();
export type QuestionFlaggedParams = z.infer<typeof QuestionFlaggedParamsSchema>;

export const PackDownloadedParamsSchema = z
  .object({
    pack_id: z.string(),
    subject: SubjectSlugSchema,
    bytes: z.number().int().positive(),
    duration_ms: z.number().int().nonnegative(),
    cache_hit: z.boolean(),
  })
  .strict();
export type PackDownloadedParams = z.infer<typeof PackDownloadedParamsSchema>;

/**
 * Discriminated union over event name → params. Used by `analytics.emit`
 * so a typo in the event name is a compile error, not a silent miss.
 */
export type AnalyticsEvent =
  | { name: 'question_impression'; params: QuestionImpressionParams }
  | { name: 'question_answered'; params: QuestionAnsweredParams }
  | { name: 'question_skipped'; params: QuestionSkippedParams }
  | { name: 'question_flagged'; params: QuestionFlaggedParams }
  | { name: 'pack_downloaded'; params: PackDownloadedParams };

export type AnalyticsEventName = AnalyticsEvent['name'];
