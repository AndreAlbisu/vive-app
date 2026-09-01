import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { PASTEL_AZUL, PASTEL_SALVIA, PASTEL_TEAL, PASTEL_DURAZNO } from '@/constants/tools';
import { PinButton } from '@/components/PinButton';
import { ReminderBell } from '@/components/ReminderBell';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { SoundEqualizer } from '@/components/ui/SoundEqualizer';
import { usuarioActualId } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';
const GLASS_BG    = 'rgba(255,248,240,0.55)';

const SOUNDS = [
  { id: 'lluvia',   icon: 'weather-rainy' as const,   label: 'Lluvia suave',  bg: PASTEL_AZUL },
  { id: 'bosque',   icon: 'tree-outline' as const,    label: 'Bosque',        bg: PASTEL_SALVIA },
  { id: 'olas',     icon: 'waves' as const,            label: 'Olas del mar',  bg: PASTEL_TEAL },
  { id: 'blanco',   icon: 'sine-wave' as const,        label: 'Ruido marrón',  bg: PASTEL_DURAZNO },
];

// Grabaciones reales con licencia CC0 (freesound.org), recortadas a 90s
const SOUND_FILES: Record<string, any> = {
  lluvia: require('../assets/sounds/lluvia.m4a'),
  bosque: require('../assets/sounds/bosque.m4a'),
  olas:   require('../assets/sounds/olas.m4a'),
  blanco: require('../assets/sounds/blanco.m4a'),
};

