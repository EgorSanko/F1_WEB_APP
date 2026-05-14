import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useMyPredictions, useSchedule, flagFor } from '@/lib/hooks';
import type { Prediction, PredictionType } from '@/lib/api';
import { ruRaceTitle } from '@/lib/locale';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

const TYPE_LABEL: Record<PredictionType, string> = {
  winner: 'Победитель',
  podium: 'Подиум',
  fastest_lap: 'Быстрый круг',
  dnf_count: 'DNF',
  safety_car: 'Safety Car',
};

const TYPE_ICON: Record<PredictionType, keyof typeof Ionicons.glyphMap> = {
  winner: 'trophy',
  podium: 'medal',
  fastest_lap: 'flash',
  dnf_count: 'flag',
  safety_car: 'shield-checkmark',
};

const STATUS_INFO: Record<
  Prediction['status'],
  { label: string; color: string; bg: string }
> = {
  pending: { label: 'Ожидает', color: '#A0A0B0', bg: 'rgba(255,255,255,0.06)' },
  correct: { label: 'Верно', color: '#10B981', bg: 'rgba(16,185,129,0.18)' },
  incorrect: { label: 'Неверно', color: '#A0A0B0', bg: 'rgba(255,255,255,0.05)' },
  partial: { label: 'Частично', color: '#FFCB05', bg: 'rgba(255,203,5,0.18)' },
};

export default function MyPredictionsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'settled'>('pending');
  const data = useMyPredictions();
  const schedule = useSchedule();

  const list = tab === 'pending' ? data.data?.pending ?? [] : data.data?.settled ?? [];

  const raceByRound = useMemo(() => {
    const m = new Map<number, { name: string; country?: string; country_code?: string }>();
    schedule.data?.races.forEach((r) =>
      m.set(r.round, { name: r.name, country: r.country, country_code: r.country_code }),
    );
    return m;
  }, [schedule.data]);

  const grouped = useMemo(() => {
    const m = new Map<number, Prediction[]>();
    for (const p of list) {
      if (!m.has(p.race_round)) m.set(p.race_round, []);
      m.get(p.race_round)!.push(p);
    }
    return Array.from(m.entries()).sort(
      (a, b) => (tab === 'pending' ? a[0] - b[0] : b[0] - a[0]),
    );
  }, [list, tab]);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header onBack={() => router.back()} title="Мои прогнозы" />

        {/* Summary card */}
        {data.data && (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 6,
              marginBottom: 12,
              backgroundColor: CARD_BG,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(225,6,0,0.18)',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: 'rgba(225,6,0,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="trophy" size={22} color="#E10600" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: '#FAFAFA', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                {data.data.total_won.toLocaleString('ru-RU')}
              </Text>
              <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                Очков заработано
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#FAFAFA', fontSize: 16, fontWeight: '800' }}>
                {data.data.settled.length} / {data.data.settled.length + data.data.pending.length}
              </Text>
              <Text className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                завершено
              </Text>
            </View>
          </View>
        )}

        {/* Segmented tabs */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 4,
            backgroundColor: CARD_BG,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}>
          {(['pending', 'settled'] as const).map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: active ? '#E10600' : 'transparent',
                  shadowColor: active ? '#E10600' : 'transparent',
                  shadowOpacity: active ? 0.4 : 0,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: active ? 4 : 0,
                }}>
                <Text
                  style={{
                    color: active ? '#FAFAFA' : '#A0A0B0',
                    fontWeight: '800',
                    fontSize: 12,
                  }}>
                  {t === 'pending' ? 'Ожидают' : 'Завершены'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {data.isLoading && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color="#E10600" />
            </View>
          )}
          {data.data && list.length === 0 && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="ticket-outline" size={36} color="#3A3A4A" />
              <Text className="text-muted text-sm mt-2">
                {tab === 'pending' ? 'Нет ожидающих прогнозов' : 'Нет завершённых прогнозов'}
              </Text>
            </View>
          )}

          {grouped.map(([round, preds]) => {
            const race = raceByRound.get(round);
            const titleGen = race ? ruRaceTitle(race.country, race.name) : `Раунд ${round}`;
            const totalEarned = preds.reduce((s, p) => s + (p.points_won ?? 0), 0);
            return (
              <View key={round} style={{ marginBottom: 18 }}>
                {/* Race section header */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                    paddingHorizontal: 4,
                  }}>
                  <View
                    style={{
                      width: 3,
                      height: 26,
                      backgroundColor: '#E10600',
                      borderRadius: 2,
                      marginRight: 10,
                    }}
                  />
                  <Text style={{ fontSize: 18, marginRight: 8 }}>
                    {race?.country_code ? flagFor(race.country_code) : '🏁'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: '#E10600', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }}>
                      ГРАН-ПРИ · РАУНД {String(round).padStart(2, '0')}
                    </Text>
                    <Text
                      style={{ color: '#FAFAFA', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}
                      numberOfLines={1}>
                      {titleGen}
                    </Text>
                  </View>
                  {tab === 'settled' && totalEarned > 0 && (
                    <View
                      style={{
                        backgroundColor: 'rgba(225,6,0,0.18)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(225,6,0,0.35)',
                      }}>
                      <Text style={{ color: '#E10600', fontSize: 11, fontWeight: '800' }}>
                        +{totalEarned} оч.
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                  }}>
                  {preds.map((p, i) => {
                    const status = STATUS_INFO[p.status];
                    return (
                      <View
                        key={p.id}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderBottomWidth: i < preds.length - 1 ? 1 : 0,
                          borderBottomColor: 'rgba(255,255,255,0.04)',
                        }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: 'rgba(225,6,0,0.15)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Ionicons
                            name={TYPE_ICON[p.prediction_type]}
                            size={16}
                            color="#E10600"
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: '#FAFAFA', fontSize: 14, fontWeight: '800' }}>
                            {TYPE_LABEL[p.prediction_type]}
                          </Text>
                          <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {formatValue(p.prediction_type, p.prediction_value)}
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 5,
                            backgroundColor: status.bg,
                          }}>
                          <Text
                            style={{
                              color: status.color,
                              fontSize: 9,
                              fontWeight: '800',
                              letterSpacing: 1.2,
                            }}>
                            {status.label.toUpperCase()}
                          </Text>
                        </View>
                        {p.status !== 'pending' && (
                          <Text
                            style={{
                              color: p.points_won ? '#E10600' : '#6B6B7B',
                              fontWeight: '800',
                              fontSize: 13,
                              marginLeft: 10,
                              width: 40,
                              textAlign: 'right',
                            }}>
                            {p.points_won ? `+${p.points_won}` : '0'}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 6,
      }}>
      <Pressable
        onPress={onBack}
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
          marginRight: 44,
        }}
        numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function formatValue(type: PredictionType, value: unknown): string {
  if (value == null) return '—';
  if (type === 'safety_car') return value === true || value === 'yes' ? 'Да' : 'Нет';
  if (type === 'dnf_count') return `${value} сходов`;
  if (type === 'podium' && Array.isArray(value)) {
    return value.map((n) => `#${n}`).join(' → ');
  }
  if (typeof value === 'number') return `Пилот #${value}`;
  return String(value);
}
