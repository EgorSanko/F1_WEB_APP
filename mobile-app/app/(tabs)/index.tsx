import { ImageBackground, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { NEXT_RACE, RACES } from '@/lib/mock';

const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

export default function HomeScreen() {
  const upcoming = RACES.slice(0, 3);

  return (
    <View className="flex-1 bg-bg">
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
            <Image
              source={require('../../assets/images/logo-f1hub.png')}
              style={{ width: 110, height: 40 }}
              contentFit="contain"
            />
            <Pressable className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-line">
              <Ionicons name="notifications-outline" size={20} color="#FAFAFA" />
            </Pressable>
          </View>

          {/* Eyebrow */}
          <View className="flex-row items-center px-5 mt-3 mb-2">
            <View className="w-2 h-2 rounded-full bg-red mr-2" />
            <Text className="text-text text-[11px] font-bold tracking-[2px]">СТАРТ ЧЕРЕЗ</Text>
          </View>

          {/* Countdown */}
          <View className="flex-row gap-2 px-5">
            {[
              { v: '11', l: 'ДН' },
              { v: '07', l: 'Ч' },
              { v: '51', l: 'МИН' },
              { v: '06', l: 'СЕК' },
            ].map((c) => (
              <View
                key={c.l}
                className="flex-1 bg-surface rounded-xl py-3 items-center border border-line">
                <Text className="text-text text-2xl font-extrabold">{c.v}</Text>
                <Text className="text-muted text-[10px] mt-0.5 tracking-widest">{c.l}</Text>
              </View>
            ))}
          </View>

          {/* Hero card — Next GP */}
          <View className="mx-4 mt-5 rounded-2xl overflow-hidden border border-line">
            <ImageBackground
              source={{ uri: NEXT_RACE.image }}
              style={{ aspectRatio: 4 / 5 }}
              imageStyle={{ opacity: 0.55 }}>
              <View className="absolute inset-0 bg-bg/40" />
              <Image
                source={{ uri: CAR_OVERLAY }}
                style={{
                  position: 'absolute',
                  right: -30,
                  top: 30,
                  width: 320,
                  height: 175,
                }}
                contentFit="contain"
              />
              <View className="flex-1 justify-end p-5">
                <View className="bg-red px-2.5 py-1 self-start rounded">
                  <Text className="text-text text-[10px] font-bold tracking-widest">
                    СЛЕДУЮЩИЙ ГРАН-ПРИ
                  </Text>
                </View>
                <Text className="text-text text-[34px] font-extrabold mt-3 leading-[1.05]">
                  Гран-при{'\n'}Канады
                </Text>
                <View className="flex-row items-center mt-3">
                  <Text className="text-base mr-2">{NEXT_RACE.flag}</Text>
                  <Text className="text-text text-base font-semibold">{NEXT_RACE.circuit}</Text>
                </View>
                <Text className="text-muted text-[12px] mt-1 tracking-wider">
                  13–15 ИЮНЯ 2025
                </Text>
                <Pressable className="bg-red rounded-xl py-3.5 mt-4 items-center">
                  <Text className="text-text font-bold">Смотреть трансляцию</Text>
                </Pressable>
              </View>
            </ImageBackground>
          </View>

          {/* Upcoming races */}
          <View className="px-5 mt-7 mb-3 flex-row items-center justify-between">
            <Text className="text-text text-xl font-extrabold">Ближайшие гонки</Text>
            <Link href="/calendar" asChild>
              <Pressable className="flex-row items-center">
                <Text className="text-muted text-sm font-semibold mr-1">Все</Text>
                <Ionicons name="chevron-forward" size={14} color="#A0A0B0" />
              </Pressable>
            </Link>
          </View>

          <View className="px-4 gap-2">
            {upcoming.map((race) => (
              <Link key={race.round} href={`/race/${race.round}` as never} asChild>
                <Pressable className="bg-surface rounded-xl p-3.5 border border-line flex-row items-center active:opacity-80">
                  <View className="w-10 h-7 rounded items-center justify-center mr-3">
                    <Text className="text-2xl">{race.flag}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text font-bold">{race.name}</Text>
                    <Text className="text-muted text-xs mt-0.5">{race.dates}</Text>
                    <Text className="text-muted-2 text-xs">{race.circuit}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
                </Pressable>
              </Link>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
