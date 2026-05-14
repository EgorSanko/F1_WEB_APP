/**
 * Unified video player with poster → player UX (like TG webapp).
 * - YouTube: react-native-youtube-iframe (native control surface, programmatic
 *   play/pause/seek, no top-bar branding before tap)
 * - VK / Rutube: WebView iframe (no native SDKs for these — closest possible)
 * - Direct/HLS: future expo-video integration
 *
 * Initial state: dark poster + provider badge + big play circle. Tap loads
 * the real player.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';

type Provider = 'youtube' | 'vk' | 'rutube' | 'other';

type Resolved = {
  provider: Provider;
  ytId?: string;
  iframeSrc?: string;
  thumb?: string;
};

function resolveVideo(videoUrl: string, embedUrl?: string | null): Resolved {
  const direct = embedUrl || videoUrl || '';
  // YouTube
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
  // VK Video
  const vk = direct.match(/(?:vk\.com|vkvideo\.ru)\/(?:[^?]*[?&]z=)?video(-?\d+)_(\d+)/);
  if (vk || /vk\.com\/video_ext\.php/.test(direct)) {
    const src = direct.includes('video_ext.php')
      ? direct
      : `https://vk.com/video_ext.php?oid=${vk![1]}&id=${vk![2]}&hd=2&autoplay=1`;
    return { provider: 'vk', iframeSrc: src };
  }
  // Rutube
  const rt = direct.match(/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]+)/);
  if (rt) {
    return {
      provider: 'rutube',
      iframeSrc: `https://rutube.ru/play/embed/${rt[1]}?autoStart=true`,
    };
  }
  // Fallback: hand to WebView with whatever URL is there
  return { provider: 'other', iframeSrc: direct };
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

  if (!playing) {
    return (
      <Pressable
        onPress={() => setPlaying(true)}
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
        {/* Bottom gradient is a single dim layer (no LinearGradient dep needed) */}
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
        {/* Provider badge top-left */}
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
        {/* Big play button */}
        <View className="absolute inset-0 items-center justify-center">
          <View
            className="rounded-full items-center justify-center"
            style={{
              width: 76,
              height: 76,
              backgroundColor: 'rgba(225,6,0,0.9)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 12,
            }}>
            <Ionicons name="play" size={36} color="#fff" />
          </View>
        </View>
        {/* Title overlay at bottom */}
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

  // YouTube → native iframe wrapper
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

  // VK / Rutube / other → WebView iframe wrapper
  const src = resolved.iframeSrc ?? videoUrl;
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
        source={{ html, baseUrl: 'https://f1hub.lead-seek.ru' }}
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
