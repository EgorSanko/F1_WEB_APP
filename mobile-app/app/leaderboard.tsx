import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useLeaderboard } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { absUrl } from '@/lib/api';

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const lb = useLeaderboard();

  const entries = lb.data?.leaderboard ?? [];

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pt-2 pb-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center">
            <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
          </Pressable>
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
            Топ игроков
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 8 }}
          showsVerticalScrollIndicator={false}>
          {lb.isLoading && <ActivityIndicator color="#E10600" />}
          {entries.map((e, i) => {
            const isMe = user?.user_id === e.user_id;
            const rank = e.rank ?? i + 1;
            return (
              <View
                key={e.user_id}
                className={`rounded-xl p-3 border flex-row items-center ${
                  isMe ? 'bg-red/10 border-red' : 'bg-surface border-line'
                }`}>
                <Text
                  className="font-extrabold w-7 text-center"
                  style={{
                    color:
                      rank === 1
                        ? '#FFCB05'
                        : rank === 2
                          ? '#C0C0C0'
                          : rank === 3
                            ? '#CD7F32'
                            : '#A0A0B0',
                  }}>
                  {rank}
                </Text>
                {absUrl(e.photo_url) ? (
                  <Image
                    source={{ uri: absUrl(e.photo_url) }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                ) : (
                  <View className="w-10 h-10 rounded-full bg-surface-2 items-center justify-center">
                    <Ionicons name="person" size={20} color="#A0A0B0" />
                  </View>
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-text font-bold">
                    {e.first_name || e.username || `User ${e.user_id}`}
                    {isMe ? ' · Это ты' : ''}
                  </Text>
                  {e.username && (
                    <Text className="text-muted text-xs">
                      @{e.username}
                      {e.correct_predictions != null && ` · ${e.correct_predictions} верных`}
                    </Text>
                  )}
                </View>
                <View className="items-end">
                  <Text className="text-text font-extrabold">
                    {(e.total_points ?? 0).toLocaleString('ru-RU')}
                  </Text>
                  <Text className="text-muted text-xs">очков</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
