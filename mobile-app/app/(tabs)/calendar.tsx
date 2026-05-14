import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { useSchedule, flagFor } from '@/lib/hooks';
import { ruCity, ruRaceTitle } from '@/lib/locale';
import { CircuitOutline } from '@/components/CircuitOutline';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

const TABS = ['Все', 'Ближайшие', 'Прошедшие'] as const;
type Tab = (typeof TABS)[number];

export default function CalendarScreen() {
  const [tab, setTab] = useState<Tab>('Все');
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

  // Find the next upcoming race to highlight
  const nextRound = useMemo(() => {
    const future = (schedule.data?.races ?? []).filter(
      (r) => new Date(r.race_datetime).getTime() > now.getTime(),
    );
    return future[0]?.round;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.data]);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View className="px-5 pt-2 pb-4 flex-row items-center justify-between">
          <Text
            style={{
              color: '#FAFAFA',
              fontSize: 34,
              fontWeight: '800',
              letterSpacing: -0.5,
              textTransform: 'uppercase',
            }}>
            КАЛЕНДАРЬ
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: CARD_BG,
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}>
            <Text className="text-text font-bold" style={{ fontSize: 15, marginRight: 6 }}>
              {schedule.data?.season ?? 2026}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#A0A0B0" />
          </View>
        </View>

        {/* Segmented tabs */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: CARD_BG,
            borderRadius: 999,
            padding: 4,
            marginHorizontal: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}>
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: active ? '#E10600' : 'transparent',
                  shadowColor: active ? '#E10600' : 'transparent',
                  shadowOpacity: active ? 0.5 : 0,
                  shadowRadius: active ? 14 : 0,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: active ? 6 : 0,
                }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 2,
                    color: active ? '#FAFAFA' : '#A0A0B0',
                  }}>
                  {t.toUpperCase()}
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
          <View
            className="mx-4 rounded-xl p-4"
            style={{
              backgroundColor: CARD_BG,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}>
            <Text className="text-red font-bold">Ошибка загрузки</Text>
            <Pressable onPress={() => schedule.refetch()} className="mt-2">
              <Text className="text-text font-semibold">Повторить</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
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
            const isNext = race.round === nextRound;
            const dateRu = new Date(race.race_datetime)
              .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
              .toUpperCase();
            const cityUpper = ruCity(race.locality).toUpperCase();
            const titleGen = ruRaceTitle(race.country, race.name).toUpperCase();

            return (
              <Link key={race.round} href={`/race/${race.round}` as never} asChild>
                <Pressable
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: isNext
                      ? 'rgba(225,6,0,0.55)'
                      : 'rgba(255,255,255,0.05)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 18,
                    opacity: isPast ? 0.55 : 1,
                    shadowColor: isNext ? '#E10600' : 'transparent',
                    shadowOpacity: isNext ? 0.25 : 0,
                    shadowRadius: isNext ? 16 : 0,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: isNext ? 6 : 0,
                  }}>
                  {/* Left: round number + date + city */}
                  <View style={{ width: 78 }}>
                    <Text
                      style={{
                        fontSize: 38,
                        lineHeight: 40,
                        fontWeight: '800',
                        color: '#FAFAFA',
                        letterSpacing: -1,
                      }}>
                      {String(race.round).padStart(2, '0')}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#E10600',
                        marginTop: 10,
                        letterSpacing: 1.5,
                        fontWeight: '800',
                      }}>
                      {dateRu}
                    </Text>
                    {cityUpper ? (
                      <Text
                        style={{
                          fontSize: 9,
                          color: '#FAFAFA',
                          marginTop: 3,
                          letterSpacing: 1.3,
                          fontWeight: '700',
                        }}
                        numberOfLines={1}>
                        {cityUpper}
                      </Text>
                    ) : null}
                  </View>

                  {/* Flag */}
                  <Text style={{ fontSize: 26, marginHorizontal: 8 }}>
                    {flagFor(race.country_code)}
                  </Text>

                  {/* Middle: ГРАН-ПРИ + country genitive + English locality */}
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        color: '#A0A0B0',
                        letterSpacing: 2.5,
                        fontWeight: '700',
                      }}>
                      ГРАН-ПРИ
                    </Text>
                    <Text
                      style={{
                        fontSize: 19,
                        lineHeight: 22,
                        fontWeight: '800',
                        color: '#FAFAFA',
                        marginTop: 2,
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={2}>
                      {titleGen}
                    </Text>
                    {race.locality ? (
                      <Text
                        style={{ fontSize: 12, color: '#6B6B7B', marginTop: 4 }}
                        numberOfLines={1}>
                        {race.locality}
                      </Text>
                    ) : null}
                  </View>

                  {/* Right: drawn circuit outline (красная обводка) */}
                  <CircuitOutline
                    circuitId={race.circuit_id}
                    width={70}
                    height={56}
                    color={isNext ? '#E10600' : '#5A5A6E'}
                    strokeWidth={2}
                    opacity={isNext ? 1 : 0.85}
                  />

                  <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                </Pressable>
              </Link>
            );
          })}

          {!schedule.isLoading && filtered.length === 0 && (
            <View className="py-10 items-center">
              <Ionicons name="calendar-outline" size={36} color="#6B6B7B" />
              <Text className="text-muted text-sm mt-2">Гонок не найдено</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
