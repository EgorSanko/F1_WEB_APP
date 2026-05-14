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
      <View style={{ flex: 1, backgroundColor: DARK_BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Header with back arrow */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
            <Pressable
              onPress={onClose}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={28} color="#FAFAFA" />
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                color: '#FAFAFA',
                fontSize: 19,
                fontWeight: '700',
              }}>
              {info.label}
            </Text>
            <View style={{ width: 44, height: 44 }} />
          </View>

          {/* Subtitle: description • до +N очков */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: 16,
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}>
            <Text className="text-muted text-sm">{info.description}</Text>
            <Text className="text-muted-2 text-sm">  •  </Text>
            <Text className="text-muted text-sm">до </Text>
            <Text style={{ color: '#E10600', fontWeight: '800', fontSize: 14 }}>
              +{info.max_points} очков
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {(info.type === 'winner' || info.type === 'fastest_lap') && (
              <DriverPickerList
                drivers={drivers}
                selected={pick != null ? [pick] : []}
                onPick={(n) => setPick(n)}
                single
              />
            )}

            {info.type === 'podium' && (
              <PodiumPicker drivers={drivers} value={podium} onChange={setPodium} />
            )}

            {info.type === 'dnf_count' && (
              <DnfPicker value={dnfCount} onChange={setDnfCount} />
            )}

            {info.type === 'safety_car' && (
              <SafetyCarPicker value={safetyCar} onChange={setSafetyCar} />
            )}
          </ScrollView>

          {/* Submit */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 }}>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit || busy}
              style={{
                paddingVertical: 18,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: canSubmit && !busy ? '#E10600' : 'rgba(225,6,0,0.25)',
                borderWidth: 1,
                borderColor: canSubmit ? 'rgba(255,255,255,0.12)' : 'rgba(225,6,0,0.3)',
                shadowColor: '#E10600',
                shadowOpacity: canSubmit && !busy ? 0.45 : 0,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 6 },
                elevation: canSubmit && !busy ? 8 : 0,
              }}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-text font-bold" style={{ fontSize: 16 }}>
                  Отправить прогноз
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ============ DRIVER PICKER (winner / fastest_lap / used by podium) ============

function DriverPickerList({
  drivers,
  selected,
  onPick,
  single = false,
}: {
  drivers: Driver[];
  selected: number[];
  onPick: (driverNumber: number) => void;
  single?: boolean;
}) {
  const sorted = useMemo(() => {
    return [...drivers].sort((a, b) => {
      const pa = a.position ?? 999;
      const pb = b.position ?? 999;
      if (pa !== pb) return pa - pb;
      return (b.points ?? 0) - (a.points ?? 0);
    });
  }, [drivers]);

  return (
    <View className="px-4" style={{ gap: 10 }}>
      {sorted.map((d, i) => {
        const isSelected = selected.includes(d.driver_number);
        const rank = single ? null : selected.indexOf(d.driver_number) + 1;
        const teamColor = d.team_color || '#666';
        const num = i + 1;

        return (
          <Pressable
            key={d.driver_number}
            onPress={() => onPick(d.driver_number)}
            style={{
              backgroundColor: CARD_BG,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: isSelected ? '#E10600' : 'rgba(255,255,255,0.05)',
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 14,
              overflow: 'hidden',
              shadowColor: isSelected ? '#E10600' : 'transparent',
              shadowOpacity: isSelected ? 0.35 : 0,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
              elevation: isSelected ? 6 : 0,
            }}>
            {/* Team-color left stripe */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 12,
                bottom: 12,
                width: 4,
                borderRadius: 2,
                backgroundColor: teamColor,
              }}
            />

            {/* Position number, colored by team */}
            <View style={{ width: 42, alignItems: 'center', marginLeft: 4 }}>
              <Text
                style={{
                  fontSize: 36,
                  lineHeight: 36,
                  fontWeight: '800',
                  color: teamColor,
                  letterSpacing: -1,
                }}>
                {num}
              </Text>
            </View>

            {/* Photo */}
            {d.photo_url ? (
              <Image
                source={{ uri: d.photo_url }}
                style={{ width: 56, height: 56, borderRadius: 28, marginLeft: 8 }}
              />
            ) : null}

            {/* Name + #N • Team */}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{
                  color: '#FAFAFA',
                  fontSize: 17,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                }}
                numberOfLines={1}>
                {d.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                <Text style={{ color: '#6B6B7B', fontSize: 13, fontWeight: '600' }}>
                  #{d.driver_number}
                </Text>
                <Text style={{ color: '#3A3A4A', fontSize: 13, marginHorizontal: 6 }}>•</Text>
                <Text style={{ color: teamColor, fontSize: 13, fontWeight: '700' }}>
                  {d.team}
                </Text>
              </View>
            </View>

            {/* Indicator: radio for single, rank pill for podium */}
            {single ? (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? '#E10600' : '#3A3A4A',
                  backgroundColor: isSelected ? '#E10600' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 6,
                }}>
                {isSelected && (
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }}
                  />
                )}
              </View>
            ) : isSelected && rank ? (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: '#E10600',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 6,
                }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{rank}</Text>
              </View>
            ) : (
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: '#3A3A4A',
                  marginLeft: 6,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ============ PODIUM PICKER ============

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

  const podiumColors = ['#FFCB05', '#C0C0C0', '#CD7F32'];

  return (
    <View>
      {/* P1 / P2 / P3 slot row */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 }}>
        {slots.map((s, i) => (
          <View
            key={s.rank}
            style={{
              flex: 1,
              aspectRatio: 3 / 4,
              backgroundColor: CARD_BG,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: s.driver
                ? podiumColors[i] + '88'
                : 'rgba(255,255,255,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
            }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: podiumColors[i] + '22',
                borderWidth: 1.5,
                borderColor: podiumColors[i],
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  color: podiumColors[i],
                  fontWeight: '800',
                  fontSize: 14,
                }}>
                P{s.rank}
              </Text>
            </View>
            {s.driver ? (
              <>
                {s.driver.photo_url ? (
                  <Image
                    source={{ uri: s.driver.photo_url }}
                    style={{ width: 60, height: 60, borderRadius: 30, marginTop: 10 }}
                  />
                ) : null}
                <Text
                  style={{ color: '#FAFAFA', fontSize: 12, fontWeight: '700', marginTop: 8 }}
                  numberOfLines={1}>
                  {s.driver.last_name || s.driver.name}
                </Text>
              </>
            ) : (
              <Text className="text-muted-2 text-[10px] mt-2">Не выбран</Text>
            )}
          </View>
        ))}
      </View>
      <Text className="text-muted text-xs px-5 mb-3">
        Первый тап → P1, второй → P2, третий → P3. Тап повторно — убрать.
      </Text>
      <DriverPickerList drivers={drivers} selected={value} onPick={handlePick} />
    </View>
  );
}

