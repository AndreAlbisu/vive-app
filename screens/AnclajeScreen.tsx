import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { PinButton } from '@/components/PinButton';
import { ReminderBell } from '@/components/ReminderBell';
import { usuarioActualId } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';

const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';
const GLASS_BG    = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// 5-4-3-2-1: un sentido por paso, a tu ritmo. El anclaje funciona porque VOS
// buscás y contás las cosas (no hay reloj: la presión sería contraproducente).
type Step = {
  sense: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  count: number;
  prompt: string;
};

const STEPS: Step[] = [
  { sense: 'Ver',      icon: 'eye-outline',       count: 5, prompt: 'Mirá a tu alrededor y encontrá 5 cosas que podés ver. Tocá un punto por cada una.' },
  { sense: 'Tocar',    icon: 'hand-left-outline', count: 4, prompt: 'Notá 4 cosas que podés sentir: la ropa sobre tu piel, la silla, el aire, tus pies en el suelo.' },
  { sense: 'Oír',      icon: 'ear-outline',       count: 3, prompt: 'Prestá atención a 3 sonidos a tu alrededor, aunque sean sutiles.' },
  { sense: 'Oler',     icon: 'flower-outline',    count: 2, prompt: 'Buscá 2 olores. Si no encontrás ninguno, imaginá dos que te gusten.' },
  { sense: 'Saborear', icon: 'cafe-outline',      count: 1, prompt: 'Notá 1 sabor en tu boca, o pensá en una cosa buena de vos hoy.' },
];

export default function AnclajeScreen() {
  useRecursoAbierto('anclaje');
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [stepIdx, setStepIdx] = useState(0);
  const [filled, setFilled] = useState(0);

  const startRef  = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    usuarioActualId().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  function handleStart() {
    setStepIdx(0);
    setFilled(0);
    startRef.current = Date.now();
    setPhase('running');
  }

  function finish() {
    setPhase('done');
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    recordCompletion(userIdRef.current, 'anclaje', elapsed).catch(() => {});
  }

  function handleNext() {
    if (stepIdx + 1 >= STEPS.length) {
      finish();
    } else {
      setStepIdx(stepIdx + 1);
      setFilled(0);
    }
  }

  const step = STEPS[stepIdx];
  const complete = filled >= (step?.count ?? 0);
  const isLast = stepIdx + 1 >= STEPS.length;
  const progress = (stepIdx + (complete ? 1 : 0)) / STEPS.length;

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.title}>Anclaje</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <ReminderBell kind="tool" resourceRef="anclaje" title="Anclaje" />
            <PinButton resourceId="anclaje" />
          </View>
        </View>

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <MaterialCommunityIcons name="anchor" size={54} color={FOREST_SOFT} />
              <Text style={s.subtitle}>2-3 min · a tu ritmo</Text>
              <Text style={s.description}>
                Cuando la ansiedad te desborda, recorrer tus cinco sentidos te trae
                de vuelta al presente. Uno a la vez, sin apuro.
              </Text>
              <View style={s.stepsPreview}>
                {STEPS.map((st, i) => (
                  <View key={i} style={s.stepDot}>
                    <Text style={s.stepDotNum}>{st.count}</Text>
                    <Text style={s.stepDotLabel}>{st.sense}</Text>
                  </View>
                ))}
              </View>
              <ScaleCard style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Empezar</Text>
              </ScaleCard>
            </>
          )}

          {phase === 'running' && (
            <>
              <View style={s.progressHeader}>
                <Text style={s.progressLabel}>Paso {stepIdx + 1} de {STEPS.length}</Text>
                <Text style={s.progressLabel}>{filled} de {step.count}</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
              </View>

              <View style={s.senseIconWrap}>
                <Ionicons name={step.icon} size={30} color={FOREST} />
              </View>
              <Text style={s.senseName}>{step.count} cosas que podés {step.sense.toLowerCase()}</Text>
              <Text style={s.prompt}>{step.prompt}</Text>

              <View style={s.countRow}>
                {Array.from({ length: step.count }).map((_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.countDot, i < filled && s.countDotFilled]}
                    onPress={() => setFilled(i + 1 === filled ? i : i + 1)}
                    activeOpacity={0.8}>
                    {i < filled && (
                      <Ionicons name="checkmark" size={20} color={CREAM_LIGHT} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <ScaleCard
                style={[s.primaryBtn, !complete && s.primaryBtnDisabled]}
                onPress={handleNext}
                disabled={!complete}
                activeOpacity={0.85}>
                <Text style={[s.primaryBtnText, !complete && s.primaryBtnTextDisabled]}>
                  {isLast ? 'Terminar' : 'Siguiente'}
                </Text>
              </ScaleCard>
            </>
          )}

          {phase === 'done' && (
            <>
              <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
              <Text style={s.subtitle}>Volviste al presente</Text>
              <Text style={s.description}>
                Recorriste tus cinco sentidos.{'\n'}
                Estás acá, ahora. Eso ya es mucho.
              </Text>
              <ScaleCard style={s.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Volver</Text>
              </ScaleCard>
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
  subtitle:    { fontFamily: ViveFonts.title, fontSize: 24, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  stepsPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 320 },
  stepDot:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: GLASS_BG, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: GLASS_BORDER },
  stepDotNum:   { fontFamily: ViveFonts.semibold, fontSize: 12, color: FOREST },
  stepDotLabel: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT },

  primaryBtn:         { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48 },
  primaryBtnText:     { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },
  primaryBtnDisabled: { backgroundColor: 'rgba(63,81,47,0.15)' },
  primaryBtnTextDisabled: { color: 'rgba(58,79,42,0.45)' },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  progressLabel:  { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT },
  progressTrack:  { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(63,81,47,0.12)' },
  progressFill:   { height: '100%', backgroundColor: FOREST, borderRadius: 2 },

  senseIconWrap: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: 'rgba(63,81,47,0.20)', alignItems: 'center', justifyContent: 'center', backgroundColor: GLASS_BG },
  senseName:     { fontFamily: ViveFonts.title, fontSize: 21, color: FOREST, textAlign: 'center' },
  prompt:        { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, textAlign: 'center', lineHeight: 22 },

  countRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  countDot:  { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: GLASS_BG, alignItems: 'center', justifyContent: 'center' },
  countDotFilled: { backgroundColor: FOREST, borderColor: FOREST },
});
