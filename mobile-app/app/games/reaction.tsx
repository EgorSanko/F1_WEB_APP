import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';

import { api } from '@/lib/api';
import { pickReactionFact } from '@/lib/game-data';

type State = 'ready' | 'lights' | 'green' | 'falseStart' | 'finished';

export default function ReactionGame() {
  const router = useRouter();
  const [state, setState] = useState<State>('ready');
  const [lights, setLights] = useState(0);
  const [reaction, setReaction] = useState(0);
  const [fact, setFact] = useState('');
  const [achievementUnlocked, setAchievementUnlocked] = useState(false);
  const greenAtRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const usedFacts = useRef<Set<string>>(new Set());

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const startSequence = () => {
    setState('lights');
    setLights(0);
    setAchievementUnlocked(false);
    clearTimers();
    // 5 red lights, each appears 1s after the previous
    for (let i = 1; i <= 5; i++) {
      timersRef.current.push(
        setTimeout(() => {
          setLights(i);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, i * 1000),
      );
    }
    // Random green delay 500ms..3000ms after the 5th light
    const greenDelay = 5000 + 500 + Math.random() * 2500;
    timersRef.current.push(
      setTimeout(() => {
        setState('green');
        greenAtRef.current = Date.now();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, greenDelay),
    );
  };

  const handleTap = () => {
    if (state === 'ready' || state === 'falseStart' || state === 'finished') {
      startSequence();
      return;
    }
    if (state === 'lights') {
      clearTimers();
      setState('falseStart');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (state === 'green') {
      const rt = Date.now() - greenAtRef.current;
      setReaction(rt);
      setFact(pickReactionFact(rt, usedFacts.current));
      setState('finished');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      api
        .gameResult({ game_type: 'reaction', score: rt })
        .then((r) => {
          if (r.new_achievements?.includes('reaction_god')) {
            setAchievementUnlocked(true);
          }
        })
        .catch(() => {});
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
            🚦 Реакция
          </Text>
        </View>

        {/* 5 F1 start lights */}
        <View className="flex-row justify-center gap-3 mt-8 mb-6">
          {[1, 2, 3, 4, 5].map((i) => {
            const isGreen = state === 'green' || state === 'finished';
            const isRed = !isGreen && i <= lights;
            return (
              <View
                key={i}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 3,
                  borderColor: '#555',
                  backgroundColor: isGreen ? '#00ff00' : isRed ? '#E10600' : '#222',
                  shadowColor: isGreen ? '#00ff00' : isRed ? '#E10600' : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isGreen || isRed ? 0.6 : 0,
                  shadowRadius: 12,
                  elevation: isGreen || isRed ? 8 : 0,
                }}
              />
            );
          })}
        </View>

        <Pressable onPress={handleTap} className="flex-1 mx-4 mb-4">
          {state === 'ready' && (
            <View className="flex-1 items-center justify-center">
              <Text className="text-text text-base text-center px-6">
                Жди зелёный свет, потом тапни как можно быстрее
              </Text>
              <Text className="text-muted text-xs mt-2">Средняя реакция пилота F1 — 200мс</Text>
              <View className="bg-red rounded-2xl px-10 py-4 mt-8">
                <Text className="text-text font-extrabold text-lg">СТАРТ</Text>
              </View>
            </View>
          )}

          {(state === 'lights' || state === 'green') && (
            <View className="flex-1 items-center justify-center">
              <Text
                className={`font-extrabold ${state === 'green' ? 'text-green-500' : 'text-text'}`}
                style={{ fontSize: 52 }}>
                {state === 'green' ? 'ТАПНИ!' : 'Жди...'}
              </Text>
              <Text className="text-muted text-sm mt-3">
                {state === 'green' ? '🟢 Сейчас!' : 'Не нажимай раньше времени'}
              </Text>
            </View>
          )}

          {state === 'falseStart' && (
            <View className="flex-1 items-center justify-center">
              <Text style={{ fontSize: 80 }}>❌</Text>
              <Text className="text-red text-2xl font-extrabold mt-2">ФАЛЬСТАРТ!</Text>
              <Text className="text-muted text-sm mt-1">Рано нажал!</Text>
              <View className="bg-red rounded-2xl px-8 py-3 mt-6">
                <Text className="text-text font-bold">Попробовать снова</Text>
              </View>
            </View>
          )}

          {state === 'finished' && (
            <View className="flex-1 items-center justify-center px-4">
              <Text style={{ fontSize: 64 }}>
                {reaction < 200 ? '⚡' : reaction < 300 ? '🏎️' : reaction < 500 ? '👍' : '😅'}
              </Text>
              <Text
                className="font-extrabold text-green-500 mt-2"
                style={{ fontSize: 48, fontVariant: ['tabular-nums'] }}>
                {reaction} мс
              </Text>
              <Text className="text-muted text-sm mt-1">
                {reaction < 200
                  ? 'Нечеловеческая реакция!'
                  : reaction < 300
                    ? 'Отличная реакция!'
                    : reaction < 500
                      ? 'Неплохо!'
                      : 'Можно лучше!'}
              </Text>
              {fact ? (
                <View className="bg-surface rounded-2xl border border-line px-5 py-4 mt-5">
                  <Text className="text-text text-sm leading-5 text-center">{fact}</Text>
                </View>
              ) : null}
              {achievementUnlocked && (
                <View className="bg-red px-4 py-2 rounded-full mt-4">
                  <Text className="text-text font-bold text-xs">🏅 Reaction God разблокирован!</Text>
                </View>
              )}
              <Text className="text-muted-2 text-xs mt-6">Тапни чтобы ещё раз</Text>
            </View>
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
