import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { useArticle } from '@/lib/hooks';

/** Strip HTML tags from a paragraph and decode common entities. */
function clean(html: string): string {
  return html
    .replace(/<a [^>]*>(.*?)<\/a>/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

export default function ArticleScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const router = useRouter();
  const article = useArticle(url ?? null);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A12' }}>
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
            Статья
          </Text>
          <Pressable
            onPress={() => url && Linking.openURL(url)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="open-outline" size={20} color="#A0A0B0" />
          </Pressable>
        </View>

        {article.isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#E10600" />
          </View>
        )}

        {article.isError && (
          <View className="px-5 mt-4">
            <View className="bg-surface rounded-xl border border-line p-4">
              <Text className="text-red font-bold">Не удалось загрузить статью</Text>
              <Pressable
                onPress={() => url && Linking.openURL(url)}
                className="mt-3 bg-red rounded-xl py-3 items-center active:opacity-80">
                <Text className="text-text font-bold">Открыть в браузере</Text>
              </Pressable>
            </View>
          </View>
        )}

        {article.data && (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}>
            {article.data.image ? (
              <View className="mx-4 rounded-2xl overflow-hidden border border-line">
                <Image
                  source={{ uri: article.data.image }}
                  style={{ width: '100%', aspectRatio: 16 / 9 }}
                  contentFit="cover"
                />
              </View>
            ) : null}

            <View className="px-5 mt-4">
              {article.data.source ? (
                <Text className="text-muted text-[11px] uppercase tracking-widest font-bold mb-2">
                  {article.data.source}
                  {article.data.date ? ` · ${article.data.date}` : ''}
                </Text>
              ) : null}
              <Text className="text-text text-2xl font-extrabold leading-tight">
                {article.data.title}
              </Text>
            </View>

            <View className="px-5 mt-5">
              {article.data.paragraphs.map((p, i) => (
                <Text
                  key={i}
                  className="text-text text-base mb-4"
                  style={{ lineHeight: 24 }}>
                  {clean(p)}
                </Text>
              ))}
            </View>

            {article.data.quotes?.length ? (
              <View className="mx-4 mt-2 bg-surface rounded-2xl border-l-4 border-red border-line p-4">
                {article.data.quotes.map((q, i) => (
                  <Text
                    key={i}
                    className="text-text text-base italic mb-2"
                    style={{ lineHeight: 24 }}>
                    «{clean(q)}»
                  </Text>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={() => Linking.openURL(article.data!.source_url)}
              className="mx-4 mt-6 bg-surface rounded-xl border border-line p-4 flex-row items-center active:opacity-80">
              <Ionicons name="open-outline" size={20} color="#A0A0B0" />
              <Text className="text-text font-semibold ml-3 flex-1">Читать оригинал</Text>
              <Ionicons name="chevron-forward" size={18} color="#6B6B7B" />
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
