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
      gradient: ['#1B1F3B', '#2E1A47'],
      accent: 'grid',
      accentColor: '#7A8CFF',
      promptColor: '#F5F3FF',
      displayFont: 'mono-display',
    },
    {
      id: 'math.numerals.deep',
      subject: 'math',
      gradient: ['#0F172A', '#1E293B'],
      accent: 'numerals',
      accentColor: '#38BDF8',
      promptColor: '#E0F2FE',
      displayFont: 'sans-display',
    },
  ],
  geography: [
    {
      id: 'geography.isolines.dusk',
      subject: 'geography',
      gradient: ['#0B3D2E', '#1F5F4F'],
      accent: 'isolines',
      accentColor: '#86EFAC',
      promptColor: '#ECFDF5',
      displayFont: 'sans-display',
    },
    {
      id: 'geography.dots.ocean',
      subject: 'geography',
      gradient: ['#0C2D48', '#145374'],
      accent: 'dots',
      accentColor: '#5DADE2',
      promptColor: '#EAF2F8',
      displayFont: 'serif-display',
    },
  ],
  general_knowledge: [
    {
      id: 'general_knowledge.bookshelf.warm',
      subject: 'general_knowledge',
      gradient: ['#3B1F1F', '#5C2E2E'],
      accent: 'bookshelf',
      accentColor: '#F5C26B',
      promptColor: '#FFF7E6',
      displayFont: 'serif-display',
    },
    {
      id: 'general_knowledge.scroll.parchment',
      subject: 'general_knowledge',
      gradient: ['#3A2E1A', '#5B4423'],
      accent: 'scroll',
      accentColor: '#E8C170',
      promptColor: '#FAF3E0',
      displayFont: 'serif-display',
    },
  ],
};
