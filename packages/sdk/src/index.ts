// @rcao-quiz/sdk — shared SDK for the rcao-quiz app and pipeline scripts.
//
// MVP-01 ships only this entry point. Subsequent tasks fill in:
//   - schemas/    Zod schemas for Question, Pack, Manifest, GA4 events  (MVP-03)
//   - grading.ts  gradeAnswer(question, chosen) helper                  (MVP-03)
//   - templates/  pickTemplate + QuestionCard renderer for RN           (MVP-03)
//   - bloom.ts    Bloom filter for the `seen` impressions tier          (MVP-06)
//   - analytics.ts analytics.emit() abstraction (console in Phase 0)    (MVP-03/08)

export const SDK_VERSION = '0.0.0';
