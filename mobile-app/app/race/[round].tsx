import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { RACES, SCHEDULE } from '@/lib/mock';

const TABS = ['Расписание', 'Информация', 'Статистика'] as const;

export default function RaceDetail() {
  const { round } = useLocalSearchParams<{ round: string }>();
  const router = useRouter();
  const race = RACES.find((r) => r.round === Number(round)) ?? RACES[0];
  const [tab, setTab] = useState<(typeof TABS)[number]>('Расписание');

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="px-4 pt-2 pb-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center">
            <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
          </Pressable>
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
            {race.name}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          {/* Meta row */}
          <View className="px-5 flex-row items-center mt-1 mb-3">
            <Text className="text-2xl mr-2">{race.flag}</Text>
            <Text className="text-text font-semibold mr-3">{race.circuit}</Text>
            <Text className="text-muted text-sm">{race.dates} 2025</Text>
          </View>

          {/* Circuit photo */}
          <View className="mx-4 rounded-2xl overflow-hidden border border-line">
            <Image
              source={{ uri: race.image }}
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              contentFit="cover"
            />
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2 px-4 mt-5">
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-full items-center ${
                    active ? 'bg-red' : 'bg-surface border border-line'
                  }`}>
                  <Text className={`text-xs font-bold ${active ? 'text-text' : 'text-muted'}`}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Schedule */}
          {tab === 'Расписание' && (
            <View className="px-4 mt-5">
              {SCHEDULE.map((day) => (
                <View key={day.day} className="mb-5">
                  <Text className="text-text text-base font-bold px-1 mb-2">{day.day}</Text>
                  <View className="bg-surface rounded-xl border border-line overflow-hidden">
                    {day.sessions.map((s, i) => (
                      <View
                        key={i}
                        className={`flex-row items-center px-4 py-4 ${
                          i < day.sessions.length - 1 ? 'border-b border-line' : ''
                        }`}>
                        <Text className="text-text font-extrabold w-16">{s.time}</Text>
                        <Text className="text-text flex-1 ml-2">{s.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          {tab === 'Информация' && (
            <View className="px-5 mt-5">
              <Text className="text-muted text-sm leading-6">
                Гран-при Канады проходит на трассе Жиля Вильнёва, расположенной на искусственном
                острове Нотр-Дам в Монреале. Длина круга — 4,361 км.
              </Text>
            </View>
          )}

          {tab === 'Статистика' && (
            <View className="px-5 mt-5">
              <Text className="text-muted text-sm">
                Статистика появится после квалификации.
              </Text>
            </View>
          )}

          <Pressable className="bg-red rounded-xl py-4 mt-3 mx-4 items-center">
            <Text className="text-text font-bold">Смотреть трансляцию</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
