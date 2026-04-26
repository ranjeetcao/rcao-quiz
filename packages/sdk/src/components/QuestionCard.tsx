// Full-bleed question card. The visual unit of the reels feed.
//
// Composition (top → bottom of the card):
//   - LinearGradient background (template.gradient)
//   - AccentLayer (template.accent + template.accentColor)
//   - Subject chip ("MATH · GRID") in the top-left
//   - ReportButton in the top-right
//   - Prompt text (template.promptColor + displayFont mapping)
//   - 4 ChoiceButtons (state-driven by `revealedAnswer`)
//   - Progress dots near the bottom
//
// Controlled component: the parent (the feed in MVP-05) holds the answer
// state and timing. QuestionCard only knows how to render a snapshot —
// that keeps the reveal/auto-advance choreography in one place (the feed)
// and lets the card stay deterministic and testable.

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { Question, SubjectSlug } from '../schemas/index';
import { pickTemplate } from '../templates/pick';
import type { AccentKind, Template } from '../templates/registry';
import { AccentLayer } from './AccentLayer';
import { ChoiceButton, type ChoiceState } from './ChoiceButton';
import { ReportButton } from './ReportButton';

// Hoist the LinearGradient endpoint objects out of the render path so a
// FlatList of cards in MVP-05 doesn't allocate two fresh objects per
// row per frame. Same gradient direction (top-left → bottom-right) for
// every card, so this is safe to share.
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 1 } as const;

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
  /** Override the card dimensions (default: live window size). */
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
  width: widthProp,
  height: heightProp,
  template,
}: QuestionCardProps): React.ReactElement {
  // useWindowDimensions tracks orientation + safe-area changes; reading
  // Dimensions.get('window') at module-load time goes stale and bites us
  // on iOS in particular. The width/height props still win when supplied.
  const win = useWindowDimensions();
  const width = widthProp ?? win.width;
  const height = heightProp ?? win.height;
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
  const subjectLabel = `${displaySubject(question.subject)} · ${displayAccent(tpl.accent)}`;

  return (
    <View style={[styles.card, { width, height }]}>
      <LinearGradient
        colors={[tpl.gradient[0], tpl.gradient[1]]}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={StyleSheet.absoluteFill}
      />
      <AccentLayer kind={tpl.accent} color={tpl.accentColor} width={width} height={height} />

      <Text style={[styles.subjectChip, { color: tpl.subtleColor }]}>{subjectLabel}</Text>

      <View style={styles.topBar}>
        <ReportButton onPress={onReport} color={tpl.subtleColor} />
      </View>

      <Text style={[styles.prompt, { color: tpl.promptColor, fontFamily }]}>
        {question.prompt_text}
      </Text>

      <View style={styles.choices}>
        {question.choices.map((choice, i) => (
          // Composite key — index + choice — so the buttons don't remount
          // mid-reveal if the picker ever shuffles choice order, while
          // still being stable when the same content re-renders.
          <ChoiceButton
            key={`${i}-${choice}`}
            label={choice}
            index={i}
            state={choiceState(choice, question.correct_answer, revealedAnswer)}
            accentColor={tpl.accentColor}
            textColor={tpl.promptColor}
            onPress={() => onAnswer(choice)}
          />
        ))}
      </View>

      {/*
        MVP-05 will land the real "N of M" progress indicator here; the
        feed knows the buffered question count and current index, so the
        progress UI belongs at that level rather than synthesised inside
        the card. Tried decorative dots in MVP-03 but they collided with
        the iOS home-indicator safe area and read as a bug.
      */}
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
 *
 * sans-display intentionally returns undefined — that yields the
 * platform default (SF Pro Display on iOS, Roboto on Android). At hero
 * sizes we lean on the typography styles (-0.4 letter-spacing, weight
 * 700) to give the system sans display-face energy.
 */
function mapDisplayFont(hint: Template['displayFont']): string | undefined {
  switch (hint) {
    case 'serif-display':
      return 'Georgia';
    case 'mono-display':
      return 'Menlo';
    case 'sans-display':
    default:
      return undefined;
  }
}

/** Subject slug → display-cased name for the subject chip. */
function displaySubject(subject: SubjectSlug): string {
  // 'general_knowledge' → 'GENERAL KNOWLEDGE'. Slugs are stable so we
  // don't reach for content/subjects.json here — keeping the SDK self-
  // contained for non-RN consumers.
  return subject.replace(/_/g, ' ').toUpperCase();
}

/** AccentKind → short label for the subject chip. */
function displayAccent(accent: AccentKind): string {
  return accent.toUpperCase();
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  // Subject chip — small uppercase label above the prompt that fills the
  // dead-zone left over when the prompt is short. Uses tracked-out caps
  // (letterSpacing 1.5) so it reads as meta-information, not headline.
  subjectChip: {
    position: 'absolute',
    top: 84,
    left: 28,
    right: 28,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  topBar: {
    position: 'absolute',
    top: 64,
    right: 20,
    zIndex: 2,
  },
  // Hero prompt typography. 34/40/-0.4/700 is the iOS HIG large-title
  // spec; on Android the system Roboto picks up similar metrics. Letter
  // spacing pulled tight (-0.4) gives the system sans real display-face
  // weight at this size.
  prompt: {
    position: 'absolute',
    top: 130,
    left: 28,
    right: 28,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.4,
  },
  // Choices anchored to the bottom with enough clearance above the iOS
  // home indicator that the bottom button stays visible. Bumped from 56
  // to 88 after on-device verification on iPhone 16e.
  choices: {
    position: 'absolute',
    bottom: 88,
    left: 24,
    right: 24,
  },
});
