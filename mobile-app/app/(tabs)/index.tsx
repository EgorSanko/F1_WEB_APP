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
import { Link, router } from 'expo-router';

import { useHome, useNews, useSchedule, flagFor, countdownParts } from '@/lib/hooks';

const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

export default function HomeScreen() {
  const home = useHome();
  const schedule = useSchedule();
  const news = useNews();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextRace = home.data?.next_race;
  const topNews = news.data?.posts?.slice(0, 8) ?? [];

  return (
    <View className="flex-1 bg-bg">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={
                (home.isFetching && !home.isLoading) ||
                (schedule.isFetching && !schedule.isLoading)
              }
              onRefresh={() => {
                home.refetch();
                schedule.refetch();
                news.refetch();
              }}
              tintColor="#E10600"
              colors={['#E10600']}
            />
          }>
          {/* Header */}
          <View className="px-5 pt-2 pb-4 flex-row items-center justify-between">
            <Image
              source={require('../../assets/images/logo-f1hub.png')}
              style={{ width: 110, height: 40 }}
              contentFit="contain"
            />
            <Pressable
              onPress={() => router.push('/notifications' as never)}
              className="w-11 h-11 rounded-full bg-surface items-center justify-center border border-line active:opacity-80">
              <Ionicons name="notifications-outline" size={20} color="#FAFAFA" />
              <View
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#E10600',
                  borderWidth: 1,
                  borderColor: '#15151E',
                }}
              />
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
              <View className="flex-row items-center px-5 mb-3">
                <View className="w-2 h-2 rounded-full bg-red mr-2" />
                <Text className="text-text text-[11px] font-bold tracking-[3px]">
                  СТАРТ ЧЕРЕЗ
                </Text>
              </View>

              {/* Countdown */}
              <Countdown iso={nextRace.race_datetime} now={now} />

              {/* Hero card */}
              <View className="mx-4 mt-6 rounded-3xl overflow-hidden border border-line">
                <ImageBackground
                  source={{ uri: nextRace.circuit_image }}
                  style={{ aspectRatio: 0.82 }}
                  imageStyle={{ opacity: 0.35 }}>
                  {/* Dark vertical gradient overlay (cheap: two stacked views) */}
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(10,10,16,0.55)',
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: '55%',
                      backgroundColor: 'rgba(10,10,16,0.85)',
                    }}
                  />

                  {/* Car */}
                  <Image
                    source={{ uri: CAR_OVERLAY }}
                    style={{
                      position: 'absolute',
                      right: -40,
                      top: '38%',
                      width: 380,
                      height: 220,
                    }}
                    contentFit="contain"
                  />

                  {/* Content */}
                  <View className="flex-1 justify-end p-5">
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: '#E10600',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 6,
                      }}>
                      <Text className="text-text text-[10px] font-extrabold tracking-[2px]">
                        СЛЕДУЮЩИЙ ГРАН-ПРИ
                      </Text>
                    </View>
                    <Text
                      className="text-text font-extrabold mt-3"
                      style={{ fontSize: 34, lineHeight: 36 }}>
                      {nextRace.name}
                    </Text>
                    <View className="flex-row items-center mt-3">
                      <Text className="text-lg mr-2">{flagFor(nextRace.country_code)}</Text>
                      <Text className="text-text text-base font-semibold">
                        {nextRace.locality || nextRace.country}
                      </Text>
                    </View>
                    <Text className="text-muted-2 text-[12px] mt-1.5 tracking-wider">
                      Раунд {String(nextRace.round).padStart(2, '0')} ·{' '}
                      {home.data?.season ?? 2026}
                    </Text>
                    <Link href={`/race/${nextRace.round}` as never} asChild>
                      <Pressable className="bg-red rounded-2xl mt-5 active:opacity-80 flex-row items-center justify-center"
                        style={{ paddingVertical: 16 }}>
                        <Text className="text-text font-bold text-base">Открыть гран-при</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#FAFAFA"
                          style={{ marginLeft: 6 }}
                        />
                      </Pressable>
                    </Link>
                  </View>
                </ImageBackground>
              </View>
            </>
          )}

          {/* News — horizontal scroll */}
          {topNews.length > 0 && (
            <>
              <View className="px-5 mt-8 mb-3 flex-row items-center justify-between">
                <Text className="text-text text-2xl font-extrabold">Новости</Text>
                <Link href="/news" asChild>
                  <Pressable className="flex-row items-center">
                    <Text className="text-muted text-sm font-semibold mr-1">Смотреть все</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A0A0B0" />
                  </Pressable>
                </Link>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                {topNews.map((post, i) => {
                  const image = post.image || post.photo;
                  const badge = (post.source || 'НОВОСТЬ').toUpperCase();
                  return (
                    <Pressable
                      key={i}
                      onPress={() =>
                        router.push(`/article?url=${encodeURIComponent(post.url)}` as never)
                      }
                      className="bg-surface rounded-2xl overflow-hidden border border-line active:opacity-80"
                      style={{ width: 240 }}>
                      <View style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: '#1c1c28', position: 'relative' }}>
                        {image ? (
                          <Image
                            source={{ uri: image }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Ionicons name="newspaper-outline" size={28} color="#6B6B7B" />
                          </View>
                        )}
                        <View
                          style={{
                            position: 'absolute',
                            left: 10,
                            bottom: 10,
                            backgroundColor: '#E10600',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 5,
                          }}>
                          <Text className="text-text text-[9px] font-extrabold tracking-widest">
                            {badge}
                          </Text>
                        </View>
                      </View>
                      <View className="p-3.5">
                        <Text className="text-text font-bold text-[15px]" numberOfLines={2} style={{ lineHeight: 19 }}>
                          {post.title}
                        </Text>
                        {post.published_at ? (
                          <Text className="text-muted-2 text-xs mt-2">
                            {relativeTime(post.published_at)}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Countdown({ iso, now }: { iso: string; now: Date }) {
  const { d, h, m, s } = countdownParts(iso, now);
  const cells = [
    { v: d, l: 'ДНЕЙ' },
    { v: h, l: 'ЧАСОВ' },
    { v: m, l: 'МИНУТ' },
    { v: s, l: 'СЕКУНД' },
  ];
  return (
    <View className="flex-row px-4" style={{ gap: 8 }}>
      {cells.map((c, i) => (
        <View key={c.l} style={{ flex: 1, position: 'relative' }}>
          <View
            className="bg-surface rounded-2xl items-center border border-line"
            style={{ paddingVertical: 18 }}>
            <Text className="text-text font-extrabold" style={{ fontSize: 32, lineHeight: 34 }}>
              {c.v}
            </Text>
            <Text className="text-muted text-[10px] mt-1 tracking-[2px] font-semibold">
              {c.l}
            </Text>
          </View>
          {i < cells.length - 1 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: -6,
                top: '35%',
                bottom: '35%',
                width: 2,
                backgroundColor: '#E10600',
                opacity: 0.45,
                borderRadius: 1,
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const word = h === 1 ? 'час' : h < 5 ? 'часа' : 'часов';
    return `${h} ${word} назад`;
  }
  const d = Math.floor(h / 24);
  if (d < 7) {
    const word = d === 1 ? 'день' : d < 5 ? 'дня' : 'дней';
    return `${d} ${word} назад`;
  }
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
