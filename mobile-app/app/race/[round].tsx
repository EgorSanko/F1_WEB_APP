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

import { useBroadcasts, useRaceQualifying, useRaceResults, useSchedule, useTeams, flagFor } from '@/lib/hooks';
import type { Driver, RaceResultDriver, QualifyingDriver } from '@/lib/api';
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
  const teams = useTeams();
  const teamLogoByName = useMemo(() => {
    const m: Record<string, string> = {};
    teams.data?.teams.forEach((t) => {
      if (t.logo_url) m[t.name] = t.logo_url;
    });
    return m;
  }, [teams.data]);
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

          {/* Tabs — сегментированная пилюля, активный таб с красной подложкой */}
          <View
            style={{
              flexDirection: 'row',
              marginHorizontal: 16,
              marginTop: 16,
              padding: 4,
              backgroundColor: CARD_BG,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}>
            {tabs.map((t) => {
              const active = t === tab;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: 'center',
                    borderRadius: 999,
                    backgroundColor: active ? '#E10600' : 'transparent',
                    shadowColor: active ? '#E10600' : 'transparent',
                    shadowOpacity: active ? 0.4 : 0,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: active ? 4 : 0,
                  }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: active ? '#FAFAFA' : '#A0A0B0',
                      fontWeight: active ? '800' : '600',
                      fontSize: 12,
                    }}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
                <ResultsView
                  results={results.data.results}
                  stats={stats}
                  teamLogos={teamLogoByName}
                />
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
                <QualifyingView
                  results={qualifying.data.results}
                  stats={stats}
                  teamLogos={teamLogoByName}
                />
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
  teamLogos,
}: {
  results: RaceResultDriver[];
  stats: ReturnType<typeof getCircuitStats>;
  teamLogos: Record<string, string>;
}) {
  const top3 = results.slice(0, 3);
  const rest = results.slice(3);
  const podiumColors = { 1: '#FFCB05', 2: '#C0C0C0', 3: '#CD7F32' } as const;

  return (
    <View>
      {/* Podium */}
      {top3.length === 3 && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 22, marginTop: 8 }}>
          <PodiumCard
            driver={top3[1]}
            place={2}
            color={podiumColors[2]}
            primary={`${top3[1].points} PTS`}
            primaryColor={top3[1].team_color}
            secondary={top3[1].gap || '—'}
            teamLogo={top3[1].team ? teamLogos[top3[1].team] : undefined}
          />
          <PodiumCard
            driver={top3[0]}
            place={1}
            color={podiumColors[1]}
            winner
            primary={`${top3[0].points} PTS`}
            primaryColor="#FFCB05"
            secondary={top3[0].time || '—'}
            secondaryColor="#A0A0B0"
            teamLogo={top3[0].team ? teamLogos[top3[0].team] : undefined}
          />
          <PodiumCard
            driver={top3[2]}
            place={3}
            color={podiumColors[3]}
            primary={`${top3[2].points} PTS`}
            primaryColor={top3[2].team_color}
            secondary={top3[2].gap || '—'}
            teamLogo={top3[2].team ? teamLogos[top3[2].team] : undefined}
          />
        </View>
      )}

      {/* Table header */}
      {rest.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 4,
          }}>
          <Text style={tableHeaderStyle('center', 22)}>Поз</Text>
          <Text style={tableHeaderStyle('left', 0, { flex: 1, marginLeft: 56 })}>Пилот</Text>
          <Text style={tableHeaderStyle('center', 30)}>Команда</Text>
          <Text style={tableHeaderStyle('right', 56, { marginLeft: 8 })}>Очки</Text>
          <Text style={tableHeaderStyle('right', 56, { marginLeft: 4 })}>Отставание</Text>
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
          <ResultRow
            key={d.driver_number}
            driver={d}
            isLast={i === rest.length - 1}
            teamLogo={d.team ? teamLogos[d.team] : undefined}
            performance={`${d.points}`}
            perfLabel="PTS"
            perfColor={d.team_color || '#FAFAFA'}
            gap={d.is_dnf ? 'DNF' : d.gap || '—'}
            gapColor={d.is_dnf ? '#A0A0B0' : '#FAFAFA'}
          />
        ))}
      </View>

      {/* Stats footer below table */}
      {stats && <StatsFooter stats={stats} />}
    </View>
  );
}

function tableHeaderStyle(
  align: 'left' | 'right' | 'center',
  width: number,
  extra: object = {},
): object {
  return {
    color: '#6B6B7B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    width: width || undefined,
    textAlign: align,
    ...extra,
  };
}

type PodiumDriver = {
  photo_url?: string;
  card_photo_url?: string;
  photo_url_large?: string;
  team?: string;
  team_color?: string;
  first_name?: string;
  last_name?: string;
  name: string;
};

