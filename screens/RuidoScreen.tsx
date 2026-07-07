import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { PinButton } from '@/components/PinButton';
import { ensureAnonSession } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';
const GLASS_BG    = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const SOUNDS = [
  { id: 'lluvia',   icon: 'weather-rainy' as const,   label: 'Lluvia suave' },
  { id: 'bosque',   icon: 'tree-outline' as const,    label: 'Bosque' },
  { id: 'olas',     icon: 'waves' as const,            label: 'Olas del mar' },
  { id: 'blanco',   icon: 'sine-wave' as const,        label: 'Ruido marrón' },
];

// Loops sintetizados por VITA (assets propios, sin licencias de terceros)
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
    ensureAnonSession().then(uid => { userIdRef.current = uid; }).catch(() => {});
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
        if (userIdRef.current) {
          recordCompletion(userIdRef.current, 'ruido').catch(() => {});
        }
      }
    }, 1000);
  }

  useEffect(() => () => { stopTimer(); pauseAll(); }, []);

  const remaining = Math.max(0, duration - elapsed);
  const currentSound = SOUNDS.find(s => s.id === selectedSound)!;

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { stopTimer(); pauseAll(); router.back(); }} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.title}>Ruido blanco</Text>
          <PinButton resourceId="ruido" />
        </View>

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <Ionicons name="volume-medium-outline" size={56} color={FOREST_SOFT} />
              <Text style={s.subtitle}>Sonidos ambientales</Text>
              <Text style={s.description}>
                Elegí un sonido y por cuánto tiempo.{'\n'}
                Se detiene solo cuando termina — no necesitás hacer nada más.
              </Text>

              {/* Sound selector */}
              <View style={s.soundGrid}>
                {SOUNDS.map(sound => (
                  <TouchableOpacity
                    key={sound.id}
                    style={[s.soundBtn, selectedSound === sound.id && s.soundBtnActive]}
                    onPress={() => setSelectedSound(sound.id)}
                    activeOpacity={0.8}>
                    <MaterialCommunityIcons
                      name={sound.icon}
                      size={22}
                      color={selectedSound === sound.id ? CREAM_LIGHT : FOREST_SOFT}
                    />
                    <Text style={[s.soundLabel, selectedSound === sound.id && s.soundLabelActive]}>
                      {sound.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Duration */}
              <View style={s.durationRow}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d.seconds}
                    style={[s.durationBtn, duration === d.seconds && s.durationBtnActive]}
                    onPress={() => setDuration(d.seconds)}
                    activeOpacity={0.8}>
                    <Text style={[s.durationLabel, duration === d.seconds && s.durationLabelActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Iniciar</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'running' && (
            <>
              <View style={s.runningIcon}>
                <MaterialCommunityIcons name={currentSound.icon} size={40} color={FOREST_SOFT} />
              </View>
              <Text style={s.soundName}>{currentSound.label}</Text>
              <Text style={s.timerLarge}>{formatTime(remaining)}</Text>
              <Text style={s.runningHint}>Sonando</Text>
              <TouchableOpacity style={s.ghostBtn} onPress={() => { stopTimer(); pauseAll(); router.back(); }} activeOpacity={0.8}>
                <Text style={s.ghostBtnText}>Detener</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'done' && (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
              <Text style={s.subtitle}>Tiempo completado</Text>
              <Text style={s.description}>{formatTime(duration)} de descanso.</Text>
              <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backText:{ fontFamily: ViveFonts.medium, fontSize: 13, color: 'rgba(135,131,92,0.80)' },
  title:   { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST, letterSpacing: -0.3 },

  content:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  subtitle:    { fontFamily: ViveFonts.frauncesSerif, fontSize: 26, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  soundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  soundBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GLASS_BG, borderWidth: 1.5, borderColor: GLASS_BORDER, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  soundBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  soundLabel:     { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },
  soundLabelActive: { color: CREAM_LIGHT },

  durationRow:       { flexDirection: 'row', gap: 8 },
  durationBtn:       { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: GLASS_BG },
  durationBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  durationLabel:     { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },
  durationLabelActive: { color: CREAM_LIGHT },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },
  ghostBtn:       { borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 36 },
  ghostBtnText:   { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },

  runningIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: GLASS_BG, borderWidth: 1, borderColor: GLASS_BORDER, alignItems: 'center', justifyContent: 'center' },
  soundName:   { fontFamily: ViveFonts.semibold, fontSize: 16, color: FOREST },
  timerLarge:  { fontFamily: ViveFonts.frauncesSerif, fontSize: 64, color: FOREST, letterSpacing: -1 },
  runningHint: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, marginTop: -10 },
});
