# ADR 0006 — AI-only content review with user flags + Slack digest

**Status:** ACCEPTED

## Context

The original architecture had a human-in-the-loop admin UI: LLM generates candidates, a person reviews the queue and approves or rejects. That loop is meaningful build effort (auth, role-gating, queue UI, reject-with-reason flow) and only pays off if humans are the primary review bottleneck.

At MVP scale, they aren't. The expected review work decomposes into deterministic categories the LLM stack handles itself, with humans only involved when something escalates:

- Obviously red-line content (slurs, explicit patterns) — deterministic keyword filter
- Culturally / religiously sensitive phrasing — LLM pass on that axis
- Child safety / exploitation patterns — LLM pass plus red-line filter
- NSFW / explicit — LLM pass plus red-line filter
- Factual correctness (especially math) — deterministic re-solve plus LLM coherence check
- Distractor quality — LLM coherence check

The one thing LLMs cannot do alone is notice "this question slipped past review and is live; real users are unhappy with it." For that we need a signal from play — which in the server-less architecture (ADR 0002) is a GA4 event, not a server endpoint.

## Decision

**AI-only pre-publication review** + **user flags from live play via GA4** + **daily Slack digest for human attention on exceptions**. No admin UI, no human approval queue.

### Pre-publication review (cascading stages)

Every candidate question passes through these stages in order. Failing any stage sets `status=flagged` with the failing stage in `generator_meta.validation_scores`; the question is not added to packs. Passing all stages sets `status=approved`.

1. **Red-line keyword prefilter.** Deterministic regex against a list of terms that should never appear (slurs, explicit patterns, named hate topics). Zero LLM cost. Catches the bulk of obviously-bad generations cheaply. Conservative — prefers false flags over false passes.

2. **Cheap LLM pass — topic sensitivity.** Haiku-class model (`claude-haiku-4-5` or equivalent). Rates the question on (a) religious / cultural sensitivity, (b) political polarisation, (c) demographic stereotyping. One score per axis, 0–1. Reject if any score < threshold (default 0.75). Cheap because haiku-class is roughly 1/10 the cost of sonnet-class for nuanced text.

3. **Careful LLM pass — safety-critical.** Sonnet-class model (`claude-sonnet-4-6`). Two checks: (a) child-safety / exploitation patterns, (b) explicit / NSFW. Binary pass/fail per check with a reason string. Any fail → `status=flagged`. Only runs if stage 2 passes, so we only spend sonnet tokens on the ambiguous residue.

4. **Coherence and correctness check.** For math subjects, `mathjs` (or equivalent) re-solves the question from prompt + choices and must agree with `correct_answer`. For text subjects, a sonnet pass rates (a) is exactly one choice right, (b) are the distractors plausibly wrong but not also correct. Scores go into `validation_scores`; any below threshold fails.

All per-stage scores write into the question file's `generator_meta.validation_scores` (ADR 0005). That's our audit trail: "why did we approve this?" is answered by the scores in the file; "why was this flagged?" is the score that failed.

### Cost control

Stages 1 and 2 are cheap; sonnet passes (3 and 4) only run on candidates that survived. Per-approved-question cost stays bounded because the cascade rejects expensive-to-check cases cheaply. Hard cap per pipeline run: target N approved questions plus a per-run spend ceiling (aggregated `generator_meta.cost_cents`); exceed either and the run ends.

### User-flag signal (from live play)

Each question card has a "report this question" affordance. When tapped:

- Client fires GA4 event `question_flagged` with params `{question_id, reason, anon_guest_id}`. `reason ∈ offensive | incorrect | confusing | other`.
- Client-side rate limit: one flag per `(question_id, anon_guest_id)` enforced in the app's local SQLite. Same user can't flag the same question twice.
- No server endpoint — pure GA4 event (per ADR 0002).

**Daily rollup in BigQuery (part of the digest):**

```sql
SELECT question_id, COUNT(DISTINCT anon_guest_id) AS distinct_flaggers
FROM events
WHERE event_name = 'question_flagged'
  AND event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY question_id
HAVING distinct_flaggers >= 5
```

The key defence is `COUNT(DISTINCT anon_guest_id)`, not `COUNT(*)`. One attacker firing 10,000 flag events from a script counts as 1. Threshold (5) is a config value; start conservative (low), tune up if false-positive retirements happen.

