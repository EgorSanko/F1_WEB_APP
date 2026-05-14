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

const SESSION_LABEL: Record<string, string> = {
  race: 'Гонка',
  qualifying: 'Квалификация',
  sprint: 'Спринт',
  sprint_qualifying: 'Спринт-квалификация',
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  review: 'Обзор',
};

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'race', label: 'Гонки' },
  { id: 'qualifying', label: 'Квалификации' },
  { id: 'sprint', label: 'Спринты' },
] as const;

type FilterId = (typeof FILTERS)[number]['id'];

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

  // Filter + group by (race_round, season)
  const grouped = useMemo(() => {
    let list = broadcasts.data?.broadcasts ?? [];
    if (filter !== 'all') {
      list = list.filter((b) =>
        filter === 'sprint'
          ? b.session_type === 'sprint' || b.session_type === 'sprint_qualifying'
          : b.session_type === filter,
      );
    }
    const m = new Map<string, Broadcast[]>();
    for (const b of list) {
      const key = `${b.race_round}-${b.season}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(b);
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      const [ra, sa] = a.split('-').map(Number);
      const [rb, sb] = b.split('-').map(Number);
      return sb - sa || rb - ra;
    });
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
                  <View className="w-2.5 h-2.5 rounded-full bg-text mr-2.5">
                    <View className="absolute inset-0 rounded-full bg-text animate-pulse" />
                  </View>
                  <Text className="text-text text-[10px] font-extrabold tracking-widest mr-3">
                    LIVE
                  </Text>
                  <View className="flex-1">
                    <Text className="text-text font-bold" numberOfLines={1}>
                      {b.title ?? SESSION_LABEL[b.session_type]}
                    </Text>
                    <Text className="text-text text-xs opacity-80">
                      Раунд {b.race_round} · {SESSION_LABEL[b.session_type]}
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
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}>
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

          {grouped.map(([key, items]) => {
            const race = raceByKey.get(key);
            const [round, season] = key.split('-').map(Number);
            return (
              <View key={key} className="mb-5">
                <View className="flex-row items-center px-5 mb-2">
                  <Text className="text-text text-base font-extrabold mr-2">
                    R{String(round).padStart(2, '0')}
                  </Text>
                  {race?.country_code && (
                    <Text className="text-xl mr-2">{flagFor(race.country_code)}</Text>
                  )}
                  <Text className="text-text font-bold flex-1" numberOfLines={1}>
                    {race?.name ?? `Гран-при ${round}`}
                  </Text>
                  <Text className="text-muted-2 text-xs">{season}</Text>
                </View>
                <View className="px-4 gap-2">
                  {items.map((b) => (
                    <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                      <Pressable className="bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80">
                        <View className="w-11 h-11 rounded-full bg-surface-2 items-center justify-center">
                          <Ionicons name="play" size={18} color="#E10600" />
                        </View>
                        <View className="flex-1 ml-3">
                          <Text className="text-text font-bold" numberOfLines={1}>
                            {b.title ?? `${SESSION_LABEL[b.session_type]} ${season}`}
                          </Text>
                          <View className="flex-row items-center mt-0.5">
                            <Text className="text-muted text-xs">
                              {SESSION_LABEL[b.session_type] ?? b.session_type}
                            </Text>
                            {b.is_live ? (
                              <View className="bg-red px-1.5 py-0.5 rounded ml-2">
                                <Text className="text-text text-[9px] font-extrabold tracking-widest">
                                  LIVE
                                </Text>
                              </View>
                            ) : null}
                          </View>
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
