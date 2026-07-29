import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
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
const GLASS_BG    = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const STEP_SECONDS = 60;

const STEPS = [
  { zone: 'Pies y tobillos',     text: 'Llevá tu atención a los pies. Notá el contacto con el suelo, cualquier sensación de calor, frescor o peso.' },
  { zone: 'Pantorrillas y rodillas', text: 'Subí hacia las pantorrillas y rodillas. Sin querer cambiar nada, simplemente observá lo que está ahí.' },
  { zone: 'Muslos',              text: 'Llevá la atención a los muslos. Notá su peso, temperatura y cualquier tensión presente.' },
  { zone: 'Abdomen',             text: 'Dirigí la atención al abdomen. Sentí cómo sube con cada inhalación y cae con cada exhalación.' },
  { zone: 'Pecho',               text: 'Llevá la atención al pecho. Podés notar el latido del corazón. Solo observalo.' },
  { zone: 'Manos y brazos',      text: 'Notá las manos y los brazos. ¿Hay sensaciones de hormigueo, calor o peso? Solo percibilas.' },
  { zone: 'Hombros y cuello',    text: 'Llegamos a los hombros y el cuello. ¿Hay tensión acumulada? No intentés cambiarla, solo reconocela.' },
  { zone: 'Cara y cabeza',       text: 'Llevá la atención a la cara. Relajá suavemente la mandíbula, los ojos y la frente.' },
];

const TOTAL_SECONDS = STEPS.length * STEP_SECONDS; // 480s = 8 min

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function EscanerScreen() {
  const router = useRouter();
  const [phase, setPhase]   = useState<'idle' | 'running' | 'done'>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureAnonSession().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleStart() {
    setStepIdx(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    setPhase('running');

    let si = 0, se = 0, te = 0;
    timerRef.current = setInterval(() => {
      se++;
      te++;
      setStepElapsed(se);
      setTotalElapsed(te);

      if (se >= STEP_SECONDS) {
        if (si + 1 >= STEPS.length) {
          stopTimer();
          setPhase('done');
          if (userIdRef.current) {
            recordCompletion(userIdRef.current, 'escaner', TOTAL_SECONDS).catch(() => {});
          }
        } else {
          si++;
          se = 0;
          setStepIdx(si);
          setStepElapsed(0);
        }
      }
    }, 1000);
  }

  useEffect(() => () => stopTimer(), []);

  const progress = totalElapsed / TOTAL_SECONDS;
  const stepProgress = stepElapsed / STEP_SECONDS;

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { stopTimer(); router.back(); }} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.title}>Escáner corporal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ReminderBell kind="tool" resourceRef="escaner" title="Escáner corporal" />
            <PinButton resourceId="escaner" />
          </View>
        </View>

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <Ionicons name="body-outline" size={56} color={FOREST_SOFT} />
              <Text style={s.subtitle}>8 minutos · 8 zonas</Text>
              <Text style={s.description}>
                Llevarás tu atención a cada parte del cuerpo, de los pies a la cabeza.
                Un minuto por zona.
              </Text>
              <View style={s.stepsPreview}>
                {STEPS.map((step, i) => (
                  <View key={i} style={s.stepDot}>
                    <View style={s.dot} />
                    <Text style={s.stepDotLabel}>{step.zone}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Iniciar</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'running' && (
            <>
              {/* Progress total */}
              <View style={s.progressHeader}>
                <Text style={s.progressLabel}>Paso {stepIdx + 1} de {STEPS.length}</Text>
                <Text style={s.progressLabel}>{formatTime(TOTAL_SECONDS - totalElapsed)}</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
              </View>

              {/* Step card */}
              <View style={s.stepCard}>
                <Text style={s.stepZone}>{STEPS[stepIdx].zone}</Text>
                <Text style={s.stepText}>{STEPS[stepIdx].text}</Text>
              </View>

              {/* Step timer ring */}
              <View style={s.stepTimerWrap}>
                <Text style={s.stepTimer}>{STEP_SECONDS - stepElapsed}s</Text>
              </View>

              <TouchableOpacity style={s.ghostBtn} onPress={() => { stopTimer(); router.back(); }} activeOpacity={0.8}>
                <Text style={s.ghostBtnText}>Terminar</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'done' && (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
              <Text style={s.subtitle}>Escáner completado</Text>
              <Text style={s.description}>
                Recorriste todo el cuerpo de manera consciente.{'\n'}
                Eso ya es mucho.
              </Text>
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
  title:   { fontFamily: ViveFonts.bold, fontSize: 20, color: FOREST, letterSpacing: -0.3 },

  content:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  subtitle:    { fontFamily: ViveFonts.frauncesSerif, fontSize: 24, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  stepsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 320 },
  stepDot:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GLASS_BG, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: GLASS_BORDER },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: FOREST_SOFT },
  stepDotLabel: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },
  ghostBtn:       { borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  ghostBtnText:   { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  progressLabel:  { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT },
  progressTrack:  { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(63,81,47,0.12)' },
  progressFill:   { height: '100%', backgroundColor: FOREST, borderRadius: 2 },

  stepCard: { backgroundColor: GLASS_BG, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER, padding: 22, gap: 10, width: '100%' },
  stepZone: { fontFamily: ViveFonts.semibold, fontSize: 17, color: FOREST },
  stepText: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, lineHeight: 22 },

  stepTimerWrap: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(63,81,47,0.20)', alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS_BG },
  stepTimer:     { fontFamily: ViveFonts.frauncesSerif, fontSize: 26, color: FOREST },
});
