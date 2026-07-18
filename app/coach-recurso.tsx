import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import YoutubeIframe from 'react-native-youtube-iframe';
import Markdown from 'react-native-markdown-display';
import { ViveFonts, ViveColors } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { ReminderBell } from '@/components/ReminderBell';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { logResourceEvent } from '@/lib/resourceEvents';

// ─── Constantes de formato ────────────────────────────────────────────────────
const FORMAT_COLOR: Record<string, string> = {
  audio:   '#C1694F',
  podcast: '#3B7FC4',
  video:   '#7B5EA7',
  lectura: '#4A7C59',
};
const FORMAT_LABEL: Record<string, string> = {
  audio: 'Audio', podcast: 'Podcast', video: 'Video', lectura: 'Lectura',
};
const FORMAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio:   'volume-medium-outline',
  podcast: 'mic-outline',
  video:   'videocam-outline',
  lectura: 'book-outline',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function podcastSource(url: string): string {
  if (url.includes('spotify')) return 'Spotify';
  if (url.includes('apple')) return 'Apple Podcasts';
  if (url.includes('youtube')) return 'YouTube';
  return 'la fuente';
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Resource = {
  id: string;
  title: string;
  description: string | null;
  format: string;
  source: string;
  url: string | null;
  storage_path: string | null;
  body_md: string | null;
  topic_id: string;
  duration_seconds: number | null;
  coaches: {
    profile_id: string;
    profiles: { name: string };
  };
};

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({
  audioUrl,
  color,
  userId,
  resourceId,
}: {
  audioUrl: string;
  color: string;
  userId: string | undefined;
  resourceId: string;
}) {
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);
  const loggedPlay = useRef(false);
  const loggedComplete = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const isPlaying = status.playing;
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    if (!userId) return;
    if (isPlaying && !loggedPlay.current) {
      loggedPlay.current = true;
      logResourceEvent(userId, resourceId, 'play');
    }
    if (duration > 0 && currentTime >= duration - 0.5 && !loggedComplete.current) {
      loggedComplete.current = true;
      logResourceEvent(userId, resourceId, 'complete');
    }
  }, [isPlaying, currentTime, duration, userId, resourceId]);

  function handleSeek(pct: number) {
    if (duration > 0) player.seekTo(pct * duration);
  }

  return (
    <View style={[ap.container, { borderColor: color + '33' }]}>
      {/* Barra de progreso interactiva */}
      <TouchableOpacity
        style={ap.trackWrap}
        onPress={(e) => {
          const locationX = (e.nativeEvent as any).locationX ?? 0;
          const width = (e.nativeEvent as any).layoutMeasurement?.width ?? 280;
          handleSeek(locationX / width);
        }}
        activeOpacity={1}>
        <View style={ap.track}>
          <View style={[ap.fill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: color }]} />
        </View>
      </TouchableOpacity>

      {/* Tiempo */}
      <View style={ap.timeRow}>
        <Text style={ap.timeText}>{fmtDuration(currentTime)}</Text>
        <Text style={ap.timeText}>{duration > 0 ? fmtDuration(duration) : '--:--'}</Text>
      </View>

      {/* Controles */}
      <View style={ap.controls}>
        <TouchableOpacity
          style={ap.skipBtn}
          onPress={() => player.seekTo(Math.max(0, currentTime - 15))}
          hitSlop={8}>
          <Ionicons name="play-back" size={20} color="#3A4F2A" />
          <Text style={ap.skipLabel}>15s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[ap.playBtn, { backgroundColor: color }]}
          onPress={() => isPlaying ? player.pause() : player.play()}
          activeOpacity={0.85}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color="#fff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={ap.skipBtn}
          onPress={() => player.seekTo(Math.min(duration, currentTime + 15))}
          hitSlop={8}>
          <Ionicons name="play-forward" size={20} color="#3A4F2A" />
          <Text style={ap.skipLabel}>15s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ap = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,248,240,0.55)',
    padding: 20,
    gap: 14,
    marginBottom: 20,
  },
  trackWrap: { paddingVertical: 8 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(58,79,42,0.12)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#6B7A56',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: { alignItems: 'center', gap: 2 },
  skipLabel: {
    fontFamily: ViveFonts.regular,
    fontSize: 9,
    color: '#6B7A56',
  },
});

