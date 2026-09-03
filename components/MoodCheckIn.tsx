import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ViveFonts, ViveMoodColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { localDayKey } from '@/lib/dates';
import type { MoodEntry } from '@/hooks/useMoodHistory';

const MOODS = [
  { id: 1, label: 'Bajón'     },
  { id: 2, label: 'Cansado'   },
  { id: 3, label: 'Normal'    },
  { id: 4, label: 'Bien'      },
  { id: 5, label: 'Brillando' },
] as const;

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatTodayLabel(): string {
  const d = new Date();
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}

type MoodId = (typeof MOODS)[number]['id'];

const GLASS        = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// ── Confirmar manteniendo apretado ──────────────────────────────────────────
// El check-in se confirma sosteniendo el dedo, no con un toque suelto: un
// anillo se completa alrededor del círculo y al cerrarse vibra corto.
//
// 300ms, ajustado a mano en el dispositivo el 27/08/2026 — pasó por 750, 375 y
// 500 antes de quedar acá. Sostener para decir cómo te sentís tiene que sentirse
// deliberado, no lento, y esto se hace todos los días.
//
// ⚠️ Es el piso: por debajo de esto el gesto se confunde con un toque suelto y
// el anillo no llega a verse, o sea que se pierden las dos cosas que justifican
// mantener apretado. Si hiciera falta que se sienta aún más rápido, el número a
// tocar NO es este sino la curva — hoy es lineal, y una que arranque rápido se
// percibe más corta sin serlo.
const HOLD_MS = 300;
const ANILLO  = 40;              // lienzo del anillo (el círculo del ánimo mide 24)
const R       = 16;              // radio: deja 4px de aire contra el círculo
const TRAZO   = 2.5;
const VUELTA  = 2 * Math.PI * R; // largo del recorrido, para el dash

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

interface Props {
  userId:        string | undefined;
  todayEntry:    MoodEntry | undefined;
  onRequestAuth: () => void;
  /** Se dispara al elegir un mood, ANTES del upsert (no depende de la red).
   *  `firstToday` = todavía no había check-in hoy cuando se tocó — Inicio lo
   *  usa para decidir si corresponde el momento de pantalla completa. Elegir
   *  un mood distinto habiendo ya hecho el check-in hoy también dispara esto,
   *  pero con `firstToday: false`. */
  onPicked?: (mood: { id: MoodId; label: string; color: string }, opts: { firstToday: boolean }) => void;
  /** Se consulta ANTES de tocar nada. Si devuelve `false`, el check-in no ocurre
   *  — ni animación, ni callback, ni upsert.
   *
   *  🔴 El orden importa: el ánimo es dato sensible (Ley 25.326 art. 7) y el
   *  consentimiento tiene que estar ANTES del tratamiento, no después. Guardar
   *  primero y preguntar al toque siguiente sería tratar sin permiso una vez. */
  requireConsent?: () => Promise<boolean>;
}

