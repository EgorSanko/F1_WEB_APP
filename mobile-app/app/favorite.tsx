import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import {
  flagFor,
  useConstructorStandings,
  useDriverStandings,
  useTeams,
} from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

const TABS = ['Пилот', 'Команда'] as const;
type Tab = (typeof TABS)[number];

export default function FavoriteScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('Пилот');
  const [busy, setBusy] = useState(false);

  const drivers = useDriverStandings();
  const constructors = useConstructorStandings();
  const teams = useTeams();
  const teamLogos = teams.data?.teams.reduce<Record<string, string>>((acc, t) => {
    if (t.logo_url) acc[t.name] = t.logo_url;
    return acc;
  }, {}) ?? {};

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          edges={['top']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="heart-outline" size={48} color="#6B6B7B" />
          <Text style={{ color: '#FAFAFA', fontSize: 18, fontWeight: '800', marginTop: 16 }}>
            Войди в аккаунт
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 20,
              backgroundColor: CARD_BG,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}>
            <Text style={{ color: '#FAFAFA', fontWeight: '700' }}>Назад</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const pickDriver = async (n: number) => {
    setBusy(true);
    try {
      await api.setFavorite({ driver: n });
      await refresh();
      queryClient.invalidateQueries();
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
    } finally {
      setBusy(false);
    }
  };

  const pickTeam = async (team: string) => {
    setBusy(true);
    try {
      await api.setFavorite({ team });
      await refresh();
      queryClient.invalidateQueries();
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header onBack={() => router.back()} title="Любимец сезона" />

        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <Text className="text-muted" style={{ fontSize: 12, lineHeight: 17 }}>
            Выбери одного пилота и одну команду — они подсветятся в таблицах и hub'е сезона.
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginBottom: 14,
            padding: 4,
            backgroundColor: CARD_BG,
            borderRadius: 999,
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
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: active ? '#E10600' : 'transparent',
                }}>
                <Text
                  style={{
                    color: active ? '#FAFAFA' : '#A0A0B0',
                    fontWeight: '800',
                    fontSize: 12,
                  }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
          showsVerticalScrollIndicator={false}>
          {tab === 'Пилот' && drivers.isLoading && (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#E10600" />
            </View>
          )}
          {tab === 'Пилот' &&
            drivers.data?.standings.map((d) => {
              const selected = user.favorite_driver === d.driver_number;
              const teamColor = d.team_color || '#666';
              const logo = d.team ? teamLogos[d.team] : undefined;
              return (
                <Pressable
                  key={d.driver_number}
                  onPress={() => pickDriver(d.driver_number)}
                  disabled={busy}
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: selected ? '#E10600' : 'rgba(255,255,255,0.05)',
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    overflow: 'hidden',
                    shadowColor: selected ? '#E10600' : 'transparent',
                    shadowOpacity: selected ? 0.3 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: selected ? 5 : 0,
                  }}>
                  <View
                    style={{
                      width: 4,
                      height: 42,
                      borderRadius: 2,
                      backgroundColor: teamColor,
                      marginRight: 10,
                    }}
                  />
                  {d.photo_url ? (
                    <Image
                      source={{ uri: d.photo_url }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#1A1A24',
                      }}
                    />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: '#FAFAFA', fontSize: 15, fontWeight: '800' }}>
                        {d.name}
                      </Text>
                      {d.country ? (
                        <Text style={{ fontSize: 13, marginLeft: 6 }}>{flagFor(d.country)}</Text>
                      ) : null}
                    </View>
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: teamColor,
                          marginRight: 5,
                        }}
                      />
                      <Text style={{ color: teamColor, fontSize: 11, fontWeight: '700' }}>
                        {d.team}
                      </Text>
                    </View>
                  </View>
                  {logo ? (
                    <Image
                      source={{ uri: logo }}
                      style={{ width: 26, height: 26, marginRight: 10 }}
                      contentFit="contain"
                    />
                  ) : null}
                  <Ionicons
                    name={selected ? 'heart' : 'heart-outline'}
                    size={22}
                    color={selected ? '#E10600' : '#3A3A4A'}
                  />
                </Pressable>
              );
            })}

          {tab === 'Команда' && constructors.isLoading && (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator color="#E10600" />
            </View>
          )}
          {tab === 'Команда' &&
            constructors.data?.standings.map((c) => {
              const selected = user.favorite_team === c.team;
              const teamColor = c.team_color || '#666';
              const logo = teamLogos[c.team];
              return (
                <Pressable
                  key={c.team}
                  onPress={() => pickTeam(c.team)}
                  disabled={busy}
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: selected ? '#E10600' : teamColor + '44',
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    overflow: 'hidden',
                    shadowColor: selected ? '#E10600' : 'transparent',
                    shadowOpacity: selected ? 0.3 : 0,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: selected ? 5 : 0,
                  }}>
                  <View
                    style={{
                      width: 4,
                      height: 44,
                      borderRadius: 2,
                      backgroundColor: teamColor,
                      marginRight: 12,
                    }}
                  />
                  {logo ? (
                    <Image
                      source={{ uri: logo }}
                      style={{ width: 44, height: 44 }}
                      contentFit="contain"
                    />
                  ) : (
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: teamColor + '22',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="car-sport" size={22} color={teamColor} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: '#FAFAFA', fontSize: 16, fontWeight: '800' }}>
                      {c.team}
                    </Text>
                    <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {c.points} очков · P{c.position ?? '—'}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'heart' : 'heart-outline'}
                    size={22}
                    color={selected ? '#E10600' : '#3A3A4A'}
                  />
                </Pressable>
              );
            })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 8,
      }}>
      <Pressable
        onPress={onBack}
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
        {title}
      </Text>
    </View>
  );
}
