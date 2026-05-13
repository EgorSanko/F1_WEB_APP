import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { NEXT_RACE, PREDICT_RULES, PROFILE } from '@/lib/mock';

const TABS = ['Активные', 'Завершённые'] as const;

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  trophy: 'trophy',
  podium: 'medal',
  flag: 'flag',
  timer: 'timer-outline',
};

export default function PredictScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Активные');

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="px-5 pt-2 pb-3">
          <Text className="text-text text-3xl font-extrabold">Прогнозы</Text>
        </View>

        {/* Segmented */}
        <View className="flex-row gap-2 px-4 pb-3">
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-full items-center ${
                  active ? 'bg-red' : 'bg-surface border border-line'
                }`}>
                <Text className={`text-xs font-bold ${active ? 'text-text' : 'text-muted'}`}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {/* Race prediction card */}
          <View className="mx-4 bg-surface rounded-2xl overflow-hidden border border-line">
            <View className="p-5 pb-3">
              <Text className="text-text text-xl font-extrabold">{NEXT_RACE.name}</Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-muted text-sm">
                  {NEXT_RACE.dates} · {NEXT_RACE.circuit}
                </Text>
              </View>
            </View>
            <Image
              source={{ uri: NEXT_RACE.image }}
              style={{ width: '100%', aspectRatio: 16 / 9 }}
              contentFit="cover"
            />
            <View className="p-5">
              <Text className="text-text font-bold text-base mb-4">
                Делай прогнозы и зарабатывай очки
              </Text>
              {PREDICT_RULES.map((r, i) => (
                <View
                  key={i}
                  className={`flex-row items-center py-3 ${
                    i < PREDICT_RULES.length - 1 ? 'border-b border-line' : ''
                  }`}>
                  <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center mr-3">
                    <Ionicons name={ICON_MAP[r.icon]} size={18} color="#E10600" />
                  </View>
                  <Text className="text-text text-[15px] flex-1">{r.label}</Text>
                  <Text className="text-red font-bold text-sm">+{r.points} очков</Text>
                </View>
              ))}
              <Pressable className="bg-red rounded-xl py-3.5 mt-4 items-center">
                <Text className="text-text font-bold">Сделать прогноз</Text>
              </Pressable>
            </View>
          </View>

          {/* Rating card */}
          <View className="mx-4 mt-3 bg-surface rounded-2xl border border-line p-5">
            <Text className="text-text font-bold text-base mb-4">Твой рейтинг</Text>
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-text text-2xl font-extrabold">1 247</Text>
                <Text className="text-muted text-xs mt-0.5">место</Text>
              </View>
              <View className="flex-1">
                <Text className="text-text text-2xl font-extrabold">
                  {PROFILE.points.toLocaleString('ru-RU')}
                </Text>
                <Text className="text-muted text-xs mt-0.5">очков</Text>
              </View>
              <View className="w-12 h-12 rounded-full bg-surface-2 items-center justify-center">
                <Ionicons name="trending-up" size={22} color="#10B981" />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
