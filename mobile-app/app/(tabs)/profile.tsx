import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { useAuth } from '@/lib/auth';
import { api, setTgAuth } from '@/lib/api';
import { router } from 'expo-router';

const MENU: { icon: keyof typeof Ionicons.glyphMap; label: string; href?: string }[] = [
  { icon: 'list-outline', label: 'Мои прогнозы', href: '/my-predictions' },
  { icon: 'people-outline', label: 'Топ игроков', href: '/leaderboard' },
  { icon: 'podium-outline', label: 'Таблица сезона', href: '/standings' },
  { icon: 'newspaper-outline', label: 'Новости', href: '/news' },
  { icon: 'notifications-outline', label: 'Уведомления' },
  { icon: 'settings-outline', label: 'Настройки' },
  { icon: 'help-circle-outline', label: 'Поддержка' },
];

export default function ProfileScreen() {
  const { user, isAdmin, isLoading, refresh, logout } = useAuth();
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const openBot = async () => {
    setShowCodeForm(true);
    try {
      await Linking.openURL('https://t.me/F1_egor_bot?start=code');
    } catch {
      // tg:// fallback
      try {
        await Linking.openURL('tg://resolve?domain=F1_egor_bot');
      } catch {
        Alert.alert(
          'Telegram не открылся',
          'Открой Telegram вручную, напиши боту @F1_egor_bot команду /code и введи код ниже.',
        );
      }
    }
  };

  const submitCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Введите код');
      return;
    }
    setBusy(true);
    try {
      const res = await api.authCode(trimmed);
      // `token` is the Login-Widget-compatible query string we send as TgLogin header
      await setTgAuth(res.token);
      await refresh();
      setShowCodeForm(false);
      setCode('');
    } catch (e: unknown) {
      Alert.alert(
        'Не удалось войти',
        e instanceof Error ? e.message : 'Неизвестная ошибка',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Точно выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: logout },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator size="large" color="#E10600" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <SafeAreaView edges={['top']} className="flex-1">
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <View className="px-5 pt-2 pb-3">
              <Text className="text-text text-3xl font-extrabold">Профиль</Text>
            </View>

            <View className="mx-4 mt-4 bg-surface rounded-2xl p-6 border border-line items-center">
              <View className="w-20 h-20 rounded-full bg-surface-2 items-center justify-center">
                <Ionicons name="person" size={40} color="#A0A0B0" />
              </View>
              <Text className="text-text text-lg font-bold mt-4">
                Войдите, чтобы делать прогнозы
              </Text>
              <Text className="text-muted text-sm mt-1 text-center">
                Сохраняем статистику, push о гонках
              </Text>
              <Pressable
                onPress={openBot}
                className="bg-red rounded-full px-6 py-3 mt-5 w-full items-center flex-row justify-center active:opacity-80">
                <Ionicons name="paper-plane" size={16} color="#fff" />
                <Text className="text-text font-bold ml-2">Войти через Telegram</Text>
              </Pressable>
            </View>

            {showCodeForm && (
              <View className="mx-4 mt-3 bg-surface rounded-2xl p-5 border border-line">
                <Text className="text-text font-bold mb-1">Введите код из Telegram</Text>
                <Text className="text-muted text-xs mb-3 leading-5">
                  В чате с @F1_egor_bot отправь команду <Text className="text-text font-bold">/code</Text> — бот пришлёт 6-значный код. Введи его ниже.
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor="#6B6B7B"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  className="bg-surface-2 text-text text-2xl font-extrabold tracking-[8px] text-center px-4 py-3 rounded-xl border border-line"
                  style={{ letterSpacing: 8 }}
                />
                <Pressable
                  onPress={submitCode}
                  disabled={busy || code.length < 4}
                  className={`bg-red rounded-full py-3 mt-3 items-center ${
                    busy || code.length < 4 ? 'opacity-50' : ''
                  }`}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-text font-bold">Войти</Text>
                  )}
                </Pressable>
                <Pressable onPress={openBot} className="py-3 items-center">
                  <Text className="text-muted text-sm">Открыть бота ещё раз</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Authenticated state
  const displayName = user.first_name || user.username || 'Пользователь';
  const handle = user.username ? `@${user.username}` : '';

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <Text className="text-text text-3xl font-extrabold">Профиль</Text>
          <Pressable className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-line">
            <Ionicons name="settings-outline" size={20} color="#FAFAFA" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <View className="items-center mt-4">
            {user.photo_url ? (
              <Image
                source={{ uri: user.photo_url }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
                contentFit="cover"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-surface items-center justify-center border-2 border-red">
                <Ionicons name="person" size={48} color="#A0A0B0" />
              </View>
            )}
            <Text className="text-text text-2xl font-extrabold mt-3">{displayName}</Text>
            {handle ? <Text className="text-muted text-sm">{handle}</Text> : null}
            {isAdmin ? (
              <View className="bg-red px-3 py-1 rounded-full mt-2">
                <Text className="text-text text-[11px] font-bold tracking-widest">АДМИН</Text>
              </View>
            ) : (
              <View className="bg-surface-2 px-3 py-1 rounded-full mt-2">
                <Text className="text-muted text-[11px] font-bold tracking-widest">
                  ID {user.user_id}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row mt-6 px-4">
            <View className="flex-1 items-center">
              <Text className="text-text text-2xl font-extrabold">
                {(user.points ?? 0).toLocaleString('ru-RU')}
              </Text>
              <Text className="text-muted text-xs mt-1">Очков</Text>
            </View>
            <View className="w-px bg-line" />
            <View className="flex-1 items-center">
              <Text className="text-text text-2xl font-extrabold">
                {user.predictions_total ?? 0}
              </Text>
              <Text className="text-muted text-xs mt-1">Прогнозов</Text>
            </View>
            <View className="w-px bg-line" />
            <View className="flex-1 items-center">
              <Text className="text-text text-2xl font-extrabold">
                {user.predictions_total
                  ? Math.round(((user.predictions_correct ?? 0) / user.predictions_total) * 100)
                  : 0}
                %
              </Text>
              <Text className="text-muted text-xs mt-1">Точность</Text>
            </View>
          </View>

          <View className="px-5 mt-7 flex-row items-center justify-between">
            <Text className="text-text text-lg font-extrabold">Достижения</Text>
            <Text className="text-muted text-sm font-semibold">
              {user.achievements_count ?? 0} / {user.achievements_total ?? 0}
            </Text>
          </View>

          <View className="px-4 mt-6">
            {MENU.map((m, i) => (
              <Pressable
                key={i}
                onPress={() => m.href && router.push(m.href as never)}
                className={`flex-row items-center py-4 ${
                  i < MENU.length - 1 ? 'border-b border-line' : ''
                }`}>
                <Ionicons name={m.icon} size={22} color="#A0A0B0" />
                <Text className="text-text text-base ml-3 flex-1">{m.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleLogout} className="px-4 mt-2">
            <View className="flex-row items-center py-4 border-t border-line">
              <Ionicons name="log-out-outline" size={22} color="#E10600" />
              <Text className="text-red text-base font-semibold ml-3 flex-1">Выйти</Text>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
