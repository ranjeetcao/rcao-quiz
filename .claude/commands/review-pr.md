---
description: Run code-reviewer against the current branch (vs main) and render its findings checklist.
argument-hint: [optional commit-ish to compare against; defaults to main]
---

Use the code-reviewer subagent to review the current branch.

**Diff scope to pass to the subagent:**

- If `$ARGUMENTS` is empty, compare against `main`:
  - `git diff main...HEAD`
  - `git log main..HEAD --oneline`
- If `$ARGUMENTS` is supplied, treat it as the base commit-ish:
  - `git diff $ARGUMENTS...HEAD`
  - `git log $ARGUMENTS..HEAD --oneline`

**Render the subagent's output verbatim.** `code-reviewer` emits a stable PASS/FAIL/N/A checklist (one row per check, in fixed order, with `(N)` numbering and verdict words — see its Output format section). Do not summarize, paraphrase, re-order, or re-format. Downstream tooling parses this format.

The five checks are stable and ordered:

1. Strict Zod schemas
2. SDK ban list
3. Secrets
4. Tests for new non-component SDK exports
5. `correct_answer ∈ choices` invariant

**Read-only.** This orchestrator's job is to invoke and render — not to apply fixes. `code-reviewer` is read-only by design (no `Write`, no `Edit`, no `git commit`); routing fixes is a separate step for a human or `tech-lead`.

**Appendix (one line, after the checklist):**

- If any row is `FAIL` → suggest filing the fixes (e.g. "Next step: route the FAIL items to `tech-lead` or fix locally before merge.").
- If every applicable row is `PASS` (with `N/A` allowed) → suggest the merge (e.g. "Next step: clean review — branch is ready to merge.").
