/**
 * Unified video player — mirrors how the TG webapp plays Rutube/HLS:
 * WebView with an HTML page that uses hls.js + native <video> element.
 *
 * - Rutube  → fetch /api/rutube-stream/{id} → HLS m3u8 → hls.js <video>.
 *             Real <video> controls (play/pause/seek/fullscreen/PiP via
 *             the OS video player chrome), no iframe to Rutube.
 * - YouTube → react-native-youtube-iframe (typed wrapper, works in Expo Go).
 * - VK / other → WebView iframe (no public direct stream).
 *
 * hls.js is hosted on our backend at /static/vendor/hls.min.js — same one
 * the TG webapp loads.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';

import { API_BASE } from '@/lib/api';
import { useRutubeStream } from '@/lib/hooks';

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
    return <Poster resolved={resolved} title={title} onPress={() => setPlaying(true)} />;
  }

  if (resolved.provider === 'rutube' && resolved.rutubeId) {
    return <RutubePlayer videoId={resolved.rutubeId} iframeSrc={resolved.iframeSrc!} />;
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

// ============ RUTUBE → HLS via hls.js + <video> ============

function RutubePlayer({ videoId, iframeSrc }: { videoId: string; iframeSrc: string }) {
  const stream = useRutubeStream(videoId);

  if (stream.isLoading) {
    return (
      <View
        style={{
          aspectRatio: 16 / 9,
          backgroundColor: '#000',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color="#E10600" />
        <Text className="text-muted text-xs mt-2">Загружаем плеер…</Text>
      </View>
    );
  }

  if (stream.data?.hls_url) {
    const fullHls = stream.data.hls_url.startsWith('/')
      ? `${API_BASE}${stream.data.hls_url}`
      : stream.data.hls_url;
    return <HlsPlayer hlsUrl={fullHls} />;
  }

  // Backend failed → fall back to Rutube iframe
  return <IframePlayer src={iframeSrc} />;
}

// ============ HLS PLAYER (WebView + hls.js + <video>) ============

function HlsPlayer({ hlsUrl }: { hlsUrl: string }) {
  const safeUrl = hlsUrl.replace(/"/g, '&quot;').replace(/'/g, '%27');
  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<script src="${API_BASE}/static/vendor/hls.min.js"></script>
<style>
  html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
  video{position:fixed;inset:0;width:100%;height:100%;background:#000;object-fit:contain}
</style>
</head>
<body>
<video id="v" controls autoplay playsinline webkit-playsinline></video>
<script>
  (function(){
    var url = "${safeUrl}";
    var v = document.getElementById('v');
    if (window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(v);
      hls.on(window.Hls.Events.ERROR, function(_, d){
        if (d.fatal) console.log('hls fatal', d.type);
      });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url;
    } else {
      document.body.innerHTML = '<div style="color:#fff;padding:20px;text-align:center;">HLS не поддерживается</div>';
    }
  })();
</script>
</body></html>`;

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
        originWhitelist={['*']}
      />
    </View>
  );
}

// ============ IFRAME (VK / fallback) ============

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
