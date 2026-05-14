import { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useSchedule, flagFor } from '@/lib/hooks';
import { VideoPlayer } from '@/components/VideoPlayer';

const SESSION_LABEL: Record<string, string> = {
  race: 'Гонка',
  qualifying: 'Квалификация',
  sprint: 'Спринт',
  sprint_qualifying: 'Спринт-квалификация',
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
};

export default function BroadcastDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const schedule = useSchedule();
  const broadcastId = Number(id);

  // No direct /api/broadcast/{id} — pull from list and find by id
  const list = useQuery({
    queryKey: ['broadcasts'],
    queryFn: api.broadcasts,
  });

  const b = useMemo(
    () => list.data?.broadcasts.find((x) => x.id === broadcastId),
    [list.data, broadcastId],
  );

  const race = b ? schedule.data?.races.find((r) => r.round === b.race_round) : null;

  if (list.isLoading || !b) {
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
            {b.title ?? SESSION_LABEL[b.session_type] ?? 'Трансляция'}
          </Text>
        </View>

        <VideoPlayer
          videoUrl={b.video_url}
          embedUrl={b.embed_url}
          title={b.title ?? SESSION_LABEL[b.session_type] ?? 'Трансляция'}
        />

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <View className="px-5 pt-4">
            {b.is_live ? (
              <View className="flex-row items-center mb-2">
                <View className="w-2 h-2 rounded-full bg-red mr-2" />
                <Text className="text-red text-[11px] font-extrabold tracking-widest">
                  LIVE
                </Text>
              </View>
            ) : null}
            <Text className="text-text text-xl font-extrabold">
              {b.title ?? `${SESSION_LABEL[b.session_type]} ${b.season}`}
            </Text>
            <View className="flex-row items-center mt-1.5 flex-wrap">
              {race?.country_code && (
                <Text className="text-base mr-1.5">{flagFor(race.country_code)}</Text>
              )}
              <Text className="text-muted text-sm mr-2">
                {race?.name ?? `Раунд ${b.race_round}`}
              </Text>
              <Text className="text-muted-2 text-sm">·</Text>
              <Text className="text-muted text-sm ml-2">
                {SESSION_LABEL[b.session_type] ?? b.session_type}
              </Text>
            </View>
            {b.started_at && (
              <Text className="text-muted-2 text-xs mt-1">
                Опубликовано: {new Date(b.started_at).toLocaleDateString('ru-RU')}
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => Linking.openURL(b.video_url)}
            className="mx-4 mt-4 bg-surface rounded-xl border border-line p-4 flex-row items-center active:opacity-80">
            <Ionicons name="open-outline" size={20} color="#A0A0B0" />
            <Text className="text-text font-semibold ml-3 flex-1">
              Открыть оригинал
            </Text>
            <Text className="text-muted text-xs" numberOfLines={1}>
              {hostnameOf(b.video_url)}
            </Text>
          </Pressable>

          {race && (
            <Pressable
              onPress={() => router.push(`/race/${b.race_round}` as never)}
              className="mx-4 mt-2 bg-surface rounded-xl border border-line p-4 flex-row items-center active:opacity-80">
              <Ionicons name="flag" size={20} color="#A0A0B0" />
              <Text className="text-text font-semibold ml-3 flex-1">
                Открыть гран-при
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

