---
description: Run code-reviewer against the current branch (vs main) and render its findings checklist.
argument-hint: [optional commit-ish to compare against; defaults to main]
---

Use the code-reviewer subagent to review the current branch.

**Diff scope to pass to the subagent:**

- If `$ARGUMENTS` is empty, compare against `main`:
  - `git diff main...HEAD`
  - `git log main..HEAD --oneline`
- If `$ARGUMENTS` is supplied, first verify it resolves with `git rev-parse --verify "$ARGUMENTS"`. If that fails, surface the error and abort — do **not** silently fall back to `main`, since that hides the user's typo. If it resolves:
  - `git diff $ARGUMENTS...HEAD`
  - `git log $ARGUMENTS..HEAD --oneline`

**Render the subagent's output verbatim.** `code-reviewer` emits a stable PASS/FAIL/N/A checklist (see `code-reviewer.md` § "The five checks" for the canonical list — source of truth lives there). Do not summarize, paraphrase, re-order, or re-format. Downstream tooling parses this format.

**If `code-reviewer` returns no checklist** (subagent error, timeout, empty output) → surface the failure verbatim. Do **not** fabricate a PASS-row table or default to "clean" — silent green on a broken run is the worst failure mode.

**Read-only.** This orchestrator's job is to invoke and render — not to apply fixes. `code-reviewer` is read-only by design (no `Write`, no `Edit`, no `git commit`); routing fixes is a separate step for a human or `tech-lead`.

**Appendix (one line, after the checklist):**

- If any row is `FAIL` → suggest filing the fixes (e.g. "Next step: route the FAIL items to `tech-lead` or fix locally before merge.").
- If no row is `FAIL` (every applicable row is `PASS`; `N/A` allowed) → suggest the merge (e.g. "Next step: clean review — branch is ready to merge.").
