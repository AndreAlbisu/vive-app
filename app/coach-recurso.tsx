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
  Image,
  Share,
  Animated,
  Easing,
  PanResponder,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import YoutubeIframe from 'react-native-youtube-iframe';
import Markdown from 'react-native-markdown-display';
import {
  ViveFonts, ViveColors, ResourceFormatColors, ResourceFormatLabels, resourceFormatGradient,
} from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { FormatSurface } from '@/components/FormatSurface';
import { supabase, registrarEvento } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { logResourceEvent } from '@/lib/resourceEvents';

// ─── Constantes de formato ────────────────────────────────────────────────────
const FOREST = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM = ViveColors.background; // borde de la perilla del reproductor

function displayTitle(title: string): string {
  return title.replace(/^\[SEED\]\s*/, '');
}

const FORMAT_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio:   'mic-outline',
  podcast: 'musical-notes-outline',
  video:   'videocam-outline',
  lectura: 'book-outline',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
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
  coach_id: string;
  coaches: {
    id: string;
    profile_id: string;
    specialty: string | null;
    profiles: { name: string; avatar_url: string | null };
  };
};

type Related = {
  id: string;
  title: string;
  format: string;
  duration_seconds: number | null;
  author: string;
};

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
const SPEEDS = [1, 1.25, 1.5, 2] as const;

