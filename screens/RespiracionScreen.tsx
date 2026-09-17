import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, StatusBar } from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts, ViveColors } from '@/constants/theme';
import { PinButton } from '@/components/PinButton';
import { ReminderBell } from '@/components/ReminderBell';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { usuarioActualId } from '@/lib/supabase';
import { recordCompletion } from '@/lib/resourceCompletions';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';

const FOREST       = '#3A4F2A';
const FOREST_SOFT  = '#566245';
const CREAM_LIGHT  = '#F3EEDF';
const TERRACOTTA   = '#C1694F';
const GLASS_BG     = 'rgba(255,248,240,0.55)';

// Un patrón de respiración: sus fases, el tamaño objetivo del orbe en cada una,
// y CUÁNTOS SEGUNDOS dura cada fase. Antes había un solo patrón con 4s parejos;
// el tiempo es POR FASE porque la diafragmática no es pareja (inhala 4, exhala 6).
type Patron = {
  id: string;
  nombre: string;
  titulo: string;
  descripcion: string;
  fases: readonly string[];
  targets: readonly number[];   // scale del orbe (mantené = repite el valor previo)
  segundos: readonly number[];  // duración de cada fase
  colores: readonly string[];
};

// 🔴 El copy describe la práctica y cuándo usarla, SIN prometer un efecto
// fisiológico: T&C §5 declara que Vita no presta servicios de salud (fix de copy
// del 16/09, ver docs/encuadre-salud-y-responsabilidad.md). No re-introducir
// "calma el sistema nervioso" ni equivalentes.
const PATRONES: readonly Patron[] = [
  {
    id: 'caja',
    nombre: 'Cuadrada',
    titulo: 'Cuatro tiempos iguales',
    descripcion:
      'Inhalá 4 segundos, mantené 4, exhalá 4, mantené 4.\n' +
      'Cuatro tiempos iguales, para que la respiración deje de ir apurada.',
    fases:    ['Inhalá', 'Mantené', 'Exhalá', 'Mantené'],
    targets:  [1.0, 1.0, 0.4, 0.4],
    segundos: [4, 4, 4, 4],
    colores:  ['#4A7A5A', '#6B7A56', '#C1694F', '#87835C'],
  },
  {
    id: 'diafragmatica',
    nombre: 'Diafragmática',
    titulo: 'Respirar hondo, desde la panza',
    descripcion:
      'Inhalá 4 segundos llevando el aire abajo, a la panza, y exhalá 6, más lento.\n' +
      'La exhalación, más larga que la inhalación.',
    fases:    ['Inhalá', 'Exhalá'],
    targets:  [1.0, 0.4],
    segundos: [4, 6],
    colores:  ['#4A7A5A', '#C1694F'],
  },
] as const;

const KEEP_AWAKE_TAG = 'vive-respiracion';

// Segundos de sesión después de los cuales la interfaz se retira.
//
// 🔴 El principio: la guía existe para enseñar el ritmo, no para sostenerlo. A
// los 30s ya diste casi dos ciclos completos y el patrón está aprendido — a
// partir de ahí la pantalla deja de aportar y empieza a pedir: seguir el orbe
// con los ojos abiertos mantiene la atención AFUERA del cuerpo, que es lo
// contrario de lo que la herramienta busca. Así que el orbe sigue animando (si
// abrís los ojos, la guía está) pero el texto se atenúa y la pantalla te invita
// explícitamente a dejar de mirarla.
//
// No se apaga del todo a propósito: alguien que abre los ojos a los 4 minutos
// tiene que poder retomar sin tocar nada.
const RETIRO_S = 30;
const RETIRO_OPACIDAD = 0.22;

