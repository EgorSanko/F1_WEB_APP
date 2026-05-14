import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
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
                <ResultsView results={results.data.results} stats={stats} />
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
            <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
              {/* Section header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: '#FAFAFA',
                      fontSize: 22,
                      fontWeight: '800',
                      letterSpacing: -0.3,
                      textTransform: 'uppercase',
                      fontStyle: 'italic',
                    }}>
                    ЗАПИСИ
                  </Text>
                  <Text className="text-muted text-xs mt-1">
                    Смотри ключевые моменты уикенда{race.locality ? ` в ${ruCity(race.locality)}е` : ''}
                  </Text>
                </View>
                <View
                  pointerEvents="none"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginBottom: 8,
                  }}>
                  <View style={{ width: 20, height: 2, backgroundColor: '#3A3A4A', borderRadius: 1 }} />
                  <View style={{ width: 28, height: 2, backgroundColor: '#E10600', borderRadius: 1 }} />
                  <View
                    style={{ width: 14, height: 2, backgroundColor: '#E10600', opacity: 0.5, borderRadius: 1 }}
                  />
                </View>
              </View>

              <View style={{ gap: 12 }}>
                {raceBroadcasts.map((b) => {
                  const badge = SESSION_SHORT[b.session_type] ?? b.session_type.toUpperCase();
                  const titleRu = (SESSION_LABELS[b.session_type] ?? b.session_type).toUpperCase();
                  const dateStr = b.started_at
                    ? new Date(b.started_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : null;
                  return (
                    <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                      <Pressable
                        style={{
                          backgroundColor: CARD_BG,
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.05)',
                          flexDirection: 'row',
                          alignItems: 'center',
                          overflow: 'hidden',
                        }}>
                        <View style={{ position: 'relative' }}>
                          <BroadcastThumb
                            videoUrl={b.video_url}
                            embedUrl={b.embed_url}
                            width={140}
                          />
                          <View
                            style={{
                              position: 'absolute',
                              left: 8,
                              top: 8,
                              backgroundColor: '#E10600',
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                              borderRadius: 5,
                            }}>
                            <Text
                              style={{
                                color: '#FAFAFA',
                                fontSize: 9,
                                fontWeight: '800',
                                letterSpacing: 1.3,
                              }}>
                              {badge}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14 }}>
                          <Text
                            style={{
                              color: '#FAFAFA',
                              fontSize: 15,
                              fontWeight: '800',
                              letterSpacing: 0.3,
                            }}
                            numberOfLines={1}>
                            {titleRu}
                          </Text>
                          {dateStr ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginTop: 6,
                              }}>
                              <Ionicons
                                name="calendar-outline"
                                size={11}
                                color="#6B6B7B"
                                style={{ marginRight: 5 }}
                              />
                              <Text
                                style={{ color: '#6B6B7B', fontSize: 11, fontWeight: '600' }}>
                                {dateStr}
                              </Text>
                            </View>
                          ) : null}
                          {b.title && b.title !== titleRu ? (
                            <Text className="text-muted text-xs mt-1.5" numberOfLines={1}>
                              {b.title}
                            </Text>
                          ) : null}
                          {b.is_live ? (
                            <View
                              style={{
                                alignSelf: 'flex-start',
                                marginTop: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                              }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: '#E10600',
                                  marginRight: 5,
                                }}
                              />
                              <Text
                                style={{
                                  color: '#E10600',
                                  fontSize: 9,
                                  fontWeight: '800',
                                  letterSpacing: 1.5,
                                }}>
                                LIVE
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={{ paddingRight: 14 }}>
                          <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                        </View>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>

              {/* Footer info pill */}
              <View
                style={{
                  marginTop: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: CARD_BG,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}>
                <Ionicons name="information-circle-outline" size={16} color="#6B6B7B" />
                <Text className="text-muted text-xs ml-2 flex-1" style={{ lineHeight: 16 }}>
                  Для просмотра записей требуется стабильное интернет-соединение
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ HERO (compact) ============

function Hero({
  circuitId,
  country,
  countryCode,
  locality,
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
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: 'rgba(225,6,0,0.18)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 20,
        height: 130,
        shadowColor: '#E10600',
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 22, marginRight: 8 }}>{flagFor(countryCode)}</Text>
        </View>
        <Text
          style={{
            color: '#FAFAFA',
            fontSize: 28,
            lineHeight: 30,
            fontWeight: '800',
            letterSpacing: -1,
            fontStyle: 'italic',
          }}
          numberOfLines={1}>
          {cityUpper}
        </Text>
        <Text className="text-muted text-xs mt-1.5" numberOfLines={1}>
          {dateStr}
        </Text>
      </View>

      <CircuitOutline
        circuitId={circuitId}
        width={120}
        height={100}
        color="#E10600"
        strokeWidth={2.2}
        opacity={0.95}
      />
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

// ============ RESULTS VIEW (podium + table) ============

function teamAbbr(team?: string): string {
  if (!team) return '';
  const words = team.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3);
  }
  return team.slice(0, 3).toUpperCase();
}

