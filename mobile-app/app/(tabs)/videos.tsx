import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { VIDEOS } from '@/lib/mock';

const TABS = ['Обзоры', 'Квалификации', 'Гонки'] as const;

export default function VideosScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Обзоры');

  const featured = VIDEOS[0];
  const list = VIDEOS.slice(1);

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3">
          <Text className="text-text text-3xl font-extrabold">Видео</Text>
        </View>

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
          {/* Featured */}
          <Pressable className="mx-4 bg-surface rounded-xl overflow-hidden border border-line active:opacity-80">
            <View className="aspect-video bg-surface-2 items-center justify-center relative">
              {featured.image ? (
                <Image
                  source={{ uri: featured.image }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : null}
              <View className="absolute inset-0 items-center justify-center">
                <View className="w-14 h-14 rounded-full bg-bg/70 items-center justify-center">
                  <Ionicons name="play" size={26} color="#FAFAFA" />
                </View>
              </View>
            </View>
            <View className="p-4">
              <Text className="text-text font-bold text-base">{featured.title}</Text>
              <Text className="text-muted text-xs mt-1">{featured.ago}</Text>
            </View>
          </Pressable>

          {/* List */}
          <View className="mt-4 px-4 gap-2">
            {list.map((v) => (
              <Pressable
                key={v.id}
                className="bg-surface rounded-xl overflow-hidden border border-line flex-row active:opacity-80">
                <View className="w-32 h-20 bg-surface-2 relative">
                  {v.image ? (
                    <Image
                      source={{ uri: v.image }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : null}
                  {v.duration ? (
                    <View className="absolute bottom-1 right-1 bg-bg/85 px-1.5 py-0.5 rounded">
                      <Text className="text-text text-[10px] font-semibold">{v.duration}</Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-1 p-3 justify-center">
                  <Text className="text-text font-semibold text-sm" numberOfLines={2}>
                    {v.title}
                  </Text>
                  <Text className="text-muted-2 text-[11px] mt-1">{v.ago}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