// ─── VideoPlayer ──────────────────────────────────────────────────────────────
function VideoPlayer({
  url,
  userId,
  resourceId,
}: {
  url: string;
  userId: string | undefined;
  resourceId: string;
}) {
  const { width } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);
  const videoId = extractYouTubeId(url);
  const loggedPlay = useRef(false);

  if (!videoId) {
    return (
      <TouchableOpacity
        style={vp.fallback}
        onPress={() => {
          if (userId) logResourceEvent(userId, resourceId, 'play');
          Linking.openURL(url);
        }}
        activeOpacity={0.85}>
        <Ionicons name="videocam-outline" size={24} color="#7B5EA7" />
        <Text style={vp.fallbackText}>Ver en YouTube</Text>
        <Ionicons name="open-outline" size={16} color="#7B5EA7" />
      </TouchableOpacity>
    );
  }

  const playerWidth = width - 44;
  const playerHeight = Math.round(playerWidth * 9 / 16);

  return (
    <View style={[vp.container, { height: playerHeight }]}>
      <YoutubeIframe
        height={playerHeight}
        width={playerWidth}
        videoId={videoId}
        play={playing}
        onChangeState={(state: string) => {
          if (state === 'playing' && !loggedPlay.current && userId) {
            loggedPlay.current = true;
            logResourceEvent(userId, resourceId, 'play');
          }
          if (state === 'ended') {
            setPlaying(false);
            if (userId) logResourceEvent(userId, resourceId, 'complete');
          }
        }}
      />
    </View>
  );
}

const vp = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  fallback: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(123,94,167,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(123,94,167,0.25)',
    paddingVertical: 18,
    marginBottom: 20,
  },
  fallbackText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#7B5EA7',
  },
});

// ─── PodcastCTA ───────────────────────────────────────────────────────────────
function PodcastCTA({
  url,
  userId,
  resourceId,
}: {
  url: string;
  userId: string | undefined;
  resourceId: string;
}) {
  const source = podcastSource(url);
  return (
    <TouchableOpacity
      style={pc.btn}
      onPress={() => {
        if (userId) logResourceEvent(userId, resourceId, 'play');
        Linking.openURL(url);
      }}
      activeOpacity={0.85}>
      <Ionicons name="mic-outline" size={20} color="#fff" />
      <Text style={pc.text}>Abrir en {source}</Text>
      <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3B7FC4',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  text: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#fff',
  },
});

