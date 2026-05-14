import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';
const CAR_OVERLAY = 'https://f1hub.lead-seek.ru/static/car-drift.webp';

const GAMES = [
  {
    id: 'pit_stop',
    href: '/games/pit-stop',
    icon: 'construct' as const,
    title: 'Пит-стоп',
    desc: 'Смени шины быстрее всех',
    sub: '3 этапа · реакция',
    color: '#E10600',
  },
  {
    id: 'top_trumps',
    href: '/games/top-trumps',
    icon: 'albums' as const,
    title: 'Top Trumps',
    desc: 'Карточная битва пилотов F1',
    sub: '20 карт · стратегия',
    color: '#FFCB05',
  },
  {
    id: 'reaction',
    href: '/games/reaction',
    icon: 'flash' as const,
    title: 'Реакция',
    desc: 'Стартуй по зелёному свету',
    sub: '5 попыток · скорость',
    color: '#27F4D2',
  },
  {
    id: 'quiz',
    href: '/games/quiz',
    icon: 'help-circle' as const,
    title: 'F1 Квиз',
    desc: 'Проверь свои знания',
    sub: '10 вопросов · эрудиция',
    color: '#3B9BFF',
  },
] as const;

export default function GamesHub() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingTop: 4,
            paddingBottom: 8,
          }}>
          <Pressable
            onPress={() => router.back()}
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
            }}>
            Мини-игры
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}>
          {/* Hero banner */}
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 18,
              backgroundColor: CARD_BG,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(225,6,0,0.2)',
              padding: 18,
              flexDirection: 'row',
              alignItems: 'center',
              overflow: 'hidden',
              position: 'relative',
              height: 100,
              shadowColor: '#E10600',
              shadowOpacity: 0.15,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}>
            <View
              style={{
                width: 4,
                height: 36,
                backgroundColor: '#E10600',
                borderRadius: 2,
                marginRight: 12,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: '#E10600',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 2,
                }}>
                4 ИГРЫ
              </Text>
              <Text
                style={{
                  color: '#FAFAFA',
                  fontSize: 18,
                  fontWeight: '800',
                  marginTop: 4,
                  letterSpacing: -0.2,
                }}>
                Скорость, стратегия, знание F1
              </Text>
              <Text className="text-muted-2" style={{ fontSize: 11, marginTop: 2 }}>
                Открой ачивки и попади в топ игроков
              </Text>
            </View>
            <Image
              source={{ uri: CAR_OVERLAY }}
              style={{
                position: 'absolute',
                right: -30,
                top: -20,
                width: 200,
                height: 110,
                opacity: 0.35,
              }}
              contentFit="contain"
              pointerEvents="none"
            />
          </View>

          {/* Games grid 2x2 */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              paddingHorizontal: 12,
            }}>
            {GAMES.map((g) => (
              <View
                key={g.id}
                style={{ width: '50%', paddingHorizontal: 4, marginBottom: 10 }}>
                <Pressable
                  onPress={() => router.push(g.href as never)}
                  style={{
                    backgroundColor: CARD_BG,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: g.color + '55',
                    padding: 14,
                    aspectRatio: 1,
                    justifyContent: 'space-between',
                    shadowColor: g.color,
                    shadowOpacity: 0.18,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 3,
                  }}>
                  {/* Top: icon in colored square */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: g.color + '22',
                      borderWidth: 1,
                      borderColor: g.color + '55',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name={g.icon} size={24} color={g.color} />
                  </View>

                  {/* Title + desc */}
                  <View>
                    <Text
                      style={{
                        color: '#FAFAFA',
                        fontSize: 16,
                        fontWeight: '800',
                        letterSpacing: -0.3,
                      }}
                      numberOfLines={1}>
                      {g.title}
                    </Text>
                    <Text
                      className="text-muted"
                      style={{ fontSize: 11, marginTop: 3, lineHeight: 14 }}
                      numberOfLines={2}>
                      {g.desc}
                    </Text>
                  </View>

                  {/* Bottom: sub + play */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 6,
                    }}>
                    <Text
                      style={{
                        color: '#6B6B7B',
                        fontSize: 9,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                      }}
                      numberOfLines={1}>
                      {g.sub}
                    </Text>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: g.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="play" size={11} color="#FFFFFF" style={{ marginLeft: 1 }} />
                    </View>
                  </View>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Top games CTA */}
          <Pressable
            onPress={() => router.push('/leaderboard' as never)}
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              backgroundColor: CARD_BG,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(225,6,0,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="trophy" size={20} color="#E10600" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#FAFAFA', fontSize: 14, fontWeight: '800' }}>
                Топ игроков
              </Text>
              <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                Посмотри кто лидирует в этом сезоне
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
