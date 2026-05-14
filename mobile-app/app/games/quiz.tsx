import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Q = { question_id: number; question: string; options: string[]; category: string };
type Result = { correct: boolean; correct_answer: number; explanation: string };

export default function QuizGame() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const [busy, setBusy] = useState(false);

  const loadNext = async () => {
    setBusy(true);
    setPicked(null);
    setResult(null);
    try {
      const next = await api.quizQuestion();
      setQ(next);
    } catch {}
    setBusy(false);
  };

  useEffect(() => {
    loadNext();
  }, []);

  const choose = async (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    setBusy(true);
    try {
      const r = await api.quizAnswer({ question_id: q.question_id, answer: i });
      setResult(r);
      setStats((s) => ({ total: s.total + 1, correct: s.correct + (r.correct ? 1 : 0) }));
      if (r.correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Award the quiz "game" play (server returns 0 points anyway, but
        // it counts as a play for achievements like games_10)
        if (user) {
          try {
            await api.gameResult({ game_type: 'quiz', score: 1 });
          } catch {}
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {}
    setBusy(false);
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
            Квиз
          </Text>
        </View>

        {/* Stats bar */}
        {stats.total > 0 && (
          <View className="mx-4 mb-3 bg-surface rounded-xl border border-line px-4 py-3 flex-row items-center">
            <Ionicons name="stats-chart" size={18} color="#A0A0B0" />
            <Text className="text-text font-bold ml-2">
              {stats.correct}/{stats.total}
            </Text>
            <Text className="text-muted text-xs ml-2">
              ({stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%)
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          {busy && !q && <ActivityIndicator color="#E10600" className="mt-10" />}

          {q && (
            <View className="px-4 mt-2">
              <View className="bg-red/10 px-3 py-1 rounded-full self-start mb-3">
                <Text className="text-red text-[10px] font-extrabold tracking-widest uppercase">
                  {q.category}
                </Text>
              </View>
              <Text className="text-text text-2xl font-extrabold leading-tight">
                {q.question}
              </Text>

              <View className="mt-6 gap-2">
                {q.options.map((opt, i) => {
                  const isPicked = picked === i;
                  const isCorrect = result?.correct_answer === i;
                  const showCorrect = result !== null && isCorrect;
                  const showWrong = result !== null && isPicked && !isCorrect;

                  return (
                    <Pressable
                      key={i}
                      onPress={() => choose(i)}
                      disabled={picked !== null || busy}
                      className={`rounded-xl p-4 border flex-row items-center ${
                        showCorrect
                          ? 'bg-green-500/15 border-green-500'
                          : showWrong
                            ? 'bg-red/15 border-red'
                            : isPicked
                              ? 'bg-surface-2 border-line-strong'
                              : 'bg-surface border-line'
                      }`}>
                      <View
                        className={`w-7 h-7 rounded-full items-center justify-center mr-3 ${
                          showCorrect
                            ? 'bg-green-500'
                            : showWrong
                              ? 'bg-red'
                              : 'bg-surface-2'
                        }`}>
                        {showCorrect ? (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        ) : showWrong ? (
                          <Ionicons name="close" size={16} color="#fff" />
                        ) : (
                          <Text className="text-text font-bold text-xs">
                            {String.fromCharCode(65 + i)}
                          </Text>
                        )}
                      </View>
                      <Text className="text-text font-semibold flex-1" numberOfLines={3}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {result && (
                <View className="mt-5 bg-surface rounded-xl border border-line p-4">
                  <Text className="text-text font-bold">
                    {result.correct ? '✅ Правильно!' : '❌ Неверно'}
                  </Text>
                  {!result.correct && (
                    <Text className="text-muted text-sm mt-1">
                      Верный ответ: <Text className="text-text font-bold">{result.explanation}</Text>
                    </Text>
                  )}
                  <Pressable
                    onPress={loadNext}
                    className="bg-red rounded-xl py-3 mt-4 items-center active:opacity-80">
                    <Text className="text-text font-bold">Следующий вопрос</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
