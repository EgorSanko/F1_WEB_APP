import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';

import { api } from '@/lib/api';

type State = 'idle' | 'waiting' | 'ready' | 'tooEarly' | 'done';

export default function ReactionGame() {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [ms, setMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [achievement, setAchievement] = useState<string | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const start = () => {
    setAchievement(null);
    setState('waiting');
    const delay = 1500 + Math.random() * 3500; // 1.5–5s
    timerRef.current = setTimeout(() => {
      startRef.current = Date.now();
      setState('ready');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, delay);
  };

  const handleTap = () => {
    if (state === 'idle' || state === 'done' || state === 'tooEarly') {
      start();
      return;
    }
    if (state === 'waiting') {
      if (timerRef.current) clearTimeout(timerRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState('tooEarly');
      return;
    }
    if (state === 'ready') {
      const dt = Date.now() - startRef.current;
      setMs(dt);
      setState('done');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      submit(dt);
    }
  };

  const submit = async (score: number) => {
    setBusy(true);
    try {
      const res = await api.gameResult({ game_type: 'reaction', score });
      if (res.new_achievements?.includes('reaction_god')) {
        setAchievement('reaction_god');
      }
    } catch {}
    setBusy(false);
  };

  let bg = 'bg-surface';
  let label = 'Тапни чтобы начать';
  let hint = 'Жди зелёного света и нажми как можно быстрее';
  let icon: keyof typeof Ionicons.glyphMap = 'play';

  if (state === 'waiting') {
    bg = 'bg-red';
    label = 'Жди...';
    hint = 'Не тапай раньше времени';
    icon = 'eye-off';
  } else if (state === 'ready') {
    bg = 'bg-green-500';
    label = 'ТАП!';
    hint = 'Сейчас!';
    icon = 'flash';
  } else if (state === 'tooEarly') {
    bg = 'bg-surface-2';
    label = 'Слишком рано';
    hint = 'Тапни чтобы попробовать ещё раз';
    icon = 'refresh';
  } else if (state === 'done') {
    bg = ms < 200 ? 'bg-red' : ms < 300 ? 'bg-green-500' : 'bg-surface';
    label = `${ms} мс`;
    hint = ms < 200 ? 'Невероятная реакция!' : ms < 300 ? 'Отлично' : ms < 500 ? 'Хорошо' : 'Можешь лучше';
    icon = 'trophy';
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
            Реакция
          </Text>
        </View>

        <Pressable
          onPress={handleTap}
          className={`flex-1 mx-4 mb-6 rounded-3xl items-center justify-center ${bg}`}
          style={{ borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }}>
          <Ionicons name={icon} size={64} color="#FAFAFA" />
          <Text className="text-text text-5xl font-extrabold mt-4">{label}</Text>
          <Text className="text-text text-sm opacity-80 mt-2 text-center px-6">{hint}</Text>
          {state === 'done' && achievement === 'reaction_god' && (
            <View className="bg-bg/40 px-4 py-2 rounded-full mt-6">
              <Text className="text-text font-bold">🏆 Reaction God!</Text>
            </View>
          )}
          {state === 'done' && (
            <Text className="text-text/80 text-xs mt-4">Тапни чтобы попробовать ещё</Text>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
