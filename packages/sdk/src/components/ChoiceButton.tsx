// One of the four answer buttons under a QuestionCard.
//
// Pure presentation: the parent (feed in MVP-05) owns the answer state
// machine and tells each button which `state` to render. ChoiceButton
// does not call expo-haptics directly — keeping the SDK importable from
// non-RN callers (scripts, tests) is more valuable than the one extra
// callback wire-up at the call site.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Visual state of a single button.
 *
 *   idle              — no answer chosen yet, button is interactive.
 *   chosen-pending    — this button was just tapped; reveal hasn't
 *                       happened yet (Phase 0 reveals immediately, so
 *                       this is mostly a future hook for animation).
 *   revealed-correct  — reveal: this button holds the correct answer.
 *                       Always shown highlighted, whether the user
 *                       picked it or not.
 *   revealed-wrong    — reveal: this button is the user's wrong pick.
 *   revealed-other    — reveal: a non-chosen, non-correct button. Dimmed.
 */
export type ChoiceState =
  | 'idle'
  | 'chosen-pending'
  | 'revealed-correct'
  | 'revealed-wrong'
  | 'revealed-other';

const INDEX_LETTERS = ['A', 'B', 'C', 'D'] as const;

export interface ChoiceButtonProps {
  label: string;
  state: ChoiceState;
  /**
   * Position in the choice list (0..3). Renders as a leading A/B/C/D
   * marker. Gives the eye an anchor and makes verbal answers possible
   * ("the answer is C") — same trick Kahoot/Quizlet/Duolingo use.
   */
  index: number;
  /** Tint colour for highlights (correct reveal). Comes from the template. */
  accentColor: string;
  /** Text colour for the label. Comes from the template. */
  textColor: string;
  /**
   * Called with this button's `label` when tapped. Parent passes one
   * stable `onAnswer` to all four buttons; the per-button closure that
   * wires `label` into the call lives in this component's own render
   * scope so the memo's shallow comparator sees identity-stable props.
   */
  onAnswer: (label: string) => void;
}

// Wrapped in React.memo (below) so the FlatList of cards in MVP-05
// doesn't re-render every button on every parent state change. All
// props are either primitives (label/state/index/accentColor/textColor)
// or one stable callback (onAnswer, captured once by the parent), so
// memo's default shallow comparator is sufficient.
//
// Defined as a named declaration first then wrapped — the inline
// `React.memo(function Name(...): ReturnType { ... })` form is valid
// TypeScript but babel-preset-expo's parser rejects the return-type
// annotation on a named function expression inside a call.
function ChoiceButtonImpl({
  label,
  state,
  index,
  accentColor,
  textColor,
  onAnswer,
}: ChoiceButtonProps): React.ReactElement {
  const isInteractive = state === 'idle';
  const visual = visualForState(state, accentColor);

  // Pre-compute the style array so we don't pass a function-as-style to
  // Pressable. RN's docs say function-as-style is supported but on some
  // Expo+iOS combos it silently drops the inline overrides — we hit that
  // on iOS 26.2 (text rendered, all backgrounds/borders gone). A plain
  // array is universally supported.
  const buttonStyle = [
    styles.button,
    {
      backgroundColor: visual.bg,
      borderColor: visual.border,
      opacity: visual.opacity,
    },
  ];

  // The index marker borrows the accent colour on reveal so the correct
  // answer's `A`/`B`/`C`/`D` chip highlights along with the rest of the
  // button. Idle is a soft white fill on a soft white outline — same
  // material as the button border, just smaller.
  const markerBorder = visual.markerBorder ?? 'rgba(255,255,255,0.22)';
  const markerColor = visual.markerColor ?? textColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${INDEX_LETTERS[index] ?? ''}. ${label}`}
      accessibilityState={{ disabled: !isInteractive, selected: state !== 'idle' }}
      onPress={isInteractive ? () => onAnswer(label) : undefined}
      style={buttonStyle}
    >
      <View style={[styles.marker, { borderColor: markerBorder }]}>
        <Text style={[styles.markerText, { color: markerColor }]}>
          {INDEX_LETTERS[index] ?? ''}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={[styles.label, { color: visual.textOverride ?? textColor }]}
      >
        {label}
      </Text>
      {visual.glyph !== null && (
        <View style={styles.glyphSlot}>
          <Text style={[styles.glyph, { color: visual.glyph.color }]}>{visual.glyph.char}</Text>
        </View>
      )}
    </Pressable>
  );
}

export const ChoiceButton = React.memo(ChoiceButtonImpl);

interface ChoiceVisual {
  bg: string;
  border: string;
  opacity: number;
  textOverride: string | null;
  glyph: { char: string; color: string } | null;
  /** Override for the index-marker ring colour. Defaults to a soft white. */
  markerBorder?: string;
  /** Override for the index-letter colour. Defaults to the template textColor. */
  markerColor?: string;
}

function visualForState(state: ChoiceState, accentColor: string): ChoiceVisual {
  switch (state) {
    case 'idle':
      return {
        // Slightly lower fill (0.06) and softer border (0.14) than the
        // first pass — at 0.08/0.18 the buttons read as outlined boxes
        // floating in space. The new values let the gradient breathe
        // through while still claiming the tap area.
        bg: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.14)',
        opacity: 1,
        textOverride: null,
        glyph: null,
      };
    case 'chosen-pending':
      return {
        bg: 'rgba(255,255,255,0.18)',
        border: 'rgba(255,255,255,0.38)',
        opacity: 1,
        textOverride: null,
        glyph: null,
      };
    case 'revealed-correct':
      return {
        bg: hexToRgba(accentColor, 0.22),
        border: accentColor,
        opacity: 1,
        textOverride: null,
        glyph: { char: '✓', color: accentColor },
        markerBorder: accentColor,
        markerColor: accentColor,
      };
    case 'revealed-wrong':
      return {
        bg: 'rgba(220, 80, 80, 0.22)',
        border: '#DC5050',
        opacity: 1,
        textOverride: null,
        glyph: { char: '✕', color: '#DC5050' },
        markerBorder: '#DC5050',
        markerColor: '#DC5050',
      };
    case 'revealed-other':
      return {
        bg: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.10)',
        opacity: 0.55,
        textOverride: null,
        glyph: null,
      };
  }
}

/** Tiny hex→rgba helper. Accepts `#RRGGBB`. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (m === null) return hex; // give up gracefully — caller passed something exotic
  const v = parseInt(m[1]!, 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    // Left-anchored content so the index marker pins to the left edge
    // and the label flows naturally beside it.
    justifyContent: 'flex-start',
    minHeight: 64,
  },
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  markerText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  label: {
    flex: 1,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  glyphSlot: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  glyph: {
    fontSize: 22,
    fontWeight: '700',
  },
});
