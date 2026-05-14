import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Link } from 'expo-router';
import { useBroadcasts, useRaceQualifying, useRaceResults, useSchedule, flagFor } from '@/lib/hooks';
import { videoThumbnail } from '@/lib/api';
import type { RaceResultDriver, QualifyingDriver } from '@/lib/api';
import { useSpoiler, CURRENT_SEASON, isSpoilerHidden } from '@/lib/spoiler';
import { SpoilerCard } from '@/components/SpoilerCard';

function broadcastProviderBadge(url: string): { label: string; color: string } {
  const u = url.toLowerCase();
  if (u.includes('youtu')) return { label: 'YT', color: '#FF0000' };
  if (u.includes('rutube')) return { label: 'RT', color: '#000000' };
  if (u.includes('vk.com') || u.includes('vkvideo')) return { label: 'VK', color: '#0077FF' };
  return { label: 'VIDEO', color: '#E10600' };
}

const SESSION_ORDER_FOR_BROADCAST = [
  'fp1', 'fp2', 'fp3', 'sprint_qualifying', 'sprint', 'qualifying', 'race', 'review',
] as const;

const SESSION_LABELS: Record<string, string> = {
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  qualifying: 'Квалификация',
  sprint_qualifying: 'Спринт-квалификация',
  sprint: 'Спринт',
  race: 'Гонка',
  review: 'Обзор',
};

const SESSION_SHORT: Record<string, string> = {
  fp1: 'FP1',
  fp2: 'FP2',
  fp3: 'FP3',
  qualifying: 'Квалификация',
  sprint_qualifying: 'Спринт-квалификация',
  sprint: 'Спринт',
  race: 'Гонка',
  review: 'Обзор',
};

