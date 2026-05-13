import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { useHome, useSchedule, flagFor, countdownParts } from '@/lib/hooks';

const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

export default function HomeScreen() {
  const home = useHome();
  const schedule = useSchedule();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextRace = home.data?.next_race;
  const upcoming =
    schedule.data?.races
      ?.filter((r) => new Date(r.race_datetime).getTime() > now.getTime())
      ?.slice(0, 3) ?? [];

  return (
    <View className="flex-1 bg-bg">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
            <Image
              source={require('../../assets/images/logo-f1hub.png')}
              style={{ width: 110, height: 40 }}
              contentFit="contain"
            />
            <Pressable className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-line">
              <Ionicons name="notifications-outline" size={20} color="#FAFAFA" />
            </Pressable>
          </View>

          {home.isLoading && (
            <View className="py-10 items-center">
              <ActivityIndicator color="#E10600" />
            </View>
          )}

          {home.isError && (
            <View className="mx-4 bg-surface rounded-xl p-4 border border-line">
              <Text className="text-red font-bold">Ошибка загрузки</Text>
              <Text className="text-muted text-xs mt-1">
                {home.error instanceof Error ? home.error.message : 'unknown'}
              </Text>
              <Pressable onPress={() => home.refetch()} className="mt-2">
                <Text className="text-text font-semibold">Повторить</Text>
              </Pressable>
            </View>
          )}

          {nextRace && (
            <>
              {/* Eyebrow */}
              <View className="flex-row items-center px-5 mt-3 mb-2">
                <View className="w-2 h-2 rounded-full bg-red mr-2" />
                <Text className="text-text text-[11px] font-bold tracking-[2px]">
                  СТАРТ ЧЕРЕЗ
                </Text>
              </View>

              {/* Countdown — live */}
              <Countdown iso={nextRace.race_datetime} now={now} />

              {/* Hero card */}
              <View className="mx-4 mt-5 rounded-2xl overflow-hidden border border-line">
                <ImageBackground
                  source={{ uri: nextRace.circuit_image }}
                  style={{ aspectRatio: 4 / 5 }}
                  imageStyle={{ opacity: 0.55 }}>
                  <View className="absolute inset-0 bg-bg/40" />
                  <Image
                    source={{ uri: CAR_OVERLAY }}
                    style={{ position: 'absolute', right: -30, top: 30, width: 320, height: 175 }}
                    contentFit="contain"
                  />
                  <View className="flex-1 justify-end p-5">
                    <View className="bg-red px-2.5 py-1 self-start rounded">
                      <Text className="text-text text-[10px] font-bold tracking-widest">
                        СЛЕДУЮЩИЙ ГРАН-ПРИ
                      </Text>
                    </View>
                    <Text className="text-text text-[30px] font-extrabold mt-3 leading-[1.05]">
                      {nextRace.name}
                    </Text>
                    <View className="flex-row items-center mt-3">
                      <Text className="text-base mr-2">{flagFor(nextRace.country_code)}</Text>
                      <Text className="text-text text-base font-semibold">
                        {nextRace.locality || nextRace.country}
                      </Text>
                    </View>
                    <Text className="text-muted text-[12px] mt-1 tracking-wider">
                      РАУНД {String(nextRace.round).padStart(2, '0')} · {home.data?.season ?? 2026}
                    </Text>
                    <Link href={`/race/${nextRace.round}` as never} asChild>
                      <Pressable className="bg-red rounded-xl py-3.5 mt-4 items-center active:opacity-80">
                        <Text className="text-text font-bold">Открыть гран-при</Text>
                      </Pressable>
                    </Link>
                  </View>
                </ImageBackground>
              </View>
            </>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <>
              <View className="px-5 mt-7 mb-3 flex-row items-center justify-between">
                <Text className="text-text text-xl font-extrabold">Ближайшие гонки</Text>
                <Link href="/calendar" asChild>
                  <Pressable className="flex-row items-center">
                    <Text className="text-muted text-sm font-semibold mr-1">Все</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A0A0B0" />
                  </Pressable>
                </Link>
              </View>
              <View className="px-4 gap-2">
                {upcoming.map((race) => (
                  <Link key={race.round} href={`/race/${race.round}` as never} asChild>
                    <Pressable className="bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80">
                      <Text className="text-2xl mr-3">{flagFor(race.country_code)}</Text>
                      <View className="flex-1">
                        <Text className="text-text font-bold">{race.name}</Text>
                        <Text className="text-muted text-xs mt-0.5">
                          {new Date(race.race_datetime).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                          })}
                        </Text>
                        <Text className="text-muted-2 text-xs">{race.locality}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                    </Pressable>
                  </Link>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Countdown({ iso, now }: { iso: string; now: Date }) {
  const { d, h, m, s } = countdownParts(iso, now);
  return (
    <View className="flex-row gap-2 px-5">
      {[
        { v: d, l: 'ДН' },
        { v: h, l: 'Ч' },
        { v: m, l: 'МИН' },
        { v: s, l: 'СЕК' },
      ].map((c) => (
        <View
          key={c.l}
          className="flex-1 bg-surface rounded-xl py-3 items-center border border-line">
          <Text className="text-text text-2xl font-extrabold">{c.v}</Text>
          <Text className="text-muted text-[10px] mt-0.5 tracking-widest">{c.l}</Text>
        </View>
      ))}
    </View>
  );
}
