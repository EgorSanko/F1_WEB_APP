import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function SpoilerCard({
  label = 'Результаты скрыты',
  hint = 'Включён антиспойлер. Нажми, чтобы раскрыть.',
  onReveal,
}: {
  label?: string;
  hint?: string;
  onReveal: () => void;
}) {
  return (
    <View className="mx-4 my-4 bg-surface rounded-2xl border border-line p-6 items-center">
      <View className="w-14 h-14 rounded-full bg-red/15 items-center justify-center">
        <Ionicons name="eye-off" size={28} color="#E10600" />
      </View>
      <Text className="text-text font-extrabold text-lg mt-4 text-center">{label}</Text>
      <Text className="text-muted text-sm mt-1.5 text-center leading-5">{hint}</Text>
      <Pressable
        onPress={onReveal}
        className="bg-red rounded-full px-6 py-3 mt-5 flex-row items-center active:opacity-80">
        <Ionicons name="eye" size={16} color="#fff" />
        <Text className="text-text font-bold ml-2">Раскрыть результаты</Text>
      </Pressable>
    </View>
  );
}
