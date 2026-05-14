import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { ruRaceTitle } from '@/lib/locale';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';
const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

const TYPE_ICON: Record<PredictionType, keyof typeof import('@expo/vector-icons/Ionicons').default.glyphMap> = {
  winner: 'trophy',
  podium: 'medal',
  fastest_lap: 'flash',
  dnf_count: 'flag',
  safety_car: 'shield-checkmark',
};

export default function PredictScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const data = usePredictionsAvailable(!!user);
  const [activeType, setActiveType] = useState<PredictionTypeInfo | null>(null);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <Header subtitle="Войдите, чтобы делать прогнозы" />
          <View
            className="mx-4 mt-4 rounded-2xl p-6 items-center"
            style={{
              backgroundColor: CARD_BG,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}>
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
      <View style={{ flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  if (!data.data || data.data.available === false) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <Header subtitle="Нет доступных гонок" />
          <View
            className="mx-4 mt-4 rounded-2xl p-6"
            style={{
              backgroundColor: CARD_BG,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}>
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
  const raceTitleRu = `Гран-при ${ruRaceTitle(race.country, race.name)}`;

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header subtitle={raceTitleRu} showMine />

        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          {/* Race info card with car + countdown */}
          <RaceInfoCard race={race} />

          {/* Section header */}
          <View className="px-5 mt-7 mb-4 flex-row items-end justify-between">
            <View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '800',
                  color: '#FAFAFA',
                  textTransform: 'uppercase',
                  letterSpacing: -0.3,
                  fontStyle: 'italic',
                }}>
                СДЕЛАЙ ПРОГНОЗЫ
              </Text>
              <Text className="text-muted text-sm mt-1">До закрытия — старт гонки</Text>
            </View>
            <View
              pointerEvents="none"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginBottom: 6,
              }}>
              <View style={{ width: 22, height: 2, backgroundColor: '#3A3A4A', borderRadius: 1 }} />
              <View style={{ width: 30, height: 2, backgroundColor: '#E10600', borderRadius: 1 }} />
              <View style={{ width: 14, height: 2, backgroundColor: '#E10600', opacity: 0.5, borderRadius: 1 }} />
            </View>
          </View>

          {/* Prediction type cards */}
          <View className="px-4" style={{ gap: 10 }}>
            {predictions.map((p) => (
              <Pressable
                key={p.type}
                disabled={p.already_predicted}
                onPress={() => setActiveType(p)}
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: p.already_predicted
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(225,6,0,0.18)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  opacity: p.already_predicted ? 0.55 : 1,
                }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: 'rgba(225,6,0,0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(225,6,0,0.35)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name={TYPE_ICON[p.type]} size={22} color="#E10600" />
                </View>
                <View className="flex-1 ml-4">
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      color: '#FAFAFA',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                    {p.label}
                  </Text>
                  <Text className="text-muted text-xs mt-1.5">{p.description}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
                  {p.already_predicted ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}>
                      <Text className="text-muted text-[10px] font-extrabold tracking-widest">
                        СДЕЛАН
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: '800',
                          color: '#E10600',
                          lineHeight: 26,
                        }}>
                        +{p.max_points}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#A0A0B0',
                          fontWeight: '700',
                          letterSpacing: 1.5,
                          marginTop: 2,
                        }}>
                        ОЧ.
                      </Text>
                    </>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
              </Pressable>
            ))}
          </View>

          {/* Info footer */}
          <View
            className="mx-4 mt-6 rounded-2xl p-4 flex-row items-center"
            style={{
              backgroundColor: CARD_BG,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="information" size={16} color="#A0A0B0" />
            </View>
            <Text className="text-muted text-xs ml-3 flex-1" style={{ lineHeight: 18 }}>
              Очки начисляются после расчёта результатов гонки. Один прогноз — один способ
              заработать больше очков!
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

// ============ HEADER ============

function Header({ subtitle, showMine = false }: { subtitle?: string; showMine?: boolean }) {
  return (
    <View className="px-5 pt-2 pb-4 flex-row items-start justify-between">
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 34,
            fontWeight: '800',
            color: '#FAFAFA',
            letterSpacing: -0.5,
            textTransform: 'uppercase',
            fontStyle: 'italic',
          }}>
          ПРОГНОЗЫ
        </Text>
        {subtitle ? (
          <Text className="text-muted text-sm mt-1" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showMine && (
        <Pressable
          onPress={() => router.push('/my-predictions' as never)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: CARD_BG,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}>
          <Ionicons name="list" size={14} color="#A0A0B0" />
          <Text className="text-text text-sm font-bold ml-2">Мои</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============ RACE INFO CARD ============

function RaceInfoCard({
  race,
}: {
  race: { country_code?: string; locality?: string; country?: string; date: string; race_datetime: string };
}) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        borderRadius: 22,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: 'rgba(225,6,0,0.22)',
        overflow: 'hidden',
        shadowColor: '#E10600',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 5,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, marginRight: 12 }}>{flagFor(race.country_code)}</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: '#FAFAFA',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
            {(race.locality || race.country || '').toUpperCase()}
          </Text>
          <Text className="text-muted text-xs mt-1">
            {new Date(race.date).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            г.
          </Text>
        </View>
        <Image
          source={{ uri: CAR_OVERLAY }}
          style={{
            width: 180,
            height: 80,
            position: 'absolute',
            right: -20,
            top: 8,
          }}
          contentFit="contain"
        />
      </View>

      {/* Divider with subtle red glow */}
      <View
        style={{
          height: 1,
          backgroundColor: 'rgba(225,6,0,0.18)',
          marginHorizontal: 14,
        }}
      />

      <CountdownInline iso={race.race_datetime} />
    </View>
  );
}

// ============ COUNTDOWN ============

function CountdownInline({ iso }: { iso: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const { d, h, m, s } = countdownParts(iso, now);
  const cells = [
    { v: d, l: 'ДНЕЙ', highlight: true },
    { v: h, l: 'ЧАСОВ', highlight: false },
    { v: m, l: 'МИНУТ', highlight: false },
    { v: s, l: 'СЕКУНД', highlight: false },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 }}>
      {cells.map((c, i) => (
        <Fragment key={c.l}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 30,
                lineHeight: 32,
                fontWeight: '800',
                color: c.highlight ? '#E10600' : '#FAFAFA',
                letterSpacing: -0.5,
              }}>
              {c.v}
            </Text>
            <Text
              style={{
                fontSize: 9,
                color: '#A0A0B0',
                marginTop: 4,
                letterSpacing: 1.8,
                fontWeight: '700',
              }}>
              {c.l}
            </Text>
          </View>
          {i < cells.length - 1 && (
            <View
              style={{
                width: 1,
                height: 30,
                backgroundColor: 'rgba(225,6,0,0.35)',
              }}
            />
          )}
        </Fragment>
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
