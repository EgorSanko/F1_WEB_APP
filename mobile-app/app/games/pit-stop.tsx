import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';

import { api } from '@/lib/api';

const WHEELS = ['FL', 'FR', 'RL', 'RR'] as const;
type Wheel = (typeof WHEELS)[number];

const WHEEL_LABEL: Record<Wheel, string> = {
  FL: 'Передняя левая',
  FR: 'Передняя правая',
  RL: 'Задняя левая',
  RR: 'Задняя правая',
};

type State = 'idle' | 'running' | 'done';

export default function PitStopGame() {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [done, setDone] = useState<Set<Wheel>>(new Set());
  const [ms, setMs] = useState(0);
  const [achievement, setAchievement] = useState<string | null>(null);
  const startRef = useRef(0);

  const start = () => {
    setDone(new Set());
    setAchievement(null);
    setMs(0);
    startRef.current = Date.now();
    setState('running');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const tapWheel = (w: Wheel) => {
    if (state !== 'running' || done.has(w)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = new Set(done);
    next.add(w);
    setDone(next);
    if (next.size === 4) {
      const dt = Date.now() - startRef.current;
      setMs(dt);
      setState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      submit(dt);
    }
  };

  const submit = async (score: number) => {
    try {
      const res = await api.gameResult({ game_type: 'pit_stop', score });
      if (res.new_achievements?.includes('pit_master')) {
        setAchievement('pit_master');
      }
    } catch {}
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
            Пит-стоп
          </Text>
        </View>

        <View className="px-5 mb-4">
          <Text className="text-muted text-sm leading-5">
            После «Старт» тапни все 4 колеса как можно быстрее. Быстрее{' '}
            <Text className="text-red font-bold">2 сек</Text> — ачивка Pit Master.
          </Text>
        </View>

        {state === 'done' && (
          <View className="mx-4 mb-4 bg-surface rounded-2xl border border-line p-5 items-center">
            <Text className="text-muted text-xs tracking-widest font-bold">РЕЗУЛЬТАТ</Text>
            <Text className="text-text text-4xl font-extrabold mt-1">
              {(ms / 1000).toFixed(2)} с
            </Text>
            <Text className="text-muted text-sm mt-1">
              {ms < 2000 ? 'Мирового уровня' : ms < 3500 ? 'Хороший пит-стоп' : 'Среднее'}
            </Text>
            {achievement === 'pit_master' && (
              <View className="bg-red px-3 py-1.5 rounded-full mt-3">
                <Text className="text-text font-bold text-xs">🏆 Pit Master разблокирована</Text>
              </View>
            )}
          </View>
        )}

        {/* Car illustration with 4 wheels */}
        <View className="flex-1 items-center justify-center">
          <View
            className="bg-surface rounded-3xl border border-line"
            style={{ width: 260, height: 360, padding: 24, position: 'relative' }}>
            {/* Top: FL, FR */}
            <View className="flex-row justify-between">
              <WheelButton
                wheel="FL"
                ready={state === 'running'}
                done={done.has('FL')}
                onPress={() => tapWheel('FL')}
              />
              <WheelButton
                wheel="FR"
                ready={state === 'running'}
                done={done.has('FR')}
                onPress={() => tapWheel('FR')}
              />
            </View>
            {/* Body */}
            <View className="flex-1 items-center justify-center">
              <View className="w-16 h-32 bg-red rounded-xl" />
            </View>
            {/* Bottom: RL, RR */}
            <View className="flex-row justify-between">
              <WheelButton
                wheel="RL"
                ready={state === 'running'}
                done={done.has('RL')}
                onPress={() => tapWheel('RL')}
              />
              <WheelButton
                wheel="RR"
                ready={state === 'running'}
                done={done.has('RR')}
                onPress={() => tapWheel('RR')}
              />
            </View>
          </View>
        </View>

        <View className="px-4 pb-6 pt-2">
          <Pressable
            onPress={start}
            disabled={state === 'running'}
            className={`bg-red rounded-2xl py-4 items-center ${
              state === 'running' ? 'opacity-40' : 'active:opacity-80'
            }`}>
            <Text className="text-text font-bold text-base">
              {state === 'idle' ? 'Старт' : state === 'running' ? 'Тапай колёса!' : 'Ещё раз'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function WheelButton({
  wheel,
  ready,
  done,
  onPress,
}: {
  wheel: Wheel;
  ready: boolean;
  done: boolean;
  onPress: () => void;
}) {
  const bg = done ? 'bg-green-500' : ready ? 'bg-red' : 'bg-surface-2';
  return (
    <Pressable
      onPress={onPress}
      disabled={done || !ready}
      className={`${bg} rounded-2xl items-center justify-center`}
      style={{ width: 76, height: 76 }}>
      {done ? (
        <Ionicons name="checkmark" size={32} color="#fff" />
      ) : (
        <Text className="text-text font-extrabold text-lg">{wheel}</Text>
      )}
      {!done && (
        <Text className="text-text text-[9px] opacity-80 mt-0.5">{WHEEL_LABEL[wheel].split(' ')[0]}</Text>
      )}
    </Pressable>
  );
}