const DAY_FMT = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const TIME_FMT = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export default function RaceDetail() {
  const { round } = useLocalSearchParams<{ round: string }>();
  const router = useRouter();
  const roundN = Number(round);

  const schedule = useSchedule();
  const race = schedule.data?.races.find((r) => r.round === roundN);
  const isPast = race ? new Date(race.race_datetime).getTime() < Date.now() : false;

  const results = useRaceResults(isPast ? roundN : null);
  const qualifying = useRaceQualifying(isPast ? roundN : null);
  const broadcasts = useBroadcasts();
  const raceBroadcasts = useMemo(() => {
    const list =
      broadcasts.data?.broadcasts.filter(
        (b) => b.race_round === roundN && b.season === CURRENT_SEASON,
      ) ?? [];
    return list.sort(
      (a, b) =>
        SESSION_ORDER_FOR_BROADCAST.indexOf(a.session_type as never) -
        SESSION_ORDER_FOR_BROADCAST.indexOf(b.session_type as never),
    );
  }, [broadcasts.data, roundN]);

  const spoilerEnabled = useSpoiler((s) => s.enabled);
  const spoilerHidden = isSpoilerHidden(CURRENT_SEASON, spoilerEnabled);
  const [revealResults, setRevealResults] = useState(false);
  const [revealQuali, setRevealQuali] = useState(false);

  const hasBroadcasts = raceBroadcasts.length > 0;
  const tabs = isPast
    ? hasBroadcasts
      ? (['Расписание', 'Результаты', 'Квалификация', 'Записи'] as const)
      : (['Расписание', 'Результаты', 'Квалификация'] as const)
    : hasBroadcasts
      ? (['Расписание', 'Записи'] as const)
      : (['Расписание'] as const);
  const [tab, setTab] = useState<string>(tabs[0]);

  // Group sessions by day. /api/schedule returns sessions as a dict
  // { fp1: { date, time }, qualifying: {...}, ... }, not an array.
  const sessionsByDay = useMemo(() => {
    if (!race?.sessions) return [];
    const SESSION_ORDER = [
      'fp1',
      'fp2',
      'fp3',
      'sprint_qualifying',
      'sprint',
      'qualifying',
      'race',
    ] as const;
    type S = (typeof SESSION_ORDER)[number];

    const entries: { datetime: Date; dayKey: string; type: S }[] = [];
    for (const type of SESSION_ORDER) {
      const s = race.sessions[type];
      if (!s?.date || !s?.time) continue;
      // time is like "16:00:00Z", date is "2026-05-01"
      const datetime = new Date(`${s.date}T${s.time.includes('Z') ? s.time : s.time + 'Z'}`);
      if (Number.isNaN(datetime.getTime())) continue;
      entries.push({ datetime, dayKey: datetime.toISOString().slice(0, 10), type });
    }
    entries.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    const map = new Map<string, { day: string; sessions: { time: string; label: string }[] }>();
    for (const e of entries) {
      if (!map.has(e.dayKey)) {
        const dayLabel = DAY_FMT.format(e.datetime);
        map.set(e.dayKey, {
          day: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1),
          sessions: [],
        });
      }
      map.get(e.dayKey)!.sessions.push({
        time: TIME_FMT.format(e.datetime),
        label: SESSION_LABELS[e.type] ?? e.type,
      });
    }
    return Array.from(map.values());
  }, [race]);

  if (!race) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

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
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10" numberOfLines={1}>
            {race.name}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          {/* Meta */}
          <View className="px-5 flex-row items-center mt-1 mb-3 flex-wrap">
            <Text className="text-2xl mr-2">{flagFor(race.country_code)}</Text>
            <Text className="text-text font-semibold mr-3">{race.locality || race.country}</Text>
            <Text className="text-muted text-sm">
              {new Date(race.date).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>

          {race.circuit_image && (
            <View className="mx-4 rounded-2xl overflow-hidden border border-line">
              <Image
                source={{ uri: race.circuit_image }}
                style={{ width: '100%', aspectRatio: 16 / 9 }}
                contentFit="cover"
              />
            </View>
          )}

          {/* Tabs */}
          <View className="flex-row gap-2 px-4 mt-5">
            {tabs.map((t) => {
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

          {tab === 'Расписание' && (
            <View className="px-4 mt-5">
              {sessionsByDay.length === 0 ? (
                <Text className="text-muted text-sm px-1">Расписание ещё не опубликовано</Text>
              ) : (
                sessionsByDay.map((day) => (
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
                ))
              )}
              {!isPast && (
                <Pressable className="bg-red rounded-xl py-4 mt-3 items-center active:opacity-80">
                  <Text className="text-text font-bold">Сделать прогноз</Text>
                </Pressable>
              )}
            </View>
          )}

          {tab === 'Результаты' && spoilerHidden && !revealResults && isPast && (
            <SpoilerCard
              label="Результаты гонки скрыты"
              onReveal={() => setRevealResults(true)}
            />
          )}

          {tab === 'Результаты' && (!spoilerHidden || revealResults || !isPast) && (
            <View className="px-4 mt-5">
              {results.isLoading && <ActivityIndicator color="#E10600" />}
              {results.isError && (
                <Text className="text-muted text-sm">Данных нет</Text>
              )}
              {results.data?.results && (
                <View className="bg-surface rounded-xl border border-line overflow-hidden">
                  {results.data.results.map((d: RaceResultDriver, i) => (
                    <View
                      key={d.driver_number}
                      className={`flex-row items-center px-3 py-3 ${
                        i < results.data!.results.length - 1 ? 'border-b border-line' : ''
                      }`}>
                      <Text className="text-text font-extrabold w-7 text-center">
                        {d.position}
                      </Text>
                      <View
                        className="w-1 h-8 rounded-full mx-2"
                        style={{ backgroundColor: d.team_color || '#666' }}
                      />
                      <View className="flex-1">
                        <Text className="text-text font-bold">{d.name}</Text>
                        <Text className="text-muted text-xs">
                          {d.team} · {d.code}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-text font-bold">{d.points} pts</Text>
                        <Text className="text-muted text-xs">
                          {d.is_dnf ? 'DNF' : d.gap || '—'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {tab === 'Квалификация' && spoilerHidden && !revealQuali && isPast && (
            <SpoilerCard
              label="Результаты квалификации скрыты"
              onReveal={() => setRevealQuali(true)}
            />
          )}

          {tab === 'Квалификация' && (!spoilerHidden || revealQuali || !isPast) && (
            <View className="px-4 mt-5">
              {qualifying.isLoading && <ActivityIndicator color="#E10600" />}
              {qualifying.isError && <Text className="text-muted text-sm">Данных нет</Text>}
              {qualifying.data?.results && (
                <View className="bg-surface rounded-xl border border-line overflow-hidden">
                  {qualifying.data.results.map((d: QualifyingDriver, i) => (
                    <View
                      key={d.driver_number}
                      className={`flex-row items-center px-3 py-3 ${
                        i < qualifying.data!.results.length - 1 ? 'border-b border-line' : ''
                      }`}>
                      <Text className="text-text font-extrabold w-7 text-center">
                        {d.position}
                      </Text>
                      <View
                        className="w-1 h-8 rounded-full mx-2"
                        style={{ backgroundColor: d.team_color || '#666' }}
                      />
                      <View className="flex-1">
                        <Text className="text-text font-bold">{d.name}</Text>
                        <Text className="text-muted text-xs">{d.team}</Text>
                      </View>
                      <Text className="text-text font-bold tabular-nums">
                        {d.q3 || d.q2 || d.q1 || '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {tab === 'Записи' && (
            <View className="px-4 mt-5 gap-2">
              {raceBroadcasts.map((b) => {
                const sessionLabel = SESSION_SHORT[b.session_type] ?? b.session_type;
                const thumb = videoThumbnail(b.video_url, b.embed_url);
                const prov = broadcastProviderBadge(b.video_url || b.embed_url || '');
                return (
                  <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                    <Pressable className="bg-surface rounded-xl border border-line flex-row items-center active:opacity-80 overflow-hidden">
                      <View
                        style={{
                          width: 112,
                          aspectRatio: 16 / 9,
                          backgroundColor: '#1c1c28',
                          position: 'relative',
                        }}>
                        {thumb ? (
                          <Image
                            source={{ uri: thumb }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Ionicons name="film" size={24} color="#6B6B7B" />
                          </View>
                        )}
                        <View
                          style={{
                            position: 'absolute',
                            left: 4,
                            top: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 2,
                            borderRadius: 4,
                            backgroundColor: prov.color,
                          }}>
                          <Text className="text-text text-[8px] font-extrabold tracking-widest">
                            {prov.label}
                          </Text>
                        </View>
                        <View
                          style={{
                            position: 'absolute',
                            inset: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: 'rgba(0,0,0,0.55)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                            <Ionicons name="play" size={16} color="#fff" />
                          </View>
                        </View>
                      </View>
                      <View className="flex-1 py-3 pl-3 pr-2">
                        <Text className="text-text font-bold" numberOfLines={1}>
                          {sessionLabel} · {race.name?.replace('Гран-при ', '')}
                        </Text>
                        <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                          {SESSION_LABELS[b.session_type] ?? b.session_type}
                        </Text>
                      </View>
                      {b.is_live ? (
                        <View className="bg-red px-1.5 py-0.5 rounded mr-2">
                          <Text className="text-text text-[9px] font-extrabold tracking-widest">
                            LIVE
                          </Text>
                        </View>
                      ) : null}
                      <View className="pr-3">
                        <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