function AudioPlayer({
  audioUrl,
  format,
  color,
  userId,
  resourceId,
}: {
  audioUrl: string;
  format: string;
  color: string;
  userId: string | undefined;
  resourceId: string;
}) {
  // Streaming (no `downloadFirst`): con el storage en sa-east-1 y el usuario
  // lejos, bajar el archivo entero antes de arrancar dejaba el play colgado
  // cargando para siempre. Streaming arranca en 1-2s (el spinner cubre esa
  // espera). `updateInterval` corto → estado y barra reaccionan antes.
  const player = useAudioPlayer(audioUrl, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const loggedPlay = useRef(false);
  const loggedComplete = useRef(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubProgress, setScrubProgress] = useState(0);

  // Progreso animado: la barra la mueve el native driver de forma continua, en
  // vez de saltar con cada update de status (que llega ~cada 500ms y se veía
  // lagueado). Se re-sincroniza al valor real en cada tick.
  const anim = useRef(new Animated.Value(0)).current;
  const runningAnim = useRef<Animated.CompositeAnimation | null>(null);
  // Espejos del último valor para leer dentro del PanResponder (creado una sola
  // vez) sin quedar con la closure vieja.
  const trackWRef = useRef(0);
  const durationRef = useRef(0);
  const scrubbingRef = useRef(false);
  // Tras soltar un seek, el status sigue reportando la posición vieja por ~un
  // tick. `pendingSeek` mantiene la barra en el destino hasta que el status
  // converja ahí (o venza el timeout de seguridad) — así no parpadea.
  const pendingSeekRef = useRef<number | null>(null);
  const pendingSeekAtRef = useRef(0);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const isPlaying = status.playing;
  const isLoaded = status.isLoaded;
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const rate = SPEEDS[speedIdx];

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

  // Aplica la velocidad elegida. Se usa el método (no asignar `playbackRate`
  // directo, que tira error en nativo) y se corrige el pitch para que no suene
  // "ardilla". Guardado por isLoaded + try/catch para no romper la pantalla.
  function applyRate(r: number) {
    try {
      if (status.isLoaded) player.setPlaybackRate(r, 'high');
    } catch {
      // el audio todavía no está listo; se re-aplica al cargar (efecto de abajo)
    }
  }

  // Reaplica la velocidad cuando el audio termina de cargar (algunas plataformas
  // resetean el rate al preparar la fuente).
  useEffect(() => {
    if (isLoaded) applyRate(rate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Motor de la barra suave: en cada cambio de estado real, frena la animación,
  // fija el valor verdadero, y —si está sonando— la lanza hacia el final en
  // tiempo real (segundos restantes / velocidad). useNativeDriver → 60fps sin
  // pasar por el hilo de JS.
  useEffect(() => {
    runningAnim.current?.stop();
    // Mientras el dedo arrastra, la barra la maneja el PanResponder — no pisar.
    if (scrubbing) return;

    // Punto base = posición real, salvo que haya un seek pendiente cuyo destino
    // el status todavía no refleja: en ese caso se sostiene el destino hasta que
    // converja (o venza el timeout), evitando el parpadeo al soltar.
    let base = progress;
    const target = pendingSeekRef.current;
    if (target !== null && duration > 0) {
      const converged = Math.abs(currentTime - target * duration) <= 0.6;
      const expired = Date.now() - pendingSeekAtRef.current > 1500;
      if (converged || expired) pendingSeekRef.current = null;
      else base = target;
    }

    anim.setValue(base);
    const remainFromBase = duration * (1 - base);
    if (isPlaying && duration > 0 && remainFromBase > 0) {
      const a = Animated.timing(anim, {
        toValue: 1,
        duration: (remainFromBase / rate) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      runningAnim.current = a;
      a.start();
    }
    return () => { runningAnim.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, currentTime, rate, scrubbing]);

  // Feedback de arranque: al tocar play, mostrar spinner hasta que suene de
  // verdad (cubre el buffering inicial del streaming).
  useEffect(() => {
    if (isPlaying) setPendingPlay(false);
  }, [isPlaying]);

  // Red de seguridad: si el play no arranca (error de red, etc.), soltar el
  // spinner a los 8s para que el botón no quede trabado cargando.
  useEffect(() => {
    if (!pendingPlay) return;
    const t = setTimeout(() => setPendingPlay(false), 8000);
    return () => clearTimeout(t);
  }, [pendingPlay]);

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    applyRate(SPEEDS[next]);
    registrarEvento('velocidad_cambiada', { velocidad: SPEEDS[next] }).catch(() => {});
  }

  function onTrackLayout(e: LayoutChangeEvent) {
    setTrackW(e.nativeEvent.layout.width);
  }

  // Espejos leídos por el PanResponder (ver arriba).
  trackWRef.current = trackW;
  durationRef.current = duration;
  scrubbingRef.current = scrubbing;

  function togglePlay() {
    if (isPlaying) { player.pause(); return; }
    setPendingPlay(true);
    player.play();
  }

  // Arrastre de la barra: el mismo responder cubre tap (grant+release sin mover)
  // y drag. Durante el arrastre movemos la barra bajo el dedo y recién soltamos
  // el seek al release, para no bombardear seekTo en cada frame.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const p = clamp01((e.nativeEvent.locationX ?? 0) / (trackWRef.current || 1));
        setScrubbing(true);
        setScrubProgress(p);
        anim.stopAnimation();
        anim.setValue(p);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const p = clamp01((e.nativeEvent.locationX ?? 0) / (trackWRef.current || 1));
        setScrubProgress(p);
        anim.setValue(p);
      },
      onPanResponderRelease: (e: GestureResponderEvent) => {
        const p = clamp01((e.nativeEvent.locationX ?? 0) / (trackWRef.current || 1));
        if (durationRef.current > 0) {
          player.seekTo(p * durationRef.current);
          pendingSeekRef.current = p;
          pendingSeekAtRef.current = Date.now();
        }
        anim.setValue(p);
        setScrubProgress(p);
        setScrubbing(false);
      },
      onPanResponderTerminate: () => setScrubbing(false),
    })
  ).current;

  // translateX de un fill de ancho completo, recortado por el track (overflow
  // hidden): de -trackW (vacío) a 0 (lleno). La perilla va de 0 a trackW.
  const fillTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [-trackW, 0] });
  const knobTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [0, trackW] });

  // Tiempos mostrados: durante el arrastre, siguen al dedo.
  const shownTime = scrubbing ? scrubProgress * duration : currentTime;
  const shownRemaining = Math.max(0, duration - shownTime);
  const showSpinner = pendingPlay && !isPlaying;

  const [gradFrom, gradTo] = resourceFormatGradient(format);

  return (
    <View style={ap.wrap}>
      {/* Barra de progreso: tap para saltar, o arrastrar la perilla */}
      <View style={ap.trackWrap} {...pan.panHandlers}>
        <View style={ap.track} onLayout={onTrackLayout}>
          <Animated.View
            style={[ap.fill, { width: trackW, backgroundColor: color, transform: [{ translateX: fillTranslate }] }]}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            ap.knob,
            scrubbing && ap.knobActive,
            { backgroundColor: color, transform: [{ translateX: knobTranslate }] },
          ]}
        />
      </View>

      {/* Transcurrido a la izquierda, RESTANTE en negativo a la derecha */}
      <View style={ap.timeRow}>
        <Text style={ap.timeText}>{fmtClock(shownTime)}</Text>
        <Text style={ap.timeText}>−{fmtClock(shownRemaining)}</Text>
      </View>

      {/* Controles: −15s, play (con el gradiente del formato), +15s */}
      <View style={ap.controls}>
        <TouchableOpacity
          style={ap.skipBtn}
          onPress={() => player.seekTo(Math.max(0, currentTime - 15))}
          hitSlop={10}>
          <Ionicons name="play-back" size={22} color={FOREST} />
          <Text style={ap.skipLabel}>15</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={togglePlay}
          disabled={showSpinner}
          activeOpacity={0.85}>
          <LinearGradient
            colors={[gradFrom, gradTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[ap.playBtn, { shadowColor: color }]}>
            {showSpinner ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#fff" style={isPlaying ? undefined : { marginLeft: 3 }} />
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={ap.skipBtn}
          onPress={() => player.seekTo(Math.min(duration, currentTime + 15))}
          hitSlop={10}>
          <Ionicons name="play-forward" size={22} color={FOREST} />
          <Text style={ap.skipLabel}>15</Text>
        </TouchableOpacity>
      </View>

      {/* Velocidad — cicla 1× → 1.25× → 1.5× → 2× */}
      <TouchableOpacity style={ap.speedBtn} onPress={cycleSpeed} hitSlop={10} activeOpacity={0.7}>
        <Text style={ap.speedText}>{SPEEDS[speedIdx]}×</Text>
      </TouchableOpacity>
    </View>
  );
}

