// @rcao-quiz/sdk — shared SDK for the rcao-quiz app and pipeline scripts.
//
// Submodule layout:
//   schemas/    Zod schemas + inferred types (Question, Pack, Manifest, GA4)
//   grading.ts  gradeAnswer(question, chosen) — local correctness check
//   templates/  pickTemplate + subject-themed visual registry
//   components/ RN UI primitives (QuestionCard, ChoiceButton, ReportButton)
//   analytics.ts analytics.emit() abstraction (console in Phase 0)
//   bloom.ts    Bloom filter for the `seen` impressions tier  (MVP-06)
//
// The barrel re-exports the bits that have stable public APIs. Anything
// not re-exported here is reachable via the deep `@rcao-quiz/sdk/*`
// import paths declared in package.json `exports`.

export const SDK_VERSION = '0.1.0';

export {
  // primitives
  ModeSchema,
  SubjectSlugSchema,
  QuestionStatusSchema,
  DifficultySchema,
  QuestionIdSchema,
  GeneratorMetaSchema,
  // documents
  QuestionSchema,
  PackSchema,
  ContentManifestEntrySchema,
  StatsManifestEntrySchema,
  ManifestEntrySchema,
  ManifestSchema,
  SubjectEntrySchema,
  SubjectsFileSchema,
  // event payloads
  QuestionImpressionParamsSchema,
  QuestionAnsweredParamsSchema,
  QuestionSkippedParamsSchema,
  QuestionFlaggedParamsSchema,
  PackDownloadedParamsSchema,
} from './schemas/index';

export type {
  Mode,
  SubjectSlug,
  QuestionStatus,
  Difficulty,
  QuestionId,
  GeneratorMeta,
  Question,
  Pack,
  ContentManifestEntry,
  StatsManifestEntry,
  ManifestEntry,
  Manifest,
  SubjectEntry,
  SubjectsFile,
  QuestionImpressionParams,
  QuestionAnsweredParams,
  QuestionSkippedParams,
  QuestionFlaggedParams,
  PackDownloadedParams,
  AnalyticsEvent,
  AnalyticsEventName,
} from './schemas/index';

export { gradeAnswer } from './grading';

export {
  pickTemplate,
  templatesForSubject,
  TEMPLATE_REGISTRY,
} from './templates/index';
export type { Template, AccentKind } from './templates/index';

export {
  analytics,
  getAnalytics,
  setAnalytics,
  ConsoleAnalyticsAdapter,
} from './analytics';
export type { AnalyticsAdapter, AnalyticsParams } from './analytics';

// Components live behind the deep import `@rcao-quiz/sdk/components` so
// that non-RN consumers (pack builder script, Vitest in node) don't pay
// the transitive cost of `react-native` resolution at import time.
