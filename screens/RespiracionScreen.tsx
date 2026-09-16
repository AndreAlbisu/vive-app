import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, StatusBar } from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBg } from '@/components/ui/AppBg';
import { ViveFonts } from '@/constants/theme';
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

const PHASES = ['Inhalá', 'Mantené', 'Exhalá', 'Mantené'] as const;
const PHASE_COLORS = ['#4A7A5A', '#6B7A56', '#C1694F', '#87835C'] as const;
const PHASE_TARGETS = [1.0, 1.0, 0.4, 0.4] as const; // scale objetivo de cada fase (mantené = repite el valor previo)
const PHASE_S = 4; // 4s por fase, 16s de ciclo total — coincide con la descripción en pantalla
const KEEP_AWAKE_TAG = 'vive-respiracion';

// Segundos de sesión después de los cuales la interfaz se retira.
//
// 🔴 El principio: la guía existe para enseñar el ritmo, no para sostenerlo. A
// los 30s ya diste casi dos ciclos completos de 16s y el patrón está aprendido —
// a partir de ahí la pantalla deja de aportar y empieza a pedir: seguir el orbe
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

export default function RespiracionScreen() {
  useRecursoAbierto('respiracion');
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [duration, setDuration] = useState(DURATIONS[0].seconds);
  const [remaining, setRemaining] = useState(DURATIONS[0].seconds);
  const [breathPhase, setBreathPhase] = useState(0);
  const [retirada, setRetirada] = useState(false);

  const animScale = useRef(new Animated.Value(0.4)).current;
  const animTexto = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    usuarioActualId().then(uid => { userIdRef.current = uid; }).catch(() => {});
  }, []);

  useEffect(() => { setRemaining(duration); }, [duration]);

  // El orbe respira solo en loop continuo, desde que se abre la pantalla —
  // independiente del timer de sesión (que solo cuenta cuánto falta).
  // El label de fase se dispara desde el callback de cada tramo (no un
  // setInterval aparte) para que quede pegado al frame exacto en que la
  // animación nativa termina. Easing.inOut(quad): desacelera al entrar al
  // hold y acelera al salir, sin la cola larga y casi imperceptible del
  // ease-in-out default (que hacía ver el círculo "todavía llegando" con
  // el label ya en "Mantené") ni el frenazo en seco de un easing lineal
  // (que se probó antes y quedaba muy brusco en el cambio de fase).
  //
  // 🐛 Con "reducir movimiento" activado esto hacía `return` antes de arrancar:
  // el círculo quedaba fijo Y la fase no avanzaba nunca, así que la pantalla
  // mostraba la palabra "Inhalá" congelada durante los 3 u 8 minutos enteros y
  // al final registraba la sesión como completada igual. Reducir movimiento
  // pide no animar, no dejar de guiar: ahora el ciclo corre por setTimeout y lo
  // único que se pierde es el escalado del círculo.
  useEffect(() => {
    animScale.setValue(reducedMotion ? 0.7 : 0.4);
    setBreathPhase(0);
    let cancelled = false;
    let legTimeout: ReturnType<typeof setTimeout> | null = null;

    function runLeg(i: number) {
      if (cancelled) return;

      const avanzar = () => {
        if (cancelled) return;
        const next = (i + 1) % PHASES.length;
        setBreathPhase(next);
        runLeg(next);
      };

      if (reducedMotion) {
        legTimeout = setTimeout(avanzar, PHASE_S * 1000);
        return;
      }

      Animated.timing(animScale, {
        toValue: PHASE_TARGETS[i],
        duration: PHASE_S * 1000,
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
  }, [reducedMotion]);

  // 🔴 Sin esto la herramienta solo funcionaba si tocabas la pantalla cada tanto:
  // el teléfono se bloquea solo a los 30s–2min, y con la pantalla apagada el
  // temporizador de JS se frena, así que la sesión se cortaba por la mitad. Toda
  // la guía de esta pantalla es visual, o sea que el bloqueo la apaga entera.
  // Se activa solo mientras corre —no mientras la pantalla está abierta— para no
  // dejar el teléfono despierto porque alguien entró a mirar y se fue.
  useEffect(() => {
    if (phase !== 'running') return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => { deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {}); };
  }, [phase]);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // La atenuación del texto guía. Se anima salvo que "reducir movimiento" esté
  // activo, donde el cambio es directo — el pedido ahí es no animar, no dejar de
  // retirarse.
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
          {phase !== 'running' && <Text style={s.orbLabel}>{PHASES[breathPhase]}</Text>}
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
              <ReminderBell kind="tool" resourceRef="respiracion" title="Respiración" />
              <PinButton resourceId="respiracion" />
            </>
          }
        />
        <View style={s.headerDivider} />

        <View style={s.content}>
          {phase === 'idle' && (
            <>
              <Text style={s.subtitle}>Respiración cuadrada</Text>
              {/* 🔴 Decía "Un patrón que calma el sistema nervioso rápidamente".
                  Es una promesa de efecto fisiológico, sin respaldo y sin
                  matizar, y contradice el encuadre del propio producto: T&C §5
                  declara que Vita no presta servicios de salud ni reemplaza
                  atención profesional (ver docs/encuadre-salud-y-responsabilidad.md).
                  Lo que sigue describe la práctica y cuándo se usa, que es lo
                  que la persona necesita para decidir, sin prometer nada. */}
              <Text style={s.description}>
                Inhalá 4 segundos, mantené 4, exhalá 4, mantené 4.{'\n'}
                Cuatro tiempos iguales, para que la respiración deje de ir apurada.
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
              {orb}
              <Text style={[s.phaseSub, { marginTop: -8 }]}>{PHASE_S} segundos</Text>
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
                style={[s.phaseLabel, { color: PHASE_COLORS[breathPhase], opacity: animTexto }]}>
                {PHASES[breathPhase]}
              </Animated.Text>
              {/* Lo único que NO se atenúa: la invitación a dejar de mirar. Ocupa
                  el lugar de "4 segundos", que a esta altura es el dato más
                  inútil de la pantalla. */}
              {retirada ? (
                <Text style={s.retiroHint}>Ya encontraste el ritmo. Cerrá los ojos si querés.</Text>
              ) : (
                <Text style={s.phaseSub}>{PHASE_S} segundos</Text>
              )}
              <TouchableOpacity style={s.ghostBtn} onPress={() => { stopTimer(); router.back(); }} activeOpacity={0.8}>
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

  content:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  subtitle:    { fontFamily: ViveFonts.semibold, fontSize: 22, color: FOREST, textAlign: 'center' },
  description: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

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
});
