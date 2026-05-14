import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useAchievements } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import type { UnlockedAchievement } from '@/lib/api';

// Mirror of backend ACHIEVEMENTS dict — kept in sync with config.py
const ACHIEVEMENTS: { key: string; name: string; desc: string; icon: string }[] = [
  { key: 'first_prediction', name: 'Первый прогноз', desc: 'Сделай свой первый прогноз', icon: '🔮' },
  { key: 'first_win', name: 'Первая победа', desc: 'Угадай победителя гонки', icon: '🏆' },
  { key: 'perfect_podium', name: 'Идеальный подиум', desc: 'Угадай весь подиум', icon: '🥇' },
  { key: 'streak_3', name: 'Хет-трик', desc: '3 правильных прогноза подряд', icon: '🔥' },
  { key: 'streak_5', name: 'На серии!', desc: '5 правильных прогнозов подряд', icon: '⚡' },
  { key: 'streak_10', name: 'Непобедимый', desc: '10 правильных прогнозов подряд', icon: '👑' },
  { key: 'points_500', name: 'Полтысячи', desc: 'Набери 500 очков', icon: '💰' },
  { key: 'points_1000', name: 'Тысячник', desc: 'Набери 1000 очков', icon: '💎' },
  { key: 'games_10', name: 'Игрок', desc: 'Сыграй в 10 мини-игр', icon: '🎮' },
  { key: 'pit_master', name: 'Мастер пит-стопов', desc: 'Пит-стоп быстрее 2.0 секунд', icon: '🔧' },
  { key: 'reaction_god', name: 'Реакция бога', desc: 'Реакция быстрее 0.2 секунд', icon: '⚡' },
  { key: 'all_predictions', name: 'Аналитик', desc: 'Сделай все 5 типов прогнозов', icon: '📊' },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const ach = useAchievements(!!user);

  const unlockedKeys = useMemo(() => {
    if (!ach.data) return new Set<string>();
    const list = Array.isArray(ach.data) ? ach.data : ach.data.achievements;
    return new Set(list.map((a: UnlockedAchievement) => a.key));
  }, [ach.data]);

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} className="flex-1 items-center justify-center px-6">
          <Ionicons name="trophy" size={48} color="#6B6B7B" />
          <Text className="text-text font-bold text-lg mt-4">Войди в аккаунт</Text>
          <Text className="text-muted text-sm mt-1 text-center">
            Чтобы видеть открытые достижения и зарабатывать новые.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-surface px-6 py-3 rounded-full border border-line">
            <Text className="text-text font-bold">Назад</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const unlockedCount = unlockedKeys.size;
  const total = ACHIEVEMENTS.length;

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
            Достижения
          </Text>
        </View>

        <View className="mx-4 mb-3 bg-surface rounded-2xl border border-line p-4">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-red/15 items-center justify-center">
              <Ionicons name="trophy" size={22} color="#E10600" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-text text-2xl font-extrabold">
                {unlockedCount} / {total}
              </Text>
              <Text className="text-muted text-xs">Разблокировано</Text>
            </View>
            <View>
              <Text className="text-red text-xl font-extrabold">
                {Math.round((unlockedCount / total) * 100)}%
              </Text>
            </View>
          </View>
          {/* Progress bar */}
          <View className="h-1.5 bg-surface-2 rounded-full mt-3 overflow-hidden">
            <View
              className="h-full bg-red rounded-full"
              style={{ width: `${(unlockedCount / total) * 100}%` }}
            />
          </View>
        </View>

        {ach.isLoading && (
          <View className="py-6 items-center">
            <ActivityIndicator color="#E10600" />
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 120 }}>
          <View className="flex-row flex-wrap">
            {ACHIEVEMENTS.map((a) => {
              const unlocked = unlockedKeys.has(a.key);
              return (
                <View key={a.key} style={{ width: '50%', paddingHorizontal: 8, marginBottom: 12 }}>
                  <View
                    className={`rounded-2xl border p-4 items-center ${
                      unlocked ? 'bg-surface border-red/40' : 'bg-surface border-line'
                    }`}
                    style={{ aspectRatio: 0.95 }}>
                    <Text style={{ fontSize: 44, opacity: unlocked ? 1 : 0.2 }}>
                      {a.icon}
                    </Text>
                    <Text
                      className={`font-extrabold text-sm mt-2 text-center ${
                        unlocked ? 'text-text' : 'text-muted-2'
                      }`}
                      numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text
                      className={`text-[11px] mt-1 text-center ${
                        unlocked ? 'text-muted' : 'text-muted-2'
                      }`}
                      numberOfLines={3}>
                      {a.desc}
                    </Text>
                    {!unlocked && (
                      <View className="absolute top-2 right-2">
                        <Ionicons name="lock-closed" size={14} color="#6B6B7B" />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
