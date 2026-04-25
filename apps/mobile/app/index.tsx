import { Link } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';
import { SDK_VERSION } from '@rcao-quiz/sdk';

/**
 * MVP-01 placeholder home screen.
 *
 * The real reels-style feed lands in MVP-05 (FlatList scroll-snap, QuestionCard,
 * subject templates). For now this just confirms the workspace boots end-to-end:
 * the Expo app, Expo Router, NativeWind classes, and the @rcao-quiz/sdk import
 * all working together.
 */
export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-ink-900">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-3xl font-bold text-white">rcao-quiz</Text>
        <Text className="mt-2 text-base text-ink-300">scaffold OK</Text>
        <Text className="mt-6 text-xs text-ink-400">@rcao-quiz/sdk @ {SDK_VERSION}</Text>
        <View className="mt-12">
          <Link href="/stats" className="rounded-full bg-ink-700 px-5 py-2 text-white">
            Open stats placeholder
          </Link>
        </View>
        <Text className="mt-12 text-center text-xs text-ink-500">
          Real feed lands in MVP-05.{'\n'}This screen exists only to verify the scaffold.
        </Text>
      </View>
    </SafeAreaView>
  );
}