const DURATIONS = [
  { label: '5 min',  seconds: 300 },
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RuidoScreen() {
  useRecursoAbierto('ruido');
  const router = useRouter();
  const [selectedSound, setSelectedSound] = useState(SOUNDS[0].id);
  const [duration, setDuration]           = useState(DURATIONS[0].seconds);
  const [phase, setPhase]                 = useState<'idle' | 'running' | 'done'>('idle');
  const [elapsed, setElapsed]             = useState(0);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef  = useRef<string | null>(null);

  // Pre-cargar los 4 audios al montar para evitar delay al iniciar
  const playerLluvia = useAudioPlayer(SOUND_FILES.lluvia);
  const playerBosque = useAudioPlayer(SOUND_FILES.bosque);
  const playerOlas   = useAudioPlayer(SOUND_FILES.olas);
  const playerBlanco = useAudioPlayer(SOUND_FILES.blanco);

  const players: Record<string, typeof playerLluvia> = {
    lluvia: playerLluvia,
    bosque: playerBosque,
    olas:   playerOlas,
    blanco: playerBlanco,
  };

  function getPlayer() { return players[selectedSound] ?? playerLluvia; }

  const allPlayers = [playerLluvia, playerBosque, playerOlas, playerBlanco];

  useEffect(() => {
    usuarioActualId().then(uid => { userIdRef.current = uid; }).catch(() => {});
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    // Arrancar todos en silencio para que no haya delay al presionar Iniciar.
    // El audio ya está corriendo — solo subimos el volumen cuando el usuario lo pide.
    allPlayers.forEach(p => {
      try { p.volume = 0; p.loop = true; p.play(); } catch {}
    });
  }, []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function stopFade() {
    if (fadeRef.current) clearInterval(fadeRef.current);
  }

  // Silencia todos sin hacer pause (para que sigan cargados y sin delay).
  function silenceAll() {
    stopFade();
    allPlayers.forEach(p => { try { p.volume = 0; } catch {} });
  }

  // Pause real — solo para navegación fuera de la pantalla.
  function pauseAll() {
    stopFade();
    allPlayers.forEach(p => { try { p.volume = 0; p.pause(); } catch {} });
  }

  function startFadeIn(p: typeof playerLluvia) {
    stopFade();
    const FROM = 0.22;   // audible inmediato — sin silencio previo
    const TO   = 0.38;
    const steps = 20;
    const intervalMs = 60;   // 20 × 60ms = 1.2s total
    let step = 0;
    // Volumen inicial inmediatamente (antes del primer tick del interval)
    try { p.volume = FROM; } catch {}
    fadeRef.current = setInterval(() => {
      step++;
      const v = FROM + (TO - FROM) * (step / steps);
      try { p.volume = Math.min(TO, v); } catch {}
      if (step >= steps) stopFade();
    }, intervalMs);
  }

  function handleStart() {
    setElapsed(0);
    setPhase('running');

    const active = getPlayer();
    allPlayers.forEach(p => { if (p !== active) try { p.volume = 0; } catch {} });
    startFadeIn(active);  // no hay play(): ya estaba corriendo desde el mount

    let el = 0;
    timerRef.current = setInterval(() => {
      el++;
      setElapsed(el);
      if (el >= duration) {
        stopTimer();
        silenceAll();
        setPhase('done');
        // ⚠️ Ahora pasa la duración. Antes se omitía —la función la documenta
        // como opcional "para recursos libres (Diario, Ruido blanco)"— pero
        // Ruido no es libre: la persona ELIGE 5/10/… minutos y la completación
        // se dispara con ese timer. El evento suelto que había acá sí la
        // mandaba, así que la tabla estaba guardando menos que la analítica.
        recordCompletion(userIdRef.current, 'ruido', duration).catch(() => {});
      }
    }, 1000);
  }

  // Detener manual: vuelve al estado inicial de esta misma pantalla (no navega).
  function handleStop() {
    stopTimer();
    silenceAll();
    setPhase('idle');
  }

  useEffect(() => () => { stopTimer(); pauseAll(); }, []);

  const remaining = Math.max(0, duration - elapsed);
  const isRunning = phase === 'running';

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <ToolHeader
          onBack={() => { stopTimer(); pauseAll(); router.back(); }}
          right={
            <>
              <ReminderBell kind="tool" resourceRef="ruido" title="Ruido blanco" />
              <PinButton resourceId="ruido" />
            </>
          }
        />
        <View style={s.headerDivider} />

        {phase === 'done' ? (
          <View style={s.content}>
            <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
            <Text style={s.subtitle}>Tiempo completado</Text>
            <Text style={s.description}>{formatTime(duration)} de descanso.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setPhase('idle')} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={s.screenTitle}>Sonidos ambientales</Text>
            <Text style={s.description}>
              Elegí un sonido y por cuánto tiempo.{'\n'}
              Se detiene solo cuando termina — no necesitás hacer nada más.
            </Text>

            {/* Sound selector */}
            <View style={s.soundGrid}>
              {SOUNDS.map(sound => {
                const active = selectedSound === sound.id;
                return (
                  <TouchableOpacity
                    key={sound.id}
                    style={[s.soundCard, { backgroundColor: sound.bg }, active && s.soundCardActive]}
                    onPress={() => setSelectedSound(sound.id)}
                    disabled={isRunning}
                    activeOpacity={0.85}>
                    {active && (
                      <View style={s.soundCheck}>
                        <MaterialCommunityIcons name="check" size={13} color={CREAM_LIGHT} />
                      </View>
                    )}
                    <View style={s.soundIconWrap}>
                      <MaterialCommunityIcons name={sound.icon} size={22} color={FOREST} />
                    </View>
                    <Text style={s.soundLabel}>{sound.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration */}
            <View style={s.durationRow}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d.seconds}
                  style={[s.durationBtn, duration === d.seconds && s.durationBtnActive]}
                  onPress={() => setDuration(d.seconds)}
                  disabled={isRunning}
                  activeOpacity={0.8}>
                  <Text style={[s.durationLabel, duration === d.seconds && s.durationLabelActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.primaryBtn, isRunning && s.stopBtn]}
              onPress={isRunning ? handleStop : handleStart}
              activeOpacity={0.85}>
              <MaterialCommunityIcons name={isRunning ? 'stop' : 'play'} size={16} color={CREAM_LIGHT} />
              <Text style={s.primaryBtnText}>{isRunning ? 'Detener' : 'Iniciar'}</Text>
            </TouchableOpacity>

            {isRunning && (
              <View style={s.runningBlock}>
                <Text style={s.runningTimer}>{formatTime(remaining)}</Text>
                <View style={s.runningRow}>
                  <SoundEqualizer color={FOREST} />
                  <Text style={s.runningHint}>Sonando…</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  headerDivider: { height: 1, backgroundColor: 'rgba(58,79,42,0.08)' },

  content:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  scrollContent:{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 18 },
  subtitle:     { fontFamily: ViveFonts.title, fontSize: 26, color: FOREST, textAlign: 'center' },
  screenTitle:  { fontFamily: ViveFonts.semibold, fontSize: 22, color: FOREST, textAlign: 'center' },
  description:  { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  soundGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  soundCard: {
    width: '47%',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  soundCardActive: { borderColor: FOREST },
  soundCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center',
  },
  soundIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  soundLabel: { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST },

  durationRow:       { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  durationBtn:       { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: GLASS_BG },
  durationBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  durationLabel:     { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },
  durationLabelActive: { color: CREAM_LIGHT },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  stopBtn:        { backgroundColor: TERRACOTTA },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  runningBlock: { alignItems: 'center', gap: 6 },
  runningTimer: { fontFamily: ViveFonts.bold, fontSize: 40, color: FOREST, letterSpacing: -1 },
  runningRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  runningHint: { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT },
});
