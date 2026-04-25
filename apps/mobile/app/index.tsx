import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SDK_VERSION } from '@rcao-quiz/sdk';

/**
 * Placeholder home screen.
 *
 * The real reels-style feed lands in MVP-05 (FlatList scroll-snap, picker
 * with two-tier dedupe). MVP-03 added the SDK primitives — schemas, grading,
 * pickTemplate, QuestionCard — and the `/preview` route below renders one
 * sample card per subject so we can eyeball the visual on-device without
 * waiting for the feed.
 */
export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1220' }} edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-3xl font-bold text-white">rcao-quiz</Text>
        <Text className="mt-2 text-base text-ink-300">scaffold OK</Text>
        <Text className="mt-6 text-xs text-ink-400">@rcao-quiz/sdk @ {SDK_VERSION}</Text>
        <View className="mt-12 gap-3">
          <Link href="/preview" className="rounded-full bg-blue-600 px-5 py-2 text-white">
            Preview QuestionCard (MVP-03)
          </Link>
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
