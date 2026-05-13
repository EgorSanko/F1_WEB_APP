import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PROFILE } from '@/lib/mock';

const MENU: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'list-outline', label: 'Мои прогнозы' },
  { icon: 'notifications-outline', label: 'Уведомления' },
  { icon: 'settings-outline', label: 'Настройки' },
  { icon: 'help-circle-outline', label: 'Поддержка' },
];

const ACHIEVEMENTS = [
  { color: '#7F7F8F', icon: 'trophy' as const },
  { color: '#E10600', icon: 'trophy' as const },
  { color: '#A0A0B0', icon: 'trophy' as const },
  { color: '#FFCB05', icon: 'trophy' as const },
];

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <Text className="text-text text-3xl font-extrabold">Профиль</Text>
          <Pressable className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-line">
            <Ionicons name="settings-outline" size={20} color="#FAFAFA" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}>
          {/* Avatar + name */}
          <View className="items-center mt-4">
            <View className="w-24 h-24 rounded-full bg-surface items-center justify-center border-2 border-red">
              <Ionicons name="person" size={48} color="#A0A0B0" />
            </View>
            <Text className="text-text text-2xl font-extrabold mt-3">{PROFILE.name}</Text>
            <Text className="text-muted text-sm">{PROFILE.username}</Text>
            <View className="bg-red px-3 py-1 rounded-full mt-2">
              <Text className="text-text text-[11px] font-bold tracking-widest">
                {PROFILE.badge}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row mt-6 px-4">
            <View className="flex-1 items-center">
              <Text className="text-text text-2xl font-extrabold">
                {PROFILE.points.toLocaleString('ru-RU')}
              </Text>
              <Text className="text-muted text-xs mt-1">Очков</Text>
            </View>
            <View className="w-px bg-line" />
            <View className="flex-1 items-center">
              <Text className="text-text text-2xl font-extrabold">{PROFILE.predictions}</Text>
              <Text className="text-muted text-xs mt-1">Прогнозов</Text>
            </View>
            <View className="w-px bg-line" />
            <View className="flex-1 items-center">
              <Text className="text-text text-2xl font-extrabold">{PROFILE.accuracy}%</Text>
              <Text className="text-muted text-xs mt-1">Точность</Text>
            </View>
          </View>

          {/* Achievements */}
          <View className="px-5 mt-7 flex-row items-center justify-between">
            <Text className="text-text text-lg font-extrabold">Достижения</Text>
            <Pressable className="flex-row items-center">
              <Text className="text-muted text-sm font-semibold mr-1">Все</Text>
              <Ionicons name="chevron-forward" size={14} color="#A0A0B0" />
            </Pressable>
          </View>
          <View className="flex-row gap-3 px-4 mt-3">
            {ACHIEVEMENTS.map((a, i) => (
              <View
                key={i}
                className="flex-1 aspect-square bg-surface rounded-2xl items-center justify-center border border-line">
                <Ionicons name={a.icon} size={28} color={a.color} />
              </View>
            ))}
          </View>

          {/* Menu */}
          <View className="px-4 mt-6">
            {MENU.map((m, i) => (
              <Pressable
                key={i}
                className={`flex-row items-center py-4 ${
                  i < MENU.length - 1 ? 'border-b border-line' : ''
                }`}>
                <Ionicons name={m.icon} size={22} color="#A0A0B0" />
                <Text className="text-text text-base ml-3 flex-1">{m.label}</Text>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </Pressable>
            ))}
          </View>

          {/* Logout */}
          <Pressable className="px-4 mt-2">
            <View className="flex-row items-center py-4 border-t border-line">
              <Ionicons name="log-out-outline" size={22} color="#E10600" />
              <Text className="text-red text-base font-semibold ml-3 flex-1">Выйти</Text>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
