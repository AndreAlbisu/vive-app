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

// Relajación muscular progresiva — cada paso tiene fase "tensa" y "soltá"
// tense_s: segundos tensando | hold_s: segundos manteniendo | release_s: segundos soltando
const STEPS = [
  { zone: 'Pies y piernas',     tense: 'Apretá los dedos de los pies y tensá las piernas.', release: 'Soltá completamente. Notá la diferencia entre tensión y relajación.' },
  { zone: 'Abdomen',            tense: 'Tensá el abdomen hacia adentro, como si te fueran a dar un golpe.',  release: 'Soltá el abdomen. Sentí cómo se expande con cada respiración.' },
  { zone: 'Manos y antebrazos', tense: 'Apretá los puños con fuerza. Sentí la tensión en los antebrazos.', release: 'Abrí las manos y soltá. Notá el calor y el hormigueo.' },
  { zone: 'Hombros',            tense: 'Subí los hombros hacia las orejas y mantené.', release: 'Dejá caer los hombros completamente. Sentí el peso.' },
  { zone: 'Cara',               tense: 'Fruncí toda la cara: ojos, nariz, mandíbula.', release: 'Soltá todo. Dejá la cara completamente floja.' },
  { zone: 'Cuerpo completo',    tense: 'Tomá un respiro profundo y sostené el aire.', release: 'Exhalá lentamente y soltá cualquier tensión restante en todo el cuerpo.' },
];

const TENSE_S   = 7;
const RELEASE_S = 13;
const STEP_S    = TENSE_S + RELEASE_S; // 20s
const TOTAL_S   = STEPS.length * STEP_S; // 120s... vamos a agrandar

// Extendemos el release para llegar a ~10 min
const RELEASE_S_LONG = 88; // 7 tense + 88 release = 95s × 6 = 570s ≈ 9.5 min ≈ 10 min
const STEP_S_LONG    = TENSE_S + RELEASE_S_LONG;
const TOTAL_S_LONG   = STEPS.length * STEP_S_LONG; // 570s

