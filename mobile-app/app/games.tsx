import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

const GAMES = [
  {
    id: 'pit_stop',
    href: '/games/pit-stop',
    emoji: '🔧',
    title: 'Пит-стоп',
    desc: 'Смени шины быстрее всех!',
    color: '#E10600',
  },
  {
    id: 'top_trumps',
    href: '/games/top-trumps',
    emoji: '🃏',
    title: 'Top Trumps',
    desc: 'Карточная битва пилотов F1',
    color: '#FFD700',
  },
  {
    id: 'reaction',
    href: '/games/reaction',
    emoji: '🚦',
    title: 'Реакция',
    desc: 'Стартуй по зелёному!',
    color: '#27F4D2',
  },
  {
    id: 'quiz',
    href: '/games/quiz',
    emoji: '🧠',
    title: 'F1 Квиз',
    desc: 'Проверь свои знания',
    color: '#6692FF',
  },
] as const;

export default function GamesHub() {
  const router = useRouter();

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
            🎮 Мини-игры
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          <View className="mt-2 mb-3">
            <Text className="text-muted text-sm leading-5">
              4 игры на скорость, стратегию и знание F1. Открой ачивки и попади в топ
              игроков.
            </Text>
          </View>

          {GAMES.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => router.push(g.href as never)}
              className="bg-surface rounded-2xl border border-line p-4 mb-2.5 flex-row items-center active:opacity-80"
              style={{ borderLeftWidth: 4, borderLeftColor: g.color }}>
              <Text style={{ fontSize: 36 }}>{g.emoji}</Text>
              <View className="flex-1 ml-3">
                <Text className="text-text font-extrabold text-lg">{g.title}</Text>
                <Text className="text-muted text-xs mt-0.5">{g.desc}</Text>
              </View>
              <Text className="font-extrabold text-sm" style={{ color: g.color }}>
                ИГРАТЬ →
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
