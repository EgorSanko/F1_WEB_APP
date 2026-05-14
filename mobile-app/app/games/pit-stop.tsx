import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';

import { api } from '@/lib/api';

type WheelId = 'fl' | 'fr' | 'rl' | 'rr';
type State = 'ready' | 'playing' | 'finished';

const WHEEL_LABEL: Record<WheelId, string> = {
  fl: 'FL',
  fr: 'FR',
  rl: 'RL',
  rr: 'RR',
};

const STEP_LABELS = ['🔩 Открути', '🔄 Смени', '🔧 Закрути', '✅ Готово'];
const STEP_COLORS = ['#ff4444', '#ffaa00', '#44cc44', '#27F4D2'];

export default function PitStopGame() {
  const router = useRouter();
  const [state, setState] = useState<State>('ready');
  const [wheels, setWheels] = useState<Record<WheelId, number>>({ fl: 0, fr: 0, rl: 0, rr: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [achievementUnlocked, setAchievementUnlocked] = useState(false);
  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const start = () => {
    setWheels({ fl: 0, fr: 0, rl: 0, rr: 0 });
    setElapsed(0);
    setAchievementUnlocked(false);
    setState('playing');
    startRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 16);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const tapWheel = (id: WheelId) => {
    if (state !== 'playing') return;
    const cur = wheels[id];
    if (cur >= 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = { ...wheels, [id]: cur + 1 };
    setWheels(next);
    const allDone = (Object.values(next) as number[]).every((v) => v >= 3);
    if (allDone) {
      if (tickRef.current) clearInterval(tickRef.current);
      const total = Date.now() - startRef.current;
      setElapsed(total);
      setState('finished');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      api
        .gameResult({ game_type: 'pit_stop', score: total })
        .then((r) => {
          if (r.new_achievements?.includes('pit_master')) {
            setAchievementUnlocked(true);
          }
        })
        .catch(() => {});
    }
  };

  const timeStr = (ms: number) => (ms / 1000).toFixed(3) + 'с';

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
            🔧 Пит-стоп
          </Text>
        </View>

        {state === 'ready' && (
          <View className="flex-1 items-center justify-center px-6">
            <Text style={{ fontSize: 76 }}>🏎️</Text>
            <Text className="text-text text-center text-base mt-4 leading-5">
              Тапай по каждому колесу 3 раза:
            </Text>
            <Text className="text-muted text-sm mt-1 text-center">
              Открути → Смени → Закрути
            </Text>
            <Text className="text-muted-2 text-xs mt-2 text-center">
              Мировой рекорд Red Bull — 1.80с
            </Text>
            <Pressable
              onPress={start}
              className="bg-red rounded-2xl px-12 py-4 mt-8 active:opacity-80">
              <Text className="text-text font-extrabold text-lg">СТАРТ</Text>
            </Pressable>
          </View>
        )}

        {state === 'playing' && (
          <View className="flex-1">
            {/* Timer */}
            <View className="items-center mt-2 mb-4">
              <Text
                className="text-red font-extrabold"
                style={{ fontSize: 36, fontVariant: ['tabular-nums'] }}>
                {timeStr(elapsed)}
              </Text>
            </View>
            <View className="flex-row flex-wrap justify-center" style={{ gap: 12, paddingHorizontal: 16 }}>
              {(['fl', 'fr', 'rl', 'rr'] as WheelId[]).map((id) => {
                const step = wheels[id];
                const done = step >= 3;
                return (
                  <Pressable
                    key={id}
                    onPress={() => tapWheel(id)}
                    disabled={done}
                    className="rounded-2xl items-center justify-center"
                    style={{
                      width: '46%',
                      paddingVertical: 26,
                      paddingHorizontal: 16,
                      backgroundColor: done ? 'rgba(39,244,210,0.15)' : 'rgba(255,255,255,0.06)',
                      borderWidth: 3,
                      borderColor: STEP_COLORS[step],
                    }}>
                    <Text className="text-muted font-extrabold text-base">
                      {WHEEL_LABEL[id]}
                    </Text>
                    <Text style={{ fontSize: 36, marginTop: 4 }}>{done ? '✅' : '🔴'}</Text>
                    <Text
                      className="font-bold text-sm mt-2"
                      style={{ color: STEP_COLORS[step] }}>
                      {STEP_LABELS[step]}
                    </Text>
                    <View className="flex-row gap-1.5 mt-2">
                      {[0, 1, 2].map((i) => (
                        <View
                          key={i}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: i < step ? STEP_COLORS[2] : 'rgba(255,255,255,0.15)',
                          }}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {state === 'finished' && (
          <View className="flex-1 items-center justify-center px-6">
            <Text style={{ fontSize: 72 }}>
              {elapsed < 2000 ? '🏆' : elapsed < 3000 ? '🥈' : elapsed < 5000 ? '👍' : '😅'}
            </Text>
            <Text
              className="text-green-500 font-extrabold mt-2"
              style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}>
              {timeStr(elapsed)}
            </Text>
            <Text className="text-muted text-sm mt-1">
              {elapsed < 2000
                ? 'Мировой уровень!'
                : elapsed < 2500
                  ? 'Отличный пит-стоп!'
                  : elapsed < 3500
                    ? 'Неплохо!'
                    : 'Тренируйся!'}
            </Text>
            {achievementUnlocked && (
              <View className="bg-red px-4 py-2 rounded-full mt-4">
                <Text className="text-text font-bold text-xs">🏅 Pit Master разблокирован!</Text>
              </View>
            )}
            <View className="flex-row gap-3 mt-8">
              <Pressable
                onPress={start}
                className="bg-red rounded-2xl px-6 py-3 active:opacity-80">
                <Text className="text-text font-bold">Ещё раз</Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                className="bg-surface rounded-2xl px-6 py-3 border border-line">
                <Text className="text-text font-bold">Назад</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
