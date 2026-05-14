import { Fragment, useEffect, useState } from 'react';
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

// Локальный, более тёмный фон чем глобальный bg-bg для главной.
const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

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
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
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
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: CARD_BG,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="notifications-outline" size={20} color="#FAFAFA" />
              <View
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: '#E10600',
                  borderWidth: 1.5,
                  borderColor: DARK_BG,
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
            <View
              className="mx-4 rounded-xl p-4"
              style={{ backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
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
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#E10600',
                    marginRight: 10,
                    shadowColor: '#E10600',
                    shadowOpacity: 0.9,
                    shadowRadius: 6,
                  }}
                />
                <Text className="text-text text-[11px] font-extrabold tracking-[3px]">
                  СТАРТ ЧЕРЕЗ
                </Text>
              </View>

              {/* Countdown */}
              <Countdown iso={nextRace.race_datetime} now={now} />

              {/* Hero card */}
              <HeroCard
                circuitImage={nextRace.circuit_image}
                name={nextRace.name}
                round={nextRace.round}
                season={home.data?.season ?? 2026}
                countryCode={nextRace.country_code}
                locality={nextRace.locality}
                country={nextRace.country}
              />
            </>
          )}

          {/* News — vertical list */}
          {topNews.length > 0 && (
            <>
              <View className="px-5 mt-7 mb-3 flex-row items-center justify-between">
                <Text className="text-text text-2xl font-extrabold italic">НОВОСТИ</Text>
                <Link href="/news" asChild>
                  <Pressable className="flex-row items-center">
                    <Text className="text-red text-xs font-extrabold tracking-widest mr-1">
                      ВСЕ НОВОСТИ
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#E10600" />
                  </Pressable>
                </Link>
              </View>
              <View className="px-4" style={{ gap: 10 }}>
                {topNews.map((post, i) => {
                  const image = post.image || post.photo;
                  const badge = (post.source || 'НОВОСТЬ').toUpperCase();
                  return (
                    <Pressable
                      key={i}
                      onPress={() =>
                        router.push(`/article?url=${encodeURIComponent(post.url)}` as never)
                      }
                      style={{
                        backgroundColor: CARD_BG,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}>
                      <View style={{ width: 110, height: 110, backgroundColor: '#1c1c28' }}>
                        {image ? (
                          <Image
                            source={{ uri: image }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Ionicons name="newspaper-outline" size={26} color="#6B6B7B" />
                          </View>
                        )}
                      </View>
                      <View className="flex-1 px-4 py-3">
                        <Text className="text-red text-[10px] font-extrabold tracking-widest">
                          {badge}
                        </Text>
                        <Text
                          className="text-text font-bold mt-1.5"
                          style={{ fontSize: 15, lineHeight: 19 }}
                          numberOfLines={2}>
                          {post.title}
                        </Text>
                        {post.published_at ? (
                          <Text
                            className="text-muted-2 mt-1.5"
                            style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: '700' }}>
                            {relativeTime(post.published_at).toUpperCase()}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ paddingRight: 16 }}>
                        <Ionicons name="chevron-forward" size={20} color="#E10600" />
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

// ============ COUNTDOWN ============

function Countdown({ iso, now }: { iso: string; now: Date }) {
  const { d, h, m, s } = countdownParts(iso, now);
  const cells = [
    { v: d, l: 'ДНЕЙ' },
    { v: h, l: 'ЧАСОВ' },
    { v: m, l: 'МИНУТ' },
    { v: s, l: 'СЕКУНД' },
  ];
  return (
    <View
      style={{
        marginHorizontal: 16,
        borderRadius: 24,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: 'rgba(225,6,0,0.18)',
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#E10600',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}>
      {cells.map((c, i) => (
        <Fragment key={c.l}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: 40,
                lineHeight: 44,
                fontWeight: '800',
                color: '#FAFAFA',
                letterSpacing: -0.5,
              }}>
              {c.v}
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: '#A0A0B0',
                marginTop: 4,
                letterSpacing: 2,
                fontWeight: '700',
              }}>
              {c.l}
            </Text>
          </View>
          {i < cells.length - 1 && <SlashSeparator />}
        </Fragment>
      ))}
    </View>
  );
}

function SlashSeparator() {
  return (
    <View
      style={{
        width: 22,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
      }}>
      <View
        style={{
          width: 3,
          height: 30,
          backgroundColor: '#E10600',
          borderRadius: 2,
          transform: [{ rotate: '20deg' }],
          marginRight: 3,
        }}
      />
      <View
        style={{
          width: 2,
          height: 20,
          backgroundColor: '#E10600',
          opacity: 0.4,
          borderRadius: 1,
          transform: [{ rotate: '20deg' }],
        }}
      />
    </View>
  );
}

// ============ HERO CARD ============

function HeroCard({
  circuitImage,
  name,
  round,
  season,
  countryCode,
  locality,
  country,
}: {
  circuitImage?: string;
  name: string;
  round: number;
  season: number;
  countryCode?: string;
  locality?: string;
  country?: string;
}) {
  const place = ruPlace(locality, country);

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 22,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(225,6,0,0.22)',
        backgroundColor: CARD_BG,
        shadowColor: '#E10600',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}>
      <ImageBackground
        source={circuitImage ? { uri: circuitImage } : undefined}
        style={{ aspectRatio: 0.86 }}
        imageStyle={{ opacity: 0.55 }}>
        {/* Vertical darkening: top is slightly visible, bottom is solid */}
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(10,10,18,0.45)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            top: '50%',
            backgroundColor: 'rgba(10,10,18,0.85)',
          }}
        />

        {/* Car — top-right, doesn't overlap the city skyline visible at very top */}
        <Image
          source={{ uri: CAR_OVERLAY }}
          style={{
            position: 'absolute',
            right: -50,
            top: '14%',
            width: 420,
            height: 280,
          }}
          contentFit="contain"
        />

        {/* Decorative red speed lines at bottom-right */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 24,
            bottom: 18,
            flexDirection: 'row',
            gap: 4,
          }}>
          <View style={{ width: 24, height: 3, backgroundColor: '#3A3A4A', borderRadius: 2 }} />
          <View style={{ width: 36, height: 3, backgroundColor: '#E10600', borderRadius: 2 }} />
          <View style={{ width: 18, height: 3, backgroundColor: '#E10600', opacity: 0.6, borderRadius: 2 }} />
        </View>

        {/* Content */}
        <View style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#E10600',
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 8,
            }}>
            <Text className="text-text text-[10px] font-extrabold tracking-[2px]">
              СЛЕДУЮЩИЙ ГРАН-ПРИ
            </Text>
          </View>

          <View>
            <Text
              style={{
                color: '#FAFAFA',
                fontSize: 44,
                lineHeight: 44,
                fontWeight: '800',
                letterSpacing: -1,
                textTransform: 'uppercase',
                fontStyle: 'italic',
              }}>
              {name.replace(/^Гран[- ]при\s+/i, 'Гран-при\n')}
            </Text>

            <View className="flex-row items-center mt-4">
              <Text style={{ fontSize: 18, marginRight: 8 }}>{flagFor(countryCode)}</Text>
              <Text className="text-text font-semibold" style={{ fontSize: 15 }}>
                {place}
              </Text>
            </View>
            <Text
              className="text-muted-2 mt-1.5"
              style={{ fontSize: 11, letterSpacing: 2, fontWeight: '700' }}>
              РАУНД {String(round).padStart(2, '0')} · {season}
            </Text>

            <Link href={`/race/${round}` as never} asChild>
              <Pressable
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 18,
                  backgroundColor: '#E10600',
                  paddingVertical: 14,
                  paddingHorizontal: 22,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#E10600',
                  shadowOpacity: 0.5,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}>
                <Text
                  className="text-text"
                  style={{ fontWeight: '800', fontSize: 13, letterSpacing: 1.5 }}>
                  ОТКРЫТЬ ГРАН-ПРИ
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#FAFAFA"
                  style={{ marginLeft: 8 }}
                />
              </Pressable>
            </Link>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

