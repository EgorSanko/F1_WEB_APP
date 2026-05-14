import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Prefs = { notify_race: boolean; notify_review: boolean };

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .pushPrefsGet()
      .then(setPrefs)
      .catch(() => setPrefs({ notify_race: true, notify_review: true }));
  }, [user]);

  const updatePref = async (key: keyof Prefs, value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setBusy(true);
    try {
      const saved = await api.pushPrefsSet(next);
      setPrefs(saved);
    } catch (e: unknown) {
      // revert on failure
      setPrefs(prefs);
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} className="flex-1 items-center justify-center px-6">
          <Ionicons name="notifications-off" size={48} color="#6B6B7B" />
          <Text className="text-text font-bold text-lg mt-4">Войди в аккаунт</Text>
          <Text className="text-muted text-sm mt-1 text-center">
            Уведомления настраиваются только для авторизованных пользователей.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-surface px-6 py-3 rounded-full border border-line">
            <Text className="text-text font-bold">Назад</Text>
          </Pressable>
        </SafeAreaView>
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
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
            Уведомления
          </Text>
        </View>

        {prefs == null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#E10600" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <View className="px-5 mt-2 mb-3">
              <Text className="text-muted text-xs leading-5">
                Push приходят на этот телефон. Выключи то, что не нужно.
              </Text>
            </View>

            <View className="mx-4 bg-surface rounded-2xl border border-line">
              <Row
                icon="flag"
                label="Старт гонки"
                hint="Уведомление за 2 часа и за 5 минут до старта"
                value={prefs.notify_race}
                onChange={(v) => updatePref('notify_race', v)}
                disabled={busy}
              />
              <View className="h-px bg-line mx-4" />
              <Row
                icon="film"
                label="Новый обзор гонки"
                hint="Когда выкладывается видео-обзор Гран-при"
                value={prefs.notify_review}
                onChange={(v) => updatePref('notify_review', v)}
                disabled={busy}
              />
            </View>

            <View className="mx-4 mt-4 bg-surface rounded-xl border border-line p-4 flex-row items-start">
              <Ionicons name="information-circle-outline" size={18} color="#A0A0B0" />
              <Text className="text-muted text-xs ml-2 flex-1 leading-5">
                Уведомления о результатах прогнозов приходят через Telegram-бота{' '}
                <Text className="text-text font-bold">@F1_egor_bot</Text>.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="px-4 py-4 flex-row items-center">
      <View className="w-10 h-10 rounded-full bg-surface-2 items-center justify-center">
        <Ionicons name={icon} size={18} color={value ? '#E10600' : '#A0A0B0'} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-text font-bold">{label}</Text>
        <Text className="text-muted text-xs mt-0.5">{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#2F2F3E', true: '#E10600' }}
        thumbColor="#fff"
      />
    </View>
  );
}
