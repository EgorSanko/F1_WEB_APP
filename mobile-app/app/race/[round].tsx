import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useBroadcasts, useRaceQualifying, useRaceResults, useSchedule, flagFor } from '@/lib/hooks';
import type { RaceResultDriver, QualifyingDriver } from '@/lib/api';
import { useSpoiler, CURRENT_SEASON, isSpoilerHidden } from '@/lib/spoiler';
import { SpoilerCard } from '@/components/SpoilerCard';
import { BroadcastThumb } from '@/components/VideoPlayer';
import { CircuitOutline } from '@/components/CircuitOutline';
import { ruCity } from '@/lib/locale';
import { getCircuitStats } from '@/lib/circuit-stats';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

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
  qualifying: 'QUALI',
  sprint_qualifying: 'SPRINT Q',
  sprint: 'SPRINT',
  race: 'RACE',
  review: 'Обзор',
};

const DAY_FMT = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const TIME_FMT = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

type Tab = 'Расписание' | 'Результаты' | 'Квалификация' | 'Записи';

const TAB_META: Record<Tab, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'Расписание': { label: 'РАСПИСАНИЕ', icon: 'calendar' },
  'Результаты': { label: 'РЕЗУЛЬТАТЫ', icon: 'trophy' },
  'Квалификация': { label: 'КВАЛИФИКАЦИЯ', icon: 'stopwatch' },
  'Записи': { label: 'ЗАПИСИ', icon: 'videocam' },
};

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
  const tabs = useMemo<Tab[]>(() => {
    if (isPast) {
      return hasBroadcasts
        ? ['Расписание', 'Результаты', 'Квалификация', 'Записи']
        : ['Расписание', 'Результаты', 'Квалификация'];
    }
    return hasBroadcasts ? ['Расписание', 'Записи'] : ['Расписание'];
  }, [isPast, hasBroadcasts]);
  const [tab, setTab] = useState<Tab>(tabs[0]);

  // Group sessions by day
  const sessionsByDay = useMemo(() => {
    if (!race?.sessions) return [];
    const SESSION_ORDER = [
      'fp1', 'fp2', 'fp3', 'sprint_qualifying', 'sprint', 'qualifying', 'race',
    ] as const;
    type S = (typeof SESSION_ORDER)[number];

    const entries: { datetime: Date; dayKey: string; type: S }[] = [];
    for (const type of SESSION_ORDER) {
      const s = race.sessions[type];
      if (!s?.date || !s?.time) continue;
      const datetime = new Date(`${s.date}T${s.time.includes('Z') ? s.time : s.time + 'Z'}`);
      if (Number.isNaN(datetime.getTime())) continue;
      entries.push({ datetime, dayKey: datetime.toISOString().slice(0, 10), type });
    }
    entries.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    const map = new Map<
      string,
      { day: string; sessions: { time: string; label: string; type: S }[] }
    >();
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
        type: e.type,
      });
    }
    return Array.from(map.values());
  }, [race]);

  if (!race) {
    return (
      <View
        style={{ flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  const stats = getCircuitStats(race.circuit_id);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: 6,
          }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={28} color="#FAFAFA" />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              color: '#FAFAFA',
              fontSize: 19,
              fontWeight: '700',
            }}
            numberOfLines={1}>
            {race.name}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          {/* HERO */}
          <Hero
            circuitId={race.circuit_id}
            country={race.country}
            countryCode={race.country_code}
            locality={race.locality}
            name={race.name}
            date={race.date}
          />

          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 4 }}
            style={{ marginTop: 16 }}>
            {tabs.map((t) => {
              const active = t === tab;
              const meta = TAB_META[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 11,
                    paddingHorizontal: 18,
                    borderRadius: 999,
                    backgroundColor: active ? '#E10600' : CARD_BG,
                    borderWidth: 1,
                    borderColor: active ? '#E10600' : 'rgba(255,255,255,0.05)',
                    shadowColor: active ? '#E10600' : 'transparent',
                    shadowOpacity: active ? 0.4 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: active ? 6 : 0,
                  }}>
                  <Ionicons
                    name={meta.icon}
                    size={14}
                    color={active ? '#FAFAFA' : '#A0A0B0'}
                    style={{ marginRight: 7 }}
                  />
                  <Text
                    style={{
                      color: active ? '#FAFAFA' : '#A0A0B0',
                      fontWeight: '800',
                      fontSize: 11,
                      letterSpacing: 1.5,
                    }}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {tab === 'Расписание' && (
            <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
              {sessionsByDay.length === 0 ? (
                <Text className="text-muted text-sm">Расписание ещё не опубликовано</Text>
              ) : (
                sessionsByDay.map((day) => (
                  <View key={day.day} style={{ marginBottom: 18 }}>
                    {/* Day header with red bar */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 10,
                        paddingHorizontal: 2,
                      }}>
                      <View
                        style={{
                          width: 3,
                          height: 16,
                          backgroundColor: '#E10600',
                          borderRadius: 2,
                          marginRight: 10,
                        }}
                      />
                      <Text
                        style={{
                          color: '#FAFAFA',
                          fontSize: 13,
                          fontWeight: '800',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                        }}>
                        {day.day}
                      </Text>
                    </View>

                    <View style={{ gap: 10 }}>
                      {day.sessions.map((s, i) => (
                        <SessionRow key={i} time={s.time} label={s.label} type={s.type} />
                      ))}
                    </View>
                  </View>
                ))
              )}

              {!isPast && (
                <Link href={`/(tabs)/predict` as never} asChild>
                  <Pressable
                    style={{
                      backgroundColor: '#E10600',
                      borderRadius: 18,
                      paddingVertical: 16,
                      marginTop: 8,
                      alignItems: 'center',
                      shadowColor: '#E10600',
                      shadowOpacity: 0.4,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 6,
                    }}>
                    <Text className="text-text font-bold" style={{ fontSize: 15 }}>
                      Сделать прогноз
                    </Text>
                  </Pressable>
                </Link>
              )}

              {/* Stats footer */}
              {stats && <StatsFooter stats={stats} />}
            </View>
          )}

          {tab === 'Результаты' && spoilerHidden && !revealResults && isPast && (
            <SpoilerCard
              label="Результаты гонки скрыты"
              onReveal={() => setRevealResults(true)}
            />
          )}

          {tab === 'Результаты' && (!spoilerHidden || revealResults || !isPast) && (
            <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
              {results.isLoading && <ActivityIndicator color="#E10600" />}
              {results.isError && <Text className="text-muted text-sm">Данных нет</Text>}
              {results.data?.results && (
                <View
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                  }}>
                  {results.data.results.map((d: RaceResultDriver, i) => (
                    <View
                      key={d.driver_number}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderBottomWidth: i < results.data!.results.length - 1 ? 1 : 0,
                        borderBottomColor: 'rgba(255,255,255,0.05)',
                      }}>
                      <Text
                        style={{
                          color: '#FAFAFA',
                          fontWeight: '800',
                          fontSize: 18,
                          width: 28,
                          textAlign: 'center',
                        }}>
                        {d.position}
                      </Text>
                      <View
                        style={{
                          width: 3,
                          height: 36,
                          borderRadius: 2,
                          marginHorizontal: 10,
                          backgroundColor: d.team_color || '#666',
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text className="text-text font-bold">{d.name}</Text>
                        <Text className="text-muted text-xs mt-0.5">
                          {d.team} · {d.code}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
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
            <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
              {qualifying.isLoading && <ActivityIndicator color="#E10600" />}
              {qualifying.isError && <Text className="text-muted text-sm">Данных нет</Text>}
              {qualifying.data?.results && (
                <View
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                  }}>
                  {qualifying.data.results.map((d: QualifyingDriver, i) => (
                    <View
                      key={d.driver_number}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderBottomWidth: i < qualifying.data!.results.length - 1 ? 1 : 0,
                        borderBottomColor: 'rgba(255,255,255,0.05)',
                      }}>
                      <Text
                        style={{
                          color: '#FAFAFA',
                          fontWeight: '800',
                          fontSize: 18,
                          width: 28,
                          textAlign: 'center',
                        }}>
                        {d.position}
                      </Text>
                      <View
                        style={{
                          width: 3,
                          height: 36,
                          borderRadius: 2,
                          marginHorizontal: 10,
                          backgroundColor: d.team_color || '#666',
                        }}
                      />
                      <View style={{ flex: 1 }}>
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
            <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 10 }}>
              {raceBroadcasts.map((b) => {
                const sessionLabel = SESSION_SHORT[b.session_type] ?? b.session_type;
                return (
                  <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                    <Pressable
                      style={{
                        backgroundColor: CARD_BG,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.05)',
                        flexDirection: 'row',
                        alignItems: 'center',
                        overflow: 'hidden',
                      }}>
                      <BroadcastThumb videoUrl={b.video_url} embedUrl={b.embed_url} />
                      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10 }}>
                        <Text className="text-text font-bold" numberOfLines={1}>
                          {sessionLabel} · {race.name?.replace('Гран-при ', '')}
                        </Text>
                        <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>
                          {SESSION_LABELS[b.session_type] ?? b.session_type}
                        </Text>
                      </View>
                      {b.is_live ? (
                        <View
                          style={{
                            backgroundColor: '#E10600',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            marginRight: 8,
                          }}>
                          <Text className="text-text text-[9px] font-extrabold tracking-widest">
                            LIVE
                          </Text>
                        </View>
                      ) : null}
                      <View style={{ paddingRight: 12 }}>
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

// ============ HERO ============

function Hero({
  circuitId,
  country,
  countryCode,
  locality,
  name,
  date,
}: {
  circuitId?: string;
  country?: string;
  countryCode?: string;
  locality?: string;
  name: string;
  date: string;
}) {
  const cityUpper = (ruCity(locality) || locality || country || '').toUpperCase();
  const eyebrow = name.toUpperCase();
  const dateStr = new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: 'rgba(225,6,0,0.18)',
        aspectRatio: 4 / 5,
        shadowColor: '#E10600',
        shadowOpacity: 0.15,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}>
      {/* Большое очертание трассы по центру — декоративный фон */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -20,
          top: 20,
          opacity: 0.85,
        }}>
        <CircuitOutline
          circuitId={circuitId}
          width={300}
          height={300}
          color="#E10600"
          strokeWidth={2.5}
        />
      </View>

      {/* Subtle bottom darken so text is readable */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: '55%',
          backgroundColor: 'rgba(10,10,18,0.7)',
        }}
      />

      {/* Content */}
      <View style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 32 }}>{flagFor(countryCode)}</Text>
        </View>

        <View>
          <Text
            style={{
              color: '#E10600',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 2,
            }}
            numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text
            style={{
              color: '#FAFAFA',
              fontSize: 46,
              lineHeight: 46,
              fontWeight: '800',
              letterSpacing: -1.5,
              fontStyle: 'italic',
              marginTop: 6,
            }}
            numberOfLines={1}>
            {cityUpper}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
              <Ionicons name="calendar-outline" size={14} color="#FAFAFA" />
            </View>
            <Text className="text-text text-sm font-semibold">{dateStr} г.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============ SESSION ROW ============

function SessionRow({
  time,
  label,
  type,
}: {
  time: string;
  label: string;
  type: string;
}) {
  const isRace = type === 'race';
  const isQuali = type === 'qualifying' || type === 'sprint_qualifying';
  const shortPill = SESSION_SHORT[type] ?? type.toUpperCase();

  return (
    <View
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isRace ? 'rgba(225,6,0,0.4)' : 'rgba(255,255,255,0.05)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        shadowColor: isRace ? '#E10600' : 'transparent',
        shadowOpacity: isRace ? 0.18 : 0,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: isRace ? 4 : 0,
      }}>
      <Text
        style={{
          color: '#E10600',
          fontSize: 28,
          lineHeight: 30,
          fontWeight: '800',
          letterSpacing: -0.5,
          minWidth: 78,
        }}>
        {time}
      </Text>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: 'rgba(255,255,255,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}>
        <Ionicons
          name={isRace ? 'flag' : isQuali ? 'stopwatch-outline' : 'time-outline'}
          size={12}
          color={isRace ? '#E10600' : '#A0A0B0'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text className="text-text font-bold" style={{ fontSize: 15 }}>
          {label}
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}>
          <Text
            style={{
              color: '#A0A0B0',
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 1.5,
            }}>
            {shortPill}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
    </View>
  );
}

