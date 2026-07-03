import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
import { ensureAnonSession } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';

const FOREST       = '#3A4F2A';
const FOREST_SOFT  = '#6B7A56';
const CREAM_LIGHT  = '#F3EEDF';
const TERRACOTTA   = '#C1694F';
const GLASS_BG     = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const PHASES = ['Inhala', 'Mantén', 'Exhala', 'Mantén'] as const;
const PHASE_COLORS = ['#4A7A5A', '#6B7A56', '#C1694F', '#87835C'] as const;
const PHASE_S = 4;

const DURATIONS = [
  { label: '3 min', seconds: 180 },
  { label: '8 min', seconds: 480 },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RespiracionScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [duration, setDuration] = useState(DURATIONS[0].seconds);
  const [remaining, setRemaining] = useState(DURATIONS[0].seconds);
  const [breathPhase, setBreathPhase] = useState(0);

  const animScale = useRef(new Animated.Value(0.4)).current;
  const loopRef   = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureAnonSession().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  useEffect(() => { setRemaining(duration); }, [duration]);

  function stopAll() {
    loopRef.current?.stop();
    if (timerRef.current)  clearInterval(timerRef.current);
    if (breathRef.current) clearInterval(breathRef.current);
  }

  function handleStart() {
    animScale.setValue(0.4);
    setBreathPhase(0);
    setPhase('running');

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(animScale, { toValue: 1.0, duration: PHASE_S * 1000, useNativeDriver: true }),
        Animated.timing(animScale, { toValue: 1.0, duration: PHASE_S * 1000, useNativeDriver: true }),
        Animated.timing(animScale, { toValue: 0.4, duration: PHASE_S * 1000, useNativeDriver: true }),
        Animated.timing(animScale, { toValue: 0.4, duration: PHASE_S * 1000, useNativeDriver: true }),
      ])
    );
    loopRef.current.start();

    let pi = 0;
    breathRef.current = setInterval(() => {
      pi = (pi + 1) % PHASES.length;
      setBreathPhase(pi);
    }, PHASE_S * 1000);

    let rem = duration;
    timerRef.current = setInterval(() => {
      rem -= 1;
      setRemaining(rem);
      if (rem <= 0) {
        stopAll();
        setPhase('done');
        if (userIdRef.current) {
          recordCompletion(userIdRef.current, 'respiracion', duration).catch(() => {});
        }
      }
    }, 1000);
  }

  useEffect(() => () => stopAll(), []);

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { stopAll(); router.back(); }} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.title}>Respiración</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <Text style={s.subtitle}>Respiración cuadrada</Text>
              <Text style={s.description}>
                Inhalá 4 segundos, mantené 4, exhalá 4, mantené 4.{'\n'}
                Un patrón que calma el sistema nervioso rápidamente.
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
              <View style={s.circleWrap}>
                <View style={[s.circleOuter, { transform: [{ scale: 0.7 }] }]}>
                  <View style={s.circleInner} />
                </View>
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Iniciar</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'running' && (
            <>
              <Text style={s.timer}>{formatTime(remaining)}</Text>
              <View style={s.circleWrap}>
                <Animated.View style={[s.circleOuter, { transform: [{ scale: animScale }] }]}>
                  <View style={s.circleInner} />
                </Animated.View>
              </View>
              <Text style={[s.phaseLabel, { color: PHASE_COLORS[breathPhase] }]}>
                {PHASES[breathPhase]}
              </Text>
              <Text style={s.phaseSub}>4 segundos</Text>
              <TouchableOpacity style={s.ghostBtn} onPress={() => { stopAll(); router.back(); }} activeOpacity={0.8}>
                <Text style={s.ghostBtnText}>Detener</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'done' && (
            <>
              <View style={s.doneIconWrap}>
                <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
              </View>
              <Text style={s.doneTitle}>Bien hecho</Text>
              <Text style={s.doneSub}>
                Completaste {formatTime(duration)} de respiración consciente.
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

  content:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 20 },
  subtitle:    { fontFamily: ViveFonts.semibold, fontSize: 22, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  durationRow:       { flexDirection: 'row', gap: 12 },
  durationBtn:       { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: GLASS_BG },
  durationBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  durationLabel:     { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
  durationLabelActive: { color: CREAM_LIGHT },

  circleWrap:  { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  circleOuter: { width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(74,122,90,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(74,122,90,0.25)' },
  circleInner: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(74,122,90,0.30)' },

  timer:      { fontFamily: ViveFonts.frauncesSerif, fontSize: 52, color: FOREST, letterSpacing: -1 },
  phaseLabel: { fontFamily: ViveFonts.frauncesSerif, fontSize: 32, letterSpacing: -0.3 },
  phaseSub:   { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT, marginTop: -8 },

  primaryBtn:     { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },
  ghostBtn:       { borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.30)', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 40, alignItems: 'center', marginTop: 8 },
  ghostBtnText:   { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },

  doneIconWrap: { marginBottom: 8 },
  doneTitle:    { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST },
  doneSub:      { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 22 },
});
