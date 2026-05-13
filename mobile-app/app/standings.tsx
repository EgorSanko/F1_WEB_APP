import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useConstructorStandings, useDriverStandings } from '@/lib/hooks';

const TABS = ['Пилоты', 'Конструкторы'] as const;

export default function StandingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Пилоты');
  const drivers = useDriverStandings();
  const constructors = useConstructorStandings();

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
            Таблица сезона
          </Text>
        </View>

        <View className="flex-row gap-2 px-4 pb-3">
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

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 8 }}
          showsVerticalScrollIndicator={false}>
          {tab === 'Пилоты' && (
            <>
              {drivers.isLoading && <ActivityIndicator color="#E10600" />}
              {drivers.data?.standings.map((d, i) => (
                <View
                  key={d.driver_number}
                  className="bg-surface rounded-xl p-3 border border-line flex-row items-center">
                  <Text className="text-text font-extrabold w-7 text-center">
                    {d.position ?? i + 1}
                  </Text>
                  <View
                    className="w-1 h-10 rounded-full mx-2"
                    style={{ backgroundColor: d.team_color || '#666' }}
                  />
                  {d.photo_url ? (
                    <Image
                      source={{ uri: d.photo_url }}
                      style={{ width: 36, height: 36, borderRadius: 18 }}
                      contentFit="cover"
                    />
                  ) : null}
                  <View className="flex-1 ml-3">
                    <Text className="text-text font-bold">{d.name}</Text>
                    <Text className="text-muted text-xs">{d.team}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-text font-extrabold">{d.points}</Text>
                    <Text className="text-muted text-xs">очков</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {tab === 'Конструкторы' && (
            <>
              {constructors.isLoading && <ActivityIndicator color="#E10600" />}
              {constructors.data?.standings.map((c, i) => (
                <View
                  key={c.team}
                  className="bg-surface rounded-xl p-3 border border-line">
                  <View className="flex-row items-center">
                    <Text className="text-text font-extrabold w-7 text-center">
                      {c.position ?? i + 1}
                    </Text>
                    <View
                      className="w-1 h-10 rounded-full mx-2"
                      style={{ backgroundColor: c.team_color || '#666' }}
                    />
                    <View className="flex-1">
                      <Text className="text-text font-bold">{c.team}</Text>
                      <Text className="text-muted text-xs">
                        {c.drivers?.map((d) => d.code).filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-text font-extrabold">{c.points}</Text>
                      <Text className="text-muted text-xs">очков</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
