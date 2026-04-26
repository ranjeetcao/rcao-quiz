// Deterministic JSON serialisation for hashing.
//
// SHA-256 of a JSON document is only meaningful if the same logical
// content always serialises the same way. JavaScript's `JSON.stringify`
// preserves object-key insertion order, which is fine within a single
// process but breaks across runs (and across machines, and across Node
// versions when keys are added by validators that produce them in
// different orders). Recursively sorting keys alphabetically gives us a
// canonical form that's stable independent of where the object came
// from. Arrays preserve their order — order is semantic for arrays.

export function canonicalSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalSort);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalSort((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalSort(value));
}
