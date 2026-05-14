import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAdminBroadcasts, useSchedule, flagFor } from '@/lib/hooks';
import { api, type Broadcast } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SESSION_TYPES = [
  { id: 'race', label: 'Гонка' },
  { id: 'qualifying', label: 'Квалификация' },
  { id: 'sprint', label: 'Спринт' },
  { id: 'sprint_qualifying', label: 'Спринт-квалификация' },
  { id: 'fp1', label: 'Свободная практика 1' },
  { id: 'fp2', label: 'Свободная практика 2' },
  { id: 'fp3', label: 'Свободная практика 3' },
] as const;

const SESSION_LABEL: Record<string, string> = Object.fromEntries(
  SESSION_TYPES.map((s) => [s.id, s.label]),
);

export default function AdminBroadcastsScreen() {
  const router = useRouter();
  const { isAdmin, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const broadcasts = useAdminBroadcasts(isAdmin);
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-bg">
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} className="flex-1 items-center justify-center px-6">
          <Ionicons name="lock-closed" size={48} color="#6B6B7B" />
          <Text className="text-text font-bold text-lg mt-4">Только для админа</Text>
          <Text className="text-muted text-sm mt-1 text-center">
            Управление трансляциями доступно только администратору.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-surface px-6 py-3 rounded-full border border-line">
            <Text className="text-text font-bold">Назад</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
  };

  const handleEnd = (b: Broadcast) => {
    Alert.alert('Завершить трансляцию?', `«${b.title ?? SESSION_LABEL[b.session_type]}»`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Завершить',
        onPress: async () => {
          try {
            await api.adminBroadcastEnd(b.id);
            refresh();
          } catch (e: unknown) {
            Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
          }
        },
      },
    ]);
  };

  const handleDelete = (b: Broadcast) => {
    Alert.alert('Удалить трансляцию?', `«${b.title ?? SESSION_LABEL[b.session_type]}»`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.adminBroadcastDelete(b.id);
            refresh();
          } catch (e: unknown) {
            Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
          }
        },
      },
    ]);
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
            Управление трансляциями
          </Text>
        </View>

        <Pressable
          onPress={() => setShowCreate(true)}
          className="mx-4 mb-3 bg-red rounded-2xl py-3.5 items-center flex-row justify-center active:opacity-80">
          <Ionicons name="add-circle" size={20} color="#FAFAFA" />
          <Text className="text-text font-bold ml-2">Добавить трансляцию</Text>
        </Pressable>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
          showsVerticalScrollIndicator={false}>
          {broadcasts.isLoading && <ActivityIndicator color="#E10600" />}
          {broadcasts.data?.broadcasts.map((b) => (
            <View
              key={b.id}
              className="bg-surface rounded-xl border border-line p-4">
              <View className="flex-row items-start">
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text className="text-text text-xs font-extrabold tracking-widest mr-2">
                      R{String(b.race_round).padStart(2, '0')} · {b.season}
                    </Text>
                    {b.is_live ? (
                      <View className="bg-red px-1.5 py-0.5 rounded">
                        <Text className="text-text text-[9px] font-extrabold tracking-widest">
                          LIVE
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-text font-bold" numberOfLines={1}>
                    {b.title ?? SESSION_LABEL[b.session_type] ?? b.session_type}
                  </Text>
                  <Text className="text-muted text-xs mt-0.5">
                    {SESSION_LABEL[b.session_type] ?? b.session_type}
                  </Text>
                  <Text className="text-muted-2 text-[11px] mt-1" numberOfLines={1}>
                    {b.video_url}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2 mt-3">
                {b.is_live ? (
                  <Pressable
                    onPress={() => handleEnd(b)}
                    className="flex-1 bg-surface-2 rounded-lg py-2.5 items-center active:opacity-80 border border-line">
                    <Text className="text-text text-sm font-semibold">Завершить</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => handleDelete(b)}
                  className="flex-1 bg-red/15 rounded-lg py-2.5 items-center active:opacity-80 border border-red/40">
                  <Text className="text-red text-sm font-bold">Удалить</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>

      {showCreate && <CreateForm onClose={() => setShowCreate(false)} onCreated={refresh} />}
    </View>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const schedule = useSchedule();
  const [roundStr, setRoundStr] = useState('');
  const [sessionType, setSessionType] = useState<string>('race');
  const [videoUrl, setVideoUrl] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [busy, setBusy] = useState(false);

  const races = schedule.data?.races ?? [];
  const round = Number(roundStr);
  const selectedRace = useMemo(
    () => races.find((r) => r.round === round),
    [races, round],
  );

  // Auto-compose title: "Гонка · Гран-при Майами" — until user manually edits
  const autoTitle =
    selectedRace
      ? `${SESSION_LABEL[sessionType] ?? sessionType} · ${selectedRace.name}`
      : '';

  const titleForSubmit = titleEdited ? title.trim() : autoTitle;

  const canSubmit = round > 0 && videoUrl.trim().length > 0;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await api.adminBroadcastCreate({
        race_round: round,
        session_type: sessionType,
        video_url: videoUrl.trim(),
        title: titleForSubmit || undefined,
        is_live: isLive,
      });
      Alert.alert('Готово', 'Трансляция добавлена');
      onCreated();
      onClose();
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-bg">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="px-4 pt-2 pb-3 flex-row items-center">
            <Pressable onPress={onClose} className="w-10 h-10 items-center justify-center">
              <Ionicons name="close" size={26} color="#FAFAFA" />
            </Pressable>
            <Text className="text-text text-lg font-bold flex-1 text-center mr-10">
              Новая трансляция
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
            <Field label="Раунд гонки">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ gap: 6 }}>
                {races.map((r) => {
                  const active = r.round === round;
                  return (
                    <Pressable
                      key={r.round}
                      onPress={() => setRoundStr(String(r.round))}
                      className={`px-3 py-2 rounded-full ${
                        active ? 'bg-red' : 'bg-surface border border-line'
                      }`}>
                      <Text
                        className={`text-xs font-bold ${
                          active ? 'text-text' : 'text-muted'
                        }`}>
                        R{String(r.round).padStart(2, '0')} {flagFor(r.country_code)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedRace ? (
                <Text className="text-muted text-xs mt-2">{selectedRace.name}</Text>
              ) : null}
            </Field>

            <Field label="Тип сессии">
              <View className="flex-row flex-wrap gap-2">
                {SESSION_TYPES.map((s) => {
                  const active = s.id === sessionType;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSessionType(s.id)}
                      className={`px-3 py-2 rounded-full ${
                        active ? 'bg-red' : 'bg-surface border border-line'
                      }`}>
                      <Text
                        className={`text-xs font-bold ${
                          active ? 'text-text' : 'text-muted'
                        }`}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="URL видео">
              <TextInput
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://youtube.com/watch?v=... · https://vk.com/video... · https://rutube.ru/..."
                placeholderTextColor="#6B6B7B"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="bg-surface text-text px-4 py-3 rounded-xl border border-line"
              />
              <Text className="text-muted-2 text-[11px] mt-1">
                Embed-ссылка будет извлечена автоматически
              </Text>
            </Field>

            <Field label="Название (автоматически)">
              <TextInput
                value={titleEdited ? title : autoTitle}
                onChangeText={(t) => {
                  setTitle(t);
                  setTitleEdited(true);
                }}
                placeholder="Сначала выбери раунд и тип сессии"
                placeholderTextColor="#6B6B7B"
                className="bg-surface text-text px-4 py-3 rounded-xl border border-line"
              />
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-muted-2 text-[11px]">
                  {titleEdited
                    ? 'Изменено вручную'
                    : autoTitle
                      ? 'Авто: ' + autoTitle
                      : 'Будет составлено автоматически'}
                </Text>
                {titleEdited && (
                  <Pressable
                    onPress={() => {
                      setTitleEdited(false);
                      setTitle('');
                    }}>
                    <Text className="text-red text-[11px] font-bold">Сбросить</Text>
                  </Pressable>
                )}
              </View>
            </Field>

            <View className="flex-row items-center justify-between bg-surface rounded-xl border border-line px-4 py-3 mt-2">
              <View className="flex-1">
                <Text className="text-text font-bold">Прямой эфир</Text>
                <Text className="text-muted text-xs mt-0.5">
                  Покажет красный LIVE-баннер всем пользователям
                </Text>
              </View>
              <Switch
                value={isLive}
                onValueChange={setIsLive}
                trackColor={{ false: '#2F2F3E', true: '#E10600' }}
                thumbColor="#fff"
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || busy}
              className={`bg-red rounded-2xl py-4 mt-5 items-center ${
                !canSubmit || busy ? 'opacity-40' : 'active:opacity-80'
              }`}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-text font-bold">Опубликовать</Text>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <Text className="text-muted text-xs font-bold tracking-widest mb-2 uppercase">
        {label}
      </Text>
      {children}
    </View>
  );
}
