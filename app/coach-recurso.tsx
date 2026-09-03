import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  type LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
// La barra de progreso corre 100% en el hilo de UI: animación con Reanimated
// (shared values + withTiming) y arrastre con gesture-handler. Así los re-renders
// de status (cada 250ms) y la carga del hilo de JS en dev no la tironean.
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, runOnJS, Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  const [seekTick, setSeekTick] = useState(0); // bump → el motor re-sincroniza

  // Shared values (hilo de UI): posición de la barra 0..1, ancho del track y
  // duración/último-segundo para calcular el texto dentro del worklet de gesto.
  const pos = useSharedValue(0);
  const trackWsv = useSharedValue(0);
  const durationSv = useSharedValue(0);
  const lastSecSv = useSharedValue(-1); // throttle del texto: solo al cambiar de segundo
  const lastPSv = useSharedValue(0);    // última posición del gesto (para el seek final)
  // Espejos leídos desde callbacks JS del gesto sin closure vieja.
  const durationRef = useRef(0);
  // Punto de partida tras un seek (scrub) para que el motor arranque de ahí sin
  // esperar a que el status lo refleje; y último currentTime para el detector de
  // saltos.
  const seekBaseRef = useRef<number | null>(null);
  const prevTimeRef = useRef(0);

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

  // Motor de la barra: lanza UNA animación (en el hilo de UI vía Reanimated) hacia
  // el final y se reinicia SOLO en eventos discretos (play/pausa/velocidad/seek),
  // NO en cada tick. `seekBaseRef` (del scrub) o `progress` fijan el arranque.
  useEffect(() => {
    cancelAnimation(pos);
    if (scrubbing) return; // el dedo maneja la barra (gesto)

    const base = seekBaseRef.current ?? progress;
    seekBaseRef.current = null;
    pos.value = base;

    const remainFromBase = duration * (1 - base);
    if (isPlaying && duration > 0 && remainFromBase > 0) {
      pos.value = withTiming(1, {
        duration: (remainFromBase / rate) * 1000,
        easing: Easing.linear,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, rate, scrubbing, seekTick]);

  // Mantener los shared values de duración en sync (para el worklet del gesto).
  useEffect(() => { durationSv.value = duration; }, [duration, durationSv]);

  // Detector de saltos: los ±15s (y cualquier seek externo) mueven `currentTime`
  // de golpe. Un tick normal avanza ~rate*intervalo; si el salto es mayor,
  // gatillamos un resync (bump de `seekTick`) sin reiniciar en cada tick normal.
  useEffect(() => {
    const prev = prevTimeRef.current;
    prevTimeRef.current = currentTime;
    if (scrubbing) return;
    const expected = isPlaying ? rate * 0.4 : 0.1;
    if (Math.abs(currentTime - prev) > expected + 1) {
      setSeekTick(t => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

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
    const w = e.nativeEvent.layout.width;
    setTrackW(w);
    trackWsv.value = w;
  }

  durationRef.current = duration;

  function togglePlay() {
    if (isPlaying) { player.pause(); return; }
    setPendingPlay(true);
    player.play();
  }

  // ── Callbacks JS del gesto (corren fuera del worklet, vía runOnJS). Estables
  //    (useCallback) para poder memoizar el gesto y no recrearlo en cada tick. ──
  const doSeek = useCallback((p: number) => {
    if (durationRef.current > 0) {
      player.seekTo(p * durationRef.current);
      seekBaseRef.current = p; // el motor arranca de acá → sin parpadeo
      setSeekTick(t => t + 1);
    }
    setScrubProgress(p);
  }, [player]);
  const onScrubStart = useCallback((p: number) => {
    setScrubbing(true);
    setScrubProgress(p);
  }, []);
  const onScrubText = useCallback((p: number) => setScrubProgress(p), []);
  const onScrubEnd = useCallback((p: number) => {
    doSeek(p);
    setScrubbing(false);
  }, [doSeek]);
  const resetScrub = useCallback(() => setScrubbing(false), []);

  // Dos gestos separados (patrón de slider): TAP para tocar-y-saltar (siempre se
  // reconoce, nunca toca el estado `scrubbing`, así que no se puede colgar) y PAN
  // para arrastrar. `Exclusive(pan, tap)` da prioridad al pan: si arrastrás gana
  // el pan; si solo tocás (sin mover), gana el tap. `e.x` ya es relativo al
  // GestureDetector (= track). `pos.value` mueve la barra a 60fps en el hilo de UI.
  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(4) // un toque quieto NO activa el pan → lo agarra el tap
    .onStart((e) => {
      'worklet';
      cancelAnimation(pos);
      const p = Math.max(0, Math.min(1, e.x / (trackWsv.value || 1)));
      pos.value = p;
      lastPSv.value = p;
      lastSecSv.value = Math.floor(p * durationSv.value);
      runOnJS(onScrubStart)(p);
    })
    .onUpdate((e) => {
      'worklet';
      const p = Math.max(0, Math.min(1, e.x / (trackWsv.value || 1)));
      pos.value = p;
      lastPSv.value = p;
      const sec = Math.floor(p * durationSv.value);
      if (sec !== lastSecSv.value) {
        lastSecSv.value = sec;
        runOnJS(onScrubText)(p);
      }
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onScrubEnd)(lastPSv.value);
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(resetScrub)(); // seguro por si el pan se cancela sin onEnd
    }),
    [pos, trackWsv, durationSv, lastSecSv, lastPSv, onScrubStart, onScrubText, onScrubEnd, resetScrub],
  );

  const tapGesture = useMemo(() => Gesture.Tap()
    .maxDistance(20)
    .onEnd((e) => {
      'worklet';
      const p = Math.max(0, Math.min(1, e.x / (trackWsv.value || 1)));
      pos.value = p; // salta la barra al toque en el acto (hilo de UI)
      runOnJS(doSeek)(p);
    }),
    [pos, trackWsv, doSeek],
  );

  const barGesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  // Estilos animados (hilo de UI). Fill: ancho completo recortado por el track
  // (overflow hidden), translateX de -trackW (vacío) a 0 (lleno). Perilla: 0..trackW.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -trackWsv.value * (1 - pos.value) }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: trackWsv.value * pos.value }],
  }));

  // Tiempos mostrados: durante el arrastre, siguen al dedo (por segundo).
  const shownTime = scrubbing ? scrubProgress * duration : currentTime;
  const shownRemaining = Math.max(0, duration - shownTime);
  const showSpinner = pendingPlay && !isPlaying;

  const [gradFrom, gradTo] = resourceFormatGradient(format);

  return (
    <View style={ap.wrap}>
      {/* Barra de progreso: tap para saltar, o arrastrar la perilla */}
      <GestureDetector gesture={barGesture}>
        <View style={ap.trackWrap}>
          <View style={ap.track} onLayout={onTrackLayout}>
            <Animated.View
              style={[ap.fill, { width: trackW, backgroundColor: color }, fillStyle]}
            />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[ap.knob, scrubbing && ap.knobActive, { backgroundColor: color }, knobStyle]}
          />
        </View>
      </GestureDetector>

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
  // Banda de toque alta (40px) para agarrar la barra cómodo; el track visual
  // sigue siendo fino (5px) y centrado.
  trackWrap: { height: 40, justifyContent: 'center' },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(58,79,42,0.14)',
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3 },
  knob: {
    position: 'absolute',
    top: 13,
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
  knobActive: { width: 18, height: 18, borderRadius: 9, top: 11, marginLeft: -9 },
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
