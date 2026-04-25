// Full-bleed question card. The visual unit of the reels feed.
//
// Composition:
//   - LinearGradient background (template.gradient)
//   - AccentLayer (template.accent + template.accentColor)
//   - Prompt text (template.promptColor + displayFont mapping)
//   - 4 ChoiceButtons (state-driven by `revealedAnswer`)
//   - ReportButton in the top-right
//
// Controlled component: the parent (the feed in MVP-05) holds the
// answer state and timing. QuestionCard only knows how to render a
// snapshot — that keeps the reveal/auto-advance choreography in one
// place (the feed) and lets the card stay deterministic and testable.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import type { Question } from '../schemas/index';
import { pickTemplate } from '../templates/pick';
import type { Template } from '../templates/registry';
import { AccentLayer } from './AccentLayer';
import { ChoiceButton, type ChoiceState } from './ChoiceButton';
import { ReportButton } from './ReportButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface QuestionCardProps {
  question: Question;
  /**
   * The answer the user picked, or `null` if no answer yet.
   * Driving this from the parent lets the feed control reveal timing
   * and auto-advance.
   */
  revealedAnswer: string | null;
  onAnswer: (chosen: string) => void;
  onReport: () => void;
  /** Override the card dimensions (default: full screen). */
  width?: number;
  height?: number;
  /** Override the picked template (useful for previews / Storybook). */
  template?: Template;
}

export function QuestionCard({
  question,
  revealedAnswer,
  onAnswer,
  onReport,
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT,
  template,
}: QuestionCardProps): React.ReactElement {
  if (question.mode !== 'text') {
    // Image / video render paths are deliberately out of scope for
    // Phase 0 (ADR 0003). Failing loudly here means a content batch
    // accidentally containing non-text questions surfaces immediately
    // instead of rendering a silent blank card.
    throw new Error(
      `QuestionCard: mode "${question.mode}" not implemented in Phase 0 (text only)`,
    );
  }

  const tpl = template ?? pickTemplate(question);
  const fontFamily = mapDisplayFont(tpl.displayFont);

  return (
    <View style={[styles.card, { width, height }]}>
      <LinearGradient
        colors={[tpl.gradient[0], tpl.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AccentLayer kind={tpl.accent} color={tpl.accentColor} width={width} height={height} />

      <View style={styles.topBar}>
        <ReportButton onPress={onReport} color={withAlpha(tpl.promptColor, 0.55)} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.prompt, { color: tpl.promptColor, fontFamily }]}>
          {question.prompt_text}
        </Text>

        <View style={styles.choices}>
          {question.choices.map((choice) => (
            <ChoiceButton
              key={choice}
              label={choice}
              state={choiceState(choice, question.correct_answer, revealedAnswer)}
              accentColor={tpl.accentColor}
              textColor={tpl.promptColor}
              onPress={() => onAnswer(choice)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Decide how a given choice should render given the user's pick (if any)
 * and the correct answer.
 */
function choiceState(
  choice: string,
  correctAnswer: string,
  revealedAnswer: string | null,
): ChoiceState {
  if (revealedAnswer === null) return 'idle';
  if (choice === correctAnswer) return 'revealed-correct';
  if (choice === revealedAnswer) return 'revealed-wrong';
  return 'revealed-other';
}

/**
 * Map the template's display-font hint to a concrete font-family string.
 * MVP-05 wires real custom fonts via `expo-font`; until then we ride
 * platform defaults so the card still renders in the simulator.
 */
function mapDisplayFont(hint: Template['displayFont']): string | undefined {
  switch (hint) {
    case 'serif-display':
      return 'Georgia';
    case 'mono-display':
      return 'Menlo';
    case 'sans-display':
    default:
      return undefined; // platform default sans
  }
}

/** Convert any `#RRGGBB` to rgba with the given alpha. Pass-through otherwise. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (m === null) return color;
  const v = parseInt(m[1]!, 16);
  return `rgba(${(v >> 16) & 0xff}, ${(v >> 8) & 0xff}, ${v & 0xff}, ${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  prompt: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  choices: {
    width: '100%',
  },
});
