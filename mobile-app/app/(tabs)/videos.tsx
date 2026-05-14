import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';

import {
  useBroadcasts,
  useLiveBroadcasts,
  useSchedule,
  flagFor,
} from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { videoThumbnail, type Broadcast } from '@/lib/api';

const CURRENT_SEASON = 2026;
const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';
const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

const SESSION_ORDER = [
  'fp1', 'fp2', 'fp3', 'sprint_qualifying', 'sprint', 'qualifying', 'race', 'review',
] as const;

const SESSION_LABEL: Record<string, string> = {
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  sprint_qualifying: 'Спринт-квалификация',
  sprint: 'Спринт',
  qualifying: 'Квалификация',
  race: 'Гонка',
  review: 'Обзор',
};

const SESSION_SHORT: Record<string, string> = {
  fp1: 'FP1',
  fp2: 'FP2',
  fp3: 'FP3',
  sprint_qualifying: 'Спринт-квалификация',
  sprint: 'Спринт',
  qualifying: 'Квалификация',
  race: 'Гонка',
  review: 'Обзор',
};

function sessionIndex(type: string): number {
  const i = SESSION_ORDER.indexOf(type as (typeof SESSION_ORDER)[number]);
  return i === -1 ? 99 : i;
}

function providerLabel(url: string): { label: string; color: string } {
  const u = url.toLowerCase();
  if (u.includes('youtu')) return { label: 'YT', color: '#FF0000' };
  if (u.includes('rutube')) return { label: 'RT', color: '#000000' };
  if (u.includes('vk.com') || u.includes('vkvideo')) return { label: 'VK', color: '#0077FF' };
  return { label: 'VIDEO', color: '#E10600' };
}