type StepPhase = 'tense' | 'release';

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RelajacionScreen() {
  const router = useRouter();
  const [phase, setPhase]       = useState<'idle' | 'running' | 'done'>('idle');
  const [stepIdx, setStepIdx]   = useState(0);
  const [stepPhase, setStepPhase] = useState<StepPhase>('tense');
  const [phaseElapsed, setPhaseElapsed] = useState(0);
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
    setStepPhase('tense');
    setPhaseElapsed(0);
    setTotalElapsed(0);
    setPhase('running');

    let si = 0;
    let sp: StepPhase = 'tense';
    let pe = 0;
    let te = 0;

    timerRef.current = setInterval(() => {
      pe++;
      te++;
      setPhaseElapsed(pe);
      setTotalElapsed(te);

      const maxPhase = sp === 'tense' ? TENSE_S : RELEASE_S_LONG;

      if (pe >= maxPhase) {
        if (sp === 'tense') {
          sp = 'release';
          pe = 0;
          setStepPhase('release');
          setPhaseElapsed(0);
        } else {
          // next step
          if (si + 1 >= STEPS.length) {
            stopTimer();
            setPhase('done');
            if (userIdRef.current) {
              recordCompletion(userIdRef.current, 'relajacion', TOTAL_S_LONG).catch(() => {});
            }
          } else {
            si++;
            sp = 'tense';
            pe = 0;
            setStepIdx(si);
            setStepPhase('tense');
            setPhaseElapsed(0);
          }
        }
      }
    }, 1000);
  }

  useEffect(() => () => stopTimer(), []);

  const progress = totalElapsed / TOTAL_S_LONG;
  const phaseDuration = stepPhase === 'tense' ? TENSE_S : RELEASE_S_LONG;
  const phaseRemaining = phaseDuration - phaseElapsed;

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { stopTimer(); router.back(); }} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.title}>Relajación</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ReminderBell kind="tool" resourceRef="relajacion" title="Relajación" />
            <PinButton resourceId="relajacion" />
          </View>
        </View>

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <Ionicons name="musical-notes-outline" size={56} color={FOREST_SOFT} />
              <Text style={s.subtitle}>Relajación muscular progresiva</Text>
              <Text style={s.description}>
                Tensá y soltá grupos musculares para liberar la tensión acumulada en el cuerpo. 10 minutos.
              </Text>
              <View style={s.previewList}>
                {STEPS.map((step, i) => (
                  <View key={i} style={s.previewItem}>
                    <Text style={s.previewNum}>{i + 1}</Text>
                    <Text style={s.previewLabel}>{step.zone}</Text>
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
              <View style={s.progressHeader}>
                <Text style={s.progressLabel}>Paso {stepIdx + 1} de {STEPS.length}</Text>
                <Text style={s.progressLabel}>{formatTime(TOTAL_S_LONG - totalElapsed)} restantes</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
              </View>

              <View style={s.stepCard}>
                <View style={[s.phaseTag, stepPhase === 'release' && s.phaseTagRelease]}>
                  <Text style={[s.phaseTagText, stepPhase === 'release' && s.phaseTagTextRelease]}>
                    {stepPhase === 'tense' ? 'TENSÁ' : 'SOLTÁ'}
                  </Text>
                </View>
                <Text style={s.stepZone}>{STEPS[stepIdx].zone}</Text>
                <Text style={s.stepText}>
                  {stepPhase === 'tense' ? STEPS[stepIdx].tense : STEPS[stepIdx].release}
                </Text>
              </View>

              <View style={s.phaseTimer}>
                <Text style={s.phaseTimerText}>{phaseRemaining}s</Text>
              </View>

              <TouchableOpacity style={s.ghostBtn} onPress={() => { stopTimer(); router.back(); }} activeOpacity={0.8}>
                <Text style={s.ghostBtnText}>Terminar</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'done' && (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
              <Text style={s.subtitle}>Cuerpo relajado</Text>
              <Text style={s.description}>
                Liberaste la tensión de todo el cuerpo.{'\n'}
                Notá cómo te sentís ahora.
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
  title:   { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST, letterSpacing: -0.3 },

  content:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  subtitle:    { fontFamily: ViveFonts.frauncesSerif, fontSize: 24, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  previewList: { gap: 6, width: '100%' },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: GLASS_BG, borderRadius: 12, borderWidth: 1, borderColor: GLASS_BORDER, paddingHorizontal: 14, paddingVertical: 9 },
  previewNum:  { fontFamily: ViveFonts.semibold, fontSize: 13, color: TERRACOTTA, width: 18 },
  previewLabel:{ fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },
  ghostBtn:       { borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  ghostBtnText:   { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST_SOFT },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  progressLabel:  { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT },
  progressTrack:  { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(63,81,47,0.12)' },
  progressFill:   { height: '100%', backgroundColor: FOREST, borderRadius: 2 },

  stepCard:    { backgroundColor: GLASS_BG, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER, padding: 20, gap: 10, width: '100%' },
  phaseTag:    { alignSelf: 'flex-start', backgroundColor: 'rgba(193,105,79,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  phaseTagRelease:   { backgroundColor: 'rgba(63,81,47,0.12)' },
  phaseTagText:      { fontFamily: ViveFonts.semibold, fontSize: 11, letterSpacing: 0.5, color: TERRACOTTA },
  phaseTagTextRelease: { color: FOREST },
  stepZone:    { fontFamily: ViveFonts.semibold, fontSize: 17, color: FOREST },
  stepText:    { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, lineHeight: 22 },

  phaseTimer:    { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(63,81,47,0.18)', alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS_BG },
  phaseTimerText: { fontFamily: ViveFonts.frauncesSerif, fontSize: 22, color: FOREST },
});
