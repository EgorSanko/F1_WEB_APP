import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import {
  flagFor,
  useConstructorStandings,
  useDriverStandings,
  useHeadToHead,
  usePointsProgression,
  useTeams,
} from '@/lib/hooks';
import type { DriverStanding, H2HPair, PointsProgressionDriver, Team } from '@/lib/api';
import { CURRENT_SEASON, isSpoilerHidden, useSpoiler } from '@/lib/spoiler';
import { SpoilerCard } from '@/components/SpoilerCard';

const TABS = ['Пилоты', 'Кубок', 'Карточки', 'Команды', 'H2H', 'Прогресс'] as const;
type Tab = (typeof TABS)[number];

export default function StandingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Пилоты');

  const drivers = useDriverStandings();
  const constructors = useConstructorStandings();
  const teams = useTeams();
  const h2h = useHeadToHead();
  const progression = usePointsProgression();

  const teamLogoByName = useMemo(() => {
    const m: Record<string, string> = {};
    teams.data?.teams.forEach((t) => {
      if (t.logo_url) m[t.name] = t.logo_url;
    });
    return m;
  }, [teams.data]);

  const spoilerEnabled = useSpoiler((s) => s.enabled);
  const spoilerHidden = isSpoilerHidden(CURRENT_SEASON, spoilerEnabled);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A12' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 4,
            paddingBottom: 8,
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
              marginRight: 44,
            }}>
            Чемпионат
          </Text>
        </View>

        {/* Scrollable tabs */}
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
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active ? '#E10600' : '#12121C',
                  borderWidth: 1,
                  borderColor: active ? '#E10600' : 'rgba(255,255,255,0.05)',
                  shadowColor: active ? '#E10600' : 'transparent',
                  shadowOpacity: active ? 0.35 : 0,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: active ? 4 : 0,
                }}>
                <Text
                  style={{
                    color: active ? '#FAFAFA' : '#A0A0B0',
                    fontWeight: '800',
                    fontSize: 11.5,
                    letterSpacing: 0.3,
                  }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {spoilerHidden && !revealed && (
            <SpoilerCard
              label={`Чемпионат ${CURRENT_SEASON} скрыт`}
              hint="Антиспойлер включён. Таблица показывает результаты — раскрой чтобы посмотреть."
              onReveal={() => setRevealed(true)}
            />
          )}
          {(!spoilerHidden || revealed) && tab === 'Пилоты' && (
            <DriversTab
              data={drivers.data?.standings ?? []}
              loading={drivers.isLoading}
              teamLogos={teamLogoByName}
            />
          )}
          {(!spoilerHidden || revealed) && tab === 'Кубок' && (
            <ConstructorsTab
              data={constructors.data?.standings ?? []}
              loading={constructors.isLoading}
              teamLogos={teamLogoByName}
              onPickDriver={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {(!spoilerHidden || revealed) && tab === 'Карточки' && (
            <DriverCardsTab
              data={drivers.data?.standings ?? []}
              loading={drivers.isLoading}
              teamLogos={teamLogoByName}
              onPick={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {(!spoilerHidden || revealed) && tab === 'Команды' && (
            <TeamsTab
              data={teams.data?.teams ?? []}
              loading={teams.isLoading}
              onPickDriver={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {(!spoilerHidden || revealed) && tab === 'H2H' && (
            <H2HTab
              data={h2h.data?.head_to_head ?? []}
              loading={h2h.isLoading}
              onPickDriver={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {(!spoilerHidden || revealed) && tab === 'Прогресс' && (
            <ProgressTab
              data={progression.data?.drivers ?? []}
              totalRounds={progression.data?.total_rounds ?? 24}
              loading={progression.isLoading}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ DRIVERS TAB ============
const PODIUM_METAL = ['#FFCB05', '#C0C0C0', '#CD7F32'] as const;

function DriversTab({
  data,
  loading,
  teamLogos,
}: {
  data: DriverStanding[];
  loading: boolean;
  teamLogos: Record<string, string>;
}) {
  const router = useRouter();
  if (loading) return <ActivityIndicator color="#E10600" style={{ marginTop: 40 }} />;
  if (!data.length) return <EmptyHint text="Стандинги недоступны" />;
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);
  const leader = top3[0];

  return (
    <View>
      {/* Podium */}
      {top3.length === 3 && (
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            gap: 8,
            alignItems: 'flex-end',
            marginTop: 6,
            marginBottom: 22,
          }}>
          <StandingsPodium
            d={top3[1]}
            place={2}
            color={PODIUM_METAL[1]}
            teamLogo={top3[1].team ? teamLogos[top3[1].team] : undefined}
            onPress={() => router.push(`/driver/${top3[1].driver_number}` as never)}
          />
          <StandingsPodium
            d={top3[0]}
            place={1}
            color={PODIUM_METAL[0]}
            winner
            teamLogo={top3[0].team ? teamLogos[top3[0].team] : undefined}
            onPress={() => router.push(`/driver/${top3[0].driver_number}` as never)}
          />
          <StandingsPodium
            d={top3[2]}
            place={3}
            color={PODIUM_METAL[2]}
            teamLogo={top3[2].team ? teamLogos[top3[2].team] : undefined}
            onPress={() => router.push(`/driver/${top3[2].driver_number}` as never)}
          />
        </View>
      )}

      {/* Table header */}
      {rest.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 30,
            paddingVertical: 8,
          }}>
          <Text style={tableHeaderText({ width: 30, align: 'center' })}>ПОЗ</Text>
          <Text style={tableHeaderText({ flex: 1, marginLeft: 60, align: 'left' })}>ПИЛОТ</Text>
          <View style={{ width: 32 }} />
          <Text style={tableHeaderText({ width: 60, align: 'right', marginLeft: 6 })}>ОЧКИ</Text>
        </View>
      )}

      {/* Table rows for positions 4+ */}
      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: '#12121C',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
        {rest.map((d, i) => {
          const portrait = d.card_photo_url || d.photo_url;
          const teamColor = d.team_color || '#666';
          const logo = d.team ? teamLogos[d.team] : undefined;
          const diff = leader ? (leader.points ?? 0) - (d.points ?? 0) : 0;
          return (
            <Pressable
              key={d.driver_number}
              onPress={() => router.push(`/driver/${d.driver_number}` as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderBottomWidth: i < rest.length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(255,255,255,0.04)',
              }}>
              <Text
                style={{
                  color: teamColor,
                  fontWeight: '800',
                  fontSize: 22,
                  width: 30,
                  textAlign: 'center',
                  letterSpacing: -0.8,
                  fontVariant: ['tabular-nums'],
                }}>
                {d.position ?? i + 4}
              </Text>
              {portrait ? (
                <Image
                  source={{ uri: portrait }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    marginLeft: 8,
                    backgroundColor: '#1A1A24',
                  }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    marginLeft: 8,
                    backgroundColor: '#1A1A24',
                  }}
                />
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                    {d.name}
                  </Text>
                  {d.country ? (
                    <Text style={{ fontSize: 11, marginLeft: 5 }}>{flagFor(d.country)}</Text>
                  ) : null}
                </View>
                <Text style={{ color: teamColor, fontSize: 11, fontWeight: '700', marginTop: 1 }}>
                  {d.team}
                </Text>
              </View>
              <View style={{ width: 32, alignItems: 'center' }}>
                {logo ? (
                  <Image
                    source={{ uri: logo }}
                    style={{ width: 26, height: 26 }}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={{
                      width: 4,
                      height: 20,
                      borderRadius: 2,
                      backgroundColor: teamColor,
                    }}
                  />
                )}
              </View>
              <View style={{ width: 60, alignItems: 'flex-end', marginLeft: 6 }}>
                <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 15 }}>
                  {d.points}
                </Text>
                {diff > 0 && (
                  <Text style={{ color: '#6B6B7B', fontSize: 10, marginTop: 1 }}>
                    -{diff}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function tableHeaderText({
  width,
  flex,
  align,
  marginLeft,
}: {
  width?: number;
  flex?: number;
  align: 'left' | 'right' | 'center';
  marginLeft?: number;
}): object {
  return {
    color: '#6B6B7B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    width,
    flex,
    textAlign: align,
    marginLeft,
  };
}

// ============ STANDINGS PODIUM CARD ============

function StandingsPodium({
  d,
  place,
  color,
  winner = false,
  teamLogo,
  onPress,
}: {
  d: DriverStanding;
  place: 1 | 2 | 3;
  color: string;
  winner?: boolean;
  teamLogo?: string;
  onPress: () => void;
}) {
  const portrait = d.card_photo_url || d.photo_url;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: winner ? 1.18 : 1,
        backgroundColor: winner ? '#1A1505' : '#12121C',
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: color + (winner ? 'CC' : '55'),
        overflow: 'hidden',
        shadowColor: color,
        shadowOpacity: winner ? 0.5 : 0.22,
        shadowRadius: winner ? 22 : 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: winner ? 10 : 4,
      }}>
      {/* Portrait */}
      <View style={{ width: '100%', height: winner ? 125 : 110, backgroundColor: '#1A1A24' }}>
        {portrait ? (
          <Image source={{ uri: portrait }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : null}
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
      {/* Info */}
      <View style={{ paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 4 }}>
            <Text style={{ color: '#FAFAFA', fontSize: 12, fontWeight: '700', lineHeight: 14 }} numberOfLines={1}>
              {d.first_name}
            </Text>
            <Text style={{ color: '#FAFAFA', fontSize: 12, fontWeight: '700', lineHeight: 14 }} numberOfLines={1}>
              {d.last_name}
            </Text>
          </View>
          {teamLogo ? (
            <Image source={{ uri: teamLogo }} style={{ width: 22, height: 22 }} contentFit="contain" />
          ) : (
            <View
              style={{
                width: 4,
                height: 18,
                borderRadius: 2,
                backgroundColor: d.team_color || '#666',
              }}
            />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
          <Text
            style={{
              color: winner ? '#FFCB05' : d.team_color || '#FAFAFA',
              fontWeight: '800',
              fontSize: winner ? 18 : 16,
              letterSpacing: -0.3,
            }}>
            {d.points}
          </Text>
          <Text
            style={{
              color: winner ? '#FFCB05' : d.team_color || '#FAFAFA',
              fontWeight: '700',
              fontSize: 9,
              marginLeft: 3,
              letterSpacing: 0.8,
            }}>
            PTS
          </Text>
        </View>
        {d.wins ? (
          <Text style={{ color: '#A0A0B0', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
            {d.wins} побед{d.wins === 1 ? 'а' : ''}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ============ CONSTRUCTORS TAB ============
function ConstructorsTab({
  data,
  loading,
  teamLogos,
  onPickDriver,
}: {
  data: import('@/lib/api').ConstructorStanding[];
  loading: boolean;
  teamLogos: Record<string, string>;
  onPickDriver: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" style={{ marginTop: 40 }} />;
  if (!data.length) return <EmptyHint text="Стандинги недоступны" />;
  const leader = data[0];
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      {data.map((c, i) => {
        const teamColor = c.team_color || '#666';
        const logo = teamLogos[c.team];
        const pos = c.position ?? i + 1;
        const isLeader = i === 0;
        const diff = leader ? (leader.points ?? 0) - (c.points ?? 0) : 0;
        return (
          <View
            key={c.team}
            style={{
              backgroundColor: '#12121C',
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: isLeader ? teamColor + 'AA' : teamColor + '44',
              overflow: 'hidden',
              shadowColor: isLeader ? teamColor : 'transparent',
              shadowOpacity: isLeader ? 0.3 : 0,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: isLeader ? 6 : 0,
            }}>
            {/* Header row */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: teamColor + '12',
              }}>
              <Text
                style={{
                  color: pos <= 3 ? (PODIUM_METAL[pos - 1] ?? teamColor) : teamColor,
                  fontWeight: '800',
                  fontSize: 32,
                  width: 40,
                  textAlign: 'center',
                  letterSpacing: -1,
                }}>
                {pos}
              </Text>
              <View style={{ width: 4, height: 44, borderRadius: 2, backgroundColor: teamColor, marginHorizontal: 12 }} />
              {logo ? (
                <Image source={{ uri: logo }} style={{ width: 44, height: 44 }} contentFit="contain" />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: teamColor + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="car-sport" size={22} color={teamColor} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
                  {c.team}
                </Text>
                <Text style={{ color: '#A0A0B0', fontSize: 11, marginTop: 2 }}>
                  {c.wins ? `${c.wins} побед` : 'Без побед'}
                  {diff > 0 ? ` · -${diff}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: teamColor, fontWeight: '800', fontSize: 20, letterSpacing: -0.3 }}>
                  {c.points}
                </Text>
                <Text style={{ color: '#6B6B7B', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
                  ОЧКОВ
                </Text>
              </View>
            </View>
            {/* Drivers row */}
            {c.drivers && c.drivers.length > 0 && (
              <View style={{ flexDirection: 'row' }}>
                {c.drivers.map((dr, idx) => {
                  const portrait = dr.card_photo_url || dr.photo_url;
                  return (
                    <Pressable
                      key={dr.driver_number}
                      onPress={() => onPickDriver(dr.driver_number)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 12,
                        borderRightWidth:
                          idx === 0 && c.drivers!.length > 1 ? 1 : 0,
                        borderRightColor: 'rgba(255,255,255,0.06)',
                      }}>
                      {portrait ? (
                        <Image
                          source={{ uri: portrait }}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            borderWidth: 1.5,
                            borderColor: teamColor,
                          }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: '#1A1A24',
                            borderWidth: 1.5,
                            borderColor: teamColor,
                          }}
                        />
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 13 }}
                          numberOfLines={1}>
                          {dr.last_name}
                        </Text>
                        <Text style={{ color: '#6B6B7B', fontSize: 10, fontWeight: '700', marginTop: 1 }}>
                          #{dr.driver_number} · {dr.points ?? 0} pts
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ============ DRIVER CARDS TAB (большие фото, горизонтальная компоновка) ============
function DriverCardsTab({
  data,
  loading,
  teamLogos,
  onPick,
}: {
  data: DriverStanding[];
  loading: boolean;
  teamLogos: Record<string, string>;
  onPick: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" style={{ marginTop: 40 }} />;
  if (!data.length) return <EmptyHint text="Карточки недоступны" />;
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      {data.map((d, i) => {
        const teamColor = d.team_color || '#666';
        const portrait = d.card_photo_url || d.photo_url;
        const logo = d.team ? teamLogos[d.team] : undefined;
        const pos = d.position ?? i + 1;
        const isLeader = pos === 1;
        return (
          <Pressable
            key={d.driver_number}
            onPress={() => onPick(d.driver_number)}
            style={{
              backgroundColor: '#12121C',
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: teamColor + (isLeader ? 'CC' : '55'),
              overflow: 'hidden',
              shadowColor: teamColor,
              shadowOpacity: isLeader ? 0.45 : 0.2,
              shadowRadius: isLeader ? 18 : 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: isLeader ? 8 : 3,
            }}>
            {/* Tinted gradient layer */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: teamColor + '18',
              }}
              pointerEvents="none"
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 160 }}>
              {/* Position number + #N */}
              <View style={{ width: 48, alignItems: 'center', paddingVertical: 14 }}>
                <Text
                  style={{
                    color: teamColor,
                    fontSize: 42,
                    fontWeight: '800',
                    letterSpacing: -2,
                    lineHeight: 44,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {pos}
                </Text>
                <Text
                  style={{
                    color: '#6B6B7B',
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 1.2,
                    marginTop: 4,
                  }}>
                  #{d.driver_number}
                </Text>
              </View>

              {/* Driver portrait — bigger */}
              <View
                style={{
                  width: 132,
                  height: 160,
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}>
                {portrait ? (
                  <Image
                    source={{ uri: portrait }}
                    style={{ width: 132, height: 168, marginBottom: -4 }}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: '#1A1A24',
                    }}
                  />
                )}
              </View>

              {/* Info column */}
              <View style={{ flex: 1, paddingVertical: 12, paddingRight: 10, paddingLeft: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  {logo ? (
                    <Image
                      source={{ uri: logo }}
                      style={{ width: 22, height: 22, marginRight: 6 }}
                      contentFit="contain"
                    />
                  ) : (
                    <View
                      style={{
                        width: 4,
                        height: 18,
                        borderRadius: 2,
                        backgroundColor: teamColor,
                        marginRight: 8,
                      }}
                    />
                  )}
                  <Text
                    style={{ color: '#A0A0B0', fontSize: 11, fontWeight: '700', flex: 1 }}
                    numberOfLines={1}>
                    {d.team}
                  </Text>
                </View>
                <Text
                  style={{
                    color: '#FAFAFA',
                    fontSize: 14,
                    fontWeight: '300',
                    letterSpacing: -0.3,
                  }}
                  numberOfLines={1}>
                  {d.first_name}
                </Text>
                <Text
                  style={{
                    color: '#FAFAFA',
                    fontSize: 19,
                    fontWeight: '800',
                    letterSpacing: -0.5,
                    lineHeight: 22,
                  }}
                  numberOfLines={1}>
                  {d.last_name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  {d.country ? (
                    <Text style={{ fontSize: 12, marginRight: 4 }}>{flagFor(d.country)}</Text>
                  ) : null}
                  <Text style={{ color: '#6B6B7B', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                    {d.country || ''}
                  </Text>
                </View>
                {isLeader ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: teamColor + '33',
                      borderWidth: 1,
                      borderColor: teamColor + '88',
                    }}>
                    <Text
                      style={{
                        color: teamColor,
                        fontSize: 9,
                        fontWeight: '800',
                        letterSpacing: 0.6,
                      }}>
                      ЛИДЕР ЧЕМПИОНАТА
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Points + chevron */}
              <View
                style={{
                  alignItems: 'flex-end',
                  paddingRight: 14,
                  paddingVertical: 14,
                }}>
                <Text
                  style={{
                    color: '#FAFAFA',
                    fontSize: 24,
                    fontWeight: '800',
                    letterSpacing: -0.5,
                  }}>
                  {d.points}
                </Text>
                <Text
                  style={{
                    color: '#6B6B7B',
                    fontSize: 9,
                    fontWeight: '800',
                    letterSpacing: 0.8,
                    marginTop: 1,
                  }}>
                  ОЧКОВ
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#6B6B7B"
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============ TEAMS TAB ============
function TeamsTab({
  data,
  loading,
  onPickDriver,
}: {
  data: Team[];
  loading: boolean;
  onPickDriver: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" style={{ marginTop: 40 }} />;
  if (!data.length) return <EmptyHint text="Команды недоступны" />;
  return (
    <View style={{ paddingHorizontal: 16, gap: 14 }}>
      {data.map((t) => {
        const teamColor = t.color || '#666';
        return (
          <View
            key={t.name}
            style={{
              backgroundColor: '#12121C',
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: teamColor + '55',
              overflow: 'hidden',
              shadowColor: teamColor,
              shadowOpacity: 0.22,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 5,
            }}>
            {/* Tinted layer */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: teamColor + '12',
              }}
              pointerEvents="none"
            />

            {/* Header: logo + name + stripe */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 12,
              }}>
              <View
                style={{
                  width: 4,
                  height: 40,
                  borderRadius: 2,
                  backgroundColor: teamColor,
                  marginRight: 12,
                }}
              />
              {t.logo_url ? (
                <Image
                  source={{ uri: t.logo_url }}
                  style={{ width: 44, height: 44 }}
                  contentFit="contain"
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: teamColor + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="car-sport" size={22} color={teamColor} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 17, letterSpacing: -0.3 }}
                  numberOfLines={1}>
                  {t.name}
                </Text>
                <Text
                  style={{ color: teamColor, fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 }}>
                  СЕЗОН 2026
                </Text>
              </View>
            </View>

            {/* Car image — bigger and centered */}
            {t.car_url ? (
              <View
                style={{
                  width: '100%',
                  height: 130,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                }}>
                <Image
                  source={{ uri: t.car_url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
            ) : null}

            {/* Drivers */}
            {t.drivers && t.drivers.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                }}>
                {t.drivers.map((dr, idx) => {
                  const portrait = dr.card_photo_url || dr.photo_url;
                  return (
                    <Pressable
                      key={dr.driver_number}
                      onPress={() => onPickDriver(dr.driver_number)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 12,
                        borderRightWidth: idx === 0 && t.drivers!.length > 1 ? 1 : 0,
                        borderRightColor: 'rgba(255,255,255,0.06)',
                      }}>
                      {portrait ? (
                        <Image
                          source={{ uri: portrait }}
                          style={{
                            width: 54,
                            height: 54,
                            borderRadius: 27,
                            borderWidth: 2,
                            borderColor: teamColor,
                            backgroundColor: '#1A1A24',
                          }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 54,
                            height: 54,
                            borderRadius: 27,
                            backgroundColor: '#1A1A24',
                            borderWidth: 2,
                            borderColor: teamColor,
                          }}
                        />
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={{ color: '#A0A0B0', fontSize: 11, fontWeight: '700' }}
                          numberOfLines={1}>
                          #{dr.driver_number}
                        </Text>
                        <Text
                          style={{
                            color: '#FAFAFA',
                            fontWeight: '800',
                            fontSize: 13,
                            letterSpacing: -0.2,
                            marginTop: 1,
                          }}
                          numberOfLines={1}>
                          {dr.last_name}
                        </Text>
                        <Text
                          style={{ color: teamColor, fontSize: 10, fontWeight: '700', marginTop: 1 }}>
                          {dr.points ?? 0} очк.
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ============ H2H TAB ============
function H2HTab({
  data,
  loading,
  onPickDriver,
}: {
  data: H2HPair[];
  loading: boolean;
  onPickDriver: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Нет данных для H2H" />;
  return (
    <View className="px-4 gap-3">
      {data.map((p) => {
        const d1 = p.driver1;
        const d2 = p.driver2;
        const total = (d1.points || 0) + (d2.points || 0);
        const d1Share = total > 0 ? (d1.points || 0) / total : 0.5;
        return (
          <View
            key={p.team}
            className="rounded-2xl overflow-hidden border border-line"
            style={{ backgroundColor: (p.color || '#666') + '15' }}>
            <View className="px-4 py-3 border-b border-line">
              <Text className="text-text font-extrabold">{p.team}</Text>
            </View>
            {/* Pilots */}
            <View className="flex-row p-4 items-center">
              <Pressable
                onPress={() => onPickDriver(d1.number)}
                className="flex-1 items-center active:opacity-80">
                {d1.photo_url ? (
                  <Image
                    source={{ uri: d1.photo_url }}
                    style={{ width: 70, height: 70, borderRadius: 35 }}
                  />
                ) : null}
                <Text className="text-text font-bold text-sm mt-2" numberOfLines={1}>
                  {d1.full_name}
                </Text>
                <Text className="text-muted text-[10px]">#{d1.number}</Text>
              </Pressable>
              <View className="px-4">
                <Text className="text-muted font-bold">VS</Text>
              </View>
              <Pressable
                onPress={() => onPickDriver(d2.number)}
                className="flex-1 items-center active:opacity-80">
                {d2.photo_url ? (
                  <Image
                    source={{ uri: d2.photo_url }}
                    style={{ width: 70, height: 70, borderRadius: 35 }}
                  />
                ) : null}
                <Text className="text-text font-bold text-sm mt-2" numberOfLines={1}>
                  {d2.full_name}
                </Text>
                <Text className="text-muted text-[10px]">#{d2.number}</Text>
              </Pressable>
            </View>
            {/* Stats bar — Points */}
            <H2HBar
              label="Очки"
              v1={d1.points}
              v2={d2.points}
              share1={d1Share}
              color={p.color}
            />
            <H2HBar
              label="Победы"
              v1={d1.wins}
              v2={d2.wins}
              share1={
                d1.wins + d2.wins > 0 ? d1.wins / (d1.wins + d2.wins) : 0.5
              }
              color={p.color}
            />
          </View>
        );
      })}
    </View>
  );
}

function H2HBar({
  label,
  v1,
  v2,
  share1,
  color,
}: {
  label: string;
  v1: number;
  v2: number;
  share1: number;
  color?: string;
}) {
  const winner1 = v1 > v2;
  const winner2 = v2 > v1;
  return (
    <View className="px-4 py-3 border-t border-line">
      <View className="flex-row justify-between mb-1.5">
        <Text className={`text-sm font-bold ${winner1 ? 'text-text' : 'text-muted'}`}>{v1}</Text>
        <Text className="text-muted text-[10px] tracking-widest uppercase">{label}</Text>
        <Text className={`text-sm font-bold ${winner2 ? 'text-text' : 'text-muted'}`}>{v2}</Text>
      </View>
      <View className="h-1.5 rounded-full overflow-hidden bg-surface-2">
        <View
          style={{
            width: `${Math.max(2, share1 * 100)}%`,
            height: '100%',
            backgroundColor: color || '#666',
          }}
        />
      </View>
    </View>
  );
}

// ============ PROGRESS CHART (SVG line) ============
function ProgressTab({
  data,
  totalRounds,
  loading,
}: {
  data: PointsProgressionDriver[];
  totalRounds: number;
  loading: boolean;
}) {
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const chartW = Math.min(Dimensions.get('window').width - 32, 480);
  const chartH = 260;
  const padL = 32;
  const padR = 12;
  const padT = 10;
  const padB = 26;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const maxPoints = useMemo(() => {
    let m = 0;
    for (const d of data) for (const p of d.progression) if (p.cumulative > m) m = p.cumulative;
    return Math.ceil((m + 1) / 50) * 50 || 100;
  }, [data]);

  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Нет данных" />;

  const xFor = (round: number) =>
    padL + (innerW * (round - 1)) / Math.max(1, totalRounds - 1);
  const yFor = (pts: number) => padT + innerH - (innerH * pts) / maxPoints;

  return (
    <View>
      <View className="px-4 mb-3">
        <Text className="text-text text-base font-bold mb-1">Прогресс по раундам</Text>
        <Text className="text-muted text-xs">Накопленные очки топ-10 пилотов</Text>
      </View>
      <View className="px-4 items-center">
        <Svg width={chartW} height={chartH}>
          {/* Y axis grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padT + innerH * (1 - f);
            const pts = Math.round(maxPoints * f);
            return (
              <Line
                key={f}
                x1={padL}
                x2={chartW - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}
          {[0, 0.5, 1].map((f) => {
            const y = padT + innerH * (1 - f);
            const pts = Math.round(maxPoints * f);
            return (
              <SvgText
                key={`l${f}`}
                x={4}
                y={y + 4}
                fill="#6B6B7B"
                fontSize={9}>
                {pts}
              </SvgText>
            );
          })}
          {/* X axis ticks */}
          {Array.from({ length: Math.min(totalRounds, 6) }).map((_, i) => {
            const round = Math.round(1 + (i * (totalRounds - 1)) / Math.max(1, Math.min(totalRounds, 6) - 1));
            return (
              <SvgText
                key={`x${round}`}
                x={xFor(round)}
                y={chartH - 8}
                fill="#6B6B7B"
                fontSize={9}
                textAnchor="middle">
                R{round}
              </SvgText>
            );
          })}
          {/* Lines */}
          {data.map((d) => {
            const points = d.progression
              .map((p) => `${xFor(p.round)},${yFor(p.cumulative)}`)
              .join(' ');
            const isDim = highlighted != null && highlighted !== d.driver_number;
            return (
              <Polyline
                key={d.driver_number}
                points={points}
                fill="none"
                stroke={d.team_color || '#666'}
                strokeWidth={highlighted === d.driver_number ? 3 : 1.8}
                opacity={isDim ? 0.2 : 1}
              />
            );
          })}
        </Svg>
      </View>

      {/* Legend with tap-to-highlight */}
      <View className="px-4 mt-4 flex-row flex-wrap gap-2">
        {data.map((d) => {
          const active = highlighted === d.driver_number;
          return (
            <Pressable
              key={d.driver_number}
              onPress={() =>
                setHighlighted(active ? null : d.driver_number)
              }
              className={`flex-row items-center px-2.5 py-1 rounded-full border ${
                active ? 'border-red' : 'border-line'
              }`}>
              <View
                className="w-2.5 h-2.5 rounded-full mr-1.5"
                style={{ backgroundColor: d.team_color || '#666' }}
              />
              <Text className="text-text text-[11px] font-bold">{d.code}</Text>
              <Text className="text-muted text-[10px] ml-1">{Math.round(d.total_points)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============ SHARED ============
function PodiumCard({
  d,
  rank,
  onPress,
}: {
  d: DriverStanding;
  rank: number;
  onPress: () => void;
}) {
  const accent = medalColor(rank - 1);
  const teamColor = d.team_color || '#666';
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl overflow-hidden border border-line active:opacity-80"
      style={{ backgroundColor: teamColor + '25' }}>
      <View
        className="absolute top-0 right-0 left-0 h-1"
        style={{ backgroundColor: teamColor }}
      />
      <View className="p-3 items-center">
        <Text className="font-extrabold text-2xl" style={{ color: accent }}>
          {rank}
        </Text>
        {d.photo_url ? (
          <Image
            source={{ uri: d.photo_url }}
            style={{ width: 56, height: 56, borderRadius: 28, marginTop: 4 }}
          />
        ) : null}
        <Text className="text-text font-bold text-xs mt-2 text-center" numberOfLines={1}>
          {d.last_name}
        </Text>
        <Text className="text-text font-extrabold text-base mt-0.5">{d.points}</Text>
        <Text className="text-muted text-[10px]">очков</Text>
      </View>
    </Pressable>
  );
}

function medalColor(i: number) {
  if (i === 0) return '#FFCB05';
  if (i === 1) return '#C0C0C0';
  if (i === 2) return '#CD7F32';
  return '#A0A0B0';
}

function EmptyHint({ text }: { text: string }) {
  return (
    <View className="px-5 py-10 items-center">
      <Text className="text-muted text-sm">{text}</Text>
    </View>
  );
}
