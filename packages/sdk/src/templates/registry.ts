// Subject-themed visual templates for the QuestionCard.
//
// Each template is *data only* — gradient stops, an accent kind, a couple of
// colour tokens, a display-font hint. The QuestionCard component reads the
// template and renders the accent shape (via react-native-svg) and gradient
// (via expo-linear-gradient). Keeping templates as data means:
//   - pickTemplate() is a pure function that's trivially unit-testable.
//   - Adding a new variant is a registry edit, not a component edit.
//   - The same registry can later drive a Storybook / preview screen.
//
// Per ADR 0003, Phase 0 ships subject-themed templates (no per-question
// visuals). Two variants per subject, picked deterministically from the
// question id, gives the feed a bit of visual rhythm without needing
// an artist in the loop.
//
// Token spread rule (from the design pass): every gradient's two stops
// must span ≥ 35 luminance points and the second stop pulls toward a
// saturated subject hue (not toward another grey). The previous palette
// kept everything in the same dark-on-dark band and the six templates
// felt indistinguishable; this revision pushes each subject into its
// own colour family.

import type { SubjectSlug } from '../schemas/index';

/**
 * Discriminated union of accent decorations the QuestionCard knows how to
 * render. Adding a new kind here is a coordinated change with QuestionCard.
 */
export type AccentKind =
  | 'grid' // math: faint square grid
  | 'isolines' // geography: topographic contour lines
  | 'dots' // geography: latitude/longitude dot field
  | 'bookshelf' // general_knowledge: horizontal shelf lines
  | 'scroll' // general_knowledge: parchment edges
  | 'numerals'; // math: faded numerals as background motif

export interface Template {
  /** Stable id, e.g. `math.grid.dawn`. Used for analytics + tests. */
  id: string;
  /** Subject this template targets. */
  subject: SubjectSlug;
  /** Two-stop gradient for the card background. */
  gradient: readonly [string, string];
  /** Decoration kind layered above the gradient. */
  accent: AccentKind;
  /** Tint colour for the accent shapes (low alpha at render time). */
  accentColor: string;
  /** Prompt text colour. High contrast on `gradient[1]`. */
  promptColor: string;
  /**
   * Secondary text colour — `promptColor` lifted off by ~35% alpha. Used
   * for choice labels and meta chips so the prompt sits one notch above
   * everything else in the visual hierarchy. Encoded explicitly so each
   * template can override (e.g. parchment cards want a warmer subtle).
   */
  subtleColor: string;
  /** Display-font family hint. MVP-05 wires real fonts via `expo-font`. */
  displayFont: 'serif-display' | 'sans-display' | 'mono-display';
}

/**
 * 2 templates per subject. The order here matters — `pickTemplate` picks
 * by `hash(id) % templates.length`, so reordering would re-shuffle which
 * card uses which template. That's fine in Phase 0 (no analytics on
 * template usage yet) but worth knowing later.
 */
export const TEMPLATE_REGISTRY: Record<SubjectSlug, readonly Template[]> = {
  math: [
    {
      id: 'math.grid.dawn',
      subject: 'math',
      // Navy → deep violet. The "dawn" name now earns it: ~40 luminance
      // points of spread vs. the old #1B1F3B → #2E1A47 which sat in a
      // 9-point band.
      gradient: ['#0F1230', '#3A1B6E'],
      accent: 'grid',
      accentColor: '#8FA2FF',
      promptColor: '#F5F3FF',
      subtleColor: 'rgba(245,243,255,0.65)',
      // Sans, not mono — mono migrated to numerals.deep where the math
      // glyphs justify the typewriter feel.
      displayFont: 'sans-display',
    },
    {
      id: 'math.numerals.deep',
      subject: 'math',
      // Black-blue → blue-800. Saturated mid-blue at the bottom anchors
      // the π / Σ / √ accents.
      gradient: ['#06101F', '#1E3A8A'],
      accent: 'numerals',
      accentColor: '#38BDF8',
      promptColor: '#E0F2FE',
      subtleColor: 'rgba(224,242,254,0.65)',
      displayFont: 'mono-display',
    },
  ],
  geography: [
    {
      id: 'geography.isolines.dusk',
      subject: 'geography',
      // True forest → emerald-700. Old #0B3D2E → #1F5F4F was 9 points;
      // this one is 35+. Topographic mood.
      gradient: ['#062A1E', '#2B7A5C'],
      accent: 'isolines',
      accentColor: '#A7F3D0',
      promptColor: '#ECFDF5',
      subtleColor: 'rgba(236,253,245,0.65)',
      displayFont: 'serif-display',
    },
    {
      id: 'geography.dots.ocean',
      subject: 'geography',
      // Abyss → ocean-blue. Lifts the second stop ~20% so the lat/long
      // dot field actually reads against the background. Sans because
      // serif over a dot field feels cluttered.
      gradient: ['#06223C', '#1E6FB8'],
      accent: 'dots',
      accentColor: '#7DD3FC',
      promptColor: '#EAF6FF',
      subtleColor: 'rgba(234,246,255,0.65)',
      displayFont: 'sans-display',
    },
  ],
  general_knowledge: [
    {
      id: 'general_knowledge.bookshelf.warm',
      subject: 'general_knowledge',
      // Oxblood → warm sienna. Old #3B1F1F → #5C2E2E was muddy → muddy;
      // this one has a hot ember at the bottom. Amber-400 accent sells
      // the "old library lamp" idea.
      gradient: ['#2A0F12', '#7C2D12'],
      accent: 'bookshelf',
      accentColor: '#FBBF24',
      promptColor: '#FFF7E6',
      subtleColor: 'rgba(255,247,230,0.65)',
      displayFont: 'serif-display',
    },
    {
      id: 'general_knowledge.scroll.parchment',
      subject: 'general_knowledge',
      // Espresso → tan. The two GK templates were near-identical; this
      // one now leans tan/parchment vs bookshelf's oxblood. Distinct
      // mood within the warm family.
      gradient: ['#1F1408', '#A0522D'],
      accent: 'scroll',
      accentColor: '#FCD34D',
      promptColor: '#FFF8E1',
      subtleColor: 'rgba(255,248,225,0.65)',
      displayFont: 'serif-display',
    },
  ],
};
