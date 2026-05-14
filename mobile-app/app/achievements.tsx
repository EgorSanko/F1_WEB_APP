import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon } from 'react-native-svg';
import { Stack, useRouter } from 'expo-router';

import { useAchievements } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import type { UnlockedAchievement } from '@/lib/api';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

const ACHIEVEMENTS: { key: string; name: string; desc: string; icon: string }[] = [
  { key: 'first_prediction', name: 'Первый прогноз', desc: 'Сделай свой первый прогноз', icon: '🔮' },
  { key: 'first_win', name: 'Первая победа', desc: 'Угадай победителя гонки', icon: '🏆' },
  { key: 'perfect_podium', name: 'Идеальный подиум', desc: 'Угадай весь подиум', icon: '🥇' },
  { key: 'streak_3', name: 'Хет-трик', desc: '3 правильных прогноза подряд', icon: '🔥' },
  { key: 'streak_5', name: 'На серии!', desc: '5 правильных прогнозов подряд', icon: '⚡' },
  { key: 'streak_10', name: 'Непобедимый', desc: '10 правильных прогнозов подряд', icon: '👑' },
  { key: 'points_500', name: 'Полтысячи', desc: 'Набери 500 очков', icon: '💰' },
  { key: 'points_1000', name: 'Тысячник', desc: 'Набери 1000 очков', icon: '💎' },
  { key: 'games_10', name: 'Игрок', desc: 'Сыграй в 10 мини-игр', icon: '🎮' },
  { key: 'pit_master', name: 'Мастер пит-стопов', desc: 'Пит-стоп быстрее 2.0 секунд', icon: '🔧' },
  { key: 'reaction_god', name: 'Реакция бога', desc: 'Реакция быстрее 0.2 секунд', icon: '⚡' },
  { key: 'all_predictions', name: 'Аналитик', desc: 'Сделай все 5 типов прогнозов', icon: '📊' },
];

export default function AchievementsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const ach = useAchievements(!!user);

  const unlockedKeys = useMemo(() => {
    if (!ach.data) return new Set<string>();
    const list = Array.isArray(ach.data) ? ach.data : ach.data.achievements;
    return new Set(list.map((a: UnlockedAchievement) => a.key));
  }, [ach.data]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          edges={['top']}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="trophy" size={48} color="#6B6B7B" />
          <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 18, marginTop: 16 }}>
            Войди в аккаунт
          </Text>
          <Text style={{ color: '#A0A0B0', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            Чтобы видеть открытые достижения и зарабатывать новые.
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

  const unlockedCount = unlockedKeys.size;
  const total = ACHIEVEMENTS.length;
  const percent = Math.round((unlockedCount / total) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header onBack={() => router.back()} title="Достижения" />

        {/* Progress card */}
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 16,
            backgroundColor: CARD_BG,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(225,6,0,0.18)',
            padding: 16,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: 'rgba(225,6,0,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="trophy" size={22} color="#E10600" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#FAFAFA', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>
                {unlockedCount} / {total}
              </Text>
              <Text style={{ color: '#A0A0B0', fontSize: 11, marginTop: 2 }}>Разблокировано</Text>
            </View>
            <Text style={{ color: '#E10600', fontSize: 22, fontWeight: '800' }}>{percent}%</Text>
          </View>
          {/* Progress bar */}
          <View
            style={{
              height: 6,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 3,
              marginTop: 12,
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: `${percent}%`,
                backgroundColor: '#E10600',
                borderRadius: 3,
              }}
            />
          </View>
        </View>

        {ach.isLoading && (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator color="#E10600" />
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 120 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {ACHIEVEMENTS.map((a) => {
              const unlocked = unlockedKeys.has(a.key);
              return (
                <View
                  key={a.key}
                  style={{ width: '50%', paddingHorizontal: 4, marginBottom: 10 }}>
                  <View
                    style={{
                      backgroundColor: CARD_BG,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: unlocked ? 'rgba(225,6,0,0.4)' : 'rgba(255,255,255,0.05)',
                      padding: 14,
                      alignItems: 'center',
                      aspectRatio: 0.95,
                      shadowColor: unlocked ? '#E10600' : 'transparent',
                      shadowOpacity: unlocked ? 0.25 : 0,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: unlocked ? 4 : 0,
                    }}>
                    {/* Hex frame */}
                    <View
                      style={{ width: 64, height: 70, alignItems: 'center', justifyContent: 'center' }}>
                      <Svg
                        width={64}
                        height={70}
                        viewBox="0 0 64 70"
                        style={{ position: 'absolute' }}>
                        <Polygon
                          points="32,3 59,17 59,53 32,67 5,53 5,17"
                          fill="rgba(255,255,255,0.03)"
                          stroke={unlocked ? '#E10600' : '#3A3A4A'}
                          strokeWidth={1.8}
                        />
                      </Svg>
                      <Text style={{ fontSize: 32, opacity: unlocked ? 1 : 0.25 }}>{a.icon}</Text>
                    </View>
                    <Text
                      style={{
                        color: unlocked ? '#FAFAFA' : '#6B6B7B',
                        fontWeight: '800',
                        fontSize: 13,
                        marginTop: 8,
                        textAlign: 'center',
                      }}
                      numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text
                      style={{
                        color: unlocked ? '#A0A0B0' : '#3A3A4A',
                        fontSize: 10.5,
                        marginTop: 3,
                        textAlign: 'center',
                        lineHeight: 13,
                      }}
                      numberOfLines={3}>
                      {a.desc}
                    </Text>
                    {!unlocked && (
                      <View style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Ionicons name="lock-closed" size={12} color="#3A3A4A" />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
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
