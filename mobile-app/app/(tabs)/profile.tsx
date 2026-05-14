import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Polygon } from 'react-native-svg';
import { router } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { useSpoiler } from '@/lib/spoiler';
import { absUrl, api, setTgAuth } from '@/lib/api';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';
const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: string;
};

const MENU: MenuItem[] = [
  { icon: 'trending-up', label: 'Мои прогнозы', href: '/my-predictions' },
  { icon: 'heart', label: 'Любимец сезона', href: '/favorite' },
  { icon: 'game-controller', label: 'Игры', href: '/games' },
  { icon: 'people', label: 'Топ игроков', href: '/leaderboard' },
  { icon: 'podium', label: 'Чемпионат', href: '/standings' },
  { icon: 'newspaper', label: 'Новости', href: '/news' },
];

export default function ProfileScreen() {
  const { user, isAdmin, isLoading, refresh, logout } = useAuth();
  const spoilerEnabled = useSpoiler((s) => s.enabled);
  const toggleSpoiler = useSpoiler((s) => s.toggle);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const openBot = async () => {
    setShowCodeForm(true);
    try {
      await Linking.openURL('https://t.me/F1_egor_bot?start=code');
    } catch {
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
      await setTgAuth(res.token);
      await refresh();
      setShowCodeForm(false);
      setCode('');
    } catch (e: unknown) {
      Alert.alert('Не удалось войти', e instanceof Error ? e.message : 'Неизвестная ошибка');
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
      <View style={{ flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E10600" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 }}>
              <Text style={{ color: '#FAFAFA', fontSize: 32, fontWeight: '800' }}>Профиль</Text>
            </View>

            <View
              style={{
                marginHorizontal: 16,
                marginTop: 8,
                backgroundColor: CARD_BG,
                borderRadius: 18,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
              }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#1A1A24',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#E10600',
                }}>
                <Ionicons name="person" size={40} color="#A0A0B0" />
              </View>
              <Text style={{ color: '#FAFAFA', fontSize: 16, fontWeight: '800', marginTop: 16 }}>
                Войдите, чтобы делать прогнозы
              </Text>
              <Text className="text-muted text-sm mt-1 text-center">
                Сохраняем статистику, push о гонках
              </Text>
              <Pressable
                onPress={openBot}
                style={{
                  backgroundColor: '#E10600',
                  borderRadius: 999,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 18,
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="paper-plane" size={16} color="#fff" />
                <Text className="text-text font-bold ml-2">Войти через Telegram</Text>
              </Pressable>
            </View>

            {showCodeForm && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  backgroundColor: CARD_BG,
                  borderRadius: 18,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}>
                <Text className="text-text font-bold mb-1">Введите код из Telegram</Text>
                <Text className="text-muted text-xs mb-3" style={{ lineHeight: 16 }}>
                  В чате с @F1_egor_bot отправь команду{' '}
                  <Text className="text-text font-bold">/code</Text> — бот пришлёт 6-значный
                  код. Введи его ниже.
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor="#6B6B7B"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  style={{
                    backgroundColor: '#1A1A24',
                    color: '#FAFAFA',
                    fontSize: 22,
                    fontWeight: '800',
                    textAlign: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                    letterSpacing: 8,
                  }}
                />
                <Pressable
                  onPress={submitCode}
                  disabled={busy || code.length < 4}
                  style={{
                    backgroundColor: '#E10600',
                    borderRadius: 999,
                    paddingVertical: 12,
                    marginTop: 12,
                    alignItems: 'center',
                    opacity: busy || code.length < 4 ? 0.5 : 1,
                  }}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-text font-bold">Войти</Text>
                  )}
                </Pressable>
                <Pressable onPress={openBot} style={{ paddingVertical: 12, alignItems: 'center' }}>
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
  const points = user.points ?? 0;
  const predTotal = user.predictions_total ?? 0;
  const predCorrect = user.predictions_correct ?? 0;
  const accuracy = predTotal ? Math.round((predCorrect / predTotal) * 100) : 0;
  const achCount = user.achievements_count ?? 0;
  const achTotal = user.achievements_total ?? 12;

  // 4 milestone achievements shown as badges
  const achievementsPreview = [
    {
      icon: 'flag' as const,
      label: 'Первые шаги',
      desc: 'Сделал 1 прогноз',
      unlocked: predTotal >= 1,
    },
    {
      icon: 'trophy' as const,
      label: 'Профи',
      desc: 'Сделал 10 прогнозов',
      unlocked: predTotal >= 10,
    },
    {
      icon: 'locate' as const,
      label: 'Точный глаз',
      desc: 'Точность 70%+',
      unlocked: accuracy >= 70 && predTotal >= 5,
    },
    {
      icon: 'ribbon' as const,
      label: 'Эксперт',
      desc: 'Сделал 50 прогнозов',
      unlocked: predTotal >= 50,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header with F1 car decoration */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 6,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            height: 60,
          }}>
          <Text style={{ color: '#FAFAFA', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>
            Профиль
          </Text>
          <Pressable
            onPress={() => router.push('/notifications' as never)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: CARD_BG,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}
            hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color="#FAFAFA" />
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: '#E10600',
                borderWidth: 1.5,
                borderColor: DARK_BG,
              }}
            />
          </Pressable>
          <Image
            source={{ uri: CAR_OVERLAY }}
            style={{
              position: 'absolute',
              right: -30,
              top: -30,
              width: 320,
              height: 160,
              opacity: 0.25,
            }}
            contentFit="contain"
            pointerEvents="none"
          />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          {/* User row */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  borderWidth: 2,
                  borderColor: '#E10600',
                  padding: 3,
                  shadowColor: '#E10600',
                  shadowOpacity: 0.4,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 6,
                }}>
                {absUrl(user.photo_url) ? (
                  <Image
                    source={{ uri: absUrl(user.photo_url) }}
                    style={{ width: '100%', height: '100%', borderRadius: 48 }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 48,
                      backgroundColor: '#1A1A24',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="person" size={42} color="#A0A0B0" />
                  </View>
                )}
              </View>
              <View
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: CARD_BG,
                  borderWidth: 2,
                  borderColor: DARK_BG,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="camera" size={14} color="#A0A0B0" />
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 18, justifyContent: 'center' }}>
              <Text style={{ color: '#FAFAFA', fontSize: 26, fontWeight: '800' }}>
                {displayName}
              </Text>
              {handle ? (
                <Text className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {handle}
                </Text>
              ) : null}
              {isAdmin ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#E10600',
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 5,
                    marginTop: 8,
                  }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>
                    АДМИН
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Bio */}
          <Text
            className="text-muted"
            style={{ fontSize: 13, lineHeight: 18, paddingHorizontal: 20, marginTop: 14 }}
            numberOfLines={3}>
            Фанат Формулы-1 и скорости. Аналитика, прогнозы и гонки! 🏁
          </Text>

          {/* Stats card */}
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 18,
              backgroundColor: CARD_BG,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
              flexDirection: 'row',
              paddingVertical: 16,
            }}>
            <StatCell icon="trophy" value={points.toLocaleString('ru-RU')} label="Очков" />
            <StatDivider />
            <StatCell icon="trending-up" value={String(predTotal)} label="Прогнозов" />
            <StatDivider />
            <StatCell icon="locate" value={`${accuracy}%`} label="Точность" />
          </View>

          {/* Premium banner */}
          <Pressable
            onPress={() =>
              Alert.alert('Премиум статус', 'Скоро. Больше возможностей для подписчиков.')
            }
            style={{
              marginHorizontal: 16,
              marginTop: 10,
              backgroundColor: CARD_BG,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(225,6,0,0.18)',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
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
              <Ionicons name="shield-checkmark" size={20} color="#E10600" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: '#FAFAFA', fontSize: 15, fontWeight: '800' }}>
                Премиум статус
              </Text>
              <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                Больше возможностей и эксклюзивный контент
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
          </Pressable>

          {/* Achievements */}
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              backgroundColor: CARD_BG,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
              padding: 16,
            }}>
            <Pressable
              onPress={() => router.push('/achievements' as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}>
              <Text style={{ color: '#FAFAFA', fontSize: 18, fontWeight: '800' }}>
                Достижения
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#E10600', fontSize: 13, fontWeight: '800' }}>
                  {achCount} / {achTotal}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#E10600" style={{ marginLeft: 4 }} />
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {achievementsPreview.map((a) => (
                <AchievementBadge
                  key={a.label}
                  icon={a.icon}
                  label={a.label}
                  desc={a.desc}
                  unlocked={a.unlocked}
                />
              ))}
            </View>

            {/* Spoiler toggle inline at the bottom of achievements card */}
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.06)',
                marginTop: 16,
                marginBottom: 4,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(225,6,0,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons
                  name={spoilerEnabled ? 'eye-off' : 'eye'}
                  size={18}
                  color="#E10600"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#FAFAFA', fontSize: 14, fontWeight: '800' }}>
                  Антиспойлер
                </Text>
                <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                  Скрывает результаты гонок и таблицу сезона
                </Text>
              </View>
              <Switch
                value={spoilerEnabled}
                onValueChange={toggleSpoiler}
                trackColor={{ false: '#2A2A38', true: '#E10600' }}
                thumbColor="#fff"
                ios_backgroundColor="#2A2A38"
              />
            </View>
          </View>

          {/* Menu */}
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 10,
              backgroundColor: CARD_BG,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
            }}>
            {MENU.map((m, i) => (
              <Pressable
                key={m.label}
                onPress={() => router.push(m.href as never)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderBottomWidth: i < MENU.length - 1 ? 1 : 0,
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: 'rgba(225,6,0,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={m.icon} size={15} color="#E10600" />
                </View>
                <Text style={{ color: '#FAFAFA', fontSize: 15, marginLeft: 14, flex: 1 }}>
                  {m.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </Pressable>
            ))}
          </View>

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              paddingVertical: 14,
              alignItems: 'center',
            }}>
            <Text style={{ color: '#E10600', fontSize: 14, fontWeight: '700' }}>
              Выйти из аккаунта
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ STAT CELL ============