const DURATIONS = [
  { label: '3 min', seconds: 180 },
  { label: '8 min', seconds: 480 },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Misma pastilla de fecha que Diario y Gratitud (arriba a la derecha).
function formatTodayShort() {
  return new Date()
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

export default function RespiracionScreen() {
  useRecursoAbierto('respiracion');
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [patronId, setPatronId] = useState<string>(PATRONES[0].id);
  const [duration, setDuration] = useState(DURATIONS[0].seconds);
  const [remaining, setRemaining] = useState(DURATIONS[0].seconds);
  const [breathPhase, setBreathPhase] = useState(0);
  const [retirada, setRetirada] = useState(false);

  const patron = PATRONES.find(p => p.id === patronId) ?? PATRONES[0];
  // Guarda: al cambiar de patrón, breathPhase puede quedar un frame apuntando a
  // una fase del patrón anterior (cuadrada tiene 4, diafragmática 2).
  const faseIdx = breathPhase % patron.fases.length;

  const animScale = useRef(new Animated.Value(0.4)).current;
  const animTexto = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    usuarioActualId().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  useEffect(() => { setRemaining(duration); }, [duration]);

  // El orbe respira solo en loop continuo, desde que se abre la pantalla —
  // independiente del timer de sesión. Se reinicia al cambiar de patrón (dep
  // `patronId`) porque cambian las fases y los tiempos. El label de fase se
  // dispara desde el callback de cada tramo para que quede pegado al frame en que
  // la animación termina. Easing.inOut(quad): desacelera al entrar al hold y
  // acelera al salir.
  //
  // 🐛 Con "reducir movimiento" el ciclo corre por setTimeout (no se anima el
  // círculo, pero la fase igual avanza): antes hacía `return` y dejaba la palabra
  // congelada toda la sesión. Reducir movimiento pide no animar, no dejar de guiar.
  useEffect(() => {
    const p = PATRONES.find(x => x.id === patronId) ?? PATRONES[0];
    animScale.setValue(reducedMotion ? 0.7 : 0.4);
    setBreathPhase(0);
    let cancelled = false;
    let legTimeout: ReturnType<typeof setTimeout> | null = null;

    function runLeg(i: number) {
      if (cancelled) return;

      const avanzar = () => {
        if (cancelled) return;
        const next = (i + 1) % p.fases.length;
        setBreathPhase(next);
        runLeg(next);
      };

      if (reducedMotion) {
        legTimeout = setTimeout(avanzar, p.segundos[i] * 1000);
        return;
      }

      Animated.timing(animScale, {
        toValue: p.targets[i],
        duration: p.segundos[i] * 1000,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        avanzar();
      });
    }

    runLeg(0);

    return () => {
      cancelled = true;
      if (legTimeout) clearTimeout(legTimeout);
      animScale.stopAnimation();
    };
  }, [reducedMotion, patronId]);

  // 🔴 Sin esto la herramienta solo funcionaba si tocabas la pantalla cada tanto:
  // el teléfono se bloquea solo a los 30s–2min, y con la pantalla apagada el
  // temporizador de JS se frena, así que la sesión se cortaba por la mitad. Toda
  // la guía es visual, o sea que el bloqueo la apaga entera. Se activa solo
  // mientras corre.
  useEffect(() => {
    if (phase !== 'running') return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => { deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {}); };
  }, [phase]);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // La atenuación del texto guía. Se anima salvo que "reducir movimiento" esté
  // activo, donde el cambio es directo.
  useEffect(() => {
    if (reducedMotion) { animTexto.setValue(retirada ? RETIRO_OPACIDAD : 1); return; }
    Animated.timing(animTexto, {
      toValue: retirada ? RETIRO_OPACIDAD : 1,
      duration: 2500,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [retirada, reducedMotion, animTexto]);

  function handleStart() {
    setPhase('running');
    setRetirada(false);
    animTexto.setValue(1);

    let rem = duration;
    timerRef.current = setInterval(() => {
      rem -= 1;
      setRemaining(rem);
      if (duration - rem >= RETIRO_S) setRetirada(true);
      if (rem <= 0) {
        stopTimer();
        setPhase('done');
        recordCompletion(userIdRef.current, 'respiracion', duration).catch(() => {});
      }
    }, 1000);
  }

  useEffect(() => () => stopTimer(), []);

  const orb = (
    <View style={s.circleWrap}>
      <Animated.View style={[s.circleOuter, { transform: [{ scale: animScale }] }]}>
        <View style={s.circleInner}>
          {phase !== 'running' && <Text style={s.orbLabel}>{patron.fases[faseIdx]}</Text>}
        </View>
      </Animated.View>
    </View>
  );

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <ToolHeader
          onBack={() => { stopTimer(); router.back(); }}
          right={
            <>
              <Text style={s.datePillText}>{formatTodayShort()}</Text>
              <ReminderBell kind="tool" resourceRef="respiracion" title="Respiración" />
              <PinButton resourceId="respiracion" inline />
            </>
          }
        />
        <View style={s.headerDivider} />

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <View style={s.patronRow}>
                {PATRONES.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.patronBtn, patronId === p.id && s.patronBtnActive]}
                    onPress={() => setPatronId(p.id)}
                    activeOpacity={0.8}>
                    <Text style={[s.patronLabel, patronId === p.id && s.patronLabelActive]}>
                      {p.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.subtitle}>{patron.titulo}</Text>
              <Text style={s.description}>{patron.descripcion}</Text>

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
              {orb}
              <ScaleCard style={s.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
                <MaterialCommunityIcons name="play" size={16} color={CREAM_LIGHT} />
                <Text style={s.primaryBtnText}>Iniciar</Text>
              </ScaleCard>
              <Text style={s.footerHint}>
                La pantalla no se apaga mientras dura, y se detiene sola al terminar.
              </Text>
            </>
          )}

          {phase === 'running' && (
            <>
              <Animated.Text style={[s.timer, { opacity: animTexto }]}>
                {formatTime(remaining)}
              </Animated.Text>
              {orb}
              <Animated.Text
                style={[s.phaseLabel, { color: patron.colores[faseIdx], opacity: animTexto }]}>
                {patron.fases[faseIdx]}
              </Animated.Text>
              {/* Lo único que NO se atenúa: la invitación a dejar de mirar. */}
              {retirada ? (
                <Text style={s.retiroHint}>Ya encontraste el ritmo. Cerrá los ojos si querés.</Text>
              ) : (
                <Text style={s.phaseSub}>{patron.segundos[faseIdx]} segundos</Text>
              )}
              {/* Detener vuelve al inicio de la pantalla (no sale), consistente con
                  Sonidos. Resetea el tiempo y el retiro para la próxima. */}
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={() => { stopTimer(); setRemaining(duration); setRetirada(false); setPhase('idle'); }}
                activeOpacity={0.8}>
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
              <Text style={s.doneCoach}>
                Si esto te sirve, contáselo a tu coach: puede adaptarla a lo que estés necesitando.
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
  headerDivider: { height: 1, backgroundColor: 'rgba(58,79,42,0.08)' },

  // Pastilla de fecha del header — idéntica a Diario/Gratitud.
  datePillText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.text,
    backgroundColor: 'rgba(255,255,255,0.70)',
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },

  content:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  subtitle:    { fontFamily: ViveFonts.semibold, fontSize: 22, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  patronRow:        { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  patronBtn:        { flex: 1, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: GLASS_BG, alignItems: 'center' },
  patronBtnActive:  { backgroundColor: FOREST, borderColor: FOREST },
  patronLabel:      { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
  patronLabelActive:{ color: CREAM_LIGHT },

  durationRow:       { flexDirection: 'row', gap: 12 },
  durationBtn:       { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.25)', backgroundColor: GLASS_BG },
  durationBtnActive: { backgroundColor: FOREST, borderColor: FOREST },
  durationLabel:     { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
  durationLabelActive: { color: CREAM_LIGHT },

  circleWrap:  { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  circleOuter: { width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(74,122,90,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(74,122,90,0.28)' },
  circleInner: { width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(74,122,90,0.30)', alignItems: 'center', justifyContent: 'center' },
  orbLabel:    { fontFamily: ViveFonts.semibold, fontSize: 15, color: CREAM_LIGHT },

  timer:      { fontFamily: ViveFonts.bold, fontSize: 52, color: FOREST, letterSpacing: -1 },
  phaseLabel: { fontFamily: ViveFonts.bold, fontSize: 32, letterSpacing: -0.3 },
  phaseSub:   { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT },
  retiroHint: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48, marginTop: 4 },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },
  ghostBtn:       { borderWidth: 1.5, borderColor: 'rgba(63,81,47,0.30)', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 40, alignItems: 'center', marginTop: 4 },
  ghostBtnText:   { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST_SOFT },
  footerHint:     { fontFamily: ViveFonts.regular, fontSize: 12, color: '#566245', textAlign: 'center', marginTop: 4 },

  doneIconWrap: { marginBottom: 8 },
  doneTitle:    { fontFamily: ViveFonts.title, fontSize: 28, color: FOREST },
  doneSub:      { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 22 },
  doneCoach:    { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, textAlign: 'center', lineHeight: 21, marginTop: 2, paddingHorizontal: 8 },
});
