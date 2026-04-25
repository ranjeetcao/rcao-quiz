# Architecture Decision Records

Records of the load-bearing decisions, with the context that drove them. Each ADR answers four questions:

- **Context** — what situation forced the decision
- **Decision** — what we decided
- **Consequences** — what this commits us to, both ways
- **Alternatives considered** — options rejected, with why

## Status values

`PROPOSED` | `ACCEPTED` | `SUPERSEDED-BY-<id>` | `DEPRECATED`

Once an ADR is accepted, the body is not edited in place. Material refinements either append to a small `## Amendments` section at the bottom (with date and rationale) or land as a new ADR with `Supersedes:` pointing at the old one.

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-reels-feed-not-session-rounds.md) | Reels-style feed, not session rounds | ACCEPTED |
| [0002](0002-client-heavy-cost-optimized.md) | Client-graded play, server-less runtime | ACCEPTED |
| [0003](0003-text-only-mvp-client-templates.md) | Text-only MVP with client templates; images in Phase 3 | ACCEPTED |
| [0004](0004-statistical-percentile-leaderboards.md) | Percentile social-proof, not ordinal leaderboards | ACCEPTED |
| [0005](0005-git-content-store.md) | Git as content store | ACCEPTED |
| [0006](0006-ai-review-flag-digest.md) | AI-only content review with user flags + Slack digest | ACCEPTED |