function PodiumCard({
  driver,
  place,
  color,
  winner = false,
  primary,
  primaryColor,
  secondary,
  secondaryColor,
  teamLogo,
}: {
  driver: PodiumDriver;
  place: 1 | 2 | 3;
  color: string;
  winner?: boolean;
  primary: string;
  primaryColor?: string;
  secondary?: string;
  secondaryColor?: string;
  teamLogo?: string;
}) {
  const portrait = driver.card_photo_url || driver.photo_url_large || driver.photo_url;
  const firstName = driver.first_name || driver.name.split(' ')[0];
  const lastName = driver.last_name || driver.name.split(' ').slice(1).join(' ');
  const ptsValue = primary.replace(/\s*PTS\s*$/i, '');
  const hasPts = /\bPTS\b/i.test(primary);

  return (
    <View
      style={{
        flex: winner ? 1.18 : 1,
        backgroundColor: winner ? '#1A1505' : CARD_BG,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: color + (winner ? 'CC' : '55'),
        overflow: 'hidden',
        shadowColor: color,
        shadowOpacity: winner ? 0.5 : 0.22,
        shadowRadius: winner ? 22 : 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: winner ? 10 : 4,
        position: 'relative',
      }}>
      {/* Subtle gold tint at top for winner */}
      {winner && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 203, 5, 0.06)',
          }}
        />
      )}

      {/* Portrait at top */}
      <View style={{ width: '100%', height: winner ? 125 : 110, backgroundColor: '#1A1A24' }}>
        {portrait ? (
          <Image
            source={{ uri: portrait }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : null}
        {/* Position number top-left, over photo */}
        <Text
          style={{
            position: 'absolute',
            top: 2,
            left: 10,
            color: '#FAFAFA',
            fontSize: winner ? 44 : 36,
            fontWeight: '800',
            letterSpacing: -1.5,
            lineHeight: winner ? 48 : 40,
            textShadowColor: 'rgba(0,0,0,0.75)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 8,
          }}>
          {place}
        </Text>
      </View>

      {/* Info section — компактно */}
      <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 4 }}>
            <Text
              style={{ color: '#FAFAFA', fontSize: 12, fontWeight: '700', lineHeight: 14 }}
              numberOfLines={1}>
              {firstName}
            </Text>
            <Text
              style={{ color: '#FAFAFA', fontSize: 12, fontWeight: '700', lineHeight: 14 }}
              numberOfLines={1}>
              {lastName}
            </Text>
          </View>
          {teamLogo ? (
            <Image
              source={{ uri: teamLogo }}
              style={{ width: 22, height: 22 }}
              contentFit="contain"
            />
          ) : (
            <View
              style={{
                width: 4,
                height: 18,
                borderRadius: 2,
                backgroundColor: driver.team_color || '#666',
              }}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
          <Text
            style={{
              color: primaryColor || driver.team_color || '#FAFAFA',
              fontWeight: '800',
              fontSize: winner ? 18 : 16,
              letterSpacing: -0.3,
            }}>
            {hasPts ? ptsValue : primary}
          </Text>
          {hasPts ? (
            <Text
              style={{
                color: primaryColor || driver.team_color || '#FAFAFA',
                fontWeight: '700',
                fontSize: 9,
                marginLeft: 3,
                letterSpacing: 0.8,
              }}>
              PTS
            </Text>
          ) : null}
        </View>

        {secondary ? (
          <Text
            style={{
              color: secondaryColor ?? '#A0A0B0',
              fontSize: 10,
              fontWeight: '700',
              marginTop: 2,
              letterSpacing: secondary === 'POLE' ? 1.5 : 0,
            }}
            numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ============ RESULT ROW (общая для Results и Qualifying таблиц) ============

function ResultRow({
  driver,
  isLast,
  teamLogo,
  performance,
  perfLabel,
  perfColor,
  gap,
  gapColor,
}: {
  driver: Driver & { position: number };
  isLast: boolean;
  teamLogo?: string;
  performance: string;
  perfLabel?: string;
  perfColor: string;
  gap: string;
  gapColor: string;
}) {
  const portrait = driver.card_photo_url || driver.photo_url;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
      }}>
      <Text
        style={{
          color: driver.team_color || '#FAFAFA',
          fontWeight: '800',
          fontSize: 20,
          width: 22,
          textAlign: 'center',
          letterSpacing: -0.5,
        }}>
        {driver.position}
      </Text>
      {portrait ? (
        <Image
          source={{ uri: portrait }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            marginLeft: 8,
            backgroundColor: '#1A1A24',
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            marginLeft: 8,
            backgroundColor: '#1A1A24',
          }}
        />
      )}
      <Text
        style={{
          flex: 1,
          color: '#FAFAFA',
          fontWeight: '700',
          fontSize: 13.5,
          marginLeft: 10,
        }}
        numberOfLines={1}>
        {driver.name}
      </Text>
      <View style={{ width: 30, alignItems: 'center' }}>
        {teamLogo ? (
          <Image
            source={{ uri: teamLogo }}
            style={{ width: 24, height: 24 }}
            contentFit="contain"
          />
        ) : (
          <View
            style={{
              paddingHorizontal: 4,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: driver.team_color ? driver.team_color + '22' : 'rgba(255,255,255,0.04)',
            }}>
            <Text
              style={{
                color: driver.team_color || '#A0A0B0',
                fontWeight: '800',
                fontSize: 8.5,
                letterSpacing: 0.6,
              }}>
              {teamAbbr(driver.team)}
            </Text>
          </View>
        )}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          width: 56,
          justifyContent: 'flex-end',
          marginLeft: 8,
        }}>
        <Text style={{ color: perfColor, fontWeight: '800', fontSize: 13 }}>{performance}</Text>
        {perfLabel ? (
          <Text
            style={{
              color: perfColor,
              fontWeight: '700',
              fontSize: 8.5,
              marginLeft: 3,
              letterSpacing: 0.7,
            }}>
            {perfLabel}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          width: 56,
          textAlign: 'right',
          color: gapColor,
          fontSize: 11.5,
          fontWeight: '700',
          marginLeft: 4,
        }}>
        {gap}
      </Text>
    </View>
  );
}

