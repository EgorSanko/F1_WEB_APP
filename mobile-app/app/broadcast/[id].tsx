import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type BroadcastComment } from '@/lib/api';
import { useSchedule, flagFor } from '@/lib/hooks';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useAuth } from '@/lib/auth';
import { useIsSaved } from '@/lib/saves';
import { useSpoiler, isSpoilerHidden } from '@/lib/spoiler';
import { ruRaceTitle } from '@/lib/locale';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

const SESSION_LABEL: Record<string, string> = {
  race: 'Гонка',
  qualifying: 'Квалификация',
  sprint: 'Спринт',
  sprint_qualifying: 'Спринт-квалификация',
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  review: 'Обзор',
};

const SESSION_DESCR: Record<string, string> = {
  race: 'Полная запись гонки',
  sprint: 'Полная запись спринта',
  qualifying: 'Полная запись квалификации',
  sprint_qualifying: 'Полная запись спринт-квалификации',
  fp1: 'Свободная практика 1',
  fp2: 'Свободная практика 2',
  fp3: 'Свободная практика 3',
  review: 'Обзор гран-при',
};

export default function BroadcastDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const broadcastId = Number(id);
  const schedule = useSchedule();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['broadcasts'],
    queryFn: api.broadcasts,
  });
  const b = useMemo(
    () => list.data?.broadcasts.find((x) => x.id === broadcastId),
    [list.data, broadcastId],
  );
  const race = b ? schedule.data?.races.find((r) => r.round === b.race_round) : null;

  const social = useQuery({
    queryKey: ['broadcast-social', broadcastId],
    queryFn: () => api.broadcastSocial(broadcastId),
    enabled: !!broadcastId,
  });
  const comments = useQuery({
    queryKey: ['broadcast-comments', broadcastId, 'new'],
    queryFn: () => api.broadcastComments(broadcastId, 'new', 50),
    enabled: !!broadcastId,
  });

  // Optimistic like state
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  useEffect(() => {
    if (social.data) {
      setLiked(social.data.my_liked);
      setLikesCount(social.data.likes_count);
    }
  }, [social.data]);

  const { saved, toggle: toggleSave } = useIsSaved(broadcastId || null);

  const spoilerEnabled = useSpoiler((s) => s.enabled);
  const spoilerActive = b ? isSpoilerHidden(b.season, spoilerEnabled) : false;
  const [revealComments, setRevealComments] = useState(false);
  const showComments = !spoilerActive || revealComments;

  if (list.isLoading || !b) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#E10600" />
      </View>
    );
  }

  const sessionLabel = SESSION_LABEL[b.session_type] ?? b.session_type;
  const title = b.title ?? `${sessionLabel} · ${race?.locality ?? race?.country ?? ''}`.trim();
  const description = `${SESSION_DESCR[b.session_type] ?? sessionLabel}${
    race ? ` Гран-при ${ruRaceTitle(race.country, race.name)}` : ''
  }`;
  const dateStr = b.started_at
    ? new Date(b.started_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const handleLike = async () => {
    if (!user) {
      Alert.alert('Нужен вход', 'Войди в Профиле чтобы ставить лайки.');
      return;
    }
    // Optimistic update
    setLiked((v) => !v);
    setLikesCount((c) => c + (liked ? -1 : 1));
    try {
      const r = await api.broadcastLikeToggle(broadcastId);
      setLiked(r.my_liked);
      setLikesCount(r.likes_count);
      queryClient.invalidateQueries({ queryKey: ['broadcast-social', broadcastId] });
    } catch (e) {
      // Revert
      setLiked((v) => !v);
      setLikesCount((c) => c + (liked ? 1 : -1));
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${title}\n${b.video_url}`,
        url: b.video_url,
        title,
      });
    } catch {
      // user cancelled
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 4,
            paddingBottom: 4,
          }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={28} color="#FAFAFA" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleShare}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-vertical" size={20} color="#FAFAFA" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <VideoPlayer videoUrl={b.video_url} embedUrl={b.embed_url} title={title} />

          {/* Title block */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              {race?.country_code ? (
                <Text style={{ fontSize: 14, marginRight: 6 }}>{flagFor(race.country_code)}</Text>
              ) : null}
              {race ? (
                <Text
                  style={{
                    color: '#E10600',
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 1.5,
                  }}>
                  {race.name.toUpperCase()}
                </Text>
              ) : null}
              <Text style={{ color: '#6B6B7B', fontSize: 11, marginHorizontal: 6 }}>·</Text>
              <Text
                style={{
                  color: '#A0A0B0',
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                }}>
                {sessionLabel.toUpperCase()}
              </Text>
            </View>
            <Text
              style={{
                color: '#FAFAFA',
                fontSize: 22,
                fontWeight: '800',
                marginTop: 8,
                letterSpacing: -0.3,
              }}>
              {title}
            </Text>
            {dateStr ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <Ionicons name="calendar-outline" size={12} color="#6B6B7B" />
                <Text className="text-muted-2" style={{ fontSize: 12, marginLeft: 5 }}>
                  Опубликовано: {dateStr}
                </Text>
              </View>
            ) : null}
            <Text
              className="text-muted"
              style={{ fontSize: 13, lineHeight: 18, marginTop: 12 }}
              numberOfLines={3}>
              {description}
            </Text>

            {/* Action row */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <ActionButton
                icon={liked ? 'heart' : 'heart-outline'}
                label={formatCount(likesCount)}
                color={liked ? '#E10600' : '#FAFAFA'}
                iconColor={liked ? '#E10600' : '#E10600'}
                onPress={handleLike}
              />
              <ActionButton
                icon={saved ? 'bookmark' : 'bookmark-outline'}
                label="Сохранить"
                color={saved ? '#E10600' : '#FAFAFA'}
                iconColor={saved ? '#E10600' : '#FAFAFA'}
                onPress={toggleSave}
              />
              <ActionButton
                icon="share-social-outline"
                label="Поделиться"
                color="#FAFAFA"
                iconColor="#FAFAFA"
                onPress={handleShare}
              />
            </View>
          </View>

          {/* Comments */}
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={{ color: '#FAFAFA', fontSize: 18, fontWeight: '800' }}>
                  Комментарии
                </Text>
                <Text style={{ color: '#6B6B7B', fontSize: 14, marginLeft: 8 }}>
                  {social.data?.comments_count ?? comments.data?.total ?? 0}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#A0A0B0', fontSize: 12, marginRight: 4 }}>
                  Сначала новые
                </Text>
                <Ionicons name="swap-vertical" size={14} color="#A0A0B0" />
              </View>
            </View>

            {!showComments ? (
              <SpoilerHidden
                count={social.data?.comments_count ?? 0}
                onReveal={() => setRevealComments(true)}
              />
            ) : (
              <>
                <CommentInput
                  user={user}
                  onSubmit={async (text) => {
                    try {
                      await api.broadcastCommentPost(broadcastId, text);
                      queryClient.invalidateQueries({
                        queryKey: ['broadcast-comments', broadcastId, 'new'],
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['broadcast-social', broadcastId],
                      });
                    } catch (e) {
                      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
                    }
                  }}
                />

                {comments.isLoading && (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator color="#E10600" />
                  </View>
                )}

                <View style={{ gap: 14, marginTop: 14 }}>
                  {(comments.data?.comments ?? []).map((c) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      isAdmin={isAdmin}
                      onLike={async () => {
                        if (!user) {
                          Alert.alert('Нужен вход', 'Войди чтобы лайкать');
                          return;
                        }
                        try {
                          await api.commentLikeToggle(c.id);
                          queryClient.invalidateQueries({
                            queryKey: ['broadcast-comments', broadcastId, 'new'],
                          });
                        } catch (e) {
                          Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
                        }
                      }}
                      onDelete={async () => {
                        try {
                          await api.commentDelete(c.id);
                          queryClient.invalidateQueries({
                            queryKey: ['broadcast-comments', broadcastId, 'new'],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ['broadcast-social', broadcastId],
                          });
                        } catch (e) {
                          Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось');
                        }
                      }}
                    />
                  ))}
                </View>

                {!comments.isLoading && (comments.data?.comments?.length ?? 0) === 0 && (
                  <View
                    style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Ionicons name="chatbubbles-outline" size={32} color="#3A3A4A" />
                    <Text className="text-muted-2 text-sm mt-2">Будь первым</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============ ACTION BUTTON ============

function ActionButton({
  icon,
  label,
  color,
  iconColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text
        style={{
          color,
          fontSize: 13,
          fontWeight: '700',
          marginLeft: 6,
        }}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ============ SPOILER GUARD ============

function SpoilerHidden({ count, onReveal }: { count: number; onReveal: () => void }) {
  return (
    <View
      style={{
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(225,6,0,0.25)',
        padding: 20,
        alignItems: 'center',
      }}>
      <Ionicons name="eye-off-outline" size={28} color="#E10600" />
      <Text
        style={{
          color: '#FAFAFA',
          fontSize: 15,
          fontWeight: '800',
          marginTop: 10,
          textAlign: 'center',
        }}>
        Комментарии скрыты
      </Text>
      <Text
        style={{ color: '#A0A0B0', fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 16 }}>
        Включён режим без спойлеров. Комментарии могут содержать результаты гонки.
      </Text>
      <Pressable
        onPress={onReveal}
        style={{
          marginTop: 14,
          backgroundColor: '#E10600',
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 999,
        }}>
        <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>
          ПОКАЗАТЬ {count > 0 ? `(${count})` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

// ============ COMMENT INPUT ============

function CommentInput({
  user,
  onSubmit,
}: {
  user: { user_id: number; photo_url?: string } | null;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View
        style={{
          backgroundColor: CARD_BG,
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.05)',
        }}>
        <Text className="text-muted text-sm text-center">
          Войди чтобы оставить комментарий
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD_BG,
        borderRadius: 999,
        paddingLeft: 4,
        paddingRight: 4,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}>
      {user.photo_url ? (
        <Image
          source={{ uri: user.photo_url }}
          style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }}
        />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#2A2A38',
            marginRight: 8,
          }}
        />
      )}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Написать комментарий..."
        placeholderTextColor="#6B6B7B"
        multiline
        maxLength={1000}
        style={{
          flex: 1,
          color: '#FAFAFA',
          fontSize: 14,
          paddingVertical: 6,
          paddingHorizontal: 4,
          maxHeight: 80,
        }}
      />
      <Pressable
        onPress={submit}
        disabled={busy || !text.trim()}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy || !text.trim() ? 0.4 : 1,
        }}>
        {busy ? (
          <ActivityIndicator color="#E10600" size="small" />
        ) : (
          <Ionicons name="send" size={18} color="#E10600" />
        )}
      </Pressable>
    </View>
  );
}

// ============ COMMENT ROW ============

function CommentRow({
  comment,
  isAdmin,
  onLike,
  onDelete,
}: {
  comment: BroadcastComment;
  isAdmin: boolean;
  onLike: () => void;
  onDelete: () => void;
}) {
  const canDelete = comment.is_mine || isAdmin;
  const deleteLabel = comment.is_mine
    ? 'Удалить свой комментарий?'
    : 'Удалить комментарий (модератор)?';

  const confirmDelete = () => {
    Alert.alert(deleteLabel, comment.text.slice(0, 120), [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {comment.user_photo_url ? (
        <Image
          source={{ uri: comment.user_photo_url }}
          style={{ width: 36, height: 36, borderRadius: 18 }}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#2A2A38',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="person" size={18} color="#6B6B7B" />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={{ color: '#FAFAFA', fontSize: 13, fontWeight: '800' }}>
            {comment.user_name}
          </Text>
          {comment.is_mine ? (
            <View
              style={{
                marginLeft: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: 'rgba(225,6,0,0.15)',
              }}>
              <Text style={{ color: '#E10600', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
                ВЫ
              </Text>
            </View>
          ) : null}
          <Text style={{ color: '#6B6B7B', fontSize: 11, marginLeft: 8 }}>
            {relativeTime(comment.created_at)}
          </Text>
        </View>
        <Text style={{ color: '#FAFAFA', fontSize: 13.5, marginTop: 4, lineHeight: 18 }}>
          {comment.text}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 14 }}>
          <Pressable
            onPress={onLike}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name={comment.my_liked ? 'heart' : 'heart-outline'}
              size={14}
              color={comment.my_liked ? '#E10600' : '#6B6B7B'}
            />
            {comment.likes_count > 0 ? (
              <Text
                style={{
                  color: comment.my_liked ? '#E10600' : '#6B6B7B',
                  fontSize: 11,
                  fontWeight: '700',
                  marginLeft: 4,
                }}>
                {comment.likes_count}
              </Text>
            ) : null}
          </Pressable>

          {canDelete ? (
            <Pressable onPress={confirmDelete} hitSlop={6}>
              <Text style={{ color: '#E10600', fontSize: 11, fontWeight: '700' }}>
                {comment.is_mine ? 'Удалить' : 'Удалить (модер.)'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ============ HELPERS ============

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
  return `${Math.round(n / 1000)}K`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} д назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
