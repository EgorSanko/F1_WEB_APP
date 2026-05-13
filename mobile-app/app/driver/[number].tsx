import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useDriver, flagFor } from '@/lib/hooks';

export default function DriverProfile() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const router = useRouter();
  const driver = useDriver(Number(number));

  if (driver.isLoading || !driver.data) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  const d = driver.data;
  const stats = d.season_stats;
  const teamColor = d.team_color || '#666';

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
            {d.name}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          {/* Hero card with team color gradient */}
          <View
            className="mx-4 rounded-2xl overflow-hidden border border-line"
            style={{ backgroundColor: teamColor + '22' }}>
            <View className="px-5 pt-5 pb-3 flex-row items-end">
              <View className="flex-1">
                <Text className="text-muted text-[11px] tracking-widest font-bold">
                  #{d.driver_number} · {d.code}
                </Text>
                <Text className="text-text text-[28px] font-light leading-tight">
                  {d.first_name}
                </Text>
                <Text className="text-text text-[28px] font-extrabold leading-tight">
                  {d.last_name}
                </Text>
                <View className="flex-row items-center mt-2">
                  <Text className="text-xl mr-1.5">{flagFor(d.country)}</Text>
                  <Text className="text-muted text-sm">{d.team}</Text>
                </View>
              </View>
              {d.photo_url_large || d.card_photo_url ? (
                <Image
                  source={{ uri: d.photo_url_large || d.card_photo_url }}
                  style={{ width: 130, height: 170, marginBottom: -10 }}
                  contentFit="contain"
                />
              ) : null}
            </View>
            <View style={{ height: 4, backgroundColor: teamColor }} />
          </View>

          {/* Season stats */}
          <View className="px-5 mt-6 mb-2">
            <Text className="text-text text-base font-bold">Сезон 2026</Text>
          </View>
          <View className="px-4">
            <View className="bg-surface rounded-2xl border border-line overflow-hidden">
              <Stat label="Очки" value={String(Math.round(stats.points))} accent />
              <Stat label="Гонки" value={String(stats.races)} />
              <Stat label="Победы" value={String(stats.wins)} />
              <Stat label="Подиумы" value={String(stats.podiums)} />
              <Stat label="Лучший финиш" value={stats.best_finish ? `P${stats.best_finish}` : '—'} />
              <Stat label="Сходы" value={String(stats.dnfs)} last />
            </View>
          </View>

          {/* Race-by-race results */}
          <View className="px-5 mt-6 mb-2">
            <Text className="text-text text-base font-bold">Результаты по гонкам</Text>
          </View>
          <View className="px-4">
            <View className="bg-surface rounded-2xl border border-line overflow-hidden">
              {stats.results.map((r, i) => {
                const dnf = r.status && r.status !== 'Finished' && r.status !== '+1 Lap';
                return (
                  <View
                    key={r.round}
                    className={`flex-row items-center px-4 py-3 ${
                      i < stats.results.length - 1 ? 'border-b border-line' : ''
                    }`}>
                    <Text className="text-muted text-xs font-bold w-8">
                      R{String(r.round).padStart(2, '0')}
                    </Text>
                    <Text className="text-text flex-1 ml-2 text-sm" numberOfLines={1}>
                      {r.race}
                    </Text>
                    <Text
                      className={`font-extrabold text-base mr-2 ${
                        dnf ? 'text-muted-2' : r.position && r.position <= 3 ? 'text-red' : 'text-text'
                      }`}>
                      {dnf ? 'DNF' : r.position ? `P${r.position}` : '—'}
                    </Text>
                    <Text className="text-text font-bold text-sm w-10 text-right">
                      {Math.round(r.points)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {d.teammate ? (
            <>
              <View className="px-5 mt-6 mb-2">
                <Text className="text-text text-base font-bold">Напарник</Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push((`/driver/${d.teammate!.driver_number}` as never) as never)
                }
                className="mx-4 bg-surface rounded-2xl border border-line p-4 flex-row items-center active:opacity-80">
                {d.teammate.photo_url ? (
                  <Image
                    source={{ uri: d.teammate.photo_url }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                  />
                ) : null}
                <View className="flex-1 ml-3">
                  <Text className="text-text font-bold">{d.teammate.name}</Text>
                  <Text className="text-muted text-xs">
                    #{d.teammate.driver_number} · {d.teammate.code}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
  last,
}: {
  label: string;
  value: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3.5 ${
        last ? '' : 'border-b border-line'
      }`}>
      <Text className="text-muted text-sm">{label}</Text>
      <Text className={`font-extrabold text-base ${accent ? 'text-red' : 'text-text'}`}>
        {value}
      </Text>
    </View>
  );
}
