// MVP-03 preview screen.
//
// Renders one hand-picked QuestionCard with the SDK's grading + analytics
// wired in. Not the real feed — that's MVP-05. The point of this screen is
// to verify on-device that:
//   - `@rcao-quiz/sdk` resolves at runtime in the Expo app (not just typecheck)
//   - LinearGradient + react-native-svg + ChoiceButton render
//   - Tapping a choice produces the correct reveal state and emits a
//     `question_answered` analytics event to the console
//
// You can scroll between two sample subjects to eyeball template variants.

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  analytics,
  gradeAnswer,
  type Question,
} from '@rcao-quiz/sdk';
import { QuestionCard } from '@rcao-quiz/sdk/components';

// Two hand-picked samples — one math, one geography — chosen so the user
// can see two different subject templates without scrolling far. The id
// shape matches the on-disk Question schema; in MVP-04+ the app will
// load real questions from the pack files instead of inlining them.
const SAMPLES: readonly Question[] = [
  {
    id: 'q_01HX3F7Z8K0000000PREVIEW001',
    mode: 'text',
    subject: 'math',
    prompt_text: 'What is 7 × 8?',
    choices: ['54', '56', '63', '64'],
    correct_answer: '56',
    difficulty: 1,
    status: 'approved',
    generator_meta: { source: 'preview-screen' },
    retired_at: null,
    retired_reason: null,
  },
  {
    id: 'q_01HX3F7Z8K0000000PREVIEW002',
    mode: 'text',
    subject: 'geography',
    prompt_text: 'Which river flows through Paris?',
    choices: ['Seine', 'Rhône', 'Loire', 'Garonne'],
    correct_answer: 'Seine',
    difficulty: 2,
    status: 'approved',
    generator_meta: { source: 'preview-screen' },
    retired_at: null,
    retired_reason: null,
  },
];

const ANON_GUEST_ID = 'preview-screen-anon';

export default function PreviewScreen(): React.ReactElement {
  // Map of question.id → the choice the user picked for it (or null).
  // Snapshot per card lets multiple cards be in different reveal states.
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [startedAt] = useState<number>(() => Date.now());

  const handleAnswer = (q: Question, chosen: string): void => {
    const correct = gradeAnswer(q, chosen);
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    ).catch(() => {
      // Haptics can fail on some emulators — best-effort only.
    });
    setPicked((prev) => ({ ...prev, [q.id]: chosen }));
    analytics.emit('question_answered', {
      question_id: q.id,
      subject: q.subject,
      difficulty: q.difficulty,
      pack_id: 'preview-pack',
      anon_guest_id: ANON_GUEST_ID,
      chosen_index: q.choices.indexOf(chosen),
      correct,
      time_to_answer_ms: Date.now() - startedAt,
    });
  };

  const handleReport = (q: Question): void => {
    analytics.emit('question_flagged', {
      question_id: q.id,
      subject: q.subject,
      difficulty: q.difficulty,
      pack_id: 'preview-pack',
      anon_guest_id: ANON_GUEST_ID,
      reason: 'other',
      note: 'preview-screen test flag',
    });
  };

  const reset = (): void => setPicked({});

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
      >
        {SAMPLES.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            revealedAnswer={picked[q.id] ?? null}
            onAnswer={(chosen) => handleAnswer(q, chosen)}
            onReport={() => handleReport(q)}
          />
        ))}
      </ScrollView>

      {/*
        Dev chrome — moved to the top-left so it never overlaps the
        QuestionCard's choices or progress dots. Template id is dropped
        from the visible UI; in __DEV__ it'll surface in the in-app
        debug menu in MVP-05.
      */}
      <View style={styles.devChrome} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={styles.devChromeBtn}>
          <Text style={styles.devChromeBtnText}>←</Text>
        </Pressable>
        <Pressable onPress={reset} style={styles.devChromeBtn}>
          <Text style={styles.devChromeBtnText}>Reset</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  devChrome: {
    position: 'absolute',
    top: 56,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devChromeBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    minWidth: 36,
    alignItems: 'center',
  },
  devChromeBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
});