### Daily Slack digest

A scheduled job posts to a Slack incoming webhook once per day (default 09:00 local). Posting requires exactly one env var (the webhook URL). No Slack app, no OAuth, no bot scope dance.

Digest contents:

- **New AI-flagged questions (last 24h)** — questions where the pipeline set `status=flagged`, grouped by failing stage. Each entry: question id, subject, failing stage, one-line prompt preview.
- **User-flag threshold crossed (last 24h)** — questions where distinct flagger count ≥ threshold. Each entry: question id, distinct_flaggers count, reason breakdown, one-line prompt preview.
- **Auto-retired (last 24h)** — questions the digest script itself retired (if auto-retire is enabled — see below).
- **Pipeline stats** — candidates generated, approved, flagged; estimated LLM spend.

The digest is notification, not interactivity. The operator reads it and decides what to do. For most entries they do nothing (AI-flagged ones are already out of packs; user-flagged ones get reviewed when the operator next plays the affected pack). For the rest, they run the local CLI.

### Operator CLI

Two commands, both run on the operator's local checkout of the content repo:

- `pnpm questions:inspect <id>` — prints the question JSON, last 7 days of flag events (via local BQ query), recent stats data. Used to decide on digest entries.
- `pnpm questions:retire <id> --reason "<reason>"` — updates `content/questions/<id>.json` to `status=retired`, writes `retired_at` and `retired_reason`, commits, pushes. Next pipeline run rebuilds packs and the manifest's `retired_question_ids`; clients pick up retirement within the manifest's 5-minute cache window.

No auth on the CLI beyond the git credential the operator already has.

### Optional: auto-retire on very high flag counts

If a question crosses a second, higher threshold (default 50 distinct flaggers in 24h) before the operator intervenes, the digest script can auto-retire it: same file update, same commit, but from the script. Safety net for a sleeping operator. Start disabled; enable if a live incident makes manual retirement feel too slow.

## Consequences

**Positive**

- No admin UI, no admin auth surface, no user-role column. Saves real build effort.
- Cascading review keeps LLM cost bounded — expensive models only see ambiguous content.
- Distinct-user flag counting is robust against single-script-firing-10k-events attacks; robustness scales with real user base.
- Daily digest keeps the operator informed without constant interruption.
- Every retirement is a git commit with a reason — automatic audit trail.

**Negative**

- **AI false negatives.** Review can miss something subtle a human would catch. First-line defence is the user-flag signal; second is the operator reading the digest; third is optional auto-retire at high thresholds. Residual risk acceptable at MVP scale.
- **Red-line keyword filter is blunt.** Tune cautiously — too aggressive and entire subjects become un-generatable.
- **Coordinated false-positive flagging** is bounded by distinct-user count, but a small group of actors with many `anon_guest_id`s could still push a question toward retirement. Final retirement is manual (operator reads digest), so it's noise-not-outcome. Auto-retire (if enabled) needs a high enough threshold that small coordinated attacks don't trigger it.
- **Latency.** Pre-publication review is synchronous in the pipeline (no user-facing latency). User-flag latency is up to 24h to retirement under daily digest cadence; live incidents handled by the operator running the CLI directly.

## Alternatives considered

- **Human-in-the-loop admin UI with review queue.** More build, plus auth, plus reviewer onboarding. Rejected for solo-operator scale; revisit if a content team materialises.
- **Per-question Slack ping on every flag.** Noisy, drowns the signal. Rejected in favour of the digest.
- **Weekly digest instead of daily.** Too long a fuse for safety-category content. Rejected.
- **`POST /flag` server endpoint.** Brings a server back just to record events GA4 records for free with better rate-limit ergonomics. Rejected.
- **Auto-retire unconditionally at the main threshold** (no digest confirmation). Rejected — too easy to weaponise. Keep humans in the retirement decision.
- **Skip the digest; rely on aggregate stats drift.** Stats catch "this question has 95% skip rate" eventually but don't distinguish offensive from too-hard. Need the flag signal for intent.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — client-heavy + GA4-events model that makes "flag via GA4" cheap
- [ADR 0004](0004-statistical-percentile-leaderboards.md) — stats pipeline lives alongside the digest
- [ADR 0005](0005-git-content-store.md) — where the CLI writes retirements
- [Architecture](../architecture.md) — pipeline section reflects these stages