function StatCell({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={16} color="#E10600" style={{ marginRight: 6 }} />
        <Text style={{ color: '#FAFAFA', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>
          {value}
        </Text>
      </View>
      <Text className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

function StatDivider() {
  return <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 }} />;
}

// ============ ACHIEVEMENT BADGE ============

function AchievementBadge({
  icon,
  label,
  desc,
  unlocked,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  unlocked: boolean;
}) {
  const color = unlocked ? '#E10600' : '#3A3A4A';
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View
        style={{
          width: 60,
          height: 66,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          shadowColor: unlocked ? '#E10600' : 'transparent',
          shadowOpacity: unlocked ? 0.4 : 0,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: unlocked ? 4 : 0,
        }}>
        <Svg width={60} height={66} viewBox="0 0 60 66" style={{ position: 'absolute' }}>
          <Polygon
            points="30,2 56,16 56,50 30,64 4,50 4,16"
            fill={CARD_BG}
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
        <Ionicons name={icon} size={22} color={unlocked ? '#FAFAFA' : '#6B6B7B'} />
      </View>
      <Text
        style={{
          color: unlocked ? '#FAFAFA' : '#A0A0B0',
          fontSize: 11,
          fontWeight: '800',
          marginTop: 8,
          textAlign: 'center',
        }}
        numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={{ color: '#6B6B7B', fontSize: 9, marginTop: 2, textAlign: 'center' }}
        numberOfLines={2}>
        {desc}
      </Text>
    </View>
  );
}
