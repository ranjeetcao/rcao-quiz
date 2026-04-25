# ADR 0003 — Text-only MVP with client templates; images in Phase 3

**Status:** ACCEPTED

## Context

The pitch is "eye-catching cards scrolling past." Visual variety is load-bearing for the reels UX. But:

- Generating real images costs real money (cents to a dollar per image at quality), and once generated they cost CDN storage forever.
- We don't yet know if the play loop holds attention. Spending the image budget before validating retention is a speculative bet.

The insight: what makes image cards feel good in a reels feed isn't the literal image — it's visual variety, colour, and "something for the eye to rest on." Text content over a designed background template delivers most of that at near-zero cost. Twitter quote cards, news infographics, and Instagram text slides all succeed this way.

## Decision

**MVP and the text-AI pipeline ship text-only questions.** No LLM image generation, no stock image sourcing, no media CDN egress. Visual variety comes from **client-side templates** — CSS gradients + SVG shapes + typography — bundled with the client and selected at render time.

### Template set

- **Size:** 8–12 templates. Curated, not exhaustive.
- **Implementation:** linear/radial gradients via `expo-linear-gradient` + SVG shapes via `react-native-svg` + one display font loaded via `expo-font` (e.g. Space Grotesk or Instrument Serif). No canvas, no Skia.
- **Organisation:** subject-themed with 2–3 variants per subject. Math draws from blue/geometric variants; geography from map-motif; pop-culture from neon; etc. Subjects get visual identity; users learn the language.
- **Selection logic:** deterministic by question ID. `templates[subjectPool(q.subject)][hash(q.id) % variantCount]`. Same question always gets the same look — recognisable across plays and shareable.
- **Style:** background + typography only for v1. No decorative icons.
- **Accessibility:** WCAG AA contrast on every template. Design-check each one before it lands.

### Schema

The data model carries `mode` (`text | image | video`) and a nullable `media_url` — both free to keep, both empty in MVP. Phase 3 images slot in as new rows with `mode=image` and a populated `media_url`, plus a new image-card renderer in the client. No schema migration needed.

### What moves to Phase 3

- LLM concept → image-model render → R2 upload pipeline.
- Image-card template in the client.
- Perceptual-hash dedupe for visual similarity.
- Hotlink protection on the image CDN (per ADR 0002).
- Decision criteria: enough retention/usage data to justify the image budget, or specific engagement ceilings text alone won't break.

## Consequences

**Positive**

- Question generation cost drops by roughly two orders of magnitude — text completion is cheap; image generation is not.
- Pack JSON stays tiny (a 500-question pack is tens of KB compressed). Whole content library fits comfortably on any device.
- Content licensing concerns disappear for MVP.
- Typography gets to breathe — a well-set text card with a good background can feel more intentional than a mediocre generated image.

**Negative**

- Visual variety is bounded by the template set. Heavy users see the same backgrounds many times. Mitigation: expand if telemetry complains; the cost of adding templates is a design pass.
- No "stop the scroll" surprise factor that a great photo provides. Phase 3 fixes this; template-only is a baseline, not a ceiling.
- Screenshot shareability is lower than image cards. Acceptable at MVP.

**Operational**

- One net-new client component: a `QuestionCard` that mode-dispatches and template-renders. ~200 lines of React Native + NativeWind. Phase 3 grows it to handle image mode.
- Templates are versioned in the app bundle, not content-addressed. A template change ships with the app via the next EAS Build.

## Alternatives considered

- **Ship images from day one.** Original plan. Rejected — single biggest speculative spend at MVP, and the loop can be validated without it.
- **Hot-link curated Unsplash / Wikimedia images.** Cheap middle ground; rejected for attribution overhead, uncertain commercial-use terms, and weak control over per-question concept fit.
- **Server-rendered SVG question cards.** Compelling, but adds server compute on the hot path — defeats ADR 0002.
- **User-generated questions.** Out of scope. Moderation cost would dominate MVP.

## Cross-references

- [ADR 0002](0002-client-heavy-cost-optimized.md) — why image costs matter to the runtime model
- [Architecture](../architecture.md)