// ============ STATS FOOTER ============

function StatsFooter({ stats }: { stats: NonNullable<ReturnType<typeof getCircuitStats>> }) {
  const items: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub?: string }[] = [
    {
      icon: 'analytics-outline',
      label: 'ДЛИНА ТРАССЫ',
      value: `${stats.lengthKm.toFixed(3)} KM`,
    },
    {
      icon: 'flag-outline',
      label: 'ДИСТАНЦИЯ',
      value: `${stats.distanceKm.toFixed(3)} KM`,
    },
    {
      icon: 'reload-outline',
      label: 'КОЛИЧЕСТВО КРУГОВ',
      value: String(stats.laps),
    },
    {
      icon: 'stopwatch-outline',
      label: 'РЕКОРД КРУГА',
      value: stats.lapRecord?.time ?? '—',
      sub: stats.lapRecord
        ? `${stats.lapRecord.driver} (${stats.lapRecord.year})`
        : undefined,
    },
  ];

  return (
    <View
      style={{
        marginTop: 18,
        backgroundColor: CARD_BG,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row',
        padding: 14,
      }}>
      {items.map((it, i) => (
        <View
          key={it.label}
          style={{
            flex: 1,
            paddingHorizontal: 6,
            borderRightWidth: i < items.length - 1 ? 1 : 0,
            borderRightColor: 'rgba(255,255,255,0.05)',
          }}>
          <Ionicons name={it.icon} size={14} color="#6B6B7B" />
          <Text
            style={{
              color: '#6B6B7B',
              fontSize: 8,
              fontWeight: '700',
              letterSpacing: 1.2,
              marginTop: 6,
            }}
            numberOfLines={1}>
            {it.label}
          </Text>
          <Text
            style={{
              color: '#FAFAFA',
              fontSize: 14,
              fontWeight: '800',
              marginTop: 3,
            }}
            numberOfLines={1}>
            {it.value}
          </Text>
          {it.sub ? (
            <Text
              style={{ color: '#6B6B7B', fontSize: 9, marginTop: 2 }}
              numberOfLines={1}>
              {it.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
