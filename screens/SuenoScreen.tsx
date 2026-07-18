import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
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
  { label: '20 min', seconds: 1200 },
];

const PROMPTS: [number, string][] = [
  [0.00, 'Respirá lentamente.\nDejá ir los pensamientos del día.'],
  [0.30, 'Tu cuerpo se va aflojando.\nNo hay nada que hacer ahora.'],
  [0.55, 'Cada exhalación te lleva\nmás profundo hacia el descanso.'],
  [0.75, 'El sueño se acerca.\nDejate ir.'],
  [0.90, 'Todo puede esperar\nhasta mañana.'],
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

export default function SuenoScreen() {
  const router = useRouter();
  const [phase, setPhase]       = useState<'idle' | 'running' | 'done'>('idle');
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
          recordCompletion(userIdRef.current, 'sueno', duration).catch(() => {});
        }
      }
    }, 1000);
  }

  useEffect(() => () => stopTimer(), []);

  const remaining = Math.max(0, duration - elapsed);

  return (
    <AppBg>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { stopTimer(); router.back(); }} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={phase === 'running' ? CREAM_LIGHT : FOREST} />
            <Text style={[s.backText, phase === 'running' && s.backTextLight]}>Atrás</Text>
          </TouchableOpacity>
          <Text style={[s.title, phase === 'running' && s.titleLight]}>Sueño</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ReminderBell kind="tool" ref="sueno" title="Sueño" />
            <PinButton resourceId="sueno" />
          </View>
        </View>

        {phase === 'idle' && (
          <View style={s.idleContent}>
            <Ionicons name="moon-outline" size={56} color={FOREST_SOFT} />
            <Text style={s.subtitle}>Relajación pre-sueño</Text>
            <Text style={s.description}>
              Una transición suave hacia el descanso.{'\n'}
              Prompts que acompañan el camino al sueño.
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
            <TouchableOpacity style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Iniciar</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'running' && (
          <LinearGradient colors={['#0F1A24', '#1A2436']} style={s.runningBg}>
            <MaterialCommunityIcons name="star-four-points-outline" size={28} color="rgba(255,248,240,0.25)" />
            <Text style={s.timerLarge}>{formatTime(remaining)}</Text>
            <Text style={s.promptText}>{getPrompt(elapsed, duration)}</Text>
            <TouchableOpacity style={s.ghostBtnDark} onPress={() => { stopTimer(); router.back(); }} activeOpacity={0.8}>
              <Text style={s.ghostBtnDarkText}>Terminar</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {phase === 'done' && (
          <View style={s.idleContent}>
            <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
            <Text style={s.subtitle}>Listo para descansar</Text>
            <Text style={s.description}>
              Completaste {formatTime(duration)} de relajación.{'\n'}
              Que descanses.
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </TouchableOpacity>
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
  backTextLight: { color: 'rgba(255,248,240,0.50)' },
  title:      { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST, letterSpacing: -0.3 },
  titleLight: { color: CREAM_LIGHT },

  idleContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  subtitle:    { fontFamily: ViveFonts.frauncesSerif, fontSize: 26, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  durationRow:       { flexDirection: 'row', gap: 12 },
  durationBtn:       { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: 'rgba(255,248,240,0.55)' },
  durationBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  durationLabel:     { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
  durationLabelActive: { color: CREAM_LIGHT },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  runningBg:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, paddingHorizontal: 32 },
  timerLarge:   { fontFamily: ViveFonts.frauncesSerif, fontSize: 72, color: CREAM_LIGHT, letterSpacing: -2 },
  promptText:   { fontFamily: ViveFonts.frauncesSerif, fontStyle: 'italic', fontSize: 22, color: 'rgba(243,238,223,0.75)', textAlign: 'center', lineHeight: 34 },
  ghostBtnDark: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  ghostBtnDarkText: { fontFamily: ViveFonts.medium, fontSize: 13, color: 'rgba(255,248,240,0.50)' },
});
