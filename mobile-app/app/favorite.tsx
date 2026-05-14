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
} from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

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

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} className="flex-1 items-center justify-center px-6">
          <Ionicons name="heart-outline" size={48} color="#6B6B7B" />
          <Text className="text-text font-bold text-lg mt-4">Войди в аккаунт</Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-surface px-6 py-3 rounded-full border border-line">
            <Text className="text-text font-bold">Назад</Text>
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
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-4 pt-2 pb-2 flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center">
            <Ionicons name="chevron-back" size={24} color="#FAFAFA" />
          </Pressable>
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
            Любимец сезона
          </Text>
        </View>

        <View className="px-5 mb-3">
          <Text className="text-muted text-xs leading-5">
            Выбери одного пилота и одну команду — они подсветятся в таблицах.
          </Text>
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

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 8 }}>
          {tab === 'Пилот' && drivers.isLoading && <ActivityIndicator color="#E10600" />}
          {tab === 'Пилот' &&
            drivers.data?.standings.map((d) => {
              const selected = user.favorite_driver === d.driver_number;
              return (
                <Pressable
                  key={d.driver_number}
                  onPress={() => pickDriver(d.driver_number)}
                  disabled={busy}
                  className={`rounded-xl p-3 flex-row items-center border active:opacity-80 ${
                    selected ? 'bg-red/15 border-red' : 'bg-surface border-line'
                  }`}>
                  <View
                    className="w-1 h-10 rounded-full mr-3"
                    style={{ backgroundColor: d.team_color || '#666' }}
                  />
                  {d.photo_url ? (
                    <Image
                      source={{ uri: d.photo_url }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : null}
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="text-text font-bold">{d.name}</Text>
                      <Text className="text-muted text-xs ml-2">{flagFor(d.country)}</Text>
                    </View>
                    <Text className="text-muted text-xs">{d.team}</Text>
                  </View>
                  {selected && <Ionicons name="heart" size={20} color="#E10600" />}
                </Pressable>
              );
            })}

          {tab === 'Команда' && constructors.isLoading && <ActivityIndicator color="#E10600" />}
          {tab === 'Команда' &&
            constructors.data?.standings.map((c) => {
              const selected = user.favorite_team === c.team;
              return (
                <Pressable
                  key={c.team}
                  onPress={() => pickTeam(c.team)}
                  disabled={busy}
                  className={`rounded-2xl p-4 flex-row items-center border active:opacity-80 ${
                    selected ? 'bg-red/15 border-red' : 'bg-surface border-line'
                  }`}
                  style={selected ? undefined : { backgroundColor: (c.team_color || '#666') + '15' }}>
                  <View
                    className="w-1.5 h-10 rounded-full mr-3"
                    style={{ backgroundColor: c.team_color || '#666' }}
                  />
                  <View className="flex-1">
                    <Text className="text-text font-extrabold">{c.team}</Text>
                    <Text className="text-muted text-xs mt-0.5">
                      {c.points} очков · P{c.position ?? '—'}
                    </Text>
                  </View>
                  {selected && <Ionicons name="heart" size={22} color="#E10600" />}
                </Pressable>
              );
            })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
