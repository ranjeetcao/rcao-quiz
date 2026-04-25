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

export interface ChoiceButtonProps {
  label: string;
  state: ChoiceState;
  /** Tint colour for highlights (correct reveal). Comes from the template. */
  accentColor: string;
  /** Text colour for the label. Comes from the template. */
  textColor: string;
  onPress: () => void;
}

export function ChoiceButton({
  label,
  state,
  accentColor,
  textColor,
  onPress,
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, selected: state !== 'idle' }}
      onPress={isInteractive ? onPress : undefined}
      style={buttonStyle}
    >
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

interface ChoiceVisual {
  bg: string;
  border: string;
  opacity: number;
  textOverride: string | null;
  glyph: { char: string; color: string } | null;
}

function visualForState(state: ChoiceState, accentColor: string): ChoiceVisual {
  switch (state) {
    case 'idle':
      return {
        bg: 'rgba(255,255,255,0.08)',
        border: 'rgba(255,255,255,0.18)',
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
      };
    case 'revealed-wrong':
      return {
        bg: 'rgba(220, 80, 80, 0.22)',
        border: '#DC5050',
        opacity: 1,
        textOverride: null,
        glyph: { char: '✕', color: '#DC5050' },
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
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 60,
  },
  label: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
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
