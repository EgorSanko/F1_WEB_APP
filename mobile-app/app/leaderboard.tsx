import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useLeaderboard } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { absUrl } from '@/lib/api';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';
const PODIUM_COLORS = ['#FFCB05', '#C0C0C0', '#CD7F32'] as const;

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const lb = useLeaderboard();

  const entries = lb.data?.leaderboard ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = user ? entries.find((e) => e.user_id === user.user_id) : null;
  const myRank = me?.rank ?? (user ? entries.findIndex((e) => e.user_id === user.user_id) + 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header onBack={() => router.back()} title="Топ игроков" />

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {lb.isLoading && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color="#E10600" />
            </View>
          )}

          {/* Podium top-3 */}
          {top3.length === 3 && (
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 16,
                gap: 8,
                alignItems: 'flex-end',
                marginTop: 8,
                marginBottom: 18,
              }}>
              <PodiumPlayer
                entry={top3[1]}
                place={2}
                color={PODIUM_COLORS[1]}
                isMe={user?.user_id === top3[1].user_id}
              />
              <PodiumPlayer
                entry={top3[0]}
                place={1}
                color={PODIUM_COLORS[0]}
                winner
                isMe={user?.user_id === top3[0].user_id}
              />
              <PodiumPlayer
                entry={top3[2]}
                place={3}
                color={PODIUM_COLORS[2]}
                isMe={user?.user_id === top3[2].user_id}
              />
            </View>
          )}

          {/* My rank if not in top-3 */}
          {me && myRank > 3 && (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 12,
                backgroundColor: 'rgba(225,6,0,0.12)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(225,6,0,0.4)',
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: '#E10600',
                  fontWeight: '800',
                  fontSize: 20,
                  width: 28,
                  textAlign: 'center',
                }}>
                {myRank}
              </Text>
              <Avatar uri={me.photo_url} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 14 }}>Это ты</Text>
                <Text className="text-muted" style={{ fontSize: 11 }}>
                  {me.username ? `@${me.username}` : `User ${me.user_id}`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: '#E10600', fontWeight: '800', fontSize: 15 }}>
                  {(me.total_points ?? 0).toLocaleString('ru-RU')}
                </Text>
                <Text className="text-muted-2" style={{ fontSize: 10 }}>
                  очков
                </Text>
              </View>
            </View>
          )}

          {/* Rest of leaderboard */}
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {rest.map((e, i) => {
              const isMe = user?.user_id === e.user_id;
              const rank = e.rank ?? i + 4;
              return (
                <View
                  key={e.user_id}
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isMe ? 'rgba(225,6,0,0.45)' : 'rgba(255,255,255,0.05)',
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  <Text
                    style={{
                      color: isMe ? '#E10600' : '#A0A0B0',
                      fontWeight: '800',
                      fontSize: 18,
                      width: 28,
                      textAlign: 'center',
                    }}>
                    {rank}
                  </Text>
                  <Avatar uri={e.photo_url} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: '#FAFAFA', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                      {e.first_name || e.username || `User ${e.user_id}`}
                      {isMe ? ' · Это ты' : ''}
                    </Text>
                    {(e.username || e.correct_predictions != null) && (
                      <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                        {e.username ? `@${e.username}` : ''}
                        {e.username && e.correct_predictions != null ? ' · ' : ''}
                        {e.correct_predictions != null ? `${e.correct_predictions} верных` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 15 }}>
                      {(e.total_points ?? 0).toLocaleString('ru-RU')}
                    </Text>
                    <Text className="text-muted-2" style={{ fontSize: 10 }}>
                      очков
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {!lb.isLoading && entries.length === 0 && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Ionicons name="trophy-outline" size={36} color="#3A3A4A" />
              <Text className="text-muted text-sm mt-2">Пока пусто</Text>
            </View>
          )}
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
        paddingBottom: 8,
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

function Avatar({ uri }: { uri?: string }) {
  const url = absUrl(uri);
  if (url) {
    return <Image source={{ uri: url }} style={{ width: 40, height: 40, borderRadius: 20 }} />;
  }
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1A1A24',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name="person" size={20} color="#6B6B7B" />
    </View>
  );
}

function PodiumPlayer({
  entry,
  place,
  color,
  winner = false,
  isMe = false,
}: {
  entry: {
    user_id: number;
    first_name?: string;
    username?: string | null;
    photo_url?: string;
    total_points?: number;
  };
  place: 1 | 2 | 3;
  color: string;
  winner?: boolean;
  isMe?: boolean;
}) {
  const name = entry.first_name || entry.username || `User${entry.user_id}`;
  const url = absUrl(entry.photo_url);
  return (
    <View
      style={{
        flex: winner ? 1.18 : 1,
        backgroundColor: winner ? '#1A1505' : CARD_BG,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: color + (winner ? 'CC' : '55'),
        paddingTop: winner ? 18 : 12,
        paddingBottom: 14,
        paddingHorizontal: 6,
        alignItems: 'center',
        shadowColor: color,
        shadowOpacity: winner ? 0.5 : 0.22,
        shadowRadius: winner ? 20 : 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: winner ? 8 : 3,
        position: 'relative',
      }}>
      {winner && (
        <View
          style={{
            position: 'absolute',
            top: -14,
            backgroundColor: winner ? '#1A1505' : CARD_BG,
            paddingHorizontal: 8,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: color,
          }}>
          <Text style={{ fontSize: 18 }}>🏆</Text>
        </View>
      )}
      <Text
        style={{
          color,
          fontWeight: '800',
          fontSize: winner ? 32 : 24,
          letterSpacing: -1,
          lineHeight: winner ? 34 : 26,
        }}>
        {place}
      </Text>
      <View style={{ marginTop: 6 }}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={{
              width: winner ? 60 : 48,
              height: winner ? 60 : 48,
              borderRadius: winner ? 30 : 24,
              borderWidth: 2,
              borderColor: color,
            }}
          />
        ) : (
          <View
            style={{
              width: winner ? 60 : 48,
              height: winner ? 60 : 48,
              borderRadius: winner ? 30 : 24,
              backgroundColor: '#1A1A24',
              borderWidth: 2,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="person" size={20} color="#6B6B7B" />
          </View>
        )}
      </View>
      <Text
        style={{
          color: '#FAFAFA',
          fontSize: 12,
          fontWeight: '800',
          marginTop: 8,
          textAlign: 'center',
        }}
        numberOfLines={1}>
        {name}
        {isMe ? ' (ты)' : ''}
      </Text>
      <Text
        style={{
          color,
          fontWeight: '800',
          fontSize: winner ? 17 : 15,
          marginTop: 6,
          letterSpacing: -0.3,
        }}>
        {(entry.total_points ?? 0).toLocaleString('ru-RU')}
      </Text>
      <Text className="text-muted-2" style={{ fontSize: 9, marginTop: 1 }}>
        очков
      </Text>
    </View>
  );
}