const ap = StyleSheet.create({
  // Sin caja: los controles van directo sobre el fondo crema.
  wrap: { gap: 12, marginTop: 8, marginBottom: 24 },
  trackWrap: { height: 24, justifyContent: 'center' },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(58,79,42,0.14)',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3 },
  knob: {
    position: 'absolute',
    top: 5,
    left: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    borderWidth: 2,
    borderColor: CREAM,
    shadowColor: '#3A4F2A',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // Al arrastrar, la perilla crece un poco (feedback). Se compensa top/marginLeft
  // para que siga centrada sobre el punto.
  knobActive: { width: 18, height: 18, borderRadius: 9, top: 3, marginLeft: -9 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST_SOFT,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
    marginTop: 4,
  },
  playBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  skipBtn: { alignItems: 'center', gap: 1 },
  skipLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    color: FOREST_SOFT,
  },
  speedBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12, marginTop: 2 },
  speedText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: FOREST_SOFT,
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
    marginTop: 4,
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarFallbackText, { fontSize: size * 0.4 }]}>{(name[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CoachRecursoScreen() {
  const router = useRouter();
  const { id, note, fromCoachName } = useLocalSearchParams<{ id: string; note?: string; fromCoachName?: string }>();
  const noteText = Array.isArray(note) ? note[0] : note;
  const fromCoachNameText = Array.isArray(fromCoachName) ? fromCoachName[0] : fromCoachName;
  const { user } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [authorCount, setAuthorCount] = useState<number | null>(null);
  const [related, setRelated] = useState<Related[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from('coach_resources')
      .select('id, title, description, format, source, url, storage_path, body_md, topic_id, duration_seconds, coach_id, coaches!inner(id, profile_id, specialty, profiles!inner(name, avatar_url))')
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

  // ── "Quién lo hizo" (conteo del autor) + "Después de esto" (relacionados) ────
  // Relacionados: mismo tema primero, se completa con otros del mismo autor. No
  // hay señal de "los que más se completan después" (no guardamos secuencia), así
  // que ese criterio queda afuera en vez de inventarlo. Si no sale nada, el
  // bloque no se renderiza.
  useEffect(() => {
    if (!resource) return;
    let cancelled = false;
    const coachId = resource.coach_id;
    const topicId = resource.topic_id;
    (async () => {
      const [countRes, relRes] = await Promise.all([
        supabase.from('coach_resources')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coachId).eq('status', 'published'),
        supabase.from('coach_resources')
          .select('id, title, format, duration_seconds, topic_id, coach_id, coaches!inner(profiles!inner(name))')
          .eq('status', 'published')
          .neq('id', resource.id)
          .or(`topic_id.eq.${topicId},coach_id.eq.${coachId}`)
          .limit(12),
      ]);
      if (cancelled) return;
      setAuthorCount(countRes.count ?? null);

      const rows = (relRes.data ?? []) as any[];
      // Mismo tema primero, después el resto (mismo autor).
      rows.sort((a, b) => {
        const at = a.topic_id === topicId ? 0 : 1;
        const bt = b.topic_id === topicId ? 0 : 1;
        return at - bt;
      });
      setRelated(rows.slice(0, 3).map(r => ({
        id: r.id, title: r.title, format: r.format,
        duration_seconds: r.duration_seconds,
        author: r.coaches?.profiles?.name ?? 'un profesional',
      })));
    })();
    return () => { cancelled = true; };
  }, [resource]);

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

  const onShare = useCallback(() => {
    if (!resource) return;
    Share.share({ message: `${displayTitle(resource.title)} — en Vita` }).catch(() => {});
  }, [resource]);

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

  const format = resource.format;
  const color = ResourceFormatColors[format] ?? ViveColors.primary;
  const label = ResourceFormatLabels[format] ?? format;
  const coachName = resource.coaches?.profiles?.name ?? '';
  const coachAvatar = resource.coaches?.profiles?.avatar_url ?? null;
  const coachSpecialty = resource.coaches?.specialty ?? null;
  const coachProfileId = resource.coaches?.profile_id ?? null;
  const resourceId = resource.id;

  function goToCoachProfile() {
    if (!coachProfileId) return;
    if (user) logResourceEvent(user.id, resourceId, 'coach_profile_visit');
    router.push({ pathname: '/profesional', params: { profileId: coachProfileId, resourceId } } as any);
  }

  function openRelated(r: Related) {
    registrarEvento('relacionado_abierto', { origen_id: resourceId, destino_id: r.id }).catch(() => {});
    router.push({ pathname: '/coach-recurso', params: { id: r.id } } as any);
  }

  const authorMeta = [coachSpecialty, authorCount != null ? `${authorCount} ${authorCount === 1 ? 'recurso' : 'recursos'}` : null]
    .filter(Boolean).join(' · ');

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header: atrás | guardar + compartir */}
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={ViveColors.accent} />
          </TouchableOpacity>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.headerBtn} onPress={toggleSave} hitSlop={8}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={saved ? ViveColors.primary : ViveColors.accent}
              />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerBtn} onPress={onShare} hitSlop={8}>
              <Ionicons name="share-outline" size={22} color={ViveColors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}>

          {/* Nota del coach — solo si se llegó por una recomendación */}
          {noteText && fromCoachNameText ? (
            <View style={s.recoNoteBanner}>
              <Text style={s.recoNoteBannerText}>
                <Text style={s.recoNoteBannerBold}>{fromCoachNameText}</Text> te dijo: “{noteText}”
              </Text>
            </View>
          ) : null}

          {format === 'video' ? (
            // Video: el player ES el hero. El título queda en el cuerpo.
            <>
              {resource.url && <VideoPlayer url={resource.url} userId={user?.id} resourceId={resource.id} />}
              <Text style={s.title}>{displayTitle(resource.title)}</Text>
              {coachName ? (
                <TouchableOpacity onPress={goToCoachProfile} disabled={!coachProfileId} hitSlop={4}>
                  <Text style={[s.coach, coachProfileId && s.coachLink]}>Por {coachName}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            // Audio / podcast / lectura: hero de color con el mismo tratamiento
            // que las cards del deck. El título vive acá, no en el cuerpo.
            <FormatSurface format={format} style={s.hero}>
              <View style={s.heroPill}>
                <Ionicons name={FORMAT_ICON[format] ?? 'book-outline'} size={13} color="#fff" />
                <Text style={s.heroPillText}>{label}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={s.heroTitle} numberOfLines={3}>{displayTitle(resource.title)}</Text>
              <View style={s.heroMetaRow}>
                <Avatar url={coachAvatar} name={coachName || '?'} size={24} />
                <Text style={s.heroAuthor} numberOfLines={1}>{coachName}</Text>
                {resource.duration_seconds ? (
                  <Text style={s.heroDuration}>{fmtClock(resource.duration_seconds)}</Text>
                ) : null}
              </View>
            </FormatSurface>
          )}

          {resource.description ? (
            <Text style={s.description}>{resource.description}</Text>
          ) : null}

          {/* Reproductor según formato */}
          {format === 'audio' && audioUrl && (
            <AudioPlayer audioUrl={audioUrl} format={format} color={color} userId={user?.id} resourceId={resource.id} />
          )}
          {format === 'audio' && !audioUrl && !loading && (
            <View style={s.audioUnavailable}>
              <Ionicons name="cloud-offline-outline" size={20} color={FOREST_SOFT} />
              <Text style={s.audioUnavailableText}>Audio no disponible aún</Text>
            </View>
          )}

          {format === 'podcast' && resource.url && (
            <PodcastCTA url={resource.url} userId={user?.id} resourceId={resource.id} />
          )}

          {format === 'lectura' && resource.body_md && (
            <View style={s.lecturaCard}>
              <Markdown style={mdStyles as any}>{resource.body_md}</Markdown>
            </View>
          )}

          {/* ── Quién lo hizo ─────────────────────────────────────────────── */}
          {coachName ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Quién lo hizo</Text>
              <TouchableOpacity
                style={s.authorCard}
                onPress={goToCoachProfile}
                disabled={!coachProfileId}
                activeOpacity={0.85}>
                <Avatar url={coachAvatar} name={coachName} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.authorName} numberOfLines={1}>{coachName}</Text>
                  {authorMeta ? <Text style={s.authorMeta} numberOfLines={1}>{authorMeta}</Text> : null}
                </View>
                {coachProfileId ? <Ionicons name="chevron-forward" size={18} color={FOREST_SOFT} /> : null}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Después de esto ───────────────────────────────────────────── */}
          {related.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Después de esto</Text>
              <View style={s.relCard}>
                {related.map((r, i) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.relRow, i < related.length - 1 && s.relDivider]}
                    onPress={() => openRelated(r)}
                    activeOpacity={0.7}>
                    <Text style={s.relNum}>{i + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.relTitle} numberOfLines={1}>{displayTitle(r.title)}</Text>
                      <Text style={s.relMeta} numberOfLines={1}>
                        {[r.duration_seconds ? fmtClock(r.duration_seconds) : null, r.author].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={FOREST_SOFT} />
                  </TouchableOpacity>
                ))}
              </View>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerBtn: { padding: 4 },

  recoNoteBanner: {
    backgroundColor: '#F3EEDF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  recoNoteBannerText: {
    fontFamily: ViveFonts.feedback,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: '#2E3624',
    lineHeight: 19,
  },
  recoNoteBannerBold: {
    fontStyle: 'normal',
    fontFamily: ViveFonts.semibold,
  },

  // Hero de color
  hero: {
    minHeight: 208,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5,
  },
  heroPillText: { fontFamily: ViveFonts.semibold, fontSize: 12, color: '#fff' },
  heroTitle: { fontFamily: ViveFonts.title, fontSize: 24, color: '#fff', lineHeight: 30 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  heroAuthor: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  heroDuration: { fontFamily: ViveFonts.semibold, fontSize: 13, color: 'rgba(255,255,255,0.95)' },

  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { fontFamily: ViveFonts.bold, color: '#fff' },

  // Cuerpo (solo video usa title/coach; el resto va en el hero)
  title: {
    fontFamily: ViveFonts.title,
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
  description: {
    fontFamily: ViveFonts.regular,
    fontSize: 14.5,
    color: '#3A4F2A',
    lineHeight: 22,
    marginBottom: 8,
  },

  lecturaCard: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 18,
    marginTop: 12,
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

  // Bloques de abajo — crema, líneas finas, sin color fuerte
  section: { marginTop: 18 },
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: FOREST_SOFT,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,248,240,0.5)', borderWidth: 1, borderColor: 'rgba(58,79,42,0.12)',
    borderRadius: 18, padding: 14,
  },
  authorName: { fontFamily: ViveFonts.semibold, fontSize: 15, color: FOREST },
  authorMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: FOREST_SOFT, marginTop: 2 },

  relCard: {
    backgroundColor: 'rgba(255,248,240,0.5)', borderWidth: 1, borderColor: 'rgba(58,79,42,0.12)',
    borderRadius: 18, paddingHorizontal: 14,
  },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  relDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(58,79,42,0.14)' },
  relNum: { fontFamily: ViveFonts.title, fontSize: 16, color: 'rgba(58,79,42,0.35)', width: 16, textAlign: 'center' },
  relTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  relMeta: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: 2 },

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