function ResultsView({
  results,
  stats,
}: {
  results: RaceResultDriver[];
  stats: ReturnType<typeof getCircuitStats>;
}) {
  const top3 = results.slice(0, 3);
  const rest = results.slice(3);
  const podiumColors = { 1: '#FFCB05', 2: '#C0C0C0', 3: '#CD7F32' } as const;

  return (
    <View>
      {/* Podium */}
      {top3.length === 3 && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 18 }}>
          <PodiumCard driver={top3[1]} place={2} color={podiumColors[2]} />
          <PodiumCard driver={top3[0]} place={1} color={podiumColors[1]} winner />
          <PodiumCard driver={top3[2]} place={3} color={podiumColors[3]} />
        </View>
      )}

      {/* Table header */}
      {rest.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginBottom: 6,
          }}>
          <Text style={tableHeaderStyle('left', 28)}>Поз</Text>
          <Text style={tableHeaderStyle('left', 0, { flex: 1, marginLeft: 50 })}>Пилот</Text>
          <Text style={tableHeaderStyle('left', 50)}>Команда</Text>
          <Text style={tableHeaderStyle('right', 50)}>Очки</Text>
          <Text style={tableHeaderStyle('right', 70)}>Отставание</Text>
        </View>
      )}

      {/* Rows 4+ */}
      <View
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
        {rest.map((d, i) => (
          <View
            key={d.driver_number}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderBottomWidth: i < rest.length - 1 ? 1 : 0,
              borderBottomColor: 'rgba(255,255,255,0.04)',
            }}>
            <Text
              style={{
                color: d.team_color || '#FAFAFA',
                fontWeight: '800',
                fontSize: 22,
                width: 28,
                textAlign: 'center',
                letterSpacing: -0.5,
              }}>
              {d.position}
            </Text>
            {d.photo_url ? (
              <Image
                source={{ uri: d.photo_url }}
                style={{ width: 38, height: 38, borderRadius: 19, marginLeft: 12 }}
              />
            ) : (
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  marginLeft: 12,
                  backgroundColor: '#2A2A38',
                }}
              />
            )}
            <Text
              style={{
                flex: 1,
                color: '#FAFAFA',
                fontWeight: '700',
                fontSize: 14,
                marginLeft: 10,
              }}
              numberOfLines={1}>
              {d.name}
            </Text>
            <View
              style={{
                width: 50,
                alignItems: 'center',
              }}>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 5,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderLeftWidth: 2,
                  borderLeftColor: d.team_color || '#666',
                }}>
                <Text
                  style={{
                    color: d.team_color || '#A0A0B0',
                    fontWeight: '800',
                    fontSize: 9,
                    letterSpacing: 1,
                  }}>
                  {teamAbbr(d.team)}
                </Text>
              </View>
            </View>
            <View style={{ width: 50, alignItems: 'flex-end' }}>
              <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 13 }}>
                {d.points}
              </Text>
              <Text style={{ color: '#6B6B7B', fontSize: 9, fontWeight: '700' }}>PTS</Text>
            </View>
            <Text
              style={{
                width: 70,
                textAlign: 'right',
                color: d.is_dnf ? '#A0A0B0' : '#E10600',
                fontSize: 12,
                fontWeight: '700',
              }}>
              {d.is_dnf ? 'DNF' : d.gap || '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Stats footer below table */}
      {stats && <StatsFooter stats={stats} />}
    </View>
  );
}

function tableHeaderStyle(
  align: 'left' | 'right',
  width: number,
  extra: object = {},
): object {
  return {
    color: '#6B6B7B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    width: width || undefined,
    textAlign: align,
    ...extra,
  };
}

function PodiumCard({
  driver,
  place,
  color,
  winner = false,
}: {
  driver: RaceResultDriver;
  place: 1 | 2 | 3;
  color: string;
  winner?: boolean;
}) {
  return (
    <View
      style={{
        flex: winner ? 1.15 : 1,
        backgroundColor: CARD_BG,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: color + (winner ? 'AA' : '55'),
        paddingTop: winner ? 18 : 12,
        paddingBottom: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
        shadowColor: color,
        shadowOpacity: winner ? 0.45 : 0.2,
        shadowRadius: winner ? 18 : 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: winner ? 8 : 4,
        position: 'relative',
      }}>
      {winner && (
        <Text style={{ fontSize: 22, position: 'absolute', top: -12 }}>🏆</Text>
      )}
      <Text
        style={{
          color,
          fontWeight: '800',
          fontSize: winner ? 28 : 22,
          letterSpacing: -1,
          lineHeight: winner ? 30 : 24,
        }}>
        {place}
      </Text>
      {driver.photo_url ? (
        <Image
          source={{ uri: driver.photo_url }}
          style={{
            width: winner ? 64 : 52,
            height: winner ? 64 : 52,
            borderRadius: winner ? 32 : 26,
            marginTop: 4,
            borderWidth: 1.5,
            borderColor: color,
          }}
        />
      ) : (
        <View
          style={{
            width: winner ? 64 : 52,
            height: winner ? 64 : 52,
            borderRadius: winner ? 32 : 26,
            marginTop: 4,
            backgroundColor: '#2A2A38',
          }}
        />
      )}
      <Text
        style={{
          color: '#FAFAFA',
          fontSize: 12,
          fontWeight: '700',
          marginTop: 8,
          textAlign: 'center',
        }}
        numberOfLines={1}>
        {driver.last_name || driver.name}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 3,
        }}>
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: driver.team_color || '#666',
            marginRight: 5,
          }}
        />
        <Text
          style={{
            color: '#6B6B7B',
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 0.5,
          }}
          numberOfLines={1}>
          {driver.team}
        </Text>
      </View>
      <Text
        style={{
          color: '#FAFAFA',
          fontWeight: '800',
          fontSize: winner ? 16 : 14,
          marginTop: 10,
        }}>
        {driver.points} PTS
      </Text>
      <Text
        style={{
          color: winner ? '#A0A0B0' : '#E10600',
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        }}
        numberOfLines={1}>
        {winner ? driver.time || '—' : driver.gap || '—'}
      </Text>
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
