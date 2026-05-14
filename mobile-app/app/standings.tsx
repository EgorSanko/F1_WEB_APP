import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import {
  flagFor,
  useConstructorStandings,
  useDriverStandings,
  useHeadToHead,
  usePointsProgression,
  useTeams,
} from '@/lib/hooks';
import type { DriverStanding, H2HPair, PointsProgressionDriver, Team } from '@/lib/api';

const TABS = ['Пилоты', 'Кубок', 'Карточки', 'Команды', 'H2H', 'Прогресс'] as const;
type Tab = (typeof TABS)[number];

export default function StandingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Пилоты');

  const drivers = useDriverStandings();
  const constructors = useConstructorStandings();
  const teams = useTeams();
  const h2h = useHeadToHead();
  const progression = usePointsProgression();

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
            Чемпионат
          </Text>
        </View>

        {/* Scrollable tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 8,
            alignItems: 'center',
          }}>
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`px-4 py-2 rounded-full ${
                  active ? 'bg-red' : 'bg-surface border border-line'
                }`}>
                <Text
                  className={`text-xs font-bold ${active ? 'text-text' : 'text-muted'}`}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {tab === 'Пилоты' && <DriversTab data={drivers.data?.standings ?? []} loading={drivers.isLoading} />}
          {tab === 'Кубок' && (
            <ConstructorsTab
              data={constructors.data?.standings ?? []}
              loading={constructors.isLoading}
              onPickDriver={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {tab === 'Карточки' && (
            <DriverCardsTab
              data={drivers.data?.standings ?? []}
              loading={drivers.isLoading}
              onPick={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {tab === 'Команды' && (
            <TeamsTab
              data={teams.data?.teams ?? []}
              loading={teams.isLoading}
              onPickDriver={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {tab === 'H2H' && (
            <H2HTab
              data={h2h.data?.head_to_head ?? []}
              loading={h2h.isLoading}
              onPickDriver={(n) => router.push(`/driver/${n}` as never)}
            />
          )}
          {tab === 'Прогресс' && (
            <ProgressTab
              data={progression.data?.drivers ?? []}
              totalRounds={progression.data?.total_rounds ?? 24}
              loading={progression.isLoading}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ DRIVERS TAB ============
function DriversTab({ data, loading }: { data: DriverStanding[]; loading: boolean }) {
  const router = useRouter();
  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Стандинги недоступны" />;
  const top3 = data.slice(0, 3);
  return (
    <View>
      {top3.length === 3 && (
        <View className="px-4 mb-3">
          <Text className="text-text text-base font-bold mb-3">Лидеры сезона</Text>
          <View className="flex-row gap-2">
            {top3.map((d, i) => (
              <PodiumCard
                key={d.driver_number}
                d={d}
                rank={i + 1}
                onPress={() => router.push(`/driver/${d.driver_number}` as never)}
              />
            ))}
          </View>
        </View>
      )}
      <View className="px-4 gap-2 mt-2">
        {data.map((d, i) => (
          <Pressable
            key={d.driver_number}
            onPress={() => router.push(`/driver/${d.driver_number}` as never)}
            className="bg-surface rounded-xl p-3 border border-line flex-row items-center active:opacity-80">
            <Text className="font-extrabold w-7 text-center" style={{ color: medalColor(i) }}>
              {d.position ?? i + 1}
            </Text>
            <View
              className="w-1 h-10 rounded-full mx-2"
              style={{ backgroundColor: d.team_color || '#666' }}
            />
            {d.photo_url ? (
              <Image
                source={{ uri: d.photo_url }}
                style={{ width: 36, height: 36, borderRadius: 18 }}
              />
            ) : null}
            <View className="flex-1 ml-3">
              <View className="flex-row items-center">
                <Text className="text-text font-bold">{d.name}</Text>
                <Text className="text-muted text-xs ml-2">{flagFor(d.country)}</Text>
              </View>
              <Text className="text-muted text-xs">{d.team}</Text>
            </View>
            <View className="items-end mr-1">
              <Text className="text-text font-extrabold">{d.points}</Text>
              <Text className="text-muted text-xs">очков</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#6B6B7B" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ============ CONSTRUCTORS TAB ============
function ConstructorsTab({
  data,
  loading,
  onPickDriver,
}: {
  data: import('@/lib/api').ConstructorStanding[];
  loading: boolean;
  onPickDriver: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Стандинги недоступны" />;
  return (
    <View className="px-4 gap-2">
      {data.map((c, i) => (
        <View key={c.team} className="bg-surface rounded-2xl border border-line overflow-hidden">
          <View
            className="flex-row items-center p-4"
            style={{ backgroundColor: (c.team_color || '#666') + '15' }}>
            <Text
              className="font-extrabold w-7 text-center text-lg"
              style={{ color: medalColor(i) }}>
              {c.position ?? i + 1}
            </Text>
            <View
              className="w-1.5 h-10 rounded-full mx-2"
              style={{ backgroundColor: c.team_color || '#666' }}
            />
            <View className="flex-1">
              <Text className="text-text font-extrabold text-base">{c.team}</Text>
              <Text className="text-muted text-xs">
                {c.wins ? `${c.wins} побед` : 'Без побед'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-text font-extrabold text-lg">{c.points}</Text>
              <Text className="text-muted text-xs">очков</Text>
            </View>
          </View>
          {c.drivers && c.drivers.length > 0 && (
            <View className="flex-row border-t border-line">
              {c.drivers.map((dr, idx) => (
                <Pressable
                  key={dr.driver_number}
                  onPress={() => onPickDriver(dr.driver_number)}
                  className={`flex-1 flex-row items-center p-3 active:opacity-80 ${
                    idx === 0 && c.drivers!.length > 1 ? 'border-r border-line' : ''
                  }`}>
                  {dr.photo_url ? (
                    <Image
                      source={{ uri: dr.photo_url }}
                      style={{ width: 32, height: 32, borderRadius: 16 }}
                    />
                  ) : null}
                  <View className="flex-1 ml-2">
                    <Text className="text-text text-sm font-bold" numberOfLines={1}>
                      {dr.last_name}
                    </Text>
                    <Text className="text-muted text-[10px]">#{dr.driver_number}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ============ DRIVER CARDS TAB (большие фото) ============
function DriverCardsTab({
  data,
  loading,
  onPick,
}: {
  data: DriverStanding[];
  loading: boolean;
  onPick: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Карточки недоступны" />;
  return (
    <View className="flex-row flex-wrap px-3 gap-y-3">
      {data.map((d, i) => (
        <View key={d.driver_number} className="w-1/2 px-1">
          <Pressable
            onPress={() => onPick(d.driver_number)}
            className="rounded-2xl overflow-hidden border border-line active:opacity-80"
            style={{ backgroundColor: (d.team_color || '#666') + '22' }}>
            <View
              className="absolute top-0 left-0 right-0 h-1 z-10"
              style={{ backgroundColor: d.team_color || '#666' }}
            />
            <View className="p-3 flex-row items-start">
              <View className="flex-1">
                <Text className="text-text text-2xl font-extrabold" style={{ lineHeight: 26 }}>
                  {i + 1}
                </Text>
                <Text className="text-muted text-[10px] tracking-widest font-bold mt-1">
                  #{d.driver_number}
                </Text>
              </View>
              <Text className="text-text font-extrabold text-lg">{d.points}</Text>
            </View>
            <View className="px-3 items-center justify-end" style={{ height: 140 }}>
              {d.card_photo_url || d.photo_url ? (
                <Image
                  source={{ uri: d.card_photo_url || d.photo_url }}
                  style={{ width: 130, height: 140 }}
                  contentFit="contain"
                />
              ) : null}
            </View>
            <View className="p-3 bg-bg/40">
              <Text className="text-text font-light text-sm" numberOfLines={1}>
                {d.first_name}
              </Text>
              <Text className="text-text font-extrabold text-base" numberOfLines={1}>
                {d.last_name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Text className="text-xs mr-1">{flagFor(d.country)}</Text>
                <Text className="text-muted text-[11px]" numberOfLines={1}>
                  {d.team}
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ============ TEAMS TAB ============
function TeamsTab({
  data,
  loading,
  onPickDriver,
}: {
  data: Team[];
  loading: boolean;
  onPickDriver: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Команды недоступны" />;
  return (
    <View className="px-4 gap-3">
      {data.map((t) => (
        <View
          key={t.name}
          className="rounded-2xl overflow-hidden border border-line"
          style={{ backgroundColor: (t.color || '#666') + '15' }}>
          <View className="flex-row items-center p-4">
            {t.logo_url ? (
              <Image
                source={{ uri: t.logo_url }}
                style={{ width: 48, height: 48 }}
                contentFit="contain"
              />
            ) : null}
            <View className="flex-1 ml-3">
              <Text className="text-text font-extrabold text-lg">{t.name}</Text>
              <View
                className="h-1 rounded-full mt-1"
                style={{ width: 60, backgroundColor: t.color || '#666' }}
              />
            </View>
          </View>
          {t.car_url ? (
            <View className="items-center" style={{ height: 100 }}>
              <Image
                source={{ uri: t.car_url }}
                style={{ width: '90%', height: '100%' }}
                contentFit="contain"
              />
            </View>
          ) : null}
          {t.drivers && t.drivers.length > 0 && (
            <View className="flex-row border-t border-line">
              {t.drivers.map((dr, idx) => (
                <Pressable
                  key={dr.driver_number}
                  onPress={() => onPickDriver(dr.driver_number)}
                  className={`flex-1 p-3 items-center active:opacity-80 ${
                    idx === 0 && t.drivers!.length > 1 ? 'border-r border-line' : ''
                  }`}>
                  {dr.photo_url ? (
                    <Image
                      source={{ uri: dr.photo_url }}
                      style={{ width: 56, height: 56, borderRadius: 28 }}
                    />
                  ) : null}
                  <Text className="text-text font-bold text-sm mt-2" numberOfLines={1}>
                    {dr.last_name}
                  </Text>
                  <Text className="text-muted text-[10px]">#{dr.driver_number}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ============ H2H TAB ============
function H2HTab({
  data,
  loading,
  onPickDriver,
}: {
  data: H2HPair[];
  loading: boolean;
  onPickDriver: (n: number) => void;
}) {
  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Нет данных для H2H" />;
  return (
    <View className="px-4 gap-3">
      {data.map((p) => {
        const d1 = p.driver1;
        const d2 = p.driver2;
        const total = (d1.points || 0) + (d2.points || 0);
        const d1Share = total > 0 ? (d1.points || 0) / total : 0.5;
        return (
          <View
            key={p.team}
            className="rounded-2xl overflow-hidden border border-line"
            style={{ backgroundColor: (p.color || '#666') + '15' }}>
            <View className="px-4 py-3 border-b border-line">
              <Text className="text-text font-extrabold">{p.team}</Text>
            </View>
            {/* Pilots */}
            <View className="flex-row p-4 items-center">
              <Pressable
                onPress={() => onPickDriver(d1.number)}
                className="flex-1 items-center active:opacity-80">
                {d1.photo_url ? (
                  <Image
                    source={{ uri: d1.photo_url }}
                    style={{ width: 70, height: 70, borderRadius: 35 }}
                  />
                ) : null}
                <Text className="text-text font-bold text-sm mt-2" numberOfLines={1}>
                  {d1.full_name}
                </Text>
                <Text className="text-muted text-[10px]">#{d1.number}</Text>
              </Pressable>
              <View className="px-4">
                <Text className="text-muted font-bold">VS</Text>
              </View>
              <Pressable
                onPress={() => onPickDriver(d2.number)}
                className="flex-1 items-center active:opacity-80">
                {d2.photo_url ? (
                  <Image
                    source={{ uri: d2.photo_url }}
                    style={{ width: 70, height: 70, borderRadius: 35 }}
                  />
                ) : null}
                <Text className="text-text font-bold text-sm mt-2" numberOfLines={1}>
                  {d2.full_name}
                </Text>
                <Text className="text-muted text-[10px]">#{d2.number}</Text>
              </Pressable>
            </View>
            {/* Stats bar — Points */}
            <H2HBar
              label="Очки"
              v1={d1.points}
              v2={d2.points}
              share1={d1Share}
              color={p.color}
            />
            <H2HBar
              label="Победы"
              v1={d1.wins}
              v2={d2.wins}
              share1={
                d1.wins + d2.wins > 0 ? d1.wins / (d1.wins + d2.wins) : 0.5
              }
              color={p.color}
            />
          </View>
        );
      })}
    </View>
  );
}

