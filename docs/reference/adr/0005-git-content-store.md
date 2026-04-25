# ADR 0005 — Git as content store

**Status:** ACCEPTED

## Context

With no runtime backend (ADR 0002), nothing queries a database at user-request time. The remaining consumers of question data are:

- The **pack builder** — reads approved questions on a schedule, writes pack JSONs to R2.
- The **AI generation pipeline** ([ADR 0006](0006-ai-review-flag-digest.md)) — writes new approved questions.
- The **retirement CLI** — flips a question's `status` field when an operator retires it.
- The **stats builder** — doesn't read content; only reads BigQuery.

All three writers run inside the same scheduled pipeline process (the CLI on the operator's laptop is the same code, run interactively). There is one writer at a time. There are no concurrent transactions. There are no relational joins beyond a small `subjects` lookup that's a single JSON file.

The question shape is flat: `id, mode, subject, prompt_text, choices[], correct_answer, difficulty, status, generator_meta`. No foreign keys, no blob columns, no ORM ceremony. A document per question is the right cardinality.

A relational database in this picture exists by default, not because it earns its keep.

## Decision

**Content lives as JSON files in the git repository.** No database.

### Layout

```
content/
├── subjects.json                     # slug -> display_name
├── prompt_templates/
│   └── <subject>-v<N>.json           # versioned generator templates
└── questions/
    └── <question_id>.json            # one file per question
```

### Question file shape

```json
{
  "id": "q_01HX3F7Z8K...",
  "mode": "text",
  "subject": "geography",
  "prompt_text": "Which river flows through Paris?",
  "choices": ["Seine", "Rhône", "Loire", "Garonne"],
  "correct_answer": "Seine",
  "difficulty": 2,
  "status": "approved",
  "generator_meta": {
    "model": "claude-sonnet-4-6",
    "prompt_template_id": "geography-v3",
    "validation_scores": {
      "keyword_prefilter": "pass",
      "ai_pass_topic_sensitivity": 0.98,
      "ai_pass_safety": 0.99,
      "ai_pass_coherence": 0.95
    },
    "cost_cents": 0.4,
    "created_at": "2026-04-21T03:12:04Z",
    "approved_at": "2026-04-21T03:12:11Z"
  },
  "retired_at": null,
  "retired_reason": null
}
```

`status ∈ {pending | approved | flagged | retired}`. Only `approved` questions land in packs. `flagged` questions appear in the daily digest. `retired` is the tombstone — the question's file stays for history, status flips, and the id is added to the manifest's `retired_question_ids`.

### Who writes

- **AI pipeline** is the sole automated writer — creates new files in `content/questions/`, commits them.
- **Retirement CLI** is the sole manual writer — updates `status + retired_at + retired_reason` on an existing file, commits, pushes.

Both run on the same scheduled host (or the operator's laptop for the CLI). They don't race because the pipeline runs once a day on a cron and the operator runs the CLI interactively.

### Who reads

- **Pack builder** reads every file under `content/questions/` with `status=approved`, groups by subject, writes pack JSONs to R2.
- **Stats builder** doesn't touch content files.
- **Retirement CLI** reads one file before writing.

### Git credentials on the runner

The scheduled host needs a deploy key (or fine-scoped PAT) with push rights to the content repo. Standard CI/CD setup.

## Consequences

**Positive**

- **Free history.** `git log content/questions/<id>.json` shows every change — created when, generator_meta of the generation run, retired when and why. No audit table to maintain.
- **Free backup.** Every clone is a full backup. Remote (GitHub) plus any working copy is redundant storage.
- **Free diff review.** A bad pipeline run that approves 100 garbage questions shows up as 100 new files in a commit you can revert.
- **Offline-friendly.** Pipeline on a laptop runs without network to any DB; only needs LLM API for generation and a push when done.
- **No migrations.** Schema changes are script changes — "future files have the field, old files don't, code tolerates both."
- **Cheap to diff.** `git diff main..feature content/questions/` shows exactly what a content change adds or removes. Useful for reviewing pipeline improvements.

**Negative**

- **Scale ceiling.** Git handles ~100k files in a directory before status/add/commit get sluggish. Mitigation: at ~50k questions, shard `content/questions/` by 2-char id prefix (`q_01/...`). Beyond ~500k total, switch to JSONL per subject with append-only semantics. Phase 5+ problem.
- **No query engine.** Can't `WHERE difficulty > 2 AND subject = 'math'` without scanning. Pack builder already scans everything daily; thousands of files at ~2KB each is megabytes, done in tens of ms. A future tool wanting richer queries can materialise a SQLite index on the fly from the content dir.
- **One writer assumption.** A second concurrent pipeline runner would race on commits. Mitigation: write to `content-staging/` then merge, or just coordinate. Non-problem at MVP scale.
- **Bad commits live in history.** If the pipeline commits a bad question, the commit stays in `git log` even after retirement. `retired_at` marks it dead and it never ships in a pack; if the content itself is toxic, `git filter-repo` is available but disruptive. The red-line prefilter (ADR 0006) catches the worst content before it's written; we accept that anything passing prefilter is at worst embarrassing, not actionable.

**Secrets stay out.** Content is public-repo-safe even when the repo isn't public. `generator_meta` does not carry raw LLM prompts or PII. Keys for GA4, R2, LLM APIs stay in the runner's env.

## Alternatives considered

- **SQLite in the repo.** Single binary file, rich queries. Rejected — binary diffs defeat the diff-review advantage; merges are awkward; query richness isn't needed.
- **Hosted Postgres free tier (Neon / Supabase).** Cheap at MVP scale but reintroduces a network hop and a vendor dependency with no diff-review value.
- **Document DB (DynamoDB / Firestore / etc.).** Vendor lock; cold-start quirks; no free diff review.
- **JSONL append-only log per subject.** Simpler at very large scale, worse at MVP scale (every change rewrites the whole file). Revisit at ~100k questions.
- **Flat files on a server disk, no git.** Loses history + backup + review. No upside.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — no runtime server is what makes the "DB, really?" question worth asking
- [ADR 0006](0006-ai-review-flag-digest.md) — what the pipeline writes and when
- [Architecture](../architecture.md) — data model section reflects this decision
