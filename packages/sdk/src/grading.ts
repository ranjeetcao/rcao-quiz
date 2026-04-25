// Local grading. The app never asks a server "is this right?" — the
// `correct_answer` ships in the pack (ADR 0002), and this function decides.
//
// Equality is exact — case-sensitive and whitespace-sensitive. Choices are
// authored once and rendered verbatim, so any normalisation here would
// just paper over an authoring bug. The Zod `.refine` on QuestionSchema
// already guarantees `correct_answer` matches one of the four choices
// exactly, so a mismatch at runtime means the caller passed something
// that wasn't in `question.choices` to begin with.

import type { Question } from './schemas/index';

/**
 * Returns true iff `chosen` is the correct answer for `question`.
 *
 * - Exact-match comparison (no trim, no case fold). Authoring is the
 *   single source of truth for the canonical string.
 * - Pure function. No side effects, no analytics emission. The caller
 *   wires the result into `analytics.emit('question_answered', …)`.
 */
export function gradeAnswer(question: Question, chosen: string): boolean {
  return chosen === question.correct_answer;
}