// ============ DNF COUNT PICKER ============

function DnfPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dec = () => {
    const n = parseInt(value || '0', 10);
    onChange(String(Math.max(0, n - 1)));
  };
  const inc = () => {
    const n = parseInt(value || '0', 10);
    onChange(String(Math.min(20, n + 1)));
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text className="text-muted text-sm mb-4 text-center">
        Сколько пилотов сойдёт с дистанции?
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          marginBottom: 16,
        }}>
        <Pressable
          onPress={dec}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: CARD_BG,
            borderWidth: 1,
            borderColor: 'rgba(225,6,0,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="remove" size={24} color="#E10600" />
        </Pressable>

        <View
          style={{
            backgroundColor: CARD_BG,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: 'rgba(225,6,0,0.35)',
            paddingVertical: 22,
            paddingHorizontal: 38,
            minWidth: 130,
            alignItems: 'center',
            shadowColor: '#E10600',
            shadowOpacity: 0.3,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, 2))}
            placeholder="0"
            placeholderTextColor="#3A3A4A"
            keyboardType="number-pad"
            maxLength={2}
            style={{
              color: '#FAFAFA',
              fontSize: 56,
              lineHeight: 60,
              fontWeight: '800',
              textAlign: 'center',
              minWidth: 70,
              padding: 0,
            }}
          />
        </View>

        <Pressable
          onPress={inc}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: CARD_BG,
            borderWidth: 1,
            borderColor: 'rgba(225,6,0,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="add" size={24} color="#E10600" />
        </Pressable>
      </View>

      <Text className="text-muted-2 text-xs text-center">
        ±1 от верного значения тоже даёт +15 очков
      </Text>
    </View>
  );
}

// ============ SAFETY CAR PICKER ============

function SafetyCarPicker({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text className="text-muted text-sm mb-5 text-center">
        Появится ли машина безопасности на трассе?
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[
          { v: true, label: 'ДА', icon: 'checkmark-circle' as const },
          { v: false, label: 'НЕТ', icon: 'close-circle' as const },
        ].map((opt) => {
          const active = value === opt.v;
          return (
            <Pressable
              key={opt.label}
              onPress={() => onChange(opt.v)}
              style={{
                flex: 1,
                paddingVertical: 28,
                borderRadius: 20,
                alignItems: 'center',
                backgroundColor: active ? '#E10600' : CARD_BG,
                borderWidth: 1.5,
                borderColor: active ? '#E10600' : 'rgba(255,255,255,0.06)',
                shadowColor: '#E10600',
                shadowOpacity: active ? 0.4 : 0,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: active ? 8 : 0,
              }}>
              <Ionicons
                name={opt.icon}
                size={40}
                color={active ? '#fff' : '#6B6B7B'}
              />
              <Text
                style={{
                  color: active ? '#FAFAFA' : '#A0A0B0',
                  fontWeight: '800',
                  fontSize: 16,
                  marginTop: 10,
                  letterSpacing: 2,
                }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
