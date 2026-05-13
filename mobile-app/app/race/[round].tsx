import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useRaceQualifying, useRaceResults, useSchedule, flagFor } from '@/lib/hooks';
import type { RaceResultDriver, QualifyingDriver } from '@/lib/api';

const SESSION_LABELS: Record<string, string> = {
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  qualifying: 'Квалификация',
  sprint_qualifying: 'Спринт-квалификация',
  sprint: 'Спринт',
  race: 'Гонка',
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

  const baseTabs = ['Расписание'] as const;
  const tabs = isPast ? (['Расписание', 'Результаты', 'Квалификация'] as const) : baseTabs;
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

          {tab === 'Результаты' && (
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

          {tab === 'Квалификация' && (
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
