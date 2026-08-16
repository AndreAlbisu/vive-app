import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
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
}

export function MoodCheckIn({ userId, todayEntry, onRequestAuth, onPicked }: Props) {
  const [selectedId, setSelectedId] = useState<MoodId | null>(null);

  const scales   = useRef(MOODS.map(() => new Animated.Value(1))).current;
  const opacities = useRef(MOODS.map(() => new Animated.Value(1))).current;

  const confirmOpacity = useRef(new Animated.Value(0)).current;
  const confirmY       = useRef(new Animated.Value(-4)).current;

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
              onPress={() => handlePress(m.id)}
              accessibilityLabel={m.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSel }}
              style={s.moodItem}
            >
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
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: '#4B5943',
    minHeight: 16,
  },
});
