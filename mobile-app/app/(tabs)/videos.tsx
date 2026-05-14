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

// Canonical session ordering — Race first (most popular), then Quali, then sprints, then practices, reviews
const SESSION_ORDER = [
  'race',
  'qualifying',
  'sprint',
  'sprint_qualifying',
  'fp3',
  'fp2',
  'fp1',
  'review',
] as const;

const SESSION_META: Record<
  string,
  { label: string; plural: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  race: { label: 'Гонка', plural: 'Гонки', icon: 'trophy' },
  qualifying: { label: 'Квалификация', plural: 'Квалификации', icon: 'speedometer' },
  sprint: { label: 'Спринт', plural: 'Спринты', icon: 'flash' },
  sprint_qualifying: {
    label: 'Спринт-квалификация',
    plural: 'Спринт-квалификации',
    icon: 'flash-outline',
  },
  fp1: { label: 'FP1', plural: 'Свободные практики', icon: 'stopwatch' },
  fp2: { label: 'FP2', plural: 'Свободные практики', icon: 'stopwatch' },
  fp3: { label: 'FP3', plural: 'Свободные практики', icon: 'stopwatch' },
  review: { label: 'Обзор', plural: 'Обзоры', icon: 'film' },
};

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'race', label: 'Гонки' },
  { id: 'qualifying', label: 'Квалификации' },
  { id: 'sprint', label: 'Спринты' },
  { id: 'review', label: 'Обзоры' },
  { id: 'practice', label: 'Практики' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

function matchesFilter(b: Broadcast, f: FilterId): boolean {
  if (f === 'all') return true;
  if (f === 'sprint') return b.session_type === 'sprint' || b.session_type === 'sprint_qualifying';
  if (f === 'practice') return b.session_type === 'fp1' || b.session_type === 'fp2' || b.session_type === 'fp3';
  return b.session_type === f;
}

export default function VideosScreen() {
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<FilterId>('all');
  const broadcasts = useBroadcasts();
  const live = useLiveBroadcasts();
  const schedule = useSchedule();

  const raceByKey = useMemo(() => {
    const m = new Map<string, { name: string; country_code?: string }>();
    schedule.data?.races.forEach((r) =>
      m.set(`${r.round}-${schedule.data?.season}`, {
        name: r.name,
        country_code: r.country_code,
      }),
    );
    return m;
  }, [schedule.data]);

  // Group by session_type (gradation), then within each group sort by season desc, round desc
  const grouped = useMemo(() => {
    const list = (broadcasts.data?.broadcasts ?? []).filter((b) => matchesFilter(b, filter));
    const m = new Map<string, Broadcast[]>();
    for (const b of list) {
      if (!m.has(b.session_type)) m.set(b.session_type, []);
      m.get(b.session_type)!.push(b);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => b.season - a.season || b.race_round - a.race_round);
    }
    return SESSION_ORDER.filter((t) => m.has(t)).map((t) => [t, m.get(t)!] as const);
  }, [broadcasts.data, filter]);

  const liveList = live.data?.broadcasts ?? [];

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
            {liveList.map((b) => (
              <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                <Pressable className="bg-red rounded-2xl p-4 active:opacity-80 flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-text mr-2.5" />
                  <Text className="text-text text-[10px] font-extrabold tracking-widest mr-3">
                    LIVE
                  </Text>
                  <View className="flex-1">
                    <Text className="text-text font-bold" numberOfLines={1}>
                      {b.title ?? SESSION_META[b.session_type]?.label}
                    </Text>
                    <Text className="text-text text-xs opacity-80">
                      Раунд {b.race_round} · {SESSION_META[b.session_type]?.label}
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={28} color="#FAFAFA" />
                </Pressable>
              </Link>
            ))}
          </View>
        )}

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 8,
            alignItems: 'center',
          }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full ${
                  active ? 'bg-red' : 'bg-surface border border-line'
                }`}>
                <Text
                  className={`text-xs font-bold ${active ? 'text-text' : 'text-muted'}`}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

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
              <Text className="text-muted text-sm mt-2">Трансляций пока нет</Text>
            </View>
          )}

          {grouped.map(([sessionType, items]) => {
            const meta = SESSION_META[sessionType] ?? {
              label: sessionType,
              plural: sessionType,
              icon: 'film' as const,
            };
            return (
              <View key={sessionType} className="mb-6">
                {/* Section header per gradation */}
                <View className="flex-row items-center px-5 mb-3">
                  <View className="w-9 h-9 rounded-full bg-red/15 items-center justify-center">
                    <Ionicons name={meta.icon} size={18} color="#E10600" />
                  </View>
                  <Text className="text-text text-xl font-extrabold ml-3 flex-1">
                    {meta.plural}
                  </Text>
                  <Text className="text-muted text-sm font-semibold">{items.length}</Text>
                </View>
                <View className="px-4 gap-2">
                  {items.map((b) => {
                    const race = raceByKey.get(`${b.race_round}-${b.season}`);
                    return (
                      <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                        <Pressable className="bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80">
                          <View className="w-11 h-11 rounded-full bg-surface-2 items-center justify-center">
                            <Ionicons name="play" size={18} color="#E10600" />
                          </View>
                          <View className="flex-1 ml-3">
                            <View className="flex-row items-center">
                              <Text className="text-text font-bold flex-1" numberOfLines={1}>
                                {b.title ?? race?.name ?? `Раунд ${b.race_round}`}
                              </Text>
                              {b.is_live ? (
                                <View className="bg-red px-1.5 py-0.5 rounded ml-2">
                                  <Text className="text-text text-[9px] font-extrabold tracking-widest">
                                    LIVE
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <View className="flex-row items-center mt-1">
                              <Text className="text-muted text-xs font-bold mr-2">
                                R{String(b.race_round).padStart(2, '0')}
                              </Text>
                              {race?.country_code && (
                                <Text className="text-sm mr-1.5">
                                  {flagFor(race.country_code)}
                                </Text>
                              )}
                              <Text className="text-muted text-xs flex-1" numberOfLines={1}>
                                {race?.name ?? '—'}
                              </Text>
                              <Text className="text-muted-2 text-xs ml-2">{b.season}</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                        </Pressable>
                      </Link>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
