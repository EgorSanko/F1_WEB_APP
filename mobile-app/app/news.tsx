import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useNews } from '@/lib/hooks';

const DARK_BG = '#0A0A12';
const CARD_BG = '#12121C';

export default function NewsScreen() {
  const router = useRouter();
  const news = useNews();

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
            Новости
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={news.isFetching && !news.isLoading}
              onRefresh={() => news.refetch()}
              tintColor="#E10600"
              colors={['#E10600']}
            />
          }>
          {news.isLoading && (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color="#E10600" />
            </View>
          )}
          {news.isError && (
            <View
              style={{
                backgroundColor: CARD_BG,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
              }}>
              <Text style={{ color: '#E10600', fontWeight: '800' }}>Ошибка загрузки</Text>
              <Pressable onPress={() => news.refetch()} style={{ marginTop: 8 }}>
                <Text style={{ color: '#FAFAFA', fontWeight: '700' }}>Повторить</Text>
              </Pressable>
            </View>
          )}
          {news.data?.posts.map((post, i) => {
            const image = post.image || post.photo;
            const badge = (post.source || 'НОВОСТЬ').toUpperCase();
            const time = post.published_at ? relativeTime(post.published_at) : null;
            return (
              <Pressable
                key={i}
                onPress={() =>
                  router.push(`/article?url=${encodeURIComponent(post.url)}` as never)
                }
                style={{
                  backgroundColor: CARD_BG,
                  borderRadius: 18,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}>
                {image ? (
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: image }}
                      style={{ width: '100%', aspectRatio: 16 / 9 }}
                      contentFit="cover"
                    />
                    <View
                      style={{
                        position: 'absolute',
                        left: 10,
                        bottom: 10,
                        backgroundColor: '#E10600',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 5,
                      }}>
                      <Text
                        style={{
                          color: '#FAFAFA',
                          fontSize: 9,
                          fontWeight: '800',
                          letterSpacing: 1.5,
                        }}>
                        {badge}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View style={{ padding: 14 }}>
                  <Text style={{ color: '#FAFAFA', fontWeight: '800', fontSize: 15, lineHeight: 19 }} numberOfLines={3}>
                    {post.title}
                  </Text>
                  {post.preview ? (
                    <Text className="text-muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 16 }} numberOfLines={2}>
                      {post.preview}
                    </Text>
                  ) : null}
                  {time ? (
                    <Text
                      style={{
                        color: '#6B6B7B',
                        fontSize: 10,
                        marginTop: 8,
                        letterSpacing: 1.2,
                        fontWeight: '700',
                      }}>
                      {time.toUpperCase()}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const word = h === 1 ? 'час' : h < 5 ? 'часа' : 'часов';
    return `${h} ${word} назад`;
  }
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} д назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
