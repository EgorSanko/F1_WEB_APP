import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { useSchedule, flagFor } from '@/lib/hooks';

const TABS = ['Все', 'Ближайшие', 'Прошедшие'] as const;

export default function CalendarScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Все');
  const schedule = useSchedule();
  const now = new Date();

  const filtered = useMemo(() => {
    const races = schedule.data?.races ?? [];
    if (tab === 'Ближайшие') {
      return races.filter((r) => new Date(r.race_datetime).getTime() > now.getTime());
    }
    if (tab === 'Прошедшие') {
      return races.filter((r) => new Date(r.race_datetime).getTime() <= now.getTime());
    }
    return races;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, schedule.data]);

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <Text className="text-text text-3xl font-extrabold">Календарь</Text>
          <View className="flex-row items-center bg-surface rounded-full px-3 py-1.5 border border-line">
            <Text className="text-text text-sm font-semibold mr-1">
              {schedule.data?.season ?? 2026}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#A0A0B0" />
          </View>
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

        {schedule.isLoading && (
          <View className="py-10 items-center">
            <ActivityIndicator color="#E10600" />
          </View>
        )}

        {schedule.isError && (
          <View className="mx-4 bg-surface rounded-xl p-4 border border-line">
            <Text className="text-red font-bold">Ошибка загрузки</Text>
            <Pressable onPress={() => schedule.refetch()} className="mt-2">
              <Text className="text-text font-semibold">Повторить</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={schedule.isFetching && !schedule.isLoading}
              onRefresh={() => schedule.refetch()}
              tintColor="#E10600"
              colors={['#E10600']}
            />
          }>
          {filtered.map((race) => {
            const isPast = new Date(race.race_datetime).getTime() <= now.getTime();
            return (
              <Link key={race.round} href={`/race/${race.round}` as never} asChild>
                <Pressable
                  className={`bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80 ${
                    isPast ? 'opacity-60' : ''
                  }`}>
                  <Text className="text-text text-2xl font-extrabold w-9">
                    {String(race.round).padStart(2, '0')}
                  </Text>
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
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
