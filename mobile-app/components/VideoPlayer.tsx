/**
 * Unified video player — uses standard provider players (no Plyr/hls.js).
 *
 * - YouTube → react-native-youtube-iframe (typed wrapper, works in Expo Go).
 * - Rutube  → WebView iframe to https://rutube.ru/play/embed/{id}
 *             (their stock player; loads fast, has its own quality picker).
 * - VK / other → WebView iframe.
 *
 * Poster (shown before tap):
 *   - YouTube → i.ytimg.com/{id}/hqdefault.jpg (sync)
 *   - Rutube  → fetched from https://rutube.ru/api/video/{id}/?format=json
 *               (cached via React Query).
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useQuery } from '@tanstack/react-query';

import { API_BASE } from '@/lib/api';

type Provider = 'youtube' | 'vk' | 'rutube' | 'other';

type Resolved = {
  provider: Provider;
  ytId?: string;
  rutubeId?: string;
  iframeSrc?: string;
  thumb?: string;
};

function resolveVideo(videoUrl: string, embedUrl?: string | null): Resolved {
  const direct = embedUrl || videoUrl || '';
  const yt = direct.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
  );
  if (yt) {
    return {
      provider: 'youtube',
      ytId: yt[1],
      thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const rt = direct.match(/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]+)/);
  if (rt) {
    return {
      provider: 'rutube',
      rutubeId: rt[1],
      iframeSrc: `https://rutube.ru/play/embed/${rt[1]}?autoStart=true`,
    };
  }
  const vk = direct.match(/(?:vk\.com|vkvideo\.ru)\/(?:[^?]*[?&]z=)?video(-?\d+)_(\d+)/);
  if (vk || /vk\.com\/video_ext\.php/.test(direct)) {
    const src = direct.includes('video_ext.php')
      ? direct
      : `https://vk.com/video_ext.php?oid=${vk![1]}&id=${vk![2]}&hd=2&autoplay=1`;
    return { provider: 'vk', iframeSrc: src };
  }
  return { provider: 'other', iframeSrc: direct };
}

/** Rutube exposes per-video metadata at /api/video/{id}/?format=json with a
 * `thumbnail_url`. We cache by id; one fetch per unique video. */
function useRutubeThumbnail(videoId: string | null) {
  return useQuery({
    queryKey: ['rutube-thumb', videoId],
    queryFn: async (): Promise<string | null> => {
      const r = await fetch(`https://rutube.ru/api/video/${videoId}/?format=json`);
      if (!r.ok) return null;
      const json = (await r.json()) as { thumbnail_url?: string };
      return json.thumbnail_url ?? null;
    },
    enabled: !!videoId,
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
}

const PROVIDER_NAME: Record<Provider, string> = {
  youtube: 'YouTube',
  vk: 'VK Video',
  rutube: 'Rutube',
  other: 'Видео',
};

const PROVIDER_COLOR: Record<Provider, string> = {
  youtube: '#FF0000',
  vk: '#0077FF',
  rutube: '#000000',
  other: '#E10600',
};

export function VideoPlayer({
  videoUrl,
  embedUrl,
  title,
}: {
  videoUrl: string;
  embedUrl?: string | null;
  title?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const resolved = resolveVideo(videoUrl, embedUrl);

  // For Rutube we don't get a thumb from the URL — fetch from Rutube's API.
  const rutubeThumb = useRutubeThumbnail(
    resolved.provider === 'rutube' ? resolved.rutubeId ?? null : null,
  );
  const enriched: Resolved = {
    ...resolved,
    thumb: resolved.thumb ?? rutubeThumb.data ?? undefined,
  };

  if (!playing) {
    return <Poster resolved={enriched} title={title} onPress={() => setPlaying(true)} />;
  }

  if (resolved.provider === 'youtube' && resolved.ytId) {
    return (
      <View style={{ aspectRatio: 16 / 9, backgroundColor: '#000' }}>
        <YoutubePlayer
          videoId={resolved.ytId}
          height={9999}
          play
          webViewProps={{
            allowsFullscreenVideo: true,
            allowsInlineMediaPlayback: true,
          }}
          initialPlayerParams={{ controls: true, modestbranding: true, rel: false }}
        />
      </View>
    );
  }

  // Rutube / VK / other → стандартный iframe-плеер провайдера
  return <IframePlayer src={resolved.iframeSrc ?? videoUrl} />;
}

// ============ POSTER ============

function Poster({
  resolved,
  title,
  onPress,
}: {
  resolved: Resolved;
  title?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-bg overflow-hidden relative"
      style={{ aspectRatio: 16 / 9 }}>
      {resolved.thumb ? (
        <Image
          source={{ uri: resolved.thumb }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: '#1c1c28' }}>
          <Ionicons name="film-outline" size={48} color="#444" />
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: '40%',
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          backgroundColor: PROVIDER_COLOR[resolved.provider],
        }}>
        <Text className="text-text text-[10px] font-extrabold tracking-widest">
          {PROVIDER_NAME[resolved.provider].toUpperCase()}
        </Text>
      </View>
      <View className="absolute inset-0 items-center justify-center">
        <View
          className="rounded-full items-center justify-center"
          style={{
            width: 76,
            height: 76,
            backgroundColor: 'rgba(225,6,0,0.92)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            elevation: 12,
          }}>
          <Ionicons name="play" size={36} color="#fff" />
        </View>
      </View>
      {title ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14 }}>
          <Text className="text-text font-extrabold" numberOfLines={2}>
            {title}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ============ BROADCAST THUMB (16:9, used in lists) ============

/** Small thumbnail box used in list cards. Same provider-badge + play overlay
 * styling as the big Poster but compact. Fetches Rutube thumbnail lazily. */
export function BroadcastThumb({
  videoUrl,
  embedUrl,
  width = 112,
}: {
  videoUrl: string;
  embedUrl?: string | null;
  width?: number;
}) {
  const resolved = resolveVideo(videoUrl, embedUrl);
  const rutubeThumb = useRutubeThumbnail(
    resolved.provider === 'rutube' ? resolved.rutubeId ?? null : null,
  );
  const thumb = resolved.thumb ?? rutubeThumb.data ?? null;
  const prov = PROVIDER_NAME[resolved.provider];
  const provColor = PROVIDER_COLOR[resolved.provider];
  const badge =
    resolved.provider === 'youtube'
      ? 'YT'
      : resolved.provider === 'rutube'
        ? 'RT'
        : resolved.provider === 'vk'
          ? 'VK'
          : prov.toUpperCase();

  return (
    <View
      style={{
        width,
        aspectRatio: 16 / 9,
        backgroundColor: '#1c1c28',
        position: 'relative',
      }}>
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="film" size={24} color="#6B6B7B" />
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: 4,
          top: 4,
          paddingHorizontal: 5,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: provColor,
        }}>
        <Text className="text-text text-[8px] font-extrabold tracking-widest">{badge}</Text>
      </View>
      <View
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      </View>
    </View>
  );
}

// ============ IFRAME (Rutube / VK / fallback) ============

function IframePlayer({ src }: { src: string }) {
  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
  .wrap{position:fixed;inset:0;display:flex}
  iframe{flex:1;border:0;background:#000}
</style></head>
<body><div class="wrap">
<iframe src="${src.replace(/"/g, '&quot;')}"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen referrerpolicy="origin"></iframe>
</div></body></html>`;

  return (
    <View style={{ aspectRatio: 16 / 9, backgroundColor: '#000' }}>
      <WebView
        source={{ html, baseUrl: API_BASE }}
        style={{ flex: 1, backgroundColor: '#000' }}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
      />
    </View>
  );
}
