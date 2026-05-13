import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { RACES } from '@/lib/mock';

const TABS = ['Все', 'Ближайшие', 'Прошедшие'] as const;

export default function CalendarScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Все');

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <Text className="text-text text-3xl font-extrabold">Календарь</Text>
          <Pressable className="flex-row items-center bg-surface rounded-full px-3 py-1.5 border border-line">
            <Text className="text-text text-sm font-semibold mr-1">2025</Text>
            <Ionicons name="chevron-down" size={14} color="#A0A0B0" />
          </Pressable>
        </View>

        {/* Segmented control */}
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
                <Text
                  className={`text-xs font-bold ${active ? 'text-text' : 'text-muted'}`}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 8 }}
          showsVerticalScrollIndicator={false}>
          {RACES.map((race) => (
            <Link key={race.round} href={`/race/${race.round}` as never} asChild>
              <Pressable className="bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80">
                <Text className="text-text text-2xl font-extrabold w-9">
                  {String(race.round).padStart(2, '0')}
                </Text>
                <Text className="text-2xl mr-3">{race.flag}</Text>
                <View className="flex-1">
                  <Text className="text-text font-bold">{race.name}</Text>
                  <Text className="text-muted text-xs mt-0.5">{race.dates}</Text>
                  <Text className="text-muted-2 text-xs">{race.circuit}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
