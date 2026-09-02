import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { PinButton } from '@/components/PinButton';
import { ReminderBell } from '@/components/ReminderBell';
import { ensureAnonSession } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';

const DURATIONS = [
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
];

// Each prompt: [startFraction, text]
const PROMPTS: [number, string][] = [
  [0.00, 'Cerrá los ojos suavemente.\nDejá que tu respiración sea natural.'],
  [0.20, 'Notá el aire que entra y sale.\nSin querer controlarlo, solo observá.'],
  [0.40, 'Si tu mente se fue a otro lado,\nvolvé suavemente a la respiración.'],
  [0.60, 'Observá los sonidos alrededor\nsin juzgarlos. Solo percibí.'],
  [0.80, 'Poco a poco, empezá a notar\nel espacio a tu alrededor.'],
  [0.93, 'Cuando estés listo,\nmové los dedos y abrí los ojos.'],
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getPrompt(elapsed: number, total: number) {
  const frac = elapsed / total;
  let best = PROMPTS[0][1];
  for (const [f, text] of PROMPTS) {
    if (frac >= f) best = text;
    else break;
  }
  return best;
}

export default function MeditacionScreen() {
  const router = useRouter();
  const [phase, setPhase]     = useState<'idle' | 'running' | 'done'>('idle');
  const [duration, setDuration] = useState(DURATIONS[0].seconds);
  const [elapsed, setElapsed]   = useState(0);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureAnonSession().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleStart() {
    setElapsed(0);
    setPhase('running');
    let el = 0;
    timerRef.current = setInterval(() => {
      el++;
      setElapsed(el);
      if (el >= duration) {
        stopTimer();
        setPhase('done');
        if (userIdRef.current) {
          recordCompletion(userIdRef.current, 'meditacion', duration).catch(() => {});
        }
      }
    }, 1000);
  }

  useEffect(() => () => stopTimer(), []);

  const remaining = Math.max(0, duration - elapsed);
  const progress  = elapsed / duration;

  return (
    <AppBg>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => { stopTimer(); router.back(); }} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={phase === 'running' ? CREAM_LIGHT : FOREST} />
            <Text style={[s.backText, phase === 'running' && s.backTextLight]}>Atrás</Text>
          </TouchableOpacity>
          <Text style={[s.title, phase === 'running' && s.titleLight]}>Meditación</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ReminderBell kind="tool" resourceRef="meditacion" title="Meditación" />
            <PinButton resourceId="meditacion" />
          </View>
        </View>

        {phase === 'idle' && (
          <View style={s.idleContent}>
            <Ionicons name="leaf-outline" size={56} color={FOREST_SOFT} style={{ marginBottom: 8 }} />
            <Text style={s.subtitle}>Meditación guiada</Text>
            <Text style={s.description}>
              Prompts de texto cada pocos minutos para acompañarte.{'\n'}
              Encontrá un lugar cómodo para sentarte.
            </Text>
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
            <ScaleCard style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Iniciar</Text>
            </ScaleCard>
          </View>
        )}

        {phase === 'running' && (
          <LinearGradient colors={['#2A3D1E', '#1E2D16']} style={s.runningBg}>
            <Text style={s.timerLarge}>{formatTime(remaining)}</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
            </View>
            <Text style={s.promptText}>{getPrompt(elapsed, duration)}</Text>
            <TouchableOpacity style={s.ghostBtnDark} onPress={() => { stopTimer(); router.back(); }} activeOpacity={0.8}>
              <Text style={s.ghostBtnDarkText}>Terminar antes</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {phase === 'done' && (
          <View style={s.idleContent}>
            <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} style={{ marginBottom: 8 }} />
            <Text style={s.subtitle}>Sesión completada</Text>
            <Text style={s.description}>
              Tomaste {formatTime(duration)} para estar con vos mismo.{'\n'}
              Eso importa.
            </Text>
            <ScaleCard style={s.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </ScaleCard>
          </View>
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  backText:   { fontFamily: ViveFonts.medium, fontSize: 13, color: 'rgba(135,131,92,0.80)' },
  backTextLight: { color: 'rgba(255,248,240,0.60)' },
  title:      { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST, letterSpacing: -0.3 },
  titleLight: { color: CREAM_LIGHT },

  idleContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  subtitle:    { fontFamily: ViveFonts.title, fontSize: 26, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  durationRow:       { flexDirection: 'row', gap: 12 },
  durationBtn:       { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: 'rgba(255,248,240,0.55)' },
  durationBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  durationLabel:     { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
  durationLabelActive: { color: CREAM_LIGHT },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  runningBg:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 32 },
  timerLarge:   { fontFamily: ViveFonts.bold, fontSize: 72, color: CREAM_LIGHT, letterSpacing: -2 },
  progressTrack: { width: '100%', height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressFill:  { height: '100%', backgroundColor: 'rgba(255,248,240,0.55)', borderRadius: 2 },
  promptText:    { fontFamily: ViveFonts.semibold, fontStyle: 'italic', fontSize: 19, color: 'rgba(243,238,223,0.85)', textAlign: 'center', lineHeight: 29 },
  ghostBtnDark:     { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  ghostBtnDarkText: { fontFamily: ViveFonts.medium, fontSize: 13, color: 'rgba(255,248,240,0.60)' },
});
