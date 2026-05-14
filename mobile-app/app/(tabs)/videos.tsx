import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';

import {
  useBroadcasts,
  useLiveBroadcasts,
  useSchedule,
  flagFor,
} from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import type { Broadcast } from '@/lib/api';

const CURRENT_SEASON = 2026;

// Canonical session order WITHIN a race weekend (chronological)
const SESSION_ORDER = [
  'fp1',
  'fp2',
  'fp3',
  'sprint_qualifying',
  'sprint',
  'qualifying',
  'race',
  'review',
] as const;

const SESSION_LABEL: Record<string, string> = {
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  sprint_qualifying: 'Спринт-квалификация',
  sprint: 'Спринт',
  qualifying: 'Квалификация',
  race: 'Гонка',
  review: 'Обзор',
};

const SESSION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  fp1: 'stopwatch-outline',
  fp2: 'stopwatch-outline',
  fp3: 'stopwatch-outline',
  sprint_qualifying: 'flash-outline',
  sprint: 'flash',
  qualifying: 'speedometer',
  race: 'trophy',
  review: 'film',
};

function sessionIndex(type: string): number {
  const i = SESSION_ORDER.indexOf(type as (typeof SESSION_ORDER)[number]);
  return i === -1 ? 99 : i;
}

export default function VideosScreen() {
  const { isAdmin } = useAuth();
  const broadcasts = useBroadcasts();
  const live = useLiveBroadcasts();
  const schedule = useSchedule();

  const raceByRound = useMemo(() => {
    const m = new Map<number, { name: string; country_code?: string; date: string }>();
    schedule.data?.races.forEach((r) =>
      m.set(r.round, { name: r.name, country_code: r.country_code, date: r.date }),
    );
    return m;
  }, [schedule.data]);

  // Group by race_round. Only CURRENT_SEASON. Sort sessions inside by canonical order.
  const grouped = useMemo(() => {
    const list = (broadcasts.data?.broadcasts ?? []).filter(
      (b) => b.season === CURRENT_SEASON,
    );
    const m = new Map<number, Broadcast[]>();
    for (const b of list) {
      if (!m.has(b.race_round)) m.set(b.race_round, []);
      m.get(b.race_round)!.push(b);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => sessionIndex(a.session_type) - sessionIndex(b.session_type));
    }
    return Array.from(m.entries()).sort(([a], [b]) => b - a); // newest race first
  }, [broadcasts.data]);

  const liveList = (live.data?.broadcasts ?? []).filter((b) => b.season === CURRENT_SEASON);

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <Text className="text-text text-3xl font-extrabold">Видео</Text>
          {isAdmin && (
            <Pressable
              onPress={() => router.push('/admin/broadcasts' as never)}
              className="flex-row items-center bg-red rounded-full px-3 py-1.5">
              <Ionicons name="add" size={16} color="#FAFAFA" />
              <Text className="text-text text-xs font-bold ml-1">Управление</Text>
            </Pressable>
          )}
        </View>

        {/* Live banner */}
        {liveList.length > 0 && (
          <View className="mx-4 mb-3">
            {liveList.map((b) => {
              const race = raceByRound.get(b.race_round);
              return (
                <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                  <Pressable className="bg-red rounded-2xl p-4 active:opacity-80 flex-row items-center">
                    <View className="w-2.5 h-2.5 rounded-full bg-text mr-2.5" />
                    <Text className="text-text text-[10px] font-extrabold tracking-widest mr-3">
                      LIVE
                    </Text>
                    <View className="flex-1">
                      <Text className="text-text font-bold" numberOfLines={1}>
                        {SESSION_LABEL[b.session_type]} · {race?.name ?? `Раунд ${b.race_round}`}
                      </Text>
                    </View>
                    <Ionicons name="play-circle" size={28} color="#FAFAFA" />
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {broadcasts.isLoading && (
            <View className="py-10 items-center">
              <ActivityIndicator color="#E10600" />
            </View>
          )}

          {!broadcasts.isLoading && grouped.length === 0 && (
            <View className="px-5 py-10 items-center">
              <Ionicons name="film-outline" size={36} color="#6B6B7B" />
              <Text className="text-muted text-sm mt-2">Записей сезона {CURRENT_SEASON} пока нет</Text>
            </View>
          )}

          {grouped.map(([round, items]) => {
            const race = raceByRound.get(round);
            return (
              <View key={round} className="mb-6">
                {/* Race section header */}
                <View className="flex-row items-center px-5 mb-3">
                  <Text className="text-2xl mr-2">
                    {race?.country_code ? flagFor(race.country_code) : '🏁'}
                  </Text>
                  <View className="flex-1">
                    <Text className="text-text text-xl font-extrabold" numberOfLines={1}>
                      {race?.name ?? `Гран-при ${round}`}
                    </Text>
                    <Text className="text-muted text-xs mt-0.5">
                      Раунд {String(round).padStart(2, '0')} · {CURRENT_SEASON} · {items.length}{' '}
                      {items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}
                    </Text>
                  </View>
                </View>

                {/* Sessions in canonical order */}
                <View className="px-4 gap-2">
                  {items.map((b) => (
                    <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                      <Pressable className="bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80">
                        <View className="w-11 h-11 rounded-full bg-red/15 items-center justify-center">
                          <Ionicons
                            name={SESSION_ICON[b.session_type] ?? 'film'}
                            size={20}
                            color="#E10600"
                          />
                        </View>
                        <View className="flex-1 ml-3">
                          <View className="flex-row items-center">
                            <Text className="text-text font-bold flex-1" numberOfLines={1}>
                              {SESSION_LABEL[b.session_type] ?? b.session_type} ·{' '}
                              {race?.name?.replace('Гран-при ', '')}
                            </Text>
                            {b.is_live ? (
                              <View className="bg-red px-1.5 py-0.5 rounded ml-2">
                                <Text className="text-text text-[9px] font-extrabold tracking-widest">
                                  LIVE
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-muted text-xs mt-0.5">
                            {SESSION_LABEL[b.session_type]}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