function H2HBar({
  label,
  v1,
  v2,
  share1,
  color,
}: {
  label: string;
  v1: number;
  v2: number;
  share1: number;
  color?: string;
}) {
  const winner1 = v1 > v2;
  const winner2 = v2 > v1;
  return (
    <View className="px-4 py-3 border-t border-line">
      <View className="flex-row justify-between mb-1.5">
        <Text className={`text-sm font-bold ${winner1 ? 'text-text' : 'text-muted'}`}>{v1}</Text>
        <Text className="text-muted text-[10px] tracking-widest uppercase">{label}</Text>
        <Text className={`text-sm font-bold ${winner2 ? 'text-text' : 'text-muted'}`}>{v2}</Text>
      </View>
      <View className="h-1.5 rounded-full overflow-hidden bg-surface-2">
        <View
          style={{
            width: `${Math.max(2, share1 * 100)}%`,
            height: '100%',
            backgroundColor: color || '#666',
          }}
        />
      </View>
    </View>
  );
}

// ============ PROGRESS CHART (SVG line) ============
function ProgressTab({
  data,
  totalRounds,
  loading,
}: {
  data: PointsProgressionDriver[];
  totalRounds: number;
  loading: boolean;
}) {
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const chartW = Math.min(Dimensions.get('window').width - 32, 480);
  const chartH = 260;
  const padL = 32;
  const padR = 12;
  const padT = 10;
  const padB = 26;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const maxPoints = useMemo(() => {
    let m = 0;
    for (const d of data) for (const p of d.progression) if (p.cumulative > m) m = p.cumulative;
    return Math.ceil((m + 1) / 50) * 50 || 100;
  }, [data]);

  if (loading) return <ActivityIndicator color="#E10600" className="mt-10" />;
  if (!data.length) return <EmptyHint text="Нет данных" />;

  const xFor = (round: number) =>
    padL + (innerW * (round - 1)) / Math.max(1, totalRounds - 1);
  const yFor = (pts: number) => padT + innerH - (innerH * pts) / maxPoints;

  return (
    <View>
      <View className="px-4 mb-3">
        <Text className="text-text text-base font-bold mb-1">Прогресс по раундам</Text>
        <Text className="text-muted text-xs">Накопленные очки топ-10 пилотов</Text>
      </View>
      <View className="px-4 items-center">
        <Svg width={chartW} height={chartH}>
          {/* Y axis grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = padT + innerH * (1 - f);
            const pts = Math.round(maxPoints * f);
            return (
              <Line
                key={f}
                x1={padL}
                x2={chartW - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}
          {[0, 0.5, 1].map((f) => {
            const y = padT + innerH * (1 - f);
            const pts = Math.round(maxPoints * f);
            return (
              <SvgText
                key={`l${f}`}
                x={4}
                y={y + 4}
                fill="#6B6B7B"
                fontSize={9}>
                {pts}
              </SvgText>
            );
          })}
          {/* X axis ticks */}
          {Array.from({ length: Math.min(totalRounds, 6) }).map((_, i) => {
            const round = Math.round(1 + (i * (totalRounds - 1)) / Math.max(1, Math.min(totalRounds, 6) - 1));
            return (
              <SvgText
                key={`x${round}`}
                x={xFor(round)}
                y={chartH - 8}
                fill="#6B6B7B"
                fontSize={9}
                textAnchor="middle">
                R{round}
              </SvgText>
            );
          })}
          {/* Lines */}
          {data.map((d) => {
            const points = d.progression
              .map((p) => `${xFor(p.round)},${yFor(p.cumulative)}`)
              .join(' ');
            const isDim = highlighted != null && highlighted !== d.driver_number;
            return (
              <Polyline
                key={d.driver_number}
                points={points}
                fill="none"
                stroke={d.team_color || '#666'}
                strokeWidth={highlighted === d.driver_number ? 3 : 1.8}
                opacity={isDim ? 0.2 : 1}
              />
            );
          })}
        </Svg>
      </View>

      {/* Legend with tap-to-highlight */}
      <View className="px-4 mt-4 flex-row flex-wrap gap-2">
        {data.map((d) => {
          const active = highlighted === d.driver_number;
          return (
            <Pressable
              key={d.driver_number}
              onPress={() =>
                setHighlighted(active ? null : d.driver_number)
              }
              className={`flex-row items-center px-2.5 py-1 rounded-full border ${
                active ? 'border-red' : 'border-line'
              }`}>
              <View
                className="w-2.5 h-2.5 rounded-full mr-1.5"
                style={{ backgroundColor: d.team_color || '#666' }}
              />
              <Text className="text-text text-[11px] font-bold">{d.code}</Text>
              <Text className="text-muted text-[10px] ml-1">{Math.round(d.total_points)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============ SHARED ============
function PodiumCard({
  d,
  rank,
  onPress,
}: {
  d: DriverStanding;
  rank: number;
  onPress: () => void;
}) {
  const accent = medalColor(rank - 1);
  const teamColor = d.team_color || '#666';
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl overflow-hidden border border-line active:opacity-80"
      style={{ backgroundColor: teamColor + '25' }}>
      <View
        className="absolute top-0 right-0 left-0 h-1"
        style={{ backgroundColor: teamColor }}
      />
      <View className="p-3 items-center">
        <Text className="font-extrabold text-2xl" style={{ color: accent }}>
          {rank}
        </Text>
        {d.photo_url ? (
          <Image
            source={{ uri: d.photo_url }}
            style={{ width: 56, height: 56, borderRadius: 28, marginTop: 4 }}
          />
        ) : null}
        <Text className="text-text font-bold text-xs mt-2 text-center" numberOfLines={1}>
          {d.last_name}
        </Text>
        <Text className="text-text font-extrabold text-base mt-0.5">{d.points}</Text>
        <Text className="text-muted text-[10px]">очков</Text>
      </View>
    </Pressable>
  );
}

function medalColor(i: number) {
  if (i === 0) return '#FFCB05';
  if (i === 1) return '#C0C0C0';
  if (i === 2) return '#CD7F32';
  return '#A0A0B0';
}

function EmptyHint({ text }: { text: string }) {
  return (
    <View className="px-5 py-10 items-center">
      <Text className="text-muted text-sm">{text}</Text>
    </View>
  );
}