// ─── MarkdownStyles ───────────────────────────────────────────────────────────
const mdStyles = StyleSheet.create({
  body: { color: '#3A4F2A' },
  heading1: { fontFamily: ViveFonts.semibold, fontSize: 20, color: '#3A4F2A', marginBottom: 8, marginTop: 16 },
  heading2: { fontFamily: ViveFonts.semibold, fontSize: 17, color: '#3A4F2A', marginBottom: 6, marginTop: 14 },
  heading3: { fontFamily: ViveFonts.medium, fontSize: 15, color: '#3A4F2A', marginBottom: 4, marginTop: 10 },
  paragraph: { fontFamily: ViveFonts.regular, fontSize: 14.5, color: '#3A4F2A', lineHeight: 23, marginBottom: 12 },
  strong: { fontFamily: ViveFonts.semibold },
  em: { fontStyle: 'italic' },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { fontFamily: ViveFonts.regular, fontSize: 14, color: '#3A4F2A', lineHeight: 22 },
  blockquote: {
    backgroundColor: 'rgba(58,79,42,0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#4A7C59',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  hr: { backgroundColor: 'rgba(58,79,42,0.12)', height: 1, marginVertical: 16 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CoachRecursoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('coach_resources')
      .select('id, title, description, format, source, url, storage_path, body_md, topic_id, duration_seconds, coaches!inner(profile_id, profiles!inner(name))')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        setResource(data as any);
        if (user) logResourceEvent(user.id, data.id, 'view');

        if (data.format === 'audio' && data.storage_path) {
          const { data: signed } = await supabase.storage
            .from('resource-audio')
            .createSignedUrl(data.storage_path, 3600);
          if (signed?.signedUrl) setAudioUrl(signed.signedUrl);
        }

        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('resource_saves')
      .select('resource_id')
      .eq('user_id', user.id)
      .eq('resource_id', id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, id]);

  async function toggleSave() {
    if (!user || !resource || savingBookmark) return;
    setSavingBookmark(true);
    if (saved) {
      await supabase.from('resource_saves').delete().eq('user_id', user.id).eq('resource_id', resource.id);
      setSaved(false);
    } else {
      await supabase.from('resource_saves')
        .upsert({ user_id: user.id, resource_id: resource.id }, { onConflict: 'user_id,resource_id', ignoreDuplicates: true });
      setSaved(true);
    }
    setSavingBookmark(false);
  }

  if (loading) {
    return (
      <AppBg>
        <SafeAreaView style={s.center}>
          <ActivityIndicator color={ViveColors.accent} />
        </SafeAreaView>
      </AppBg>
    );
  }

  if (!resource) {
    return (
      <AppBg>
        <SafeAreaView style={s.center}>
          <Text style={s.errorText}>Recurso no encontrado</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backLink}>Volver</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </AppBg>
    );
  }

  const color = FORMAT_COLOR[resource.format] ?? ViveColors.primary;
  const coachName = (resource.coaches as any)?.profiles?.name ?? '';
  const coachProfileId = resource.coaches?.profile_id ?? null;
  const resourceId = resource.id;

  function goToCoachProfile() {
    if (!coachProfileId) return;
    if (user) logResourceEvent(user.id, resourceId, 'coach_profile_visit');
    router.push({ pathname: '/profesional', params: { profileId: coachProfileId } } as any);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={ViveColors.accent} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <ReminderBell kind="coach_resource" ref={resource.id} title={resource.title} />
            <TouchableOpacity style={s.saveBtn} onPress={toggleSave} hitSlop={8}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={saved ? ViveColors.primary : ViveColors.accent}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}>

          {/* Cover — solo para audio y lectura; video muestra el player directo */}
          {resource.format !== 'video' && (
            <View style={[s.cover, { backgroundColor: color + '15' }]}>
              <View style={[s.coverIcon, { backgroundColor: color + '25' }]}>
                <Ionicons name={FORMAT_ICON[resource.format] ?? 'book-outline'} size={40} color={color} />
              </View>
              <View style={[s.formatBadge, { backgroundColor: color }]}>
                <Text style={s.formatBadgeText}>{FORMAT_LABEL[resource.format] ?? resource.format}</Text>
              </View>
            </View>
          )}

          {/* Video player — arriba de todo */}
          {resource.format === 'video' && resource.url && (
            <VideoPlayer url={resource.url} userId={user?.id} resourceId={resource.id} />
          )}

          {/* Info */}
          <Text style={s.title}>{resource.title}</Text>
          {coachName ? (
            <TouchableOpacity onPress={goToCoachProfile} disabled={!coachProfileId} hitSlop={4}>
              <Text style={[s.coach, coachProfileId && s.coachLink]}>Por {coachName}</Text>
            </TouchableOpacity>
          ) : null}
          {resource.duration_seconds ? (
            <Text style={s.duration}>{fmtDuration(resource.duration_seconds)}</Text>
          ) : null}
          {resource.description ? (
            <Text style={s.description}>{resource.description}</Text>
          ) : null}

          {/* Reproductor según formato */}
          {resource.format === 'audio' && audioUrl && (
            <AudioPlayer audioUrl={audioUrl} color={color} userId={user?.id} resourceId={resource.id} />
          )}
          {resource.format === 'audio' && !audioUrl && !loading && (
            <View style={s.audioUnavailable}>
              <Ionicons name="cloud-offline-outline" size={20} color="#6B7A56" />
              <Text style={s.audioUnavailableText}>Audio no disponible aún</Text>
            </View>
          )}

          {resource.format === 'podcast' && resource.url && (
            <PodcastCTA url={resource.url} userId={user?.id} resourceId={resource.id} />
          )}

          {resource.format === 'lectura' && resource.body_md && (
            <View style={s.lecturaCard}>
              <Markdown style={mdStyles as any}>{resource.body_md}</Markdown>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 22, paddingBottom: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  saveBtn: { padding: 4 },

  cover: {
    height: 150,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  coverIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  formatBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 11,
    color: '#fff',
  },

  title: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 24,
    color: '#3A4F2A',
    lineHeight: 32,
    marginBottom: 6,
  },
  coach: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#6B7A56',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  coachLink: {
    textDecorationLine: 'underline',
  },
  duration: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#6B7A56',
    marginBottom: 14,
  },
  description: {
    fontFamily: ViveFonts.regular,
    fontSize: 14.5,
    color: '#3A4F2A',
    lineHeight: 22,
    marginBottom: 22,
  },

  lecturaCard: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 18,
    marginBottom: 20,
  },

  audioUnavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
    marginBottom: 20,
  },
  audioUnavailableText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#6B7A56',
  },

  errorText: {
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: '#6B7A56',
    marginBottom: 12,
  },
  backLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: ViveColors.primary,
  },
});
