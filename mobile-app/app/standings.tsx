import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useConstructorStandings, useDriverStandings, flagFor } from '@/lib/hooks';
import type { DriverStanding } from '@/lib/api';

const TABS = ['Пилоты', 'Конструкторы'] as const;

export default function StandingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Пилоты');
  const drivers = useDriverStandings();
  const constructors = useConstructorStandings();

  const driverList = drivers.data?.standings ?? [];
  const top3 = driverList.slice(0, 3);

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
            Чемпионат
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
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {tab === 'Пилоты' && (
            <>
              {drivers.isLoading && (
                <View className="py-10 items-center">
                  <ActivityIndicator color="#E10600" />
                </View>
              )}

              {/* Podium top-3 cards */}
              {top3.length === 3 && (
                <View className="px-4 mb-3">
                  <Text className="text-text text-base font-bold mb-3">Лидеры сезона</Text>
                  <View className="flex-row gap-2">
                    {top3.map((d, i) => (
                      <PodiumCard
                        key={d.driver_number}
                        d={d}
                        rank={i + 1}
                        onPress={() => router.push(`/driver/${d.driver_number}` as never)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Full table */}
              <View className="px-4 gap-2 mt-2">
                {driverList.map((d, i) => (
                  <Pressable
                    key={d.driver_number}
                    onPress={() => router.push(`/driver/${d.driver_number}` as never)}
                    className="bg-surface rounded-xl p-3 border border-line flex-row items-center active:opacity-80">
                    <Text
                      className="font-extrabold w-7 text-center"
                      style={{
                        color:
                          i === 0
                            ? '#FFCB05'
                            : i === 1
                              ? '#C0C0C0'
                              : i === 2
                                ? '#CD7F32'
                                : '#A0A0B0',
                      }}>
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
                      <View className="flex-row items-center">
                        <Text className="text-text font-bold">{d.name}</Text>
                        <Text className="text-muted text-xs ml-2">{flagFor(d.country)}</Text>
                      </View>
                      <Text className="text-muted text-xs">{d.team}</Text>
                    </View>
                    <View className="items-end mr-1">
                      <Text className="text-text font-extrabold">{d.points}</Text>
                      <Text className="text-muted text-xs">очков</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#6B6B7B" />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {tab === 'Конструкторы' && (
            <>
              {constructors.isLoading && (
                <View className="py-10 items-center">
                  <ActivityIndicator color="#E10600" />
                </View>
              )}
              <View className="px-4 gap-2">
                {constructors.data?.standings.map((c, i) => (
                  <View
                    key={c.team}
                    className="bg-surface rounded-2xl border border-line overflow-hidden">
                    {/* Header */}
                    <View
                      className="flex-row items-center p-4"
                      style={{ backgroundColor: (c.team_color || '#666') + '15' }}>
                      <Text
                        className="font-extrabold w-7 text-center text-lg"
                        style={{
                          color:
                            i === 0
                              ? '#FFCB05'
                              : i === 1
                                ? '#C0C0C0'
                                : i === 2
                                  ? '#CD7F32'
                                  : '#A0A0B0',
                        }}>
                        {c.position ?? i + 1}
                      </Text>
                      <View
                        className="w-1.5 h-10 rounded-full mx-2"
                        style={{ backgroundColor: c.team_color || '#666' }}
                      />
                      <View className="flex-1">
                        <Text className="text-text font-extrabold text-base">{c.team}</Text>
                        <Text className="text-muted text-xs">
                          {c.wins ? `${c.wins} побед` : 'Без побед'}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-text font-extrabold text-lg">{c.points}</Text>
                        <Text className="text-muted text-xs">очков</Text>
                      </View>
                    </View>

                    {/* Drivers row */}
                    {c.drivers && c.drivers.length > 0 && (
                      <View className="flex-row border-t border-line">
                        {c.drivers.map((dr, idx) => (
                          <Pressable
                            key={dr.driver_number}
                            onPress={() => router.push(`/driver/${dr.driver_number}` as never)}
                            className={`flex-1 flex-row items-center p-3 active:opacity-80 ${
                              idx === 0 && c.drivers!.length > 1 ? 'border-r border-line' : ''
                            }`}>
                            {dr.photo_url ? (
                              <Image
                                source={{ uri: dr.photo_url }}
                                style={{ width: 32, height: 32, borderRadius: 16 }}
                              />
                            ) : null}
                            <View className="flex-1 ml-2">
                              <Text className="text-text text-sm font-bold" numberOfLines={1}>
                                {dr.last_name}
                              </Text>
                              <Text className="text-muted text-[10px]">#{dr.driver_number}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PodiumCard({
  d,
  rank,
  onPress,
}: {
  d: DriverStanding;
  rank: number;
  onPress: () => void;
}) {
  const accent = rank === 1 ? '#FFCB05' : rank === 2 ? '#C0C0C0' : '#CD7F32';
  const teamColor = d.team_color || '#666';
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl overflow-hidden border border-line active:opacity-80"
      style={{ backgroundColor: teamColor + '25' }}>
      <View
        className="absolute top-0 right-0 left-0 h-1"
        style={{ backgroundColor: teamColor }}
      />
      <View className="p-3 items-center">
        <Text className="font-extrabold text-2xl" style={{ color: accent }}>
          {rank}
        </Text>
        {d.photo_url ? (
          <Image
            source={{ uri: d.photo_url }}
            style={{ width: 56, height: 56, borderRadius: 28, marginTop: 4 }}
            contentFit="cover"
          />
        ) : null}
        <Text className="text-text font-bold text-xs mt-2 text-center" numberOfLines={1}>
          {d.last_name}
        </Text>
        <Text className="text-text font-extrabold text-base mt-0.5">{d.points}</Text>
        <Text className="text-muted text-[10px]">очков</Text>
      </View>
    </Pressable>
  );
}
