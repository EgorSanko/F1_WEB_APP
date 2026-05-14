import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth';

const GAMES: {
  id: string;
  href: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  achievement?: string;
}[] = [
  {
    id: 'reaction',
    href: '/games/reaction',
    title: 'Реакция',
    description: 'Тапни как только загорится зелёный',
    icon: 'flash',
    achievement: 'Меньше 200мс → ачивка',
  },
  {
    id: 'pit_stop',
    href: '/games/pit-stop',
    title: 'Пит-стоп',
    description: 'Замени 4 шины как можно быстрее',
    icon: 'car-sport',
    achievement: 'Быстрее 2 сек → ачивка',
  },
  {
    id: 'quiz',
    href: '/games/quiz',
    title: 'Квиз',
    description: '15 вопросов про F1 — насколько ты в теме?',
    icon: 'help-circle',
  },
];

export default function GamesHub() {
  const router = useRouter();
  const { user } = useAuth();

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
            Игры
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}>
          <View className="bg-surface rounded-xl border border-line p-4 flex-row items-center">
            <Ionicons name="information-circle-outline" size={20} color="#A0A0B0" />
            <Text className="text-muted text-xs ml-2 flex-1 leading-5">
              Игры для тренировки реакции и знаний. Очки сезона за них не идут — только
              ачивки и место в топе игроков.
            </Text>
          </View>

          {GAMES.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => router.push(g.href as never)}
              disabled={!user && g.id !== 'quiz'}
              className={`bg-surface rounded-2xl border border-line p-5 active:opacity-80 ${
                !user && g.id !== 'quiz' ? 'opacity-50' : ''
              }`}>
              <View className="flex-row items-center">
                <View className="w-14 h-14 rounded-full bg-red/15 items-center justify-center">
                  <Ionicons name={g.icon} size={26} color="#E10600" />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-text font-extrabold text-lg">{g.title}</Text>
                  <Text className="text-muted text-sm mt-0.5">{g.description}</Text>
                  {g.achievement ? (
                    <Text className="text-red text-xs mt-1.5 font-semibold">
                      🏆 {g.achievement}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </View>
              {!user && g.id !== 'quiz' ? (
                <Text className="text-muted-2 text-xs mt-3">
                  Залогинься в Профиле чтобы играть и сохранять результаты
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