// ============ QUALIFYING VIEW (podium + table) ============

function parseLapTime(t?: string): number {
  if (!t) return 0;
  // "1:23.456" → 83.456
  const m = t.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
  return parseFloat(t) || 0;
}

function QualifyingView({
  results,
  stats,
  teamLogos,
}: {
  results: QualifyingDriver[];
  stats: ReturnType<typeof getCircuitStats>;
  teamLogos: Record<string, string>;
}) {
  const top3 = results.slice(0, 3);
  const rest = results.slice(3);
  const podiumColors = { 1: '#FFCB05', 2: '#C0C0C0', 3: '#CD7F32' } as const;

  const poleSec = top3[0] ? parseLapTime(top3[0].q3 || top3[0].q2 || top3[0].q1) : 0;
  const bestOf = (d: QualifyingDriver) => d.q3 || d.q2 || d.q1 || '—';
  const gapTo = (d: QualifyingDriver): string => {
    const t = parseLapTime(d.q3 || d.q2 || d.q1);
    if (!t || !poleSec) return '—';
    const diff = t - poleSec;
    if (diff <= 0) return 'POLE';
    return `+${diff.toFixed(3)}`;
  };

  return (
    <View>
      {/* Podium */}
      {top3.length === 3 && (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 22, marginTop: 8 }}>
          <PodiumCard
            driver={top3[1]}
            place={2}
            color={podiumColors[2]}
            primary={bestOf(top3[1])}
            primaryColor={top3[1].team_color}
            secondary={gapTo(top3[1])}
            teamLogo={top3[1].team ? teamLogos[top3[1].team] : undefined}
          />
          <PodiumCard
            driver={top3[0]}
            place={1}
            color={podiumColors[1]}
            winner
            primary={bestOf(top3[0])}
            primaryColor="#FFCB05"
            secondary="POLE"
            secondaryColor="#FFCB05"
            teamLogo={top3[0].team ? teamLogos[top3[0].team] : undefined}
          />
          <PodiumCard
            driver={top3[2]}
            place={3}
            color={podiumColors[3]}
            primary={bestOf(top3[2])}
            primaryColor={top3[2].team_color}
            secondary={gapTo(top3[2])}
            teamLogo={top3[2].team ? teamLogos[top3[2].team] : undefined}
          />
        </View>
      )}

      {/* Table header */}
      {rest.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginBottom: 4,
          }}>
          <Text style={tableHeaderStyle('center', 22)}>Поз</Text>
          <Text style={tableHeaderStyle('left', 0, { flex: 1, marginLeft: 56 })}>Пилот</Text>
          <Text style={tableHeaderStyle('center', 30)}>Команда</Text>
          <Text style={tableHeaderStyle('right', 56, { marginLeft: 8 })}>Лучшее</Text>
          <Text style={tableHeaderStyle('right', 56, { marginLeft: 4 })}>Разрыв</Text>
        </View>
      )}

      {/* Rows */}
      <View
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
        {rest.map((d, i) => (
          <ResultRow
            key={d.driver_number}
            driver={d}
            isLast={i === rest.length - 1}
            teamLogo={d.team ? teamLogos[d.team] : undefined}
            performance={bestOf(d)}
            perfColor="#FAFAFA"
            gap={gapTo(d)}
            gapColor="#E10600"
          />
        ))}
      </View>

      {/* Stats footer */}
      {stats && <StatsFooter stats={stats} />}
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
