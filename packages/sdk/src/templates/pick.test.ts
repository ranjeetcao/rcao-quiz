import { describe, expect, it } from 'vitest';
import type { Question, SubjectSlug } from '../schemas/index';
import { pickTemplate, templatesForSubject } from './pick';
import { TEMPLATE_REGISTRY } from './registry';

// pickTemplate only reads `id` and `subject`, so we use the narrow Pick<>
// signature directly. No need to fabricate full Question fixtures here.
function q(id: string, subject: SubjectSlug): Pick<Question, 'id' | 'subject'> {
  return { id, subject };
}

describe('pickTemplate', () => {
  it('returns a template that belongs to the question subject', () => {
    const t = pickTemplate(q('q_01HX3F7Z8K0000000000000000', 'math'));
    expect(t.subject).toBe('math');
    expect(templatesForSubject('math')).toContainEqual(t);
  });

  it('is deterministic — same id, same template across calls', () => {
    const id = 'q_01HX3F7Z8K0000000000000ABC';
    const a = pickTemplate(q(id, 'geography'));
    const b = pickTemplate(q(id, 'geography'));
    expect(a.id).toBe(b.id);
  });

  it('changes the picked template when the id changes', () => {
    // With 2 templates per subject, two distinct ids should — usually —
    // hit at least one of each. We sample a small batch and assert the
    // bucket spread is > 1 (i.e. not 100% on one template).
    const ids = [
      'q_01HX3F7Z8K0000000000000001',
      'q_01HX3F7Z8K0000000000000002',
      'q_01HX3F7Z8K0000000000000003',
      'q_01HX3F7Z8K0000000000000004',
      'q_01HX3F7Z8K0000000000000005',
      'q_01HX3F7Z8K0000000000000006',
    ];
    const picks = new Set(ids.map((id) => pickTemplate(q(id, 'math')).id));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('distributes roughly evenly across templates for a subject (sanity, not statistical)', () => {
    // Generate 200 ids, count picks per template id. With 2 templates,
    // a reasonable spread is each bucket holding > 25% of picks.
    const subject: SubjectSlug = 'general_knowledge';
    const counts = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const id = `q_01HX3F7Z8K00000000000${i.toString().padStart(5, '0')}`;
      const t = pickTemplate(q(id, subject));
      counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
    }
    expect(counts.size).toBe(TEMPLATE_REGISTRY[subject].length);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(50); // 25% of 200
    }
  });

  it('every subject has at least one template (registry sanity)', () => {
    for (const subject of Object.keys(TEMPLATE_REGISTRY) as SubjectSlug[]) {
      expect(TEMPLATE_REGISTRY[subject].length).toBeGreaterThan(0);
    }
  });

  it('every registered template carries the subject it is filed under', () => {
    for (const subject of Object.keys(TEMPLATE_REGISTRY) as SubjectSlug[]) {
      for (const t of TEMPLATE_REGISTRY[subject]) {
        expect(t.subject).toBe(subject);
      }
    }
  });
});