// ============ HELPERS ============

const CITY_RU: Record<string, string> = {
  Sakhir: 'Сахир',
  Jeddah: 'Джидда',
  Melbourne: 'Мельбурн',
  Suzuka: 'Судзука',
  Shanghai: 'Шанхай',
  Miami: 'Майами',
  Imola: 'Имола',
  Monaco: 'Монако',
  'Monte Carlo': 'Монте-Карло',
  Montréal: 'Монреаль',
  Montreal: 'Монреаль',
  Barcelona: 'Барселона',
  Spielberg: 'Шпильберг',
  Silverstone: 'Сильверстоун',
  Spa: 'Спа',
  'Spa-Francorchamps': 'Спа',
  Budapest: 'Будапешт',
  Mogyoród: 'Будапешт',
  Zandvoort: 'Зандворт',
  Monza: 'Монца',
  Baku: 'Баку',
  Singapore: 'Сингапур',
  Austin: 'Остин',
  'Mexico City': 'Мехико',
  'São Paulo': 'Сан-Паулу',
  'Sao Paulo': 'Сан-Паулу',
  'Las Vegas': 'Лас-Вегас',
  Lusail: 'Лусаил',
  'Yas Marina': 'Абу-Даби',
  'Abu Dhabi': 'Абу-Даби',
};

const COUNTRY_RU: Record<string, string> = {
  Bahrain: 'Бахрейн',
  'Saudi Arabia': 'Саудовская Аравия',
  Australia: 'Австралия',
  Japan: 'Япония',
  China: 'Китай',
  USA: 'США',
  'United States': 'США',
  Italy: 'Италия',
  Monaco: 'Монако',
  Canada: 'Канада',
  Spain: 'Испания',
  Austria: 'Австрия',
  UK: 'Великобритания',
  'United Kingdom': 'Великобритания',
  'Great Britain': 'Великобритания',
  Belgium: 'Бельгия',
  Hungary: 'Венгрия',
  Netherlands: 'Нидерланды',
  Azerbaijan: 'Азербайджан',
  Singapore: 'Сингапур',
  Mexico: 'Мексика',
  Brazil: 'Бразилия',
  Qatar: 'Катар',
  UAE: 'ОАЭ',
  'United Arab Emirates': 'ОАЭ',
};

function ruPlace(locality?: string, country?: string): string {
  const l = locality ? CITY_RU[locality] ?? locality : undefined;
  const c = country ? COUNTRY_RU[country] ?? country : undefined;
  if (l && c) return `${l}, ${c}`;
  return l || c || '';
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
