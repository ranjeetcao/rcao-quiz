import { describe, expect, it } from 'vitest';
import { gradeAnswer } from './grading';
import type { Question } from './schemas/index';

// Minimal Question fixture — enough to satisfy the type, not the full Zod
// parse (gradeAnswer doesn't validate). The Zod-parse-the-fixture flavour
// of test belongs in a schemas test if we add one.
function q(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q_01HX3F7Z8K0000000000000000',
    mode: 'text',
    subject: 'math',
    prompt_text: 'What is 2 + 2?',
    choices: ['3', '4', '5', '6'],
    correct_answer: '4',
    difficulty: 1,
    status: 'approved',
    generator_meta: { source: 'test' },
    retired_at: null,
    retired_reason: null,
    ...overrides,
  } as Question;
}

describe('gradeAnswer', () => {
  it('returns true for the exact correct choice', () => {
    expect(gradeAnswer(q(), '4')).toBe(true);
  });

  it('returns false for any other choice', () => {
    expect(gradeAnswer(q(), '3')).toBe(false);
    expect(gradeAnswer(q(), '5')).toBe(false);
    expect(gradeAnswer(q(), '6')).toBe(false);
  });

  it('is case-sensitive', () => {
    const question = q({ choices: ['Seine', 'Rhône', 'Loire', 'Garonne'], correct_answer: 'Seine' });
    expect(gradeAnswer(question, 'Seine')).toBe(true);
    expect(gradeAnswer(question, 'seine')).toBe(false);
    expect(gradeAnswer(question, 'SEINE')).toBe(false);
  });

  it('is whitespace-sensitive', () => {
    const question = q({ choices: ['4', ' 4', '4 ', '04'], correct_answer: '4' });
    expect(gradeAnswer(question, '4')).toBe(true);
    expect(gradeAnswer(question, ' 4')).toBe(false);
    expect(gradeAnswer(question, '4 ')).toBe(false);
  });

  it('returns false for a string that is not in choices at all', () => {
    // The Zod refine on QuestionSchema means this never happens with a
    // validated question, but the helper still has to behave sanely.
    expect(gradeAnswer(q(), 'completely off')).toBe(false);
  });
});
