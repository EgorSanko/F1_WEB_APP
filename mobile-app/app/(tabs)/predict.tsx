import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { usePredictionsAvailable, countdownParts, flagFor } from '@/lib/hooks';
import { api, type Driver, type PredictionType, type PredictionTypeInfo } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const TYPE_ICON: Record<PredictionType, keyof typeof import('@expo/vector-icons/Ionicons').default.glyphMap> = {
  winner: 'trophy',
  podium: 'medal',
  fastest_lap: 'flash',
  dnf_count: 'warning',
  safety_car: 'car-sport',
};

export default function PredictScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const data = usePredictionsAvailable(!!user);
  const [activeType, setActiveType] = useState<PredictionTypeInfo | null>(null);

  if (!user) {
    return (
      <View className="flex-1 bg-bg">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="px-5 pt-2 pb-3">
            <Text className="text-text text-3xl font-extrabold">Прогнозы</Text>
          </View>
          <View className="mx-4 mt-4 bg-surface rounded-2xl p-6 border border-line items-center">
            <Ionicons name="lock-closed" size={32} color="#A0A0B0" />
            <Text className="text-text text-base font-bold mt-3 text-center">
              Войдите, чтобы делать прогнозы
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/profile' as never)}
              className="bg-red rounded-full px-6 py-3 mt-4">
              <Text className="text-text font-bold">Перейти в Профиль</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (data.isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  if (!data.data || data.data.available === false) {
    return (
      <View className="flex-1 bg-bg">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="px-5 pt-2 pb-3">
            <Text className="text-text text-3xl font-extrabold">Прогнозы</Text>
          </View>
          <View className="mx-4 mt-4 bg-surface rounded-2xl p-6 border border-line">
            <Text className="text-text font-bold">Нет доступных гонок</Text>
            <Text className="text-muted text-sm mt-1">
              Прогнозы открываются за неделю до старта Гран-при.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const { race, predictions, drivers } = data.data;

  return (
    <View className="flex-1 bg-bg">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-3 flex-row items-end justify-between">
          <View>
            <Text className="text-text text-3xl font-extrabold">Прогнозы</Text>
            <Text className="text-muted text-sm mt-0.5">{race.name}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/my-predictions' as never)}
            className="flex-row items-center bg-surface rounded-full px-3 py-1.5 border border-line">
            <Ionicons name="list" size={14} color="#A0A0B0" />
            <Text className="text-text text-xs font-semibold ml-1.5">Мои</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          {/* Race meta + countdown */}
          <View className="mx-4 bg-surface rounded-2xl border border-line p-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-xl mr-2">{flagFor(race.country_code)}</Text>
              <View className="flex-1">
                <Text className="text-text font-bold">{race.locality || race.country}</Text>
                <Text className="text-muted text-xs">
                  {new Date(race.date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
            <CountdownInline iso={race.race_datetime} />
          </View>

          <View className="px-5 mt-6 mb-3">
            <Text className="text-text text-lg font-extrabold">Сделай прогнозы</Text>
            <Text className="text-muted text-sm mt-0.5">До закрытия — старт гонки</Text>
          </View>

          <View className="px-4 gap-2">
            {predictions.map((p) => (
              <Pressable
                key={p.type}
                disabled={p.already_predicted}
                onPress={() => setActiveType(p)}
                className={`bg-surface rounded-xl p-4 border border-line flex-row items-center ${
                  p.already_predicted ? 'opacity-60' : 'active:opacity-80'
                }`}>
                <View className="w-11 h-11 rounded-full bg-surface-2 items-center justify-center">
                  <Ionicons name={TYPE_ICON[p.type]} size={20} color="#E10600" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-text font-bold">{p.label}</Text>
                  <Text className="text-muted text-xs mt-0.5">{p.description}</Text>
                </View>
                <View className="items-end">
                  {p.already_predicted ? (
                    <View className="bg-surface-2 px-2 py-1 rounded">
                      <Text className="text-muted text-[10px] font-bold tracking-widest">
                        СДЕЛАН
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-red font-extrabold text-sm">+{p.max_points} оч.</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          <View className="mx-4 mt-6 mb-2 bg-surface rounded-xl p-4 border border-line flex-row items-center">
            <Ionicons name="information-circle-outline" size={20} color="#A0A0B0" />
            <Text className="text-muted text-xs ml-2 flex-1 leading-5">
              Очки начисляются после расчёта результатов гонки. Один прогноз на каждый тип.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {activeType && (
        <PredictionForm
          info={activeType}
          drivers={drivers}
          raceRound={race.round}
          onClose={() => setActiveType(null)}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: ['predictions'] });
            setActiveType(null);
          }}
        />
      )}
    </View>
  );
}

function CountdownInline({ iso }: { iso: string }) {
  const { d, h, m, s } = countdownParts(iso);
  return (
    <View className="flex-row gap-2">
      {[
        { v: d, l: 'ДН' },
        { v: h, l: 'Ч' },
        { v: m, l: 'МИН' },
        { v: s, l: 'СЕК' },
      ].map((c) => (
        <View
          key={c.l}
          className="flex-1 bg-surface-2 rounded-lg py-2 items-center">
          <Text className="text-text text-lg font-extrabold">{c.v}</Text>
          <Text className="text-muted text-[9px] tracking-widest">{c.l}</Text>
        </View>
      ))}
    </View>
  );
}

// ============ PREDICTION FORM (Modal) ============

function PredictionForm({
  info,
  drivers,
  raceRound,
  onClose,
  onSubmitted,
}: {
  info: PredictionTypeInfo;
  drivers: Driver[];
  raceRound: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // State per type
  const [pick, setPick] = useState<number | null>(null); // winner, fastest_lap
  const [podium, setPodium] = useState<number[]>([]); // podium (3 in order)
  const [dnfCount, setDnfCount] = useState('');
  const [safetyCar, setSafetyCar] = useState<boolean | null>(null);

  const canSubmit =
    (info.type === 'winner' && pick !== null) ||
    (info.type === 'fastest_lap' && pick !== null) ||
    (info.type === 'podium' && podium.length === 3) ||
    (info.type === 'dnf_count' && /^\d+$/.test(dnfCount.trim())) ||
    (info.type === 'safety_car' && safetyCar !== null);

  const handleSubmit = async () => {
    let value: unknown;
    if (info.type === 'winner' || info.type === 'fastest_lap') value = pick;
    else if (info.type === 'podium') value = podium;
    else if (info.type === 'dnf_count') value = parseInt(dnfCount.trim(), 10);
    else if (info.type === 'safety_car') value = safetyCar;

    setBusy(true);
    try {
      await api.predictMake({
        race_round: raceRound,
        prediction_type: info.type,
        prediction_value: value,
      });
      Alert.alert('Прогноз отправлен', 'Удачи! Результат после гонки.');
      onSubmitted();
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
              {info.label}
            </Text>
          </View>
          <View className="px-5 pb-4">
            <Text className="text-muted text-sm">
              {info.description} · до{' '}
              <Text className="text-red font-bold">+{info.max_points} очков</Text>
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
            {(info.type === 'winner' || info.type === 'fastest_lap') && (
              <DriverPickerList
                drivers={drivers}
                selected={pick != null ? [pick] : []}
                onPick={(n) => setPick(n)}
              />
            )}

            {info.type === 'podium' && (
              <PodiumPicker drivers={drivers} value={podium} onChange={setPodium} />
            )}

            {info.type === 'dnf_count' && (
              <View className="px-5">
                <Text className="text-muted text-sm mb-3">
                  Сколько пилотов сойдёт с дистанции?
                </Text>
                <TextInput
                  value={dnfCount}
                  onChangeText={(t) => setDnfCount(t.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  placeholderTextColor="#6B6B7B"
                  keyboardType="number-pad"
                  maxLength={2}
                  autoFocus
                  className="bg-surface text-text text-4xl font-extrabold text-center px-4 py-5 rounded-2xl border border-line"
                />
                <Text className="text-muted-2 text-xs mt-2 text-center">
                  ±1 от верного значения тоже даёт +15 очков
                </Text>
              </View>
            )}

            {info.type === 'safety_car' && (
              <View className="px-5">
                <Text className="text-muted text-sm mb-4">
                  Появится ли машина безопасности на трассе?
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setSafetyCar(true)}
                    className={`flex-1 py-6 rounded-2xl items-center border ${
                      safetyCar === true ? 'bg-red border-red' : 'bg-surface border-line'
                    }`}>
                    <Ionicons
                      name="checkmark-circle"
                      size={36}
                      color={safetyCar === true ? '#fff' : '#A0A0B0'}
                    />
                    <Text
                      className={`mt-2 font-extrabold ${
                        safetyCar === true ? 'text-text' : 'text-muted'
                      }`}>
                      ДА
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSafetyCar(false)}
                    className={`flex-1 py-6 rounded-2xl items-center border ${
                      safetyCar === false ? 'bg-red border-red' : 'bg-surface border-line'
                    }`}>
                    <Ionicons
                      name="close-circle"
                      size={36}
                      color={safetyCar === false ? '#fff' : '#A0A0B0'}
                    />
                    <Text
                      className={`mt-2 font-extrabold ${
                        safetyCar === false ? 'text-text' : 'text-muted'
                      }`}>
                      НЕТ
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          <View className="px-4 pb-6 pt-2 border-t border-line bg-bg">
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || busy}
              className={`bg-red rounded-2xl py-4 items-center ${
                !canSubmit || busy ? 'opacity-40' : 'active:opacity-80'
              }`}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-text font-bold text-base">Отправить прогноз</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function DriverPickerList({
  drivers,
  selected,
  onPick,
}: {
  drivers: Driver[];
  selected: number[];
  onPick: (driverNumber: number) => void;
}) {
  return (
    <View className="px-4 gap-2">
      {drivers.map((d) => {
        const isSelected = selected.includes(d.driver_number);
        const rank = selected.indexOf(d.driver_number) + 1;
        return (
          <Pressable
            key={d.driver_number}
            onPress={() => onPick(d.driver_number)}
            className={`bg-surface rounded-xl p-3 border flex-row items-center active:opacity-80 ${
              isSelected ? 'border-red' : 'border-line'
            }`}>
            {isSelected && (
              <View className="w-7 h-7 rounded-full bg-red items-center justify-center mr-2">
                <Text className="text-text font-extrabold text-sm">{rank}</Text>
              </View>
            )}
            <View
              className="w-1 h-10 rounded-full mr-3"
              style={{ backgroundColor: d.team_color || '#666' }}
            />
            {d.photo_url ? (
              <Image
                source={{ uri: d.photo_url }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            ) : null}
            <View className="flex-1 ml-3">
              <Text className="text-text font-bold">{d.name}</Text>
              <Text className="text-muted text-xs">
                #{d.driver_number} · {d.team}
              </Text>
            </View>
            {isSelected && <Ionicons name="checkmark" size={20} color="#E10600" />}
          </Pressable>
        );
      })}
    </View>
  );
}

function PodiumPicker({
  drivers,
  value,
  onChange,
}: {
  drivers: Driver[];
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const handlePick = (n: number) => {
    if (value.includes(n)) {
      onChange(value.filter((x) => x !== n));
    } else if (value.length < 3) {
      onChange([...value, n]);
    }
  };

  const slots = useMemo(() => {
    const arr: { rank: number; driver: Driver | undefined }[] = [];
    for (let i = 0; i < 3; i++) {
      const n = value[i];
      arr.push({ rank: i + 1, driver: drivers.find((d) => d.driver_number === n) });
    }
    return arr;
  }, [value, drivers]);

  return (
    <View>
      <View className="flex-row gap-2 px-4 mb-4">
        {slots.map((s) => (
          <View
            key={s.rank}
            className="flex-1 aspect-[3/4] bg-surface rounded-xl border border-line items-center justify-center">
            <Text
              className="font-extrabold text-xl"
              style={{
                color: s.rank === 1 ? '#FFCB05' : s.rank === 2 ? '#C0C0C0' : '#CD7F32',
              }}>
              P{s.rank}
            </Text>
            {s.driver ? (
              <>
                {s.driver.photo_url ? (
                  <Image
                    source={{ uri: s.driver.photo_url }}
                    style={{ width: 56, height: 56, borderRadius: 28, marginTop: 6 }}
                  />
                ) : null}
                <Text className="text-text text-xs font-bold mt-2 text-center px-1" numberOfLines={1}>
                  {s.driver.last_name}
                </Text>
              </>
            ) : (
              <Text className="text-muted-2 text-[10px] mt-2">Не выбран</Text>
            )}
          </View>
        ))}
      </View>
      <Text className="text-muted text-xs px-5 mb-2">
        Выбирай по порядку: первый тап → P1, второй → P2, третий → P3
      </Text>
      <DriverPickerList drivers={drivers} selected={value} onPick={handlePick} />
    </View>
  );
}