function computeDuration(started?: string, ended?: string | null): string | null {
  if (!started || !ended) return null;
  const s = new Date(started).getTime();
  const e = new Date(ended).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  const total = Math.floor((e - s) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export default function VideosScreen() {
  const { isAdmin } = useAuth();
  const broadcasts = useBroadcasts();
  const live = useLiveBroadcasts();
  const schedule = useSchedule();

  const raceByRound = useMemo(() => {
    const m = new Map<number, { name: string; country_code?: string; date: string }>();
    schedule.data?.races.forEach((r) =>
      m.set(r.round, { name: r.name, country_code: r.country_code, date: r.date }),
    );
    return m;
  }, [schedule.data]);

  const grouped = useMemo(() => {
    const list = (broadcasts.data?.broadcasts ?? []).filter(
      (b) => b.season === CURRENT_SEASON,
    );
    const m = new Map<number, Broadcast[]>();
    for (const b of list) {
      if (!m.has(b.race_round)) m.set(b.race_round, []);
      m.get(b.race_round)!.push(b);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => sessionIndex(a.session_type) - sessionIndex(b.session_type));
    }
    return Array.from(m.entries()).sort(([a], [b]) => b - a);
  }, [broadcasts.data]);

  const liveList = (live.data?.broadcasts ?? []).filter((b) => b.season === CURRENT_SEASON);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text
            style={{
              color: '#FAFAFA',
              fontSize: 32,
              fontWeight: '800',
              letterSpacing: -0.5,
            }}>
            Видео
          </Text>
          {isAdmin && (
            <Pressable
              onPress={() => router.push('/admin/broadcasts' as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#E10600',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                shadowColor: '#E10600',
                shadowOpacity: 0.45,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}>
              <Ionicons name="add" size={16} color="#FAFAFA" />
              <Text style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '800', marginLeft: 5 }}>
                Управление
              </Text>
            </Pressable>
          )}
        </View>

        {/* Live banner */}
        {liveList.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
            {liveList.map((b) => {
              const race = raceByRound.get(b.race_round);
              return (
                <Link key={b.id} href={`/broadcast/${b.id}` as never} asChild>
                  <Pressable
                    style={{
                      backgroundColor: '#E10600',
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                    <View
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 10 }}
                    />
                    <Text
                      style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginRight: 10 }}>
                      LIVE
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>
                        {SESSION_LABEL[b.session_type]} · {race?.name ?? `Раунд ${b.race_round}`}
                      </Text>
                    </View>
                    <Ionicons name="play-circle" size={28} color="#fff" />
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {broadcasts.isLoading && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#E10600" />
            </View>
          )}

          {!broadcasts.isLoading && grouped.length === 0 && (
            <View style={{ paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="film-outline" size={36} color="#6B6B7B" />
              <Text className="text-muted text-sm mt-2">
                Записей сезона {CURRENT_SEASON} пока нет
              </Text>
            </View>
          )}

          {grouped.map(([round, items]) => {
            const race = raceByRound.get(round);
            return (
              <View key={round} style={{ marginBottom: 22 }}>
                {/* Race section header with F1 car decoration */}
                <View
                  style={{
                    paddingHorizontal: 20,
                    marginBottom: 14,
                    height: 64,
                    position: 'relative',
                    overflow: 'hidden',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  <Text style={{ fontSize: 24, marginRight: 10 }}>
                    {race?.country_code ? flagFor(race.country_code) : '🏁'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: '#FAFAFA', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}
                      numberOfLines={1}>
                      {race?.name ?? `Гран-при ${round}`}
                    </Text>
                    <Text className="text-muted-2" style={{ fontSize: 12, marginTop: 2 }}>
                      Раунд {String(round).padStart(2, '0')} · {CURRENT_SEASON} · {items.length}{' '}
                      {items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}
                    </Text>
                  </View>
                  <Image
                    source={{ uri: CAR_OVERLAY }}
                    style={{
                      position: 'absolute',
                      right: -10,
                      top: -10,
                      width: 170,
                      height: 90,
                      opacity: 0.55,
                    }}
                    contentFit="contain"
                  />
                </View>

                <View style={{ paddingHorizontal: 16, gap: 10 }}>
                  {items.map((b) => (
                    <VideoCard
                      key={b.id}
                      broadcast={b}
                      raceName={race?.name?.replace('Гран-при ', '') ?? ''}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function VideoCard({ broadcast: b, raceName }: { broadcast: Broadcast; raceName: string }) {
  const sessionShort = SESSION_SHORT[b.session_type] ?? b.session_type;
  const sessionFull = SESSION_LABEL[b.session_type] ?? b.session_type;
  const prov = providerLabel(b.video_url || b.embed_url || '');
  const thumb = videoThumbnail(b.video_url, b.embed_url);
  const duration = computeDuration(b.started_at, b.ended_at);
  const date = b.started_at
    ? new Date(b.started_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Link href={`/broadcast/${b.id}` as never} asChild>
      <Pressable
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          alignItems: 'stretch',
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: 130,
            aspectRatio: 16 / 11,
            backgroundColor: '#1A1A24',
            position: 'relative',
          }}>
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="videocam-outline" size={26} color="#3A3A4A" />
            </View>
          )}
          {/* Provider badge */}
          <View
            style={{
              position: 'absolute',
              left: 6,
              top: 6,
              backgroundColor: prov.color,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
              {prov.label}
            </Text>
          </View>
          {/* Play button */}
          <View
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="play" size={14} color="#FAFAFA" style={{ marginLeft: 1 }} />
          </View>
          {/* Duration */}
          {duration ? (
            <View
              style={{
                position: 'absolute',
                right: 6,
                bottom: 6,
                backgroundColor: 'rgba(0,0,0,0.75)',
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderRadius: 3,
              }}>
              <Text style={{ color: '#FAFAFA', fontSize: 10, fontWeight: '700' }}>
                {duration}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text
              style={{
                color: '#FAFAFA',
                fontSize: 14.5,
                fontWeight: '800',
                letterSpacing: -0.2,
                flex: 1,
              }}
              numberOfLines={2}>
              {sessionShort}
              {raceName ? ` · ${raceName}` : ''}
            </Text>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
              }}
              style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
              <Ionicons name="ellipsis-vertical" size={14} color="#6B6B7B" />
            </Pressable>
          </View>
          <Text className="text-muted" style={{ fontSize: 12, marginTop: 3 }} numberOfLines={1}>
            {sessionFull}
          </Text>
          {date ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Ionicons name="calendar-outline" size={11} color="#6B6B7B" />
              <Text className="text-muted-2" style={{ fontSize: 11, marginLeft: 5 }}>
                {date}
              </Text>
            </View>
          ) : null}
          {b.is_live ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 6,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#E10600',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }}>
                LIVE
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ paddingRight: 10, justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
        </View>
      </Pressable>
    </Link>
  );
}
