# Architecture Decision Records

Lightweight records of the non-obvious architectural choices, with the context that drove them. New ADRs are numbered sequentially and never edited in place once accepted — supersession is explicit.

## Format

Each ADR answers four questions:

- **Context** — what situation forced the decision
- **Decision** — what we decided
- **Consequences** — what this commits us to, both positive and negative
- **Alternatives considered** — options rejected, with why

## Header fields

Every ADR opens with these fields. Required ones must be set; optional ones are omitted when not applicable.

- **Status** (required) — `PROPOSED` | `ACCEPTED` | `SUPERSEDED-BY-<id>` | `DEPRECATED`
- **Date** (required) — `YYYY-MM-DD` of the latest status change
- **Supersedes** (optional) — ID of an ADR or named prior doc this replaces (free-text allowed for non-ADR predecessors, e.g. `architecture v1`)
- **Superseded-by** (optional) — ID of the ADR that replaces this one
- **Related** (optional) — comma-separated ADR IDs for context
- **Implementation phase** (optional) — phase tag when implementation is deferred (e.g. `Phase 4`)

Once an ADR is `ACCEPTED`, the body is **not edited in place**. Material refinements append to an `## Amendments` section at the bottom with a date and short rationale; reversals are handled by a new ADR with `Supersedes:` pointing at the old one.

## Status values

`PROPOSED` | `ACCEPTED` | `SUPERSEDED-BY-<id>` | `DEPRECATED`

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-reels-feed-not-session-rounds.md) | Reels-style feed, not session rounds | ACCEPTED |
| [0002](0002-client-heavy-cost-optimized.md) | Client-heavy architecture for lowest operating cost | ACCEPTED |
| [0003](0003-text-only-mvp-client-templates.md) | Text-only questions with client templates for MVP; images in Phase 2 | ACCEPTED |
| [0004](0004-statistical-percentile-leaderboards.md) | Statistical percentile leaderboards, not ordinal ranking | ACCEPTED |
| [0005](0005-warm-start-bundled-packs.md) | Warm-start from bundled packs (mobile, Phase 4) | ACCEPTED |
