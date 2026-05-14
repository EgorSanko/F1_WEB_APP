import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { useHome, useNews, useSchedule, flagFor, countdownParts } from '@/lib/hooks';
import { CURRENT_SEASON, isSpoilerHidden, useSpoiler } from '@/lib/spoiler';
import { router } from 'expo-router';

const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

export default function HomeScreen() {
  const home = useHome();
  const schedule = useSchedule();
  const news = useNews();
  const spoilerEnabled = useSpoiler((s) => s.enabled);
  const spoilerHidden = isSpoilerHidden(CURRENT_SEASON, spoilerEnabled);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextRace = home.data?.next_race;
  const topNews = news.data?.posts?.slice(0, 4) ?? [];

  return (
    <View className="flex-1 bg-bg">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={(home.isFetching && !home.isLoading) || (schedule.isFetching && !schedule.isLoading)}
              onRefresh={() => {
                home.refetch();
                schedule.refetch();
              }}
              tintColor="#E10600"
              colors={['#E10600']}
            />
          }>
          {/* Header */}
          <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
            <Image
              source={require('../../assets/images/logo-f1hub.png')}
              style={{ width: 110, height: 40 }}
              contentFit="contain"
            />
            <Pressable
              onPress={() => router.push('/notifications' as never)}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-line active:opacity-80">
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

          {/* Standings top-3 quick links */}
          {home.data?.standings_top3 && home.data.standings_top3.length > 0 && !spoilerHidden && (
            <>
              <View className="px-5 mt-7 mb-3 flex-row items-center justify-between">
                <Text className="text-text text-xl font-extrabold">Таблица сезона</Text>
                <Link href="/standings" asChild>
                  <Pressable className="flex-row items-center">
                    <Text className="text-muted text-sm font-semibold mr-1">Все</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A0A0B0" />
                  </Pressable>
                </Link>
              </View>
              <View className="px-4 gap-2">
                {home.data.standings_top3.slice(0, 3).map((d, i) => (
                  <Link key={d.driver_number} href={`/driver/${d.driver_number}` as never} asChild>
                    <Pressable className="bg-surface rounded-xl p-3 border border-line flex-row items-center active:opacity-80">
                      <Text
                        className="font-extrabold w-7 text-center"
                        style={{
                          color: i === 0 ? '#FFCB05' : i === 1 ? '#C0C0C0' : '#CD7F32',
                        }}>
                        {i + 1}
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
                      <Text className="text-text font-extrabold">{d.points}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </>
          )}

          {/* Latest news */}
          {topNews.length > 0 && (
            <>
              <View className="px-5 mt-7 mb-3 flex-row items-center justify-between">
                <Text className="text-text text-xl font-extrabold">Новости</Text>
                <Link href="/news" asChild>
                  <Pressable className="flex-row items-center">
                    <Text className="text-muted text-sm font-semibold mr-1">Все</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A0A0B0" />
                  </Pressable>
                </Link>
              </View>
              <View className="px-4 gap-2">
                {topNews.map((post, i) => {
                  const image = post.image || post.photo;
                  return (
                    <Pressable
                      key={i}
                      onPress={() =>
                        router.push(`/article?url=${encodeURIComponent(post.url)}` as never)
                      }
                      className="bg-surface rounded-xl overflow-hidden border border-line flex-row items-center active:opacity-80">
                      {image ? (
                        <Image
                          source={{ uri: image }}
                          style={{ width: 100, height: 84 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          className="bg-surface-2 items-center justify-center"
                          style={{ width: 100, height: 84 }}>
                          <Ionicons name="newspaper-outline" size={24} color="#6B6B7B" />
                        </View>
                      )}
                      <View className="flex-1 p-3">
                        {post.source ? (
                          <Text className="text-muted text-[10px] uppercase tracking-widest font-bold">
                            {post.source}
                          </Text>
                        ) : null}
                        <Text className="text-text font-semibold text-sm mt-0.5" numberOfLines={2}>
                          {post.title}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
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
