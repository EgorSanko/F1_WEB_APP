import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useDriver, flagFor, useTeams } from '@/lib/hooks';
import { CURRENT_SEASON, isSpoilerHidden, useSpoiler } from '@/lib/spoiler';
import { SpoilerCard } from '@/components/SpoilerCard';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

export default function DriverProfile() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const router = useRouter();
  const driver = useDriver(Number(number));
  const teams = useTeams();
  const spoilerEnabled = useSpoiler((s) => s.enabled);
  const spoilerHidden = isSpoilerHidden(CURRENT_SEASON, spoilerEnabled);
  const [revealed, setRevealed] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);

  const teamLogo = useMemo(() => {
    if (!driver.data?.team || !teams.data?.teams) return undefined;
    return teams.data.teams.find((t) => t.name === driver.data!.team)?.logo_url;
  }, [driver.data, teams.data]);

  if (driver.isLoading || !driver.data) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  const d = driver.data;
  const stats = d.season_stats;
  const teamColor = d.team_color || '#666';
  const isLeader = d.position === 1;
  const portrait = d.photo_url_large || d.card_photo_url || d.photo_url;

  const visibleResults = showAllResults ? stats.results : stats.results.slice(0, 5);

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
            }}
            numberOfLines={1}>
            {d.name}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          {/* Hero card */}
          <View
            style={{
              marginHorizontal: 16,
              borderRadius: 24,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: teamColor + '88',
              backgroundColor: CARD_BG,
              shadowColor: teamColor,
              shadowOpacity: 0.4,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 10,
            }}>
            {/* Tinted layer */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: teamColor + '28',
              }}
              pointerEvents="none"
            />
            {/* Right edge accent stripe */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: 4,
                backgroundColor: teamColor,
              }}
              pointerEvents="none"
            />

            <View style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 240 }}>
              {/* Info column */}
              <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 }}>
                <Text
                  style={{
                    color: teamColor,
                    fontSize: 32,
                    fontWeight: '800',
                    fontStyle: 'italic',
                    letterSpacing: -1,
                    lineHeight: 34,
                  }}>
                  #{d.driver_number} {d.code}
                </Text>
                <Text
                  style={{
                    color: '#FAFAFA',
                    fontSize: 24,
                    fontWeight: '300',
                    fontStyle: 'italic',
                    letterSpacing: -0.5,
                    marginTop: 10,
                    lineHeight: 28,
                  }}
                  numberOfLines={1}>
                  {d.first_name}
                </Text>
                <Text
                  style={{
                    color: '#FAFAFA',
                    fontSize: 28,
                    fontWeight: '800',
                    fontStyle: 'italic',
                    letterSpacing: -0.7,
                    lineHeight: 30,
                  }}
                  numberOfLines={1}>
                  {d.last_name}
                </Text>

                {/* Team line */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                  {teamLogo ? (
                    <Image
                      source={{ uri: teamLogo }}
                      style={{ width: 20, height: 20, marginRight: 6 }}
                      contentFit="contain"
                    />
                  ) : (
                    <View
                      style={{
                        width: 4,
                        height: 16,
                        borderRadius: 2,
                        backgroundColor: teamColor,
                        marginRight: 8,
                      }}
                    />
                  )}
                  <Text
                    style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '700' }}
                    numberOfLines={1}>
                    {d.team}
                  </Text>
                </View>

                {/* Country */}
                {d.country ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ fontSize: 15, marginRight: 6 }}>{flagFor(d.country)}</Text>
                    <Text style={{ color: '#A0A0B0', fontSize: 12, fontWeight: '700' }}>
                      {d.country}
                    </Text>
                  </View>
                ) : null}

                {/* Leader pill */}
                {isLeader ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: teamColor + '33',
                      borderWidth: 1,
                      borderColor: teamColor,
                    }}>
                    <Text
                      style={{
                        color: teamColor,
                        fontSize: 10,
                        fontWeight: '800',
                        letterSpacing: 0.8,
                      }}>
                      ★ ЛИДЕР ЧЕМПИОНАТА
                    </Text>
                  </View>
                ) : d.position ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 12,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: teamColor + '22',
                      borderWidth: 1,
                      borderColor: teamColor + '88',
                    }}>
                    <Text
                      style={{
                        color: teamColor,
                        fontSize: 10,
                        fontWeight: '800',
                        letterSpacing: 0.8,
                      }}>
                      P{d.position} В ЧЕМПИОНАТЕ
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Portrait */}
              <View
                style={{
                  width: 150,
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingRight: 8,
                }}>
                {portrait ? (
                  <Image
                    source={{ uri: portrait }}
                    style={{ width: 150, height: 220 }}
                    contentFit="contain"
                  />
                ) : null}
              </View>
            </View>
          </View>

          {/* 3 stat tiles */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              gap: 10,
              marginTop: 14,
            }}>
            <StatTile
              icon="trophy"
              label="Очки"
              value={spoilerHidden && !revealed ? '••' : String(Math.round(stats.points))}
              color={teamColor}
            />
            <StatTile
              icon="flag"
              label="Победы"
              value={spoilerHidden && !revealed ? '••' : String(stats.wins)}
              color={teamColor}
            />
            <StatTile
              icon="medal"
              label="Подиумы"
              value={spoilerHidden && !revealed ? '••' : String(stats.podiums)}
              color={teamColor}
            />
          </View>

          {/* Season stats list */}
          <View style={{ paddingHorizontal: 20, marginTop: 22, marginBottom: 10 }}>
            <Text style={{ color: '#FAFAFA', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
              Сезон {CURRENT_SEASON}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <View
              style={{
                backgroundColor: CARD_BG,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}>
              <Stat
                label="Очки"
                value={spoilerHidden && !revealed ? '••' : String(Math.round(stats.points))}
                color={teamColor}
              />
              <Stat label="Гонки" value={String(stats.races)} />
              <Stat
                label="Победы"
                value={spoilerHidden && !revealed ? '••' : String(stats.wins)}
                color={teamColor}
              />
              <Stat
                label="Подиумы"
                value={spoilerHidden && !revealed ? '••' : String(stats.podiums)}
                color={teamColor}
              />
              <Stat
                label="Лучший финиш"
                value={
                  spoilerHidden && !revealed
                    ? '••'
                    : stats.best_finish
                      ? `P${stats.best_finish}`
                      : '—'
                }
                color={teamColor}
              />
              <Stat
                label="Сходы"
                value={spoilerHidden && !revealed ? '••' : String(stats.dnfs)}
                last
              />
            </View>
          </View>

          {/* Race-by-race results */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginTop: 22,
              marginBottom: 10,
            }}>
            <Text
              style={{ color: '#FAFAFA', fontSize: 17, fontWeight: '800', letterSpacing: -0.3, flex: 1 }}>
              Результаты по гонкам
            </Text>
            {stats.results.length > 5 && !(spoilerHidden && !revealed) ? (
              <Pressable onPress={() => setShowAllResults((v) => !v)}>
                <Text style={{ color: teamColor, fontSize: 12, fontWeight: '700' }}>
                  {showAllResults ? 'Свернуть' : 'Смотреть все ›'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {spoilerHidden && !revealed ? (
            <SpoilerCard
              label="Результаты сезона скрыты"
              hint="Антиспойлер включён. Нажми чтобы посмотреть."
              onReveal={() => setRevealed(true)}
            />
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <View
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}>
                {visibleResults.map((r, i) => {
                  const dnf = r.status && r.status !== 'Finished' && r.status !== '+1 Lap';
                  const isPodium = r.position && r.position <= 3;
                  return (
                    <View
                      key={r.round}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderBottomWidth: i < visibleResults.length - 1 ? 1 : 0,
                        borderBottomColor: 'rgba(255,255,255,0.05)',
                      }}>
                      <Text
                        style={{
                          color: '#6B6B7B',
                          fontSize: 11,
                          fontWeight: '800',
                          letterSpacing: 0.8,
                          width: 32,
                        }}>
                        R{String(r.round).padStart(2, '0')}
                      </Text>
                      <Text
                        style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 4 }}
                        numberOfLines={1}>
                        {r.race}
                      </Text>
                      <Text
                        style={{
                          color: dnf ? '#6B6B7B' : isPodium ? teamColor : '#FAFAFA',
                          fontSize: 15,
                          fontWeight: '800',
                          marginRight: 10,
                          letterSpacing: -0.3,
                        }}>
                        {dnf ? 'DNF' : r.position ? `P${r.position}` : '—'}
                      </Text>
                      <Text
                        style={{
                          color: '#A0A0B0',
                          fontSize: 11,
                          fontWeight: '700',
                          minWidth: 56,
                          textAlign: 'right',
                        }}>
                        {Math.round(r.points)} очк.
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {d.teammate ? (
            <>
              <View style={{ paddingHorizontal: 20, marginTop: 22, marginBottom: 10 }}>
                <Text style={{ color: '#FAFAFA', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
                  Напарник
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  router.push((`/driver/${d.teammate!.driver_number}` as never) as never)
                }
                style={{
                  marginHorizontal: 16,
                  backgroundColor: CARD_BG,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                {d.teammate.photo_url ? (
                  <Image
                    source={{ uri: d.teammate.photo_url }}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      borderWidth: 2,
                      borderColor: teamColor,
                    }}
                    contentFit="cover"
                  />
                ) : null}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: '#FAFAFA', fontSize: 15, fontWeight: '800' }}>
                    {d.teammate.name}
                  </Text>
                  <Text style={{ color: '#A0A0B0', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
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

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color + '33',
        paddingVertical: 14,
        paddingHorizontal: 10,
        alignItems: 'center',
      }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: color + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ color, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ color: '#A0A0B0', fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  last,
}: {
  label: string;
  value: string;
  color?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}>
      <Text style={{ color: '#A0A0B0', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: color || '#FAFAFA', fontSize: 15, fontWeight: '800' }}>
        {value}
      </Text>
    </View>
  );
}
