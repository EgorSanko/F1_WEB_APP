import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { useNews } from '@/lib/hooks';

export default function NewsScreen() {
  const router = useRouter();
  const news = useNews();

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
          <Text className="text-text text-lg font-bold flex-1 text-center mr-10">Новости</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={news.isFetching && !news.isLoading}
              onRefresh={() => news.refetch()}
              tintColor="#E10600"
              colors={['#E10600']}
            />
          }>
          {news.isLoading && <ActivityIndicator color="#E10600" />}
          {news.isError && (
            <View className="bg-surface rounded-xl p-4 border border-line">
              <Text className="text-red font-bold">Ошибка загрузки</Text>
              <Pressable onPress={() => news.refetch()} className="mt-2">
                <Text className="text-text font-semibold">Повторить</Text>
              </Pressable>
            </View>
          )}
          {news.data?.posts.map((post, i) => {
            const image = post.image || post.photo;
            return (
              <Pressable
                key={i}
                onPress={() =>
                  router.push(`/article?url=${encodeURIComponent(post.url)}` as never)
                }
                className="bg-surface rounded-xl overflow-hidden border border-line active:opacity-80">
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={{ width: '100%', aspectRatio: 16 / 9 }}
                    contentFit="cover"
                  />
                ) : null}
                <View className="p-3.5">
                  {post.source ? (
                    <Text className="text-muted text-[10px] uppercase tracking-widest">
                      {post.source}
                    </Text>
                  ) : null}
                  <Text className="text-text font-bold mt-1" numberOfLines={3}>
                    {post.title}
                  </Text>
                  {post.preview ? (
                    <Text className="text-muted text-sm mt-1.5" numberOfLines={2}>
                      {post.preview}
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
