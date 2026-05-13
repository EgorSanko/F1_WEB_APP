import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useMyPredictions } from '@/lib/hooks';
import type { Prediction, PredictionType } from '@/lib/api';

const TYPE_LABEL: Record<PredictionType, string> = {
  winner: 'Победитель',
  podium: 'Подиум',
  fastest_lap: 'Быстрый круг',
  dnf_count: 'DNF',
  safety_car: 'Safety Car',
};

const STATUS_INFO: Record<
  Prediction['status'],
  { label: string; color: string; bg: string }
> = {
  pending: { label: 'Ожидает', color: '#A0A0B0', bg: 'rgba(255,255,255,0.06)' },
  correct: { label: 'Верно', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  incorrect: { label: 'Неверно', color: '#A0A0B0', bg: 'rgba(255,255,255,0.04)' },
  partial: { label: 'Частично', color: '#FFCB05', bg: 'rgba(255,203,5,0.15)' },
};

export default function MyPredictionsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'settled'>('pending');
  const data = useMyPredictions();

  const list = tab === 'pending' ? data.data?.pending ?? [] : data.data?.settled ?? [];

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
            Мои прогнозы
          </Text>
        </View>

        {data.data && (
          <View className="mx-4 mb-3 bg-surface rounded-xl border border-line p-4 flex-row items-center">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: 'rgba(225,6,0,0.15)' }}>
              <Ionicons name="trophy" size={22} color="#E10600" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-text text-2xl font-extrabold">
                {data.data.total_won.toLocaleString('ru-RU')}
              </Text>
              <Text className="text-muted text-xs">Очков заработано</Text>
            </View>
            <View className="items-end">
              <Text className="text-text font-bold">
                {data.data.settled.length} / {data.data.settled.length + data.data.pending.length}
              </Text>
              <Text className="text-muted text-xs">завершено</Text>
            </View>
          </View>
        )}

        <View className="flex-row gap-2 px-4 pb-3">
          {(['pending', 'settled'] as const).map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-full items-center ${
                  active ? 'bg-red' : 'bg-surface border border-line'
                }`}>
                <Text className={`text-xs font-bold ${active ? 'text-text' : 'text-muted'}`}>
                  {t === 'pending' ? 'Ожидают' : 'Завершены'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 8 }}
          showsVerticalScrollIndicator={false}>
          {data.isLoading && <ActivityIndicator color="#E10600" />}
          {data.data && list.length === 0 && (
            <Text className="text-muted text-sm px-2 mt-4">
              {tab === 'pending' ? 'Нет ожидающих прогнозов' : 'Нет завершённых прогнозов'}
            </Text>
          )}
          {list.map((p) => {
            const status = STATUS_INFO[p.status];
            return (
              <View
                key={p.id}
                className="bg-surface rounded-xl border border-line p-4">
                <View className="flex-row items-center mb-2">
                  <View className="flex-1">
                    <Text className="text-text font-bold">
                      Раунд {String(p.race_round).padStart(2, '0')} · {TYPE_LABEL[p.prediction_type]}
                    </Text>
                    <Text className="text-muted text-xs mt-0.5">
                      {formatValue(p.prediction_type, p.prediction_value)}
                    </Text>
                  </View>
                  <View
                    className="px-2.5 py-1 rounded"
                    style={{ backgroundColor: status.bg }}>
                    <Text
                      className="text-[10px] font-bold tracking-widest"
                      style={{ color: status.color }}>
                      {status.label.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {p.status !== 'pending' && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="trophy-outline" size={14} color="#A0A0B0" />
                    <Text className="text-muted text-xs ml-1">
                      Получено: {' '}
                      <Text className="text-text font-bold">+{p.points_won ?? 0}</Text> очков
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatValue(type: PredictionType, value: unknown): string {
  if (value == null) return '—';
  if (type === 'safety_car') return value === true || value === 'yes' ? 'Да' : 'Нет';
  if (type === 'dnf_count') return `${value} сходов`;
  if (type === 'podium' && Array.isArray(value)) {
    return value.map((n) => `#${n}`).join(' → ');
  }
  if (typeof value === 'number') return `Пилот #${value}`;
  return String(value);
}
