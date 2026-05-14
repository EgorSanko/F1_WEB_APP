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

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

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
      setPrefs(prefs);
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          edges={['top']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="notifications-off" size={48} color="#6B6B7B" />
          <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 18, marginTop: 16 }}>
            Войди в аккаунт
          </Text>
          <Text
            style={{ color: '#A0A0B0', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            Уведомления настраиваются только для авторизованных пользователей.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 24,
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

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header onBack={() => router.back()} title="Уведомления" />

        {prefs == null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#E10600" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
              <Text className="text-muted" style={{ fontSize: 12, lineHeight: 17 }}>
                Push приходят на этот телефон. Выключи то, что не нужно.
              </Text>
            </View>

            <View
              style={{
                marginHorizontal: 16,
                backgroundColor: CARD_BG,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}>
              <Row
                icon="flag"
                label="Старт гонки"
                hint="Уведомление за 2 часа и за 5 минут до старта"
                value={prefs.notify_race}
                onChange={(v) => updatePref('notify_race', v)}
                disabled={busy}
                isLast={false}
              />
              <Row
                icon="film"
                label="Новый обзор гонки"
                hint="Когда выкладывается видео-обзор Гран-при"
                value={prefs.notify_review}
                onChange={(v) => updatePref('notify_review', v)}
                disabled={busy}
                isLast
              />
            </View>

            <View
              style={{
                marginHorizontal: 16,
                marginTop: 14,
                backgroundColor: CARD_BG,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}>
                <Ionicons name="information" size={16} color="#A0A0B0" />
              </View>
              <Text
                className="text-muted"
                style={{ fontSize: 12, marginLeft: 10, flex: 1, lineHeight: 17 }}>
                Уведомления о результатах прогнозов приходят через Telegram-бота{' '}
                <Text style={{ color: '#FAFAFA', fontWeight: '700' }}>@F1_egor_bot</Text>.
              </Text>
            </View>
          </ScrollView>
        )}
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

function Row({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  isLast: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
      }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: 'rgba(225,6,0,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={18} color="#E10600" />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 14 }}>{label}</Text>
        <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
          {hint}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#2A2A38', true: '#E10600' }}
        thumbColor="#fff"
      />
    </View>
  );
}
