# ADR 0003 — Text-only questions with client templates for MVP; images in Phase 2

**Status:** ACCEPTED
**Date:** 2026-04-19
**Related:** [ADR 0002](0002-client-heavy-cost-optimized.md)

## Context

The product pitch was "eye-catching snapshots scrolling past" — visual variety is load-bearing to the reels UX. But generating real images costs real money (DALL·E / Imagen / SD calls run tens of cents to a dollar per image at quality), and once generated they cost CDN storage + egress forever. At MVP, where the cost envelope is tight and the pipeline is unproven, committing to images means either paying for a speculative pool or underinvesting in the one thing that makes the experience feel good.

The insight: **what makes image cards feel good in a reels feed isn't the literal image — it's visual variety, colour, and "something for the eye to rest on."** Text content rendered over a designed background template delivers most of that at near-zero cost. Twitter quote cards, news infographics, and Instagram text slides all succeed this way.

## Decision

**MVP and Phase 1 ship text-only questions.** No LLM image generation, no stock image sourcing, no media CDN egress. All visual variety comes from **client-side templates** — CSS + SVG backgrounds with typography over them — bundled with the client and selected at render time.

### Template set

- **Size of set:** 8–12 templates to start. Small enough to feel curated; too many templates and nothing becomes iconic.
- **Implementation:** Pure CSS gradients + SVG shapes + one display font (e.g. Space Grotesk or Instrument Serif, loaded once from Google Fonts). No canvas, no WebGL. Total bundle cost: a few KB.
- **Organisation:** **Subject-themed, with 2–3 variants per subject.** Math questions deterministically draw from a small pool of blue/geometric looks; history from parchment/muted; geography from map-motif; pop_culture from neon/gradient; etc. This gives subjects visual identity (users learn the language — "blue card, this'll be math") while still providing internal variety.
- **Style:** Pure background + text typography for v1. No decorative icons (compass for geography, die for math, etc.) until we decide deliberately to invest in that per-subject design work.
- **Selection logic:** Deterministic by question ID. `templates[subjectPool(q.subject)][hash(q.id) % variantCount]`. The same question always looks the same across plays and across users, which makes screenshots and shares recognisable.

### Accessibility

All templates must hit WCAG AA contrast on their text layer. Design-check each one before it lands. Gradient templates in particular fail this by default — the text layer must have either a semi-opaque scrim or colours chosen from the contrast-safe half of the gradient.

### Schema

The data model keeps the `mode` column and a nullable `media_url` even though neither does anything in MVP:

- `mode` stays as `text | image | video`. All MVP rows are `mode=text`.
- `media_url` stays nullable. No MVP rows populate it.

This means Phase 2 images slot in as just-another-mode — new rows with `mode=image` and a populated `media_url`, rendered with a different template in the client. No schema migration, no data backfill, no data-shape churn.

### What moves to Phase 2

- Real image generation (LLM concept → image model render → R2 upload)
- CLIP similarity scoring for image dedupe
- Image safety handling (rely on provider safety layer + perceptual hash)
- Image hotlink protection (see ADR 0002)
- Image-specific templates on the client (single new renderer, handled through the same mode dispatch)

Phase 2 decision criteria: we have enough retention and usage data to justify the image budget, or we're seeing specific engagement ceilings that image variety would plausibly break.

## Consequences

**Positive**

- Question generation cost drops by roughly two orders of magnitude. Text completion is cheap; image generation is not.
- Pack JSON stays tiny (a 500-question pack is tens of KB compressed). The whole content library can fit comfortably on any device.
- The pipeline validator gets simpler — no image safety step, no CLIP dedupe, no similarity score bookkeeping.
- Content licensing headache disappears for MVP. No image provenance to track, no Wikimedia attribution to display.
- Typography gets to breathe. A well-set text card with a good background can feel more intentional than a mediocre generated image.

**Negative**

- Visual variety is bounded by the template set. If we only have 2–3 looks per subject, a heavy user sees the same backgrounds many times. Mitigation: if we see this becoming a complaint, we expand the set — cheap to do, just design work.
- No surprise factor. A surprise landmark photo can stop the scroll in a way a text card rarely will. Real images in Phase 2 will fix this; template-only is a baseline, not a ceiling.
- Screenshot shareability is lower. Text cards look like text cards; image cards feel more "shareable." Not a deal-breaker at MVP.

**Operational**

- One net-new component in the client: a `QuestionCard` that does mode dispatch and template rendering. Roughly 200 lines of React + Tailwind for MVP. Grows to add the image path in Phase 2 without touching the text path.
- Templates are versioned in the client bundle, not content-addressed. A template change ships with the app. Users on old clients see old templates until they update — fine, templates are cosmetic.

## Alternatives considered

- **Ship images from day one.** Original plan. Rejected — the image pipeline is the single biggest speculative spend at MVP, and we can validate the product loop without it.
- **Hot-link curated Unsplash / Wikimedia images for MVP.** Considered as a cheap middle ground but rejected — attribution requirements, uncertain commercial-use terms for some sources, and no quality control vs. matching a specific question concept. Not worth the coordination cost.
- **User-generated / uploaded question cards.** Out of scope. Moderation and safety review would dominate MVP effort.
- **Server-side rendered SVG question cards (image-like but generated on the fly).** Compelling, but adds server compute to the hot path and defeats the client-heavy direction from ADR 0002.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — why we care about image costs in the first place
- [Architecture](../architecture.md) — current system design reflecting this decision