export function MoodCheckIn({ userId, todayEntry, onRequestAuth, onPicked, requireConsent }: Props) {
  const [selectedId, setSelectedId] = useState<MoodId | null>(null);

  const scales   = useRef(MOODS.map(() => new Animated.Value(1))).current;
  const opacities = useRef(MOODS.map(() => new Animated.Value(1))).current;

  const confirmOpacity = useRef(new Animated.Value(0)).current;
  const confirmY       = useRef(new Animated.Value(-4)).current;

  // Cuál se está sosteniendo ahora. Uno solo a la vez, así que alcanza un valor
  // animado compartido en vez de uno por ánimo.
  const [manteniendo, setManteniendo] = useState<MoodId | null>(null);
  const progreso = useRef(new Animated.Value(0)).current;
  // El `start` de una animación completada dispara su callback y DESPUÉS llega
  // el `onPressOut` del mismo gesto. Sin esta bandera, soltar el dedo después de
  // confirmar cancelaba lo recién confirmado.
  const confirmado = useRef(false);

  function completar(id: MoodId) {
    confirmado.current = true;
    setManteniendo(null);
    progreso.setValue(0);
    // Corta y sola: es un acuse de recibo, no una celebración.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    handlePress(id);
  }

  function empezarAMantener(id: MoodId) {
    confirmado.current = false;
    setManteniendo(id);
    progreso.setValue(0);
    Animated.timing(progreso, {
      toValue: 1,
      duration: HOLD_MS,
      // ⚠️ `useNativeDriver: false` obligado: lo que se anima es
      // `strokeDashoffset` de un SVG, que no existe en el hilo nativo. Es un
      // trazo de una sola figura chica durante 750ms, no un layout.
      useNativeDriver: false,
    }).start(({ finished }) => { if (finished) completar(id); });
  }

  function soltar() {
    if (confirmado.current) return;
    progreso.stopAnimation(() => {
      // Se desarma rápido en vez de saltar a cero: soltar antes de tiempo es
      // arrepentirse, y merece verse como que el anillo se vuelve.
      Animated.timing(progreso, { toValue: 0, duration: 90, useNativeDriver: false })
        .start(() => setManteniendo(null));
    });
  }

  // Preload from parent's history query
  useEffect(() => {
    if (!todayEntry) return;
    const id = todayEntry.mood_id as MoodId;
    setSelectedId(id);
    applyCircleAnimation(id);
    // Show confirmation without the intro animation (already saved)
    confirmOpacity.setValue(1);
    confirmY.setValue(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntry?.mood_id]);

  function applyCircleAnimation(id: MoodId) {
    Animated.parallel(
      MOODS.flatMap((m, i) => [
        Animated.spring(scales[i], {
          toValue: m.id === id ? 1.28 : 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 220,
        }),
        Animated.timing(opacities[i], {
          toValue: m.id === id ? 1 : 0.35,
          duration: 180,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }

  async function handlePress(id: MoodId) {
    if (!userId) { onRequestAuth(); return; }

    // Antes de la animación a propósito: si la persona dice que no, no tiene que
    // quedar una carita marcada como si algo se hubiera guardado.
    if (requireConsent && !(await requireConsent())) return;

    setSelectedId(id);
    applyCircleAnimation(id);

    // Animate confirmation microcopy in
    confirmOpacity.setValue(0);
    confirmY.setValue(-4);
    Animated.parallel([
      Animated.timing(confirmOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(confirmY,       { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();

    // Fecha LOCAL, no UTC. Con `toISOString()` el día saltaba a las 21:00
    // argentinas, así que dos check-ins del mismo lunes (20:00 y 22:00) se
    // guardaban con fechas distintas y el UNIQUE(user_id, entry_date) no los
    // dedupeaba — quedaban dos registros para un solo día del usuario.
    const today = localDayKey();
    const mood  = MOODS.find(m => m.id === id)!;

    // ANTES del upsert y sin esperar la red — Inicio necesita reaccionar en
    // el acto (Parte A: "actualizá inmediatamente la card persistente").
    // `todayEntry` es el prop de ANTES de este toque, así que "no había nada
    // todavía" es exactamente `!todayEntry`, sin necesitar otro estado.
    onPicked?.(
      { id, label: mood.label, color: ViveMoodColors[id] },
      { firstToday: !todayEntry },
    );

    await supabase.from('mood_entries').upsert(
      { user_id: userId, mood_id: id, mood_label: mood.label, entry_date: today },
      { onConflict: 'user_id,entry_date' },
    );
  }

  const activeMood = MOODS.find(m => m.id === selectedId);

  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>{formatTodayLabel()}</Text>

      <View style={s.row}>
        {/* Hairline de fondo conectando los círculos */}
        <View style={s.hairline} />

        {MOODS.map((m, i) => {
          const color = ViveMoodColors[m.id];
          const isSel = selectedId === m.id;
          return (
            <Pressable
              key={m.id}
              onPressIn={() => empezarAMantener(m.id)}
              onPressOut={soltar}
              // 🔴 Con lector de pantalla no hay "mantener": VoiceOver y
              // TalkBack mandan un toque, no un gesto sostenido. Sin esto, la
              // persona que usa un lector no podría hacer el check-in.
              onAccessibilityTap={() => completar(m.id)}
              accessibilityLabel={m.label}
              accessibilityHint="Mantené presionado para confirmar"
              accessibilityRole="radio"
              accessibilityState={{ selected: isSel }}
              style={s.moodItem}
            >
              <View style={s.circleWrap}>
                {manteniendo === m.id && (
                  <Svg width={ANILLO} height={ANILLO} style={s.anillo} pointerEvents="none">
                    {/* Arranca arriba (de ahí el -90) y se cierra en sentido
                        horario. `strokeDasharray` de una vuelta entera y el
                        offset yendo de una vuelta a cero: el trazo se dibuja. */}
                    <CirculoAnimado
                      cx={ANILLO / 2}
                      cy={ANILLO / 2}
                      r={R}
                      fill="none"
                      stroke={color}
                      strokeWidth={TRAZO}
                      strokeLinecap="round"
                      strokeDasharray={`${VUELTA} ${VUELTA}`}
                      strokeDashoffset={progreso.interpolate({
                        inputRange: [0, 1],
                        outputRange: [VUELTA, 0],
                      })}
                      transform={`rotate(-90 ${ANILLO / 2} ${ANILLO / 2})`}
                    />
                  </Svg>
                )}
                <Animated.View
                  style={[
                    s.circle,
                    { backgroundColor: color },
                    isSel && Platform.OS === 'ios' && {
                      shadowColor: color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.55,
                      shadowRadius: 5,
                    },
                    {
                      transform: [{ scale: scales[i] }],
                      opacity: opacities[i],
                    },
                  ]}
                />
              </View>
              <Animated.Text
                style={[
                  s.label,
                  isSel && s.labelSelected,
                  { opacity: opacities[i] },
                ]}
              >
                {m.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>

      {/* Microcopy de confirmación — altura reservada para no saltar el layout */}
      <Animated.Text
        style={[
          s.confirm,
          { opacity: confirmOpacity, transform: [{ translateY: confirmY }] },
        ]}
      >
        {activeMood
          ? `Registrado: ${activeMood.label.toLowerCase()} · gracias por contarnos`
          : ' '}
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: GLASS,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingTop: 13,
    paddingHorizontal: 16,
    paddingBottom: 11,
    ...Platform.select({
      ios:     { shadowColor: 'rgba(0,0,0,0.25)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  eyebrow: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10,
    letterSpacing: 0.3,
    color: '#C1694F',
    marginBottom: 9,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  hairline: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(86,94,50,0.14)',
  },
  moodItem: {
    alignItems: 'center',
    gap: 5,
    zIndex: 1,
    paddingHorizontal: 2,
  },
  // Mide lo mismo que el círculo para no mover el layout: el anillo va
  // absoluto por fuera, desbordando hacia los costados.
  circleWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anillo: {
    position: 'absolute',
    left: (24 - ANILLO) / 2,
    top: (24 - ANILLO) / 2,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  label: {
    fontFamily: ViveFonts.medium,
    fontSize: 9,
    color: '#4B5943',
  },
  labelSelected: {
    fontFamily: ViveFonts.semibold,
    color: '#2E3A2A',
  },
  confirm: {
    marginTop: 9,
    fontFamily: ViveFonts.feedback,
    fontSize: 11,
    color: '#4B5943',
    minHeight: 16,
  },
});
