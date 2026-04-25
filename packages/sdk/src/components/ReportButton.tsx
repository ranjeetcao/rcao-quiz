// Top-right report icon on every QuestionCard.
//
// MVP-03 ships only the button + the press callback. The actual flag
// sheet (`(modals)/report.tsx`) and SQLite-backed dedupe land in MVP-09.
// Keeping this here in the SDK rather than the app means the icon
// styling lives next to the card it sits on top of.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export interface ReportButtonProps {
  onPress: () => void;
  /** Tint colour for the icon. Defaults to a low-attention white. */
  color?: string;
}

export function ReportButton({
  onPress,
  color = 'rgba(255,255,255,0.6)',
}: ReportButtonProps): React.ReactElement {
  return (
    <Pressable
      accessibilityLabel="Report this question"
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.5 : 1 }]}
    >
      {/* Unicode flag glyph keeps the SDK free of an SVG asset import.
          The QuestionCard already pulls in react-native-svg; we don't
          need a second dependency for a single-character icon. */}
      <Text style={[styles.glyph, { color }]}>⚑</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  glyph: {
    fontSize: 22,
    fontWeight: '600',
  },
});
