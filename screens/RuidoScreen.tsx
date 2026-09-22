import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
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
const FOREST_SOFT = '#566245';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';
const GLASS_BG    = 'rgba(255,248,240,0.55)';

// `hint` es para qué sirve cada uno: sin eso la pantalla explicaba cómo se usa
// (elegí sonido, elegí tiempo) y nunca por qué elegirías uno y no otro.
//
// 🔴 **Dos de los cinco textos prometían algo que el sonido no hace, corregidos
// el 21/09/2026 después de medirlos y escucharlos:**
//   · Bosque decía *"para concentrarte"*. Tiene pájaros, o sea EVENTOS: sonidos
//     cortos que aparecen y se van, y cada uno se lleva un pedacito de atención.
//     Es lo contrario de concentrarse. Lo que sí hace es acompañar. Para
//     concentrarse la lluvia es mejor, porque es pareja y no pasa nada.
//   · Ruido grave decía *"para tapar el ruido"* y es **el peor de los cinco para
//     eso**: lo que hay que tapar son voces, el habla vive en los medios y
//     agudos, y este cae -8,7 dB por octava. Sí tapa bien el zumbido parejo de
//     abajo (la calle, un aire acondicionado), y eso es lo que dice ahora.
// El id `blanco` quedó del primer corte y ya no describe nada: medido, el archivo
// cae -8,7 dB por octava entre 250 Hz y 4 kHz. Blanco sería 0, rosa -3, marrón -6
// — o sea que es todavía más grave que el marrón, y "blanco" era directamente
// falso. Se muestra por lo que se oye; el id no se toca porque viaja en
// completions, guardados y recordatorios.
const SOUNDS = [
  { id: 'lluvia',   icon: 'weather-rainy' as const,    label: 'Lluvia suave',  hint: 'para dormirte',        bg: PASTEL_AZUL },
  { id: 'bosque',   icon: 'tree-outline' as const,     label: 'Bosque',        hint: 'para acompañarte',     bg: PASTEL_SALVIA },
  { id: 'olas',     icon: 'waves' as const,            label: 'Olas del mar',  hint: 'para bajar un cambio', bg: PASTEL_TEAL },
  { id: 'blanco',   icon: 'sine-wave' as const,        label: 'Ruido grave',   hint: 'para el ruido de fondo', bg: PASTEL_DURAZNO },
];

// ✅ **Re-exportados el 21/09/2026 desde la fuente, que es lo que estas mismas
// líneas venían pidiendo desde la sesión 234.** Antes: mono, 22 kHz, 63 kbps,
// sobre un corte que ya venía comprimido a 31 kbps. Ahora: **estéreo, 44,1 kHz,
// 128 kbps**, encodeados una sola vez desde el original.
//
// Por qué importaba: casi todo lo que hace que una lluvia suene a lluvia vive
// arriba de los 11 kHz, y a 22 kHz de muestreo eso directamente no existe. Y el
// ambiente es la única categoría donde el estéreo no es adorno: la sensación de
// estar adentro de un lugar viene de que los dos oídos escuchen cosas distintas.
//
// Origen (los tres de campo salen de Wikimedia Commons, verificados uno por uno):
//   · lluvia  → "Falling Rain SFX 1", de valvalion. **CC BY 3.0: obliga a dar
//                crédito**, y por eso está la línea de abajo en la pantalla.
//   · bosque  → "20090610 0 ambience", de nille (pdsounds). Dominio público.
//   · olas    → "On a pebble beach", de earthcalling (pdsounds). Dominio público.
//   · blanco  → **generado**, no grabado. El ruido marrón es una definición
//                matemática, así que sintetizarlo bien no es imitar nada: es la
//                cosa. Y sale estéreo de verdad, con los canales independientes.
//
// El tramo de cada uno se eligió MIDIENDO y no a oído (`scripts/elegir-tramo.py`
// busca el fragmento más parejo, sin picos ni silencios), y el loop lo cierra
// `scripts/procesar-sonidos.py` con un crossfade de potencia constante.
//
// ⚠️ **Olas dura 32s y no 87**: es la única de las tres grabaciones libres con
// olas decentes que encontramos, y el original dura 40 segundos. Se nota más el
// loop que en las otras. Si aparece una fuente mejor, se reemplaza con el mismo
// script y no hay que tocar nada de esta pantalla.
//
// 🔴 **Y el tramo se movió una vez, escuchándolo.** La primera versión arrancaba
// en el segundo 2 y Andre oyó "algo raro, como pisadas" al principio. Estaba:
// midiendo el original bloque a bloque aparece un golpe aislado entre 2,50 y
// 3,00, contra un fondo muy tranquilo. Ahora empieza en el 6,00, que además es
// donde las olas se vuelven parejas: el corte pasó de 1 pico y 6 silencios a
// **cero y cero**. 📌 La medición sirve para descartar, no para elegir: encontró
// el ladrido de perro de otro archivo, pero este golpe no lo marcó como pico
// porque el tramo de alrededor era muy silencioso. Hace falta el oído humano.
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

  // Pre-cargar los audios al montar para evitar delay al iniciar
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
              <ReminderBell kind="tool" resourceRef="ruido" title="Sonidos ambientales" />
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
            <ScaleCard style={s.primaryBtn} onPress={() => setPhase('idle')} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </ScaleCard>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={s.screenTitle}>Sonidos ambientales</Text>
            <Text style={s.description}>
              Un fondo parejo tapa el ruido de afuera y le da a la cabeza algo
              que no cambia. Sirve para dormirte, para concentrarte, o para
              bajar un cambio antes de una sesión.
            </Text>
            <Text style={s.descriptionSmall}>
              Elegí uno y por cuánto tiempo. Se detiene solo.
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
                    <Text style={s.soundHint}>{sound.hint}</Text>
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

            <ScaleCard
              style={[s.primaryBtn, isRunning && s.stopBtn]}
              onPress={isRunning ? handleStop : handleStart}
              activeOpacity={0.85}>
              <MaterialCommunityIcons name={isRunning ? 'stop' : 'play'} size={16} color={CREAM_LIGHT} />
              <Text style={s.primaryBtnText}>{isRunning ? 'Detener' : 'Iniciar'}</Text>
            </ScaleCard>

            {/* 🔴 No es decorativo: la lluvia es CC BY 3.0 y **el crédito es la
                condición de la licencia**. Va discreto y al final, pero va. Los
                otros dos son de dominio público y no obligan; se nombran igual
                porque cuesta nada y es de donde salieron. */}
            <Text style={s.creditos}>
              Lluvia: valvalion (CC BY). Bosque: nille. Olas: earthcalling.
            </Text>

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
  descriptionSmall: { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST_SOFT, textAlign: 'center', marginTop: -8 },

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
  soundHint:  { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT, textAlign: 'center', marginTop: -4 },

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
  creditos: {
    fontFamily: ViveFonts.regular, fontSize: 10.5, color: FOREST_SOFT,
    opacity: 0.75, textAlign: 'center', marginTop: 18,
  },
});
