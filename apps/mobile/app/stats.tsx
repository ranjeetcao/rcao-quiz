import { Link } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';

/**
 * MVP-01 stats placeholder. Real stats screen lands in STATS-09 (subject mastery
 * percentile buckets). This screen exists only to verify Expo Router multi-screen
 * navigation works.
 */
export default function Stats() {
  return (
    <SafeAreaView className="flex-1 bg-ink-900">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-2xl font-bold text-white">Stats</Text>
        <Text className="mt-2 text-base text-ink-300">placeholder · STATS-09 will fill this in</Text>
        <View className="mt-10">
          <Link href="/" className="rounded-full bg-ink-700 px-5 py-2 text-white">
            Back
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
