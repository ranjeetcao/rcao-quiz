// Pick a visual template for a question — deterministic by question id.
//
// Why deterministic: we want the same question to look the same every time
// it appears, both within a session and across reinstalls. That makes
// screenshots reproducible and makes it possible to tweak a single
// template without re-shuffling the entire feed's appearance.
//
// Why hash the id (vs. modulo of the raw string): question ids are
// ULID-shaped, monotonically increasing in their leading bytes. A naive
// `id.length % n` or `charCodeAt(0) % n` would cluster recently-generated
// questions on the same template. A small string-hash (FNV-1a 32-bit)
// scrambles the bits cheaply and gives an even distribution.

import type { Question, SubjectSlug } from '../schemas/index';
import { TEMPLATE_REGISTRY, type Template } from './registry';

/**
 * FNV-1a 32-bit hash. Tiny, fast, no deps, good enough for "pick one of N
 * templates" — we are not allocating cache buckets, just spreading.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by 16777619 mod 2^32, expressed via bit ops to stay in
    // unsigned 32-bit range (JS numbers are float64 by default).
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Returns the template a given question should render with.
 *
 * Throws if the subject has no templates registered — that's a bug in the
 * registry, not a runtime condition the caller should handle. The Zod
 * SubjectSlug enum makes the case unreachable in practice; we still
 * throw rather than return a fallback so the gap is loud during tests.
 */
export function pickTemplate(question: Pick<Question, 'id' | 'subject'>): Template {
  const templates = TEMPLATE_REGISTRY[question.subject];
  if (templates.length === 0) {
    throw new Error(`no templates registered for subject "${question.subject}"`);
  }
  const idx = fnv1a32(question.id) % templates.length;
  // Safe: idx ∈ [0, templates.length) and we just checked length > 0.
  return templates[idx]!;
}

/**
 * Exported for tests + tooling. Lets callers list the variants for a
 * subject without reaching into the registry directly.
 */
export function templatesForSubject(subject: SubjectSlug): readonly Template[] {
  return TEMPLATE_REGISTRY[subject];
}
