import { useRef, useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';

import { ViveColors, ViveFonts, ViveMoodColors, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { VITA_TOOL_MAP } from '@/constants/vitaTools';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { ScaleCard } from '@/components/ScaleCard';
import { MoodCheckIn } from '@/components/MoodCheckIn';
import { useSobreVosMomento } from '@/context/SobreVosMomentoContext';
import { VitaWordmark } from '@/components/VitaWordmark';
import { VitaMark } from '@/components/VitaMark';
import { useAuth } from '@/context/AuthContext';
import { supabase, registrarEvento } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import type { MoodEntry } from '@/hooks/useMoodHistory';
import { computeMoodStreak, detectMoodDrop } from '@/lib/moodStats';
import { buildReflection, type Reflection } from '@/lib/weeklyReflection';
import { useDailyReflection } from '@/hooks/useDailyReflection';
import { localDayKey, localDayKeyMinus } from '@/lib/dates';
import { useWeeklySignals } from '@/hooks/useWeeklySignals';
import { shouldShowMoment } from '@/lib/sobreVosMomento';
import { getMomentPref, getLastShown, markMomentShown, getLastSpoken, markSpoken } from '@/lib/sobreVosMomentoStorage';
import { shouldStaySilent } from '@/lib/sobreVosSilencio';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Colores del mockup `sobre-vos-momento.html` — deliberadamente NO ViveColors,
// que son tonos parecidos pero no idénticos (terracota #C1694F vs #C06B4A del
// mockup). Fidelidad exacta al diseño, no al token más cercano.
const SELLO_TERRACOTTA = '#C06B4A';
const SELLO_FOREST     = '#3F512F';
const SELLO_INK        = '#2E3624';
const SELLO_CREAM      = '#F2ECDF';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
  return `${dayName} ${day} de ${MONTHS_ES[month - 1]}`;
}

function getGreeting(firstName: string | undefined): string {
  return firstName ? `¡Hola ${firstName}!` : '¡Hola!';
}

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';
const RESOURCE_ICON_COLOR = [ViveColors.primary, ViveColors.accent];
const RESOURCE_BUBBLE_BG  = ['rgba(232,116,59,0.18)', 'rgba(107,191,138,0.18)'];

type PinnedResource = { id: string; title: string; icon: string; route: string | undefined };

// `resources.type` — sistema viejo de recursos (/recurso)
const PINNED_TYPE_ICON: Record<string, string> = {
  audio: 'volume-high',
  guia_pasos: 'format-list-numbered',
  lectura_breve: 'book-open-variant',
};

// `coach_resources.format` — Recursos v2 (/coach-recurso)
const PINNED_FORMAT_ICON: Record<string, string> = {
  audio: 'volume-high',
  podcast: 'podcast',
  video: 'play-circle-outline',
  lectura: 'book-open-variant',
};

interface NextSession {
  id: string;
  coach_id: string;
  sala_id: string | null;
  date: string;
  time: string;
  coachName: string;
  coachSpecialty: string | null;
}

const fadeUp = (anim: Animated.Value) => ({
  opacity: anim,
  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
});

export default function InicioScreen() {
  const router = useRouter();
  const { user, requestAuth, displayName: nombrePerfil } = useAuth();
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [displayResources, setDisplayResources] = useState<PinnedResource[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // 37 días: los últimos 7 son "esta semana" y los 30 anteriores la base
  // histórica contra la que la devolución compara.
  const { entries: moodEntries } = useMoodHistory(user?.id, 37);
  // Fecha LOCAL, no UTC: con `toISOString()` el día saltaba a las 21:00, así
  // que después de esa hora `todayMoodEntry` buscaba la entrada de MAÑANA, no
  // la encontraba, y el check-in de hoy se veía como no hecho.
  const today = localDayKey();
  const todayMoodEntry = moodEntries.find(e => e.entry_date === today);
  // `useProgressStats` salió de esta pantalla junto con los tres números: eran
  // sus únicos consumidores acá. Son dos queries menos en la pantalla que más
  // se abre — el hook sigue vivo y lo usa `/progreso`, que es donde esos
  // números tienen lugar.
  const weekly = useWeeklySignals(user?.id);

  const recentCutoff = localDayKeyMinus(6);
  const recentMoodEntries = moodEntries.filter(e => e.entry_date >= recentCutoff);
  const historicMoodEntries = moodEntries.filter(e => e.entry_date < recentCutoff);
  const moodStreak = computeMoodStreak(moodEntries);

  // `sharpDrop` alimenta la señal `sharp-drop` de `buildReflection()` — cuando
  // el ánimo cayó fuerte hoy, la devolución baja el tono en vez de decir algo
  // liviano. Se calcula acá (no adentro del hook) porque también lo necesita
  // el recompute optimista de `handleMoodPicked`, más abajo.
  const sharpDrop = detectMoodDrop(moodEntries) !== null;

  // Las reglas eligen QUÉ decir y salen en el acto; si la redacción por IA está
  // encendida, el hook cambia solo el texto cuando llega. Nunca hay spinner:
  // la tarjeta arranca con el texto determinístico.
  const reflection = useDailyReflection(user?.id, {
    recentMoods: recentMoodEntries.map(e => e.mood_id),
    historicMoods: historicMoodEntries.map(e => e.mood_id),
    streak: moodStreak,
    resourcesThisWeek: weekly.resourcesThisWeek,
    sessionsThisWeek: weekly.sessionsThisWeek,
    writingThisWeek: weekly.writingThisWeek,
    sharpDrop,
    dayKey: today,
  });

  // ── "Sobre vos" — Parte A/B/C ────────────────────────────────────────────
  // `useMoodHistory` no se refresca solo tras guardar un check-in nuevo (fetch
  // único al montar), así que sin esto la card y el momento seguirían mirando
  // datos de ANTES del check-in que la persona recién hizo. `freshCheckIn`
  // guarda el resultado recalculado a mano con el pick ya adentro; una vez que
  // existe, manda sobre `reflection`/`todayMoodEntry` para el resto de la
  // sesión (hasta el próximo montaje, que sí trae todo fresco de la base).
  const [freshCheckIn, setFreshCheckIn] = useState<{ color: string; reflection: Reflection } | null>(null);
  // El momento vive fuera de Inicio (app/(tabs)/_layout.tsx, sibling de
  // <Tabs>) para poder sacarle el <Modal> propio — ver SobreVosMomentoContext.
  const { open: openMomento } = useSobreVosMomento();

  const cardMoodColor = freshCheckIn?.color ?? (todayMoodEntry ? ViveMoodColors[todayMoodEntry.mood_id] : null);
  const cardReflection = freshCheckIn?.reflection ?? reflection;

  // ── El silencio (§3.3) ───────────────────────────────────────────────────
  // Arranca en `false`: mientras no se sepa, la tarjeta habla. Al revés —
  // asumir silencio hasta que el storage conteste— la card parpadearía de
  // callada a hablando en cada montaje, que se ve peor que hablar de más.
  //
  // `markSpoken` corre SOLO cuando la tarjeta efectivamente va a hablar. De eso
  // depende que la regla alterne en vez de callarse para siempre: ver la nota en
  // `lib/sobreVosMomentoStorage.ts`.
  const [silent, setSilent] = useState(false);
  const cardSignal = cardReflection.signal;

  useEffect(() => {
    // Sin check-in de hoy la card está en su estado neutro ("Contame cómo
    // venís"), que es una invitación y no una devolución — eso no se calla
    // nunca, o la persona nueva se queda sin saber para qué está la tarjeta.
    if (!cardMoodColor) { setSilent(false); return; }

    let cancelled = false;
    (async () => {
      const lastSpoken = await getLastSpoken();
      if (cancelled) return;
      const callar = shouldStaySilent({ signal: cardSignal, lastSpoken, dayKey: today });
      setSilent(callar);
      if (!callar) await markSpoken(today, cardSignal);
    })();
    return () => { cancelled = true; };
  }, [cardSignal, cardMoodColor, today]);

  const handleMoodPicked = useCallback((
    mood: { id: number; label: string; color: string },
    opts: { firstToday: boolean },
  ) => {
    const optimisticToday: MoodEntry = {
      id: 'optimistic', mood_id: mood.id, mood_label: mood.label, entry_date: today,
    };
    const augmented = [optimisticToday, ...moodEntries.filter(e => e.entry_date !== today)];
    const augRecent = augmented.filter(e => e.entry_date >= recentCutoff);
    const augHistoric = augmented.filter(e => e.entry_date < recentCutoff);
    const freshReflection = buildReflection({
      recentMoods: augRecent.map(e => e.mood_id),
      historicMoods: augHistoric.map(e => e.mood_id),
      streak: computeMoodStreak(augmented),
      resourcesThisWeek: weekly.resourcesThisWeek,
      sessionsThisWeek: weekly.sessionsThisWeek,
      writingThisWeek: weekly.writingThisWeek,
      sharpDrop: detectMoodDrop(augmented) !== null,
      dayKey: today,
    });

    setFreshCheckIn({ color: mood.color, reflection: freshReflection });

    // Cambiaste el mood habiendo ya hecho el check-in hoy: la card se
    // actualiza (arriba), pero el momento es una sola vez por día — no
    // relanza.
    if (!opts.firstToday) return;

    setTimeout(async () => {
      const [prefEnabled, lastShown] = await Promise.all([getMomentPref(), getLastShown()]);
      if (!shouldShowMoment({ signal: freshReflection.signal, prefEnabled, lastShown })) return;
      openMomento(freshReflection, mood.color);
      markMomentShown(today, freshReflection.signal);
      registrarEvento('reflexion_vista', { origen: 'checkin' });
    }, 350);
  }, [moodEntries, today, recentCutoff, weekly.resourcesThisWeek, weekly.sessionsThisWeek, weekly.writingThisWeek, openMomento]);

  function handleReopenMomento() {
    if (!cardMoodColor) {
      Alert.alert('Elegí cómo venís hoy', 'Así vas a poder ver tu reflexión completa');
      return;
    }
    openMomento(cardReflection, cardMoodColor);
    registrarEvento('reflexion_vista', { origen: 'reapertura' });
  }

  const a1   = useRef(new Animated.Value(0)).current;
  const aMood = useRef(new Animated.Value(0)).current;
  const a2   = useRef(new Animated.Value(0)).current;
  const a3   = useRef(new Animated.Value(0)).current;
  const a4   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(a1,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(aMood, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a2,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a3,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(a4,    { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [a1, aMood, a2, a3, a4]);

  const fetchNotifCount = useCallback(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('read', false)
      .then(({ count }) => setUnreadNotifCount(count ?? 0));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifCount();
    const channel = supabase
      .channel(`notif-bell-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` }, fetchNotifCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifCount]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user]);

  useFocusEffect(useCallback(() => { fetchNotifCount(); }, [fetchNotifCount]));

  // Recarga en cada foco de la tab — así un pin hecho en otra pantalla se ve al volver
  useFocusEffect(
    useCallback(() => {
      if (!user) { setDisplayResources([]); return; }
      let active = true;
      (async () => {
        const { data: pins } = await supabase
          .from('pinned_resources')
          .select('resource_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!active) return;
        if (!pins || pins.length === 0) { setDisplayResources([]); return; }

        const ids = pins.map(p => p.resource_id as string);
        // Los ids de tools de VITA son slugs; los de recursos de coaches, uuids.
        // Esos uuids pueden ser de `resources` (sistema viejo, ficha /recurso) o
        // de `coach_resources` (Recursos v2, ficha /coach-recurso) — hay que
        // buscar en las dos, no se distinguen por la forma del id.
        const coachIds = ids.filter(id => !VITA_TOOL_MAP[id]);

        let coachById = new Map<string, PinnedResource>();
        if (coachIds.length > 0) {
          const [legacy, v2] = await Promise.all([
            supabase.from('resources')
              .select('id, type, title')
              .in('id', coachIds)
              .is('retired_at', null),
            supabase.from('coach_resources')
              .select('id, format, title')
              .in('id', coachIds)
              .eq('status', 'published'),
          ]);
          // v2 primero y legacy después: si un uuid apareciera en las dos (no
          // debería), gana el mapeo viejo, que es el que ya venía funcionando.
          for (const r of v2.data ?? []) {
            coachById.set(r.id as string, {
              id: r.id as string,
              title: r.title as string,
              icon: PINNED_FORMAT_ICON[r.format as string] ?? 'book-open-variant',
              route: `/coach-recurso?id=${r.id}`,
            });
          }
          for (const r of legacy.data ?? []) {
            coachById.set(r.id as string, {
              id: r.id as string,
              title: r.title as string,
              icon: PINNED_TYPE_ICON[r.type as string] ?? 'book-open-variant',
              route: `/recurso?id=${r.id}`,
            });
          }
        }

        if (!active) return;

        // preservar el orden de pineado (más reciente primero); saltear los retirados/borrados
        const mapped = ids.map(id => {
          const tool = VITA_TOOL_MAP[id];
          if (tool) return { id, title: tool.label, icon: tool.mdicon, route: tool.route };
          return coachById.get(id) ?? null;
        }).filter(Boolean) as PinnedResource[];

        setDisplayResources(mapped);
      })();
      return () => { active = false; };
    }, [user])
  );

  // 🔴 Esto era un `useEffect(…, [user])`: corría UNA sola vez, cuando el usuario
  // aparecía, y no volvía a correr nunca más. Reservabas una sesión, volvías a
  // Inicio y la tarjeta seguía mostrando lo de antes; el coach te confirmaba una
  // pendiente y acá no pasaba nada; cancelabas y la sesión cancelada se quedaba
  // en pantalla. Ahora recarga por las dos vías, que es el mismo par que ya usa
  // `app/(tabs)/_layout.tsx` para el puntito de la barra: **foco** (volvés a la
  // tab) y **realtime** (te cambian algo mientras estás parado acá). Ninguna de
  // las dos alcanza sola — el foco no se dispara si nunca te fuiste, y el
  // realtime no cubre lo que pasó con la app cerrada.
  const fetchNextSession = useCallback(async () => {
    if (!user) return;

    // ⚠️ `localDayKey()` y NO `toISOString()`. Con UTC, después de las 21:00 ART
    // "hoy" ya es mañana, así que el `.gte()` dejaba afuera las sesiones de esta
    // misma noche: la tarjeta desaparecía justo en el rato en que más importa.
    // Mismo error que documenta `lib/moodStats.ts:18`.
    const today = localDayKey();

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, coach_id, sala_id, scheduled_date, scheduled_time')
      .eq('user_id', user.id)
      .eq('status', 'confirmada')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      // Sin este segundo criterio, con dos sesiones el mismo día la "próxima"
      // salía a suerte del planner. Mismo orden que `SessionsScreen`.
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!booking) { setNextSession(null); return; }

    // bookings.coach_id → coaches.id (NO profiles.id — ver SCHEMA regla 2).
    // Join de dos pasos: coaches.id → coaches.profile_id → profiles.name.
    const { data: coachRow } = await supabase
      .from('coaches')
      .select('profile_id, specialty')
      .eq('id', booking.coach_id)
      .maybeSingle();

    const { data: profile } = coachRow?.profile_id
      ? await supabase.from('profiles').select('name').eq('id', coachRow.profile_id).maybeSingle()
      : { data: null };

    setNextSession({
      id: booking.id,
      // profiles.id (= salas.coach_id) para navegar a la sala, no coaches.id
      coach_id: coachRow?.profile_id ?? booking.coach_id,
      sala_id: booking.sala_id ?? null,
      date: booking.scheduled_date,
      time: booking.scheduled_time,
      coachName: profile?.name ?? 'Tu profesional',
      coachSpecialty: coachRow?.specialty ?? null,
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNextSession();
    // Sin filtro, igual que la suscripción a `bookings` de `(tabs)/_layout.tsx`:
    // el RLS ya limita las filas que llegan, y la de esta tabla mira `user_id`.
    const channel = supabase
      .channel(`home-next-session-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchNextSession)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNextSession]);

  useFocusEffect(useCallback(() => { fetchNextSession(); }, [fetchNextSession]));

  // `profiles.name` primero: es la fuente que ve el resto de la app y la única
  // que tiene el nombre de las cuentas de Apple (el id token no lo lleva). La
  // metadata queda de respaldo mientras el perfil no resolvió.
  const primerNombre = (nombrePerfil ?? user?.user_metadata?.name)?.split(' ')[0];
  // El prefijo del mail SOLO acá, no en el saludo: `getGreeting` sin nombre
  // saluda igual y bien, mientras que "Hola a1b2c3d4" (el mail de Hide My
  // Email de Apple) sería peor que no nombrar a nadie.
  const displayName = primerNombre ?? user?.email?.split('@')[0] ?? '';

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <FirstTimeTooltip
          storageKey="vive_tooltip_inicio"
          icon="home-outline"
          title="Tu espacio de inicio"
          description="Acá encontrás tu próxima sesión, recursos guardados y la recomendación del día"
          delay={800}
        />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. TOP BAR: logo + campana + avatar ── */}
          <Animated.View style={[s.topBar, fadeUp(a1)]}>
            <VitaWordmark />
            <View style={s.topRight}>
              <TouchableOpacity
                onPress={() => router.push('/notifications')}
                hitSlop={8}
                activeOpacity={0.8}
                style={s.bellBtn}
              >
                <MaterialCommunityIcons
                  name={unreadNotifCount > 0 ? 'bell' : 'bell-outline'}
                  size={22}
                  color="#3F512F"
                />
                {unreadNotifCount > 0 && <View style={s.bellDot} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/profile-own')}
                hitSlop={8}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatarCircle} />
                ) : (
                  <LinearGradient
                    colors={['#FF9A52', ViveColors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.avatarCircle}
                  >
                    <Text style={s.avatarInitial}>{(displayName.charAt(0) || '?').toUpperCase()}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* ── 2. SALUDO ── */}
          <Animated.View style={[s.greetingBlock, fadeUp(a1)]}>
            <Text style={s.greetingLine1}>{getGreeting(primerNombre)}</Text>
            <Text style={s.greetingLine2}>¿Cómo venís hoy?</Text>
          </Animated.View>

          {/* ── 3. MOOD CHECK-IN ── */}
          <Animated.View style={fadeUp(aMood)}>
            <MoodCheckIn
              userId={user?.id}
              todayEntry={todayMoodEntry}
              onRequestAuth={requestAuth}
              onPicked={handleMoodPicked}
            />
          </Animated.View>

          {/* ── 4. SOBRE VOS ── */}
          <Animated.View style={fadeUp(a2)}>
            <SobreVosCard reflection={cardReflection} moodColor={cardMoodColor} silent={silent} onPress={handleReopenMomento} />
          </Animated.View>

          {/* ── 5. TU PRÓXIMA SESIÓN ── */}
          <Animated.View style={fadeUp(a3)}>
            <View style={s.sessionHeaderRow}>
              <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Tu próxima sesión</Text>
              <TouchableOpacity onPress={() => router.push('/agenda')} hitSlop={8} activeOpacity={0.7}>
                <Text style={s.verTodasLink}>Ver todas</Text>
              </TouchableOpacity>
            </View>
            {nextSession ? (
              <SurfaceCard variant="elevated" backgroundColor={GLASS} borderRadius={18} style={s.sessionCardWrap}>
                <View style={s.sessionCardInner}>
                  <View style={s.sessionAvatar}>
                    <Text style={s.sessionAvatarText}>{nextSession.coachName[0]}</Text>
                  </View>
                  <View style={s.sessionInfo}>
                    <Text style={s.sessionName}>{nextSession.coachName}</Text>
                    {nextSession.coachSpecialty ? (
                      <Text style={s.sessionRole}>{nextSession.coachSpecialty}</Text>
                    ) : null}
                    <Text style={s.sessionSub}>
                      {formatSessionDate(nextSession.date)} · {nextSession.time.slice(0, 5)} hs
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.verSalaButton}
                    onPress={() => router.push({
                      pathname: '/sala',
                      params: nextSession.sala_id
                        ? { sala_id: nextSession.sala_id }
                        : { coach_id: nextSession.coach_id },
                    })}
                    activeOpacity={0.82}
                  >
                    <Text style={s.verSalaButtonText}>Ver sala</Text>
                  </TouchableOpacity>
                </View>
              </SurfaceCard>
            ) : (
              <TouchableOpacity
                style={s.noSessionCard}
                onPress={() => router.push('/(tabs)/conexiones')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="calendar-plus" size={22} color={ViveColors.primary} />
                <View style={s.noSessionInfo}>
                  <Text style={s.noSessionTitle}>Sin sesiones agendadas</Text>
                  <Text style={s.noSessionSub}>Reservá una sesión con tu profesional</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.45)" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* ── 6. TUS RECURSOS PINNEADOS ── */}
          <Animated.View style={fadeUp(a4)}>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Tus recursos a mano</Text>
            {displayResources.length === 0 ? (
              <TouchableOpacity
                style={s.pinnedEmpty}
                onPress={() => router.push('/(tabs)/recursos')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="pin-outline" size={22} color={ViveColors.primary} />
                <View style={s.pinnedEmptyText}>
                  <Text style={s.pinnedEmptyTitle}>Fijá tus recursos favoritos acá</Text>
                  <Text style={s.pinnedEmptySub}>Entrá a un recurso y tocá el marcador para tenerlo a mano (hasta 4)</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(135,131,92,0.45)" />
              </TouchableOpacity>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.resourcesRow}
              >
                {displayResources.map((r, i) => (
                  <ScaleCard
                    key={r.id}
                    style={s.resourceCard}
                    onPress={r.route ? () => router.push(r.route as any) : undefined}
                  >
                    <View style={[s.resourceIconCircle, { backgroundColor: RESOURCE_BUBBLE_BG[i % 2] }]}>
                      <MaterialCommunityIcons name={r.icon as any} size={22} color={RESOURCE_ICON_COLOR[i % 2]} />
                    </View>
                    <Text style={s.resourceLabel} numberOfLines={2}>{r.title}</Text>
                  </ScaleCard>
                ))}
              </ScrollView>
            )}
          </Animated.View>

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  container: {},

  // ── 1. Top bar ─────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 2,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bellBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E05252',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: ViveFonts.bold,
    fontSize: 17,
    color: '#FFFFFF',
  },

  // ── 2. Saludo ──────────────────────────────────────────────────────────────
  greetingBlock: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  greetingLine1: {
    fontFamily: ViveFonts.title,
    fontSize: 30,
    color: '#565E32',
    lineHeight: 38,
  },
  greetingLine2: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 28,
    color: '#565E32',
    lineHeight: 36,
  },
  // ── 3. Sobre vos — card "Sello" ────────────────────────────────────────────
  selloOuter: {
    marginHorizontal: 18,
    marginBottom: 22,
    marginTop: 10, // deja aire para que el sello sobresalga sin pisar lo de arriba
  },
  selloWrap: {},
  selloContent: {
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  // El día callado la card es más baja: sin frase de dos líneas ni CTA, el
  // padding de una card con texto la dejaría hueca.
  selloContentQuiet: {
    paddingTop: 26,
    paddingBottom: 20,
  },
  selloQuietMark: {
    alignItems: 'center',
  },
  selloReflect: {
    fontFamily: ViveFonts.feedback,
    fontSize: 15.5,
    lineHeight: 24,
    color: SELLO_INK,
    marginTop: 2,
  },
  selloReflectBold: {
    fontFamily: ViveFonts.title,
    color: SELLO_FOREST,
  },
  selloCta: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: SELLO_FOREST,
    marginTop: 5,
  },
  selloCtaUp: {
    color: SELLO_TERRACOTTA,
  },
  seal: {
    position: 'absolute',
    top: -16,
    left: 16,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 9,
    paddingRight: 12,
    borderWidth: 2,
    borderColor: SELLO_CREAM,
    shadowColor: '#2E261A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 4,
  },
  sealText: {
    fontFamily: ViveFonts.bold,
    fontSize: 11,
    color: '#FFF8EF',
  },

  // ── 4. Recursos útiles ─────────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.titleSemiBold,
    fontSize: 15,
    color: '#565E32',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleFlush: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  verTodasLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },
  resourcesRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 22,
  },
  resourceCard: {
    width: 130,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    minHeight: 110,
    justifyContent: 'center',
  },
  resourceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: '#565E32',
    textAlign: 'center',
    lineHeight: 17,
  },
  pinnedEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 18,
    marginBottom: 22,
    backgroundColor: GLASS,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pinnedEmptyText: { flex: 1, gap: 3 },
  pinnedEmptyTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
  pinnedEmptySub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 17,
  },

  // ── 7. Próxima sesión ──────────────────────────────────────────────────────
  sessionCardWrap: {
    marginHorizontal: 18,
    marginBottom: 0,
  },
  sessionCardInner: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionAvatarText: {
    fontFamily: ViveFonts.bold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  sessionInfo: { flex: 1 },
  sessionName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 20,
  },
  sessionRole: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    lineHeight: 17,
    marginTop: 1,
  },
  sessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.72)',
    lineHeight: 17,
    marginTop: 1,
  },
  verSalaButton: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  verSalaButtonText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#565E32',
  },

  // No session
  noSessionCard: {
    marginHorizontal: 18,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noSessionInfo: { flex: 1 },
  noSessionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    marginBottom: 2,
  },
  noSessionSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
  },

});

// ─── Sobre vos — la card "Sello" (Parte B) ──────────────────────────────────

/** La card persistente. El texto siempre sale de `buildReflection()` (el
 *  motor de Andre en lib/weeklyReflection.ts) — acá no hay una segunda fuente
 *  de frases. Lo que cambia según el estado es la presentación:
 *
 *  - Neutro (sin check-in hoy, `moodColor == null`): sello terracota con
 *    pulso, invitación a hacer el check-in.
 *  - Resuelto (con check-in hoy): sello y tinte de fondo con el color de ESE
 *    mood — el texto es el mismo que mostraría igual sin el rediseño.
 *
 *  - Callado (`silent`): hay check-in, pero hoy no hay nada nuevo que decir —
 *    ver `lib/sobreVosSilencio.ts` y `docs/la-voz-de-sofia.md` §3.3. La card
 *    sigue estando, con su sello y el color del mood, pero sin frase y sin CTA.
 *
 *  Toda la card es tocable → reabre el momento completo (SobreVosMomento).
 *  Salvo callada: ahí no hay nada que reabrir. */
function SobreVosCard({
  reflection,
  moodColor,
  silent,
  onPress,
}: {
  reflection: Reflection;
  moodColor: string | null;
  silent: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isNeutral = !moodColor;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isNeutral || reducedMotion) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.045, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,     duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isNeutral, reducedMotion, pulse]);

  const sealColor = isNeutral ? SELLO_TERRACOTTA : moodColor!;
  const tintColors: [string, string] = isNeutral
    ? ['rgba(196,181,140,0.20)', '#F7F2E7']
    : [hexToRgba(moodColor!, 0.16), '#F7F2E7'];

  const a11yLabel = isNeutral
    ? 'Contame cómo venís'
    : silent
      ? 'Sobre vos. Hoy sin novedades'
      : `${reflection.before}${reflection.bold}${reflection.after}`;

  return (
    <View style={s.selloOuter}>
      <SurfaceCard
        variant="elevated"
        tone="light"
        backgroundColor="#F7F2E7"
        borderRadius={20}
        grainOpacity={0.045}
        onPress={silent ? undefined : onPress}
        style={s.selloWrap}
      >
        <LinearGradient
          colors={tintColors}
          locations={[0, 0.6]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.65, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[s.selloContent, silent && s.selloContentQuiet]}
          accessible
          accessibilityRole={silent ? 'text' : 'button'}
          accessibilityLabel={a11yLabel}
          accessibilityHint={silent ? undefined : 'Abre tu reflexión completa'}
        >
          {silent ? (
            /* Sin frase y sin copy inventado a propósito: cualquier línea que
               pusiéramos acá volvería a ser una devolución, que es justo lo que
               el día callado no tiene. La marca al 22% ocupa el lugar del texto
               para que se lea como "hoy no hay nada" y no como "esto se rompió". */
            <View style={s.selloQuietMark}>
              <VitaMark size={20} color={hexToRgba(SELLO_FOREST, 0.22)} strokeWidth={6} />
            </View>
          ) : isNeutral ? (
            <>
              <Text style={s.selloReflect}>Contame cómo venís</Text>
              <Text style={[s.selloCta, s.selloCtaUp]}>↑ Tocá un mood arriba</Text>
            </>
          ) : (
            <>
              <Text style={s.selloReflect}>
                {reflection.before}
                <Text style={s.selloReflectBold}>{reflection.bold}</Text>
                {reflection.after}
              </Text>
              <Text style={s.selloCta}>→ Ver más</Text>
            </>
          )}
        </View>
      </SurfaceCard>

      {/* Fuera de SurfaceCard a propósito: su contenido va con overflow
          hidden (para el grano/gradiente), y el sello está diseñado para
          sobresalir por encima del borde superior de la card. */}
      <Animated.View style={[s.seal, { backgroundColor: sealColor, transform: [{ scale: pulse }] }]}>
        <VitaMark size={13} color="#FFF8EF" strokeWidth={9} />
        <Text style={s.sealText}>Sobre vos</Text>
      </Animated.View>
    </View>
  );
}
