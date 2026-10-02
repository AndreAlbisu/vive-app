import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { EjeIcon } from '@/components/EjeIcon';
import { MatriculaPill } from '@/components/MatriculaPill';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
import { prefetchCoaches, getCoachesCache, getCoachesStatus, CachedCoach } from '@/lib/coachesCache';
import { lineaProximoLugar } from '@/lib/perfilProfesional';
import { useBlockedFilter } from '@/hooks/useBlockedFilter';
import { altoDeEje } from '@/lib/ejesLayout';
import { DOORS, coachesForDoor, EJES, EJE_MAP, doorsForEje } from '@/constants/conexionesDoors';
import { rankDeck, type DeckSlotKey } from '@/lib/coachDeckRanking';
import { anotarSensible } from '@/lib/analytics';
import { leerRespuestasGuardadas } from '@/lib/quizPendiente';
import { evaluarParaMazo, topeDeRango, monedaDePresupuesto, type RespuestasQuiz } from '@/lib/quizMatch';
import { QUIZ_AREAS } from '@/constants/searchData';
import { etiquetaProfesionalPublica } from '@/lib/tipoProfesional';

// ─── Paleta (refleja el HTML de referencia) ──────────────────────────────────
const FOREST      = '#3F512F';
const FOREST_SOFT = '#566245';
const INK         = '#2E3624';
const CARD        = '#F7F2E7';
const TERRACOTTA  = '#C06B4A';
const TC_SOFT     = '#EAD3C6';
const STAR        = '#C99A3F';
const LINE        = 'rgba(63,81,47,0.14)';
// Las cuatro categorías comparten composición; borde, acento y etiqueta
// distinguen el motivo sin convertir toda la tarjeta en un bloque de color.
const CARD_SLOT_STYLES: Record<DeckSlotKey, { border: string; badge: string; badgeText: string; badgeBorder: string }> = {
  recomendado: { border: '#C26E50', badge: '#F6E1D7', badgeText: '#9C5237', badgeBorder: '#EBCABB' },
  tendencia:   { border: '#BB923E', badge: '#F6ECD1', badgeText: '#856723', badgeBorder: '#E9D8B0' },
  nuevo:       { border: '#94B470', badge: '#EAF3DE', badgeText: '#557B44', badgeBorder: '#D6E8C7' },
  economico:   { border: '#30462F', badge: FOREST,  badgeText: '#FFF9ED', badgeBorder: FOREST },
};

const SCREEN_W = Dimensions.get('window').width;
const CARD_HERO_HEIGHT = Math.min(260, Math.max(198, SCREEN_W * 0.62));

// Feature flag temporal: ocultar la card de reagendar en el menú (pedido Andre).
// Poner en true para volver a mostrarla.
const SHOW_REBOOK: boolean = false;

// Tinte suave desde un hex de eje (para círculos del menú + banda del deck).
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Re-book ─────────────────────────────────────────────────────────────────
type RebookData = {
  coachProfileId: string;
  name: string;
  specialty: string;
  pricePerSession: number;
  avatarUrl: string | null;
  lastDate: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Normaliza para búsqueda tolerante: sin acentos, minúsculas, sin espacios al borde.
// Así "gonzalez" encuentra "González" (el "o cerca" del pedido).
function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function getInitials(name: string) {
  const p = (name ?? '').trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] ?? '?').toUpperCase();
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Las "fases" de Conexiones (Ejes → Puertas/temas → Deck) son un swap de estado
// dentro de la misma pantalla, no una navegación real — así que no reciben gratis
// el slide nativo de iOS que sí tiene cualquier `router.push` del resto de la app.
// Se remonta con cada `key` distinto (recibido desde afuera) y anima una sola vez
// al montarse: fundido + deslizamiento leve desde la derecha, imitando ese push.
function SlideInView({ children, style }: { children: React.ReactNode; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [anim]);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function ConexionesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, requestAuth } = useAuth();
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);

  const [selectedAxisId, setSelectedAxisId] = useState<string | null>(null);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [deckIndex, setDeckIndex]           = useState(0);
  const [rawCoaches, setCoaches]        = useState<CachedCoach[]>([]);
  const coaches                         = useBlockedFilter(rawCoaches);
  const [coachQuery, setCoachQuery]     = useState('');
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  // La carga del catálogo falló (sin conexión). No es "no hay profesionales".
  const [coachesError, setCoachesError] = useState(false);
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);
  const [rebookData, setRebookData]     = useState<RebookData | null>(null);

  // ── Llegar desde el onboarding ────────────────────────────────────────────
  // El final del onboarding manda acá con la puerta de lo que la persona acaba
  // de contar (`lib/onboardingRespuestas.ts` → `CATEGORIA_A_PUERTA`).
  //
  // 🔴 Abre el MENÚ de su eje con su tema destacado, NO el deck de esa puerta.
  // La primera versión abría el deck y Andre lo frenó: se sentía forzado, y
  // tenía razón. El perfil para el que existe este camino es "el que tiene un
  // problema y no sabe qué necesita" — no saber qué necesitás no es estar listo
  // para pagarle a alguien, y ponerle un mazo de personas adelante a los
  // sesenta segundos de abrir la app colapsa las dos cosas. Acá ve que hay
  // gente de lo suyo, pero elige ella si entra.
  //
  // 🔴 Se aplica UNA SOLA VEZ. El parámetro se queda pegado a la ruta del tab
  // después de navegar, así que sin el ref cada vuelta al tab —o cada
  // `backToAxes`— volvería a abrir el eje solo y no habría forma de salir de él.
  // `eje` lo manda el onboarding desde el 12/09/2026; `puerta` queda para los
  // links viejos y para cuando algo quiera abrir un tema puntual.
  const { puerta, eje: ejeParam } = useLocalSearchParams<{ puerta?: string; eje?: string }>();
  const puertaAplicada = useRef(false);
  // La puerta que el onboarding sugiere. Solo destaca una fila del menú: no
  // filtra, no reordena y no navega.
  const [puertaSugerida, setPuertaSugerida] = useState<string | null>(null);

  // Lo que la persona respondió en el quiz, si lo hizo (21/09/2026). Se relee
  // al volver a la pantalla: quien sale del quiz y vuelve tiene que ver el
  // mazo ya ajustado, sin reabrir la app.
  const [respuestasQuiz, setRespuestasQuiz] = useState<RespuestasQuiz | null>(null);
  const [quizRespondidoEn, setQuizRespondidoEn] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let cancelado = false;
    leerRespuestasGuardadas()
      .then(r => {
        if (cancelado) return;
        setQuizRespondidoEn(r?.respondidoEn ?? null);
        if (!r) { setRespuestasQuiz(null); return; }
        setRespuestasQuiz({
          tema: null,
          areas: (r.areas ?? (r.topic ? [r.topic] : [])) as string[],
          subtemas: (r.subtemas ?? []) as string[],
          tipo: r.professionalType ?? null,
          presupuesto: null,
          // Si paga solo en dólares, el tope que vale es el de dólares.
          ...(monedaDePresupuesto(r.pagos) === 'USD'
            ? { presupuestoMax: typeof r.budgetMaxUsd === 'number' ? r.budgetMaxUsd : null, presupuestoMoneda: 'USD' as const }
            : { presupuestoMax: typeof r.budgetMax === 'number' ? r.budgetMax : topeDeRango(r.budget) }),
          estilo: (r.estilo ?? null) as RespuestasQuiz['estilo'],
          guia: (r.guia ?? null) as RespuestasQuiz['guia'],
          foco: (r.foco ?? null) as RespuestasQuiz['foco'],
          genero: (r.generoPref ?? null) as RespuestasQuiz['genero'],
          pagos: r.pagos ?? null,
        });
      })
      .catch(() => { /* sin quiz, el mazo sortea como siempre */ });
    return () => { cancelado = true; };
  }, []));

  // Los temas por los que ya reservó, para dejar de marcar el del quiz.
  const [reservasPorTema, setReservasPorTema] = useState<{ tema_origen: string; created_at: string }[]>([]);
  useFocusEffect(useCallback(() => {
    if (!user?.id) { setReservasPorTema([]); return; }
    let cancelado = false;
    supabase
      .from('bookings')
      .select('tema_origen, created_at')
      .eq('user_id', user.id)
      .eq('payment_status', 'aprobado')
      .neq('status', 'cancelada')
      .not('tema_origen', 'is', null)
      .then(({ data }) => { if (!cancelado) setReservasPorTema(data ?? []); });
    return () => { cancelado = true; };
  }, [user?.id]));

  // El quiz sugiere el tema: la puerta con más temas en común con lo que eligió.
  //
  // 🔴 SOLO la marca, no la abre. Hasta el 24/09/2026 abría sola el eje cada vez
  // que se entraba a la pestaña, y a Andre no le gustó: la pantalla arranca
  // siempre en las tres áreas, con el eje y el tema del quiz marcados.
  //
  // 📌 La marca dura hasta que reserva por ese tema (una reserva pagada y no
  // cancelada, hecha después del quiz). Sin esto quedaba para siempre, aunque ya
  // hubiera encontrado a alguien y ahora buscara otra cosa. Si la reserva se
  // cancela, o vuelve a hacer el quiz, la marca vuelve.
  const puertaQuiz = useMemo(() => {
    if (!respuestasQuiz) return null;
    const buscados = respuestasQuiz.subtemas && respuestasQuiz.subtemas.length > 0
      ? respuestasQuiz.subtemas
      : QUIZ_AREAS.filter(a => (respuestasQuiz.areas ?? []).includes(a.id)).flatMap(a => a.subtemas);
    let mejor: (typeof DOORS)[number] | null = null;
    let max = 0;
    for (const d of DOORS) {
      const n = d.subtemas.filter(t => buscados.includes(t)).length;
      if (n > max) { max = n; mejor = d; }
    }
    if (!mejor) return null;
    const desde = quizRespondidoEn ? Date.parse(quizRespondidoEn) : NaN;
    const yaReservo = reservasPorTema.some(r =>
      r.tema_origen === mejor!.label && !(Date.parse(r.created_at) < desde));
    return yaReservo ? null : mejor.id;
  }, [respuestasQuiz, quizRespondidoEn, reservasPorTema]);

  // La del onboarding manda sobre la del quiz: es lo que acaba de contar.
  const puertaDestacada = puertaSugerida ?? puertaQuiz;
  const origenSugerencia = puertaSugerida ? 'onboarding' : puertaQuiz ? 'quiz' : null;
  const ejeDestacado = useMemo(() => {
    const door = DOORS.find(d => d.id === puertaDestacada);
    return door ? EJES.find(e => e.color === door.color)?.id ?? null : null;
  }, [puertaDestacada]);

  // ── Cache poll ────────────────────────────────────────────────────────────
  useEffect(() => {
    prefetchCoaches(intentoCatalogo > 0);
    let t: ReturnType<typeof setInterval>;
    const check = () => {
      const c = getCoachesCache();
      if (c) { setCoaches(c); setLoadingCoaches(false); setCoachesError(false); clearInterval(t); return; }
      // Sin conexión: se avisa, y el poll sigue reintentando cada 5 s
      // (`prefetchCoaches` se encarga de espaciarlo) hasta que vuelva la red.
      if (getCoachesStatus() === 'error') { setCoachesError(true); setLoadingCoaches(false); }
      prefetchCoaches();
    };
    check();
    t = setInterval(check, 80);
    return () => clearInterval(t);
  }, [intentoCatalogo]);

  const reintentarCatalogo = () => {
    setCoachesError(false);
    setLoadingCoaches(true);
    setIntentoCatalogo(n => n + 1);
  };

  // Llega del onboarding con el eje que la persona acaba de contar: se abre su
  // menú, sin destacar ninguna puerta. No filtra ni elige por ella — eso lo
  // decide la persona, que es lo que se quiso desde que se frenó la versión que
  // abría el mazo de gente a los sesenta segundos.
  useEffect(() => {
    if (!ejeParam || puertaAplicada.current) return;
    puertaAplicada.current = true;
    if (EJE_MAP[ejeParam]) setSelectedAxisId(ejeParam);
  }, [ejeParam]);

  useEffect(() => {
    if (!puerta || puertaAplicada.current) return;
    const door = DOORS.find(d => d.id === puerta);
    // ⚠️ Un id que no existe se ignora en silencio y la pantalla queda en el
    // menú, que es su estado normal. Marcamos igual como aplicado: reintentar
    // con un id inválido no lo va a volver válido.
    puertaAplicada.current = true;
    if (!door) return;
    const eje = EJES.find(e => e.color === door.color);
    if (!eje) return;
    setSelectedAxisId(eje.id);
    setPuertaSugerida(door.id);
  }, [puerta]);

  // ── Re-book query ─────────────────────────────────────────────────────────
  const loadRebook = useCallback(async () => {
    if (!user?.id) { setRebookData(null); return; }
    const today = new Date().toISOString().split('T')[0];

    const { data: last } = await supabase
      .from('bookings')
      .select('coach_id, scheduled_date, coach_name, coach_specialty')
      .eq('user_id', user.id)
      .or(`status.eq.completada,and(status.eq.confirmada,scheduled_date.lt.${today})`)
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!last?.coach_id) { setRebookData(null); return; }

    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('coach_id', last.coach_id)
      .in('status', ['pendiente', 'confirmada'])
      .gte('scheduled_date', today);

    if ((count ?? 0) > 0) { setRebookData(null); return; }

    const { data: coachRow } = await supabase
      .from('coaches')
      .select('specialty, profesion, price_per_session, profile_id')
      .eq('id', last.coach_id)
      .eq('availability_status', 'activo')
      .single();

    if (!coachRow) { setRebookData(null); return; }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', coachRow.profile_id)
      .single();

    setRebookData({
      coachProfileId: coachRow.profile_id as string,
      name:           (profileRow?.name || (last.coach_name as string) || '') as string,
      specialty:      etiquetaProfesionalPublica(coachRow),
      pricePerSession: coachRow.price_per_session as number,
      avatarUrl:      (profileRow?.avatar_url ?? null) as string | null,
      lastDate:       (last.scheduled_date as string) ?? null,
    });
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadRebook(); }, [loadRebook]));

  // ── Selección eje / puerta ──────────────────────────────────────────────────
  const selectedAxis = selectedAxisId ? EJE_MAP[selectedAxisId] ?? null : null;

  // Búsqueda en vivo por nombre (sobre el cache ya cargado; sin tocar la base).
  const coachResults = useMemo(() => {
    const q = normalizeName(coachQuery);
    if (!q) return [];
    return coaches.filter(c => normalizeName(c.name).includes(q)).slice(0, 20);
  }, [coachQuery, coaches]);
  const selectedDoor = selectedDoorId ? DOORS.find(d => d.id === selectedDoorId) ?? null : null;
  const deck = useMemo(
    () => (selectedDoor
      ? rankDeck(
          coachesForDoor(selectedDoor, coaches),
          user?.id,
          undefined,
          // Con quiz, cada tarjeta sortea primero entre los que encajan con lo
          // que respondió (ver `evaluarParaMazo`). Sin quiz, como siempre.
          respuestasQuiz ? c => evaluarParaMazo(c, respuestasQuiz, selectedDoor.subtemas) : undefined,
        )
      : []),
    [selectedDoor, coaches, user?.id, respuestasQuiz],
  );
  // La disponibilidad "esta semana" ahora viene en el cache (`hasSlotThisWeek`,
  // poblado en coachesCache contra la misma vista), así que se fue el fetch
  // aparte que se disparaba con cada cambio de deck.

  // ── Navegación ────────────────────────────────────────────────────────────
  function goToPerfil(coach: CachedCoach) {
    router.push({
      pathname: '/profesional',
      params: {
        profileId: coach.id,
        name: coach.name,
        specialty: coach.specialty,
        priceFrom: String(coach.priceFrom),
        // La puerta por la que entró viaja con la reserva hasta el profesional.
        // Acá es inequívoca: el deck se armó con ESTA puerta y ninguna otra.
        ...(selectedDoor && { tema: selectedDoor.label }),
      },
    });
  }

  function toggleFav(profileId: string) {
    if (!user) { requestAuth('contactar_profesional'); return; }
    toggleFavorite(profileId);
  }

  function goRebook() {
    if (!rebookData) return;
    router.push({
      pathname: '/booking-calendar',
      params: {
        coachId:   rebookData.coachProfileId,
        name:      rebookData.name,
        specialty: rebookData.specialty,
        priceFrom: String(rebookData.pricePerSession),
      },
    });
  }

  function selectAxis(id: string) {
    setSelectedAxisId(id);
  }
  function backToAxes() {
    setSelectedAxisId(null);
  }
  function openDoor(id: string) {
    // 🔴 Es la medición que cierra el círculo del onboarding: comparar la puerta
    // que le SUGERIMOS con la que abre de verdad. Si la mayoría abre otra, el
    // mapa `CATEGORIA_A_PUERTA` está mal y esto lo dice sin que haya que
    // adivinarlo. `sugerida` es null cuando no vino del onboarding.
    // ⚠️ El tema que alguien abre ("Ansiedad") es dato de salud: sin
    // consentimiento va sin `puerta`. `sugerida` sí viaja, no dice cuál
    // (auditoría 26/09).
    anotarSensible('conexiones_puerta_abierta', {
      puerta: id,
      sugerida: puertaDestacada ? id === puertaDestacada : null,
      desde_onboarding: origenSugerencia === 'onboarding',
      desde_quiz: origenSugerencia === 'quiz',
    }, ['puerta']);

    // Aseguro que el eje quede fijado (por si se abre desde los chips del deck).
    const door = DOORS.find(d => d.id === id);
    const eje = EJES.find(e => door && e.color === door.color);
    if (eje) setSelectedAxisId(eje.id);
    setSelectedDoorId(id);
    setDeckIndex(0);
  }
  function backToMenu() {
    // Vuelve a los temas del eje (fase 2), no a los ejes.
    setSelectedDoorId(null);
    setDeckIndex(0);
  }
  function verTodosEnPuerta() {
    if (!selectedDoor) return;
    router.push({
      pathname: '/search3',
      params: { topic: selectedDoor.subtemas.join(','), label: selectedDoor.label },
    });
  }

  // ═══ Vista DECK (una puerta elegida) ═══════════════════════════════════════
  if (selectedDoor) {
    return (
      <AppBg>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={s.safe} edges={['top']}>
          <SlideInView key={selectedDoorId} style={s.slideFill}>
          <ScrollView
            style={s.screen}
            contentContainerStyle={s.screenContent}
            showsVerticalScrollIndicator={false}>

            {/* Header con volver */}
            <View style={s.deckHeader}>
              <TouchableOpacity onPress={backToMenu} hitSlop={10} activeOpacity={0.7} style={s.backBtn}>
                <Feather name="chevron-left" size={26} color={FOREST} />
              </TouchableOpacity>
              <Text style={s.deckHeaderTitle}>Profesionales</Text>
              <View style={s.hicons}>
                <TouchableOpacity onPress={() => (user ? router.push('/favoritos') : requestAuth('ver_favoritos'))} activeOpacity={0.7} hitSlop={8}>
                  <Feather name="star" size={20} color={FOREST} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Chips deslizables de temas — solo los del eje actual */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.themeChipsRow}>
              {DOORS.filter(d => d.color === selectedDoor.color).map(d => {
                const active = d.id === selectedDoorId;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      s.themeChip,
                      active ? { backgroundColor: d.color, borderColor: d.color } : { borderColor: tint(d.color, 0.28) },
                    ]}
                    onPress={() => openDoor(d.id)}
                    activeOpacity={0.85}>
                    <Feather name={d.icon as any} size={13} color={active ? '#F7EFE4' : d.color} />
                    <Text style={[s.themeChipText, active && s.themeChipTextActive]} numberOfLines={1}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Deck — carrusel paginado (swipe izq/der) */}
            {loadingCoaches ? (
              <ActivityIndicator size="small" color={FOREST} style={{ marginTop: 40 }} />
            ) : coachesError ? (
              <View style={s.deckClose}>
                <Feather name="wifi-off" size={22} color={FOREST_SOFT} />
                <Text style={s.deckCloseTitle}>No pudimos cargar a los profesionales</Text>
                <Text style={s.deckCloseSub}>Revisá la conexión. Lo volvemos a intentar solos, o tocá para probar ahora.</Text>
                <TouchableOpacity onPress={reintentarCatalogo} hitSlop={10} activeOpacity={0.7} accessibilityRole="button">
                  <Text style={s.reintentar}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : deck.length === 0 ? (
              <View style={s.deckClose}>
                <Feather name="search" size={22} color={FOREST_SOFT} />
                <Text style={s.deckCloseTitle}>Todavía no hay profesionales en {selectedDoor.label.toLowerCase()}</Text>
                <Text style={s.deckCloseSub}>Probá con otro tema, o hacé el quiz para una sugerencia</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  key={selectedDoorId}
                  horizontal
                  pagingEnabled
                  style={s.deckScroll}
                  showsHorizontalScrollIndicator={false}
                  onScrollBeginDrag={() => navigation.setOptions({ swipeEnabled: false })}
                  onScrollEndDrag={() => navigation.setOptions({ swipeEnabled: true })}
                  onMomentumScrollEnd={e => {
                    navigation.setOptions({ swipeEnabled: true });
                    setDeckIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
                  }}
                  scrollEventThrottle={16}>
                  {deck.map((entry) => {
                    const { coach, slot, motivo } = entry;
                    const isFav = favoriteIds.has(coach.id);
                    const reason = CARD_SLOT_STYLES[slot.key];
                    const paymentMethods = [
                      coach.acceptsMp && 'Mercado Pago',
                      coach.acceptsPaypal && 'PayPal',
                      coach.acceptsUsdt && 'USDT',
                    ].filter(Boolean).join('  ·  ');
                    return (
                      <View key={coach.id} style={s.cardPage}>
                        <View style={s.cardShadow}>
                          <View style={[s.cardSurface, { borderColor: reason.border }]}>
                            <View style={[s.cardHero, { height: CARD_HERO_HEIGHT }]}>
                              {coach.avatarUrl ? (
                                <Image source={{ uri: coach.avatarUrl }} style={s.cardHeroImage} resizeMode="cover" />
                              ) : (
                                <LinearGradient colors={['#D8DCC8', '#F2DCCE']} style={s.cardHeroFallback}>
                                  <Text style={s.cardInitials}>{getInitials(coach.name)}</Text>
                                </LinearGradient>
                              )}
                              <TouchableOpacity
                                onPress={() => toggleFav(coach.id)}
                                hitSlop={8}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                style={s.cardFavorite}>
                                <Feather name="star" size={20} color={isFav ? TERRACOTTA : FOREST} />
                              </TouchableOpacity>
                            </View>
                          <View style={s.cardBody}>
                            <View style={s.cardNameRow}>
                              <Text style={s.cardName} numberOfLines={1} adjustsFontSizeToFit>{coach.name}</Text>
                              {coach.verified && <Feather name="check-circle" size={15} color={FOREST} />}
                              {coach.hasMatricula && <MatriculaPill compact />}
                            </View>
                            <Text style={s.cardMeta} numberOfLines={1}>
                              {coach.specialty}
                              {(coach.reviewCount ?? 0) >= 1 ? (
                                <Text>
                                  {'  ·  '}
                                  <Text style={{ color: STAR }}>★ </Text>
                                  {(coach.avgRating ?? 0).toFixed(1)}
                                </Text>
                              ) : (
                                '  ·  Sin reseñas todavía'
                              )}
                            </Text>

                            <View style={[s.reasonPill, { backgroundColor: reason.badge, borderColor: reason.badgeBorder }]}>
                              <Feather name={slot.icon as any} size={12} color={reason.badgeText} />
                              <Text style={[s.reasonText, { color: reason.badgeText }]}>{slot.label}</Text>
                            </View>

                            {!!coach.bio?.trim() && (
                              <View style={[s.cardBioWrap, { borderLeftColor: reason.border }]}>
                                <Text style={s.cardBio} numberOfLines={2}>“{coach.bio.trim()}”</Text>
                              </View>
                            )}

                            {!!motivo && (
                              <View style={s.motivoRow}>
                                <Feather name="check" size={12} color={FOREST} />
                                <Text style={s.motivoText} numberOfLines={2}>{motivo}</Text>
                              </View>
                            )}

                            {/* Mismo texto que el perfil ("Próximo turno: mañana, 18:00").
                                Solo si tiene uno en los próximos 7 días: sin turno
                                pronto no se dice nada, no es una falta. */}
                            {!!coach.proximoTurno && (
                              <View style={s.motivoRow}>
                                <Feather name="clock" size={12} color={FOREST} />
                                <Text style={s.motivoText} numberOfLines={1}>
                                  {lineaProximoLugar(coach.proximoTurno.fecha, coach.proximoTurno.hora).texto}
                                </Text>
                              </View>
                            )}

                            {!!paymentMethods && <Text style={s.cardPayments} numberOfLines={1}>{paymentMethods}</Text>}

                            <TouchableOpacity
                              style={s.knowBtn}
                              onPress={() => goToPerfil(coach)}
                              activeOpacity={0.75}
                              accessibilityRole="button">
                              <Text style={s.knowText}>Ver perfil</Text>
                              <Feather name="arrow-right" size={17} color="#FFF9ED" />
                            </TouchableOpacity>
                          </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Dots */}
                {deck.length > 1 && (
                  <View style={s.dotsRow}>
                    {deck.map((e, i) => (
                      <View key={e.coach.id} style={[s.dot, i === deckIndex && s.dotActive, i === deckIndex && { backgroundColor: CARD_SLOT_STYLES[e.slot.key].border }]} />
                    ))}
                  </View>
                )}

                <TouchableOpacity onPress={verTodosEnPuerta} activeOpacity={0.7} style={s.verListaBtn}>
                  <Text style={s.verListaText}>Ver lista completa</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
          </ScrollView>
          </SlideInView>
        </SafeAreaView>
      </AppBg>
    );
  }

  // ═══ Vista MENÚ (ninguna puerta elegida) ═══════════════════════════════════
  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <FirstTimeTooltip
          storageKey="vive_tooltip_conexiones"
          icon="account-group-outline"
          iconColor={FOREST_SOFT}
          title="Encontrá a tu guía"
          description="Elegí un tema y te presento a los profesionales indicados. Lo cambiás cuando quieras"
          delay={800}
        />

        <ScrollView
          style={s.screen}
          contentContainerStyle={s.screenContent}
          showsVerticalScrollIndicator={false}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={s.header}>
            <Text style={s.title}>Profesionales</Text>
            <View style={s.hicons}>
              <TouchableOpacity
                onPress={() => (user ? router.push('/favoritos') : requestAuth('ver_favoritos'))}
                activeOpacity={0.7}
                hitSlop={8}>
                <Feather name="star" size={22} color={FOREST} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Re-book card (condicional) — OCULTA por ahora (pedido Andre) ─ */}
          {SHOW_REBOOK && rebookData && (
            <View style={s.rebook}>
              {rebookData.avatarUrl ? (
                <Image source={{ uri: rebookData.avatarUrl }} style={s.rebookAvatar} />
              ) : (
                <View style={[s.rebookAvatar, s.rebookAvatarFallback]}>
                  <Text style={s.rebookInitials}>{getInitials(rebookData.name)}</Text>
                </View>
              )}
              <View style={s.rebookText}>
                <Text style={s.rebookTitle} numberOfLines={1}>
                  ¿Otra sesión con {rebookData.name.split(' ')[0]}?
                </Text>
                {rebookData.lastDate && (
                  <Text style={s.rebookSub}>Tu última fue el {formatShortDate(rebookData.lastDate)}</Text>
                )}
              </View>
              <TouchableOpacity style={s.rebookCta} onPress={goRebook} activeOpacity={0.85}>
                <Text style={s.rebookCtaText}>Reservar</Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedAxis ? (
            /* ── Fase 2: temas del eje ──────────────────────────────────── */
            <SlideInView key={selectedAxis.id}>
              <TouchableOpacity onPress={backToAxes} activeOpacity={0.7} hitSlop={8} style={s.menuBackRow}>
                <Feather name="chevron-left" size={18} color={FOREST_SOFT} />
                <Text style={s.menuBackText}>Áreas de bienestar</Text>
              </TouchableOpacity>

              <View style={s.askWrap}>
                <Text style={s.askTitle}>{selectedAxis.label}</Text>
                <Text style={s.askSub}>
                  {puertaDestacada && ejeDestacado === selectedAxis.id
                    ? 'Por lo que contaste, empezaría por el tema destacado, pero elegí el que quieras'
                    : 'Elegí un tema y te presento a los profesionales indicados'}
                </Text>
              </View>

              {/* Una sola tarjeta con los temas adentro, no una tarjeta por tema.
                  El eje mental tiene 6: seis tarjetas con sombra son seis objetos
                  flotando, mucho ruido para una lista que se escanea. Y los
                  separadores sueltos, sin contenedor, fallan al revés — con los 3
                  de físico o espiritual se leen como una lista a la que le faltó
                  cargar algo. Un contenedor único da las dos cosas: es un objeto
                  solo, así que con 3 igual se ve terminado, y adentro es liviano.
                  Mismo criterio que las columnas de la fase 1, que tampoco llevan
                  sombra para leerse como una composición y no como tres objetos. */}
              <View style={s.doorsWrap}>
                {doorsForEje(selectedAxis).map((d, i) => (
                  <View key={d.id}>
                    {i > 0 && <View style={s.doorSep} />}
                    {/* 📝 La sugerida se destaca SOLO con un fondo teñido del
                        color que su ícono ya tiene. Nada de borde, sombra ni
                        badge: sigue siendo una fila más de la lista, que es el
                        punto — la estamos señalando, no eligiendo por ella. */}
                    <ScaleCard
                      style={[s.doorRow, d.id === puertaDestacada && { backgroundColor: tint(d.color, 0.10) }]}
                      onPress={() => openDoor(d.id)}
                    >
                      {/* Lo único que lleva el color del eje. El resto —título,
                          bajada, flecha— queda neutro a propósito: si la fila
                          tuviera además borde y sombra propios, le competirían el
                          protagonismo al único elemento que dice dónde estás. */}
                      <View style={[s.doorIcon, { backgroundColor: tint(d.color, 0.16) }]}>
                        <Feather name={d.icon as any} size={22} color={d.color} />
                      </View>
                      <View style={s.doorTextWrap}>
                        <Text style={s.doorTitle} numberOfLines={1}>{d.label}</Text>
                        <Text style={s.doorTagline} numberOfLines={1}>{d.tagline}</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color={tint(FOREST, 0.5)} />
                    </ScaleCard>
                  </View>
                ))}
              </View>
            </SlideInView>
          ) : (
            /* ── Fase 1: ejes de bienestar ──────────────────────────────── */
            <SlideInView key="fase1">
              <View style={[s.askWrap, s.askWrapTight]}>
                <Text style={[s.askSub, s.askSubBig]}>Elegí un área de bienestar para empezar</Text>
              </View>

              {/* Búsqueda por nombre — en vivo sobre el cache de coaches */}
              <View style={s.searchBar}>
                <Feather name="search" size={18} color={FOREST_SOFT} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Buscá un profesional por nombre"
                  placeholderTextColor={tint(FOREST, 0.45)}
                  value={coachQuery}
                  onChangeText={setCoachQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {coachQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setCoachQuery('')} hitSlop={8} activeOpacity={0.7}>
                    <Feather name="x" size={18} color={FOREST_SOFT} />
                  </TouchableOpacity>
                )}
              </View>

              {coachQuery.trim().length > 0 ? (
                /* Resultados de búsqueda por nombre */
                coachResults.length > 0 ? (
                  <View style={s.resultsWrap}>
                    {coachResults.map(coach => (
                      <ScaleCard
                        key={coach.id}
                        style={s.resultRow}
                        onPress={() => goToPerfil(coach)}>
                        {coach.avatarUrl ? (
                          <Image source={{ uri: coach.avatarUrl }} style={s.resultAvatar} />
                        ) : (
                          <View style={[s.resultAvatar, s.resultAvatarFallback]}>
                            <Text style={s.resultInitials}>{getInitials(coach.name)}</Text>
                          </View>
                        )}
                        <View style={s.resultText}>
                          <View style={s.cardNameRow}>
                            <Text style={s.resultName} numberOfLines={1}>{coach.name}</Text>
                            {coach.hasMatricula && <MatriculaPill compact />}
                          </View>
                          {coach.specialty ? (
                            <Text style={s.resultSpecialty} numberOfLines={1}>{coach.specialty}</Text>
                          ) : null}
                        </View>
                        <Feather name="chevron-right" size={20} color={tint(FOREST, 0.5)} />
                      </ScaleCard>
                    ))}
                  </View>
                ) : (
                  <Text style={s.noResults}>No encontramos profesionales con ese nombre</Text>
                )
              ) : (
                <View style={s.menuWrap}>
                  {EJES.map(e => (
                    <ScaleCard
                      key={e.id}
                      style={[s.menuCard, { backgroundColor: tint(e.color, 0.18) }]}
                      onPress={() => selectAxis(e.id)}
                      accessibilityLabel={`${e.label}. ${e.tagline}`}>
                      <EjeIcon name={e.icon} size={30} color={e.color} />

                      {/* "Bienestar" va chico y arriba: lo comparten los tres, así
                          que es la parte muda del nombre. Lo que distingue va
                          grande. Entero en una línea no entra en una columna de
                          ~110pt sin perder el cuerpo que le da carácter. */}
                      <Text style={s.menuKicker}>Bienestar</Text>
                      {/* ⚠️ Una sola línea, achicándose si hace falta.
                          "Espiritual" a 18px ocupa casi los 90pt de ancho útil
                          de la columna en una pantalla de 390, y en una de 320
                          (SE) no entra: sin esto se partiría en dos renglones y
                          las tres tarjetas quedarían desparejas. */}
                      <Text style={s.menuTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {e.corto}
                      </Text>

                      <Text style={s.menuTagline}>{e.tagline}</Text>

                      {/* Dónde está el tema del quiz. Solo lo señala: la
                          pantalla ya no entra sola al eje. */}
                      {e.id === ejeDestacado && (
                        <View style={[s.menuSugerido, { backgroundColor: tint(e.color, 0.22) }]}>
                          <Text style={[s.menuSugeridoText, { color: e.color }]} numberOfLines={1}>
                            {origenSugerencia === 'quiz' ? 'Según tu quiz' : 'Tu tema'}
                          </Text>
                        </View>
                      )}

                      {/* Empujada al fondo con `marginTop: auto`: las bajadas
                          ocupan dos o tres líneas según el eje, y sin esto las
                          tres flechas quedaban a alturas distintas. */}
                      <View style={[s.menuArrow, { borderColor: tint(e.color, 0.55) }]}>
                        <Feather name="arrow-right" size={17} color={e.color} />
                      </View>
                    </ScaleCard>
                  ))}
                </View>
              )}
            </SlideInView>
          )}

          {/* ── Teaser del quiz de orientación ─────────────────────────── */}
          {/* Solo en la fase 1. Adentro de un eje la persona YA eligió por dónde
              empezar, así que ofrecerle orientarse ahí contradice lo que acaba
              de hacer — y el quiz la sacaría de la elección que tomó. */}
          {!selectedAxis && (
            <ScaleCard style={s.quizWrap} onPress={() => router.push('/quiz')}>
              <LinearGradient
                colors={[TC_SOFT, '#F0DDD2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.quizCard}>
                <View style={s.quizIcon}>
                  <Feather name="message-circle" size={20} color="#FFF6EC" />
                </View>
                <View style={s.quizText}>
                  <Text style={s.quizTitle}>¿No sabés por dónde empezar?</Text>
                  <Text style={s.quizSub}>Respondé unas preguntas y te orientamos</Text>
                </View>
                <Text style={s.quizArrow}>›</Text>
              </LinearGradient>
            </ScaleCard>
          )}

          <View style={{ height: TAB_BAR_CLEARANCE + 16 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: 'rgba(46,54,36,0.22)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
});

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: 'transparent' },
  screen:        { flex: 1, backgroundColor: 'transparent' },
  screenContent: { paddingTop: 10 },
  slideFill:     { flex: 1 },

  // Header menú
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
  },
  title: {
    fontFamily: ViveFonts.title,
    fontSize: 32,
    color: FOREST,
    lineHeight: 38,
  },
  hicons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // Pregunta editorial
  // Búsqueda por nombre
  // marginTop: 11 — medido contra la barra "Hoy: ..." de recursos.tsx
  // (detectando el borde del pill, no el texto): 28px de diferencia real
  // sobre la captura @3x = 28/3 ≈ 9pt. 2 (valor previo) + 9 = 11.
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    // Ritmo vertical del bloque de cabecera (27/08/2026). Antes: 13pt del
    // subtítulo al buscador y 4 del buscador a las columnas — el buscador
    // quedaba pegado a los ejes y los tres se leían como un solo bulto.
    //
    // 24 arriba (2 que aporta `askWrapTight` + 22) y 26 abajo. Va apretado
    // adentro de un grupo y suelto entre grupos: el título y su bajada son UN
    // bloque, el buscador es otro y las columnas son otro.
    //
    // ⚠️ El hueco título→bajada NO se toca. Su `marginTop: 2` está calculado
    // para dar 28pt exactos, los mismos que `recursos.tsx`, y arriba de ese
    // estilo está documentado el error de unidades que costó llegar ahí.
    marginTop: 22,
    marginBottom: 26,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 23,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
  },
  searchInput: {
    flex: 1,
    fontFamily: ViveFonts.regular,
    fontSize: 15,
    color: FOREST,
    padding: 0,
    // Explícito: iOS reutiliza el campo nativo y puede arrastrar la separación
    // de otro (ver `VerificarMailScreen`, estilo `input`).
    letterSpacing: 0,
  },
  resultsWrap: {
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tint(FOREST, 0.1),
  },
  resultAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInitials: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: FOREST,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontFamily: ViveFonts.medium,
    fontSize: 15,
    color: FOREST,
  },
  resultSpecialty: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
    marginTop: 2,
  },
  noResults: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: FOREST_SOFT,
    paddingHorizontal: 20,
    marginTop: 24,
    textAlign: 'center',
  },
  askWrap: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 18,
  },
  // Sesión 121: en Fase 1 el buscador quedaba pegado al subtítulo. Sesión 126:
  // se sacó el título propio de Fase 1 ("Encontrá a alguien que pueda
  // acompañarte", pedido de Joaquín), así que hoy `askWrap` en Fase 1 contiene
  // solo el subtítulo. Sesión 128: con Plus Jakarta Sans (más "aire" propio
  // que Fraunces para el mismo lineHeight — métrica de la fuente, no un
  // margen nuestro) el bloque entero volvió a sentirse separado del buscador
  // y las cards de abajo — se achicó `marginTop` acá (antes heredaba el 10 de
  // `askWrap`) además del `marginBottom`, para traer el CONTENIDO hacia el
  // título sin tocar el título en sí.
  // marginTop: 2 — el -36 anterior fue un error de UNIDADES, no de la
  // relación entre pantallas: las capturas del iPhone son @3x (1290px =
  // 430pt), y los píxeles medidos sobre la captura se venían restando
  // directo al `marginTop`, que es en PUNTOS. Con dos mediciones reales
  // (marginTop -8 → gap 54px=18pt; marginTop 21 → gap 141px=47pt) la
  // relación es exactamente lineal 1:1 EN PUNTOS (gap_pt = marginTop + 26) —
  // el "3:1" que parecía haber no era la fuente, era no dividir por la
  // densidad de la pantalla. Objetivo: 84px = 28pt (recursos.tsx) →
  // marginTop = 28 − 26 = 2.
  askWrapTight: {
    marginTop: 2,
    marginBottom: 2,
  },
  // Título de Fase 2 (nombre del eje elegido) — Fase 1 ya no tiene título propio.
  askTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 26,
    color: FOREST,
    lineHeight: 32,
  },
  // Mismo estilo que "Herramientas de Vita" en recursos.tsx (sectionTitle),
  // pedido explícito — solo para Fase 1 ("Elegí un área de bienestar para
  // empezar"), no para el subtítulo de Fase 2, que sigue con el estilo chico.
  askSubBig: {
    fontFamily: ViveFonts.title,
    fontSize: 20,
    color: FOREST,
  },
  askSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 13.5,
    color: FOREST_SOFT,
    marginTop: 8,
    lineHeight: 20,
  },

  // Menú (cards de ejes / puertas)
  menuBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  menuBackText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: FOREST_SOFT,
  },
  // ── Puertas / temas (fase 2) ─────────────────────────────────────────────
  // Filas horizontales. Es el diseño que tenían también los ejes hasta el
  // 27/08/2026; acá se queda porque son hasta 6 ítems de largo variable y en
  // columnas no entrarían.
  // 📝 Sin `overflow: 'hidden'`: en iOS es `masksToBounds` y recortaría la
  // sombra del contenedor. No hace falta — las filas no pintan fondo (ScaleCard
  // solo escala) y los separadores van con margen, así que nada llega a las
  // esquinas redondeadas.
  doorsWrap: {
    marginHorizontal: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 24,
    ...shadow,
  },
  doorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  // Arranca donde arranca el texto, no en el borde: la línea corta bajo el
  // título y deja pasar la columna de íconos, que se lee como una sola tira.
  doorSep: {
    height: 1,
    backgroundColor: LINE,
    marginLeft: 16 + 50 + 14,
    marginRight: 16,
  },
  // Cuadrado redondeado y no círculo — es la forma que distingue a los temas de
  // los ejes, que sí son redondos (tomado del boceto del 27/08/2026).
  doorIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  doorTextWrap: { flex: 1, minWidth: 0 },
  doorTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15.5,
    color: INK,
  },
  doorTagline: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: FOREST_SOFT,
    marginTop: 2,
  },

  // ── Ejes de bienestar (fase 1) ───────────────────────────────────────────
  // 🔴 Rediseño 27/08/2026. Antes eran tres filas horizontales idénticas — el
  // patrón de lista que sirve igual para "Configuración" o "Ayuda", con el color
  // del eje metido en un círculo de 48px, o sea el 3% de la superficie de la
  // tarjeta. Ahora son tres columnas y el color ES la tarjeta.
  //
  // 📝 Sin sombra ni borde a propósito: el color de fondo ya separa cada columna
  // del crema, y agregarle sombra encima las volvía tres objetos flotando en vez
  // de una sola composición de tres partes.
  menuWrap: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  menuCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 24,
    paddingTop: 26,
    paddingBottom: 20,
    paddingHorizontal: 10,
    // El alto lo fija esta línea y no el contenido: sin ella la tarjeta mide lo
    // que miden sus partes (~236pt) y queda chata. El aire extra cae entre la
    // bajada y la flecha, porque la flecha va anclada abajo.
    //
    // 🔴 Sale del ancho de pantalla, NO es un número fijo. Con 354 clavado la
    // proporción se deformaba en los dos sentidos —4,08:1 en un SE contra
    // 2,87:1 en un 15 Pro Max— porque el ancho de la columna sí es proporcional
    // (`flex: 1`) y el alto no. Ver `lib/ejesLayout.ts`.
    //
    // ⚠️ `SCREEN_W` se lee una vez al cargar el módulo, como el resto de este
    // archivo: no se recalcula al rotar. Es la limitación que ya tenía
    // `cardPage`, no una nueva.
    minHeight: altoDeEje(SCREEN_W),
  },
  menuKicker: {
    fontFamily: ViveFonts.medium,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: FOREST_SOFT,
    marginTop: 20,
  },
  menuTitle: {
    fontFamily: ViveFonts.title,
    fontSize: 18,
    lineHeight: 24,
    color: INK,
    textAlign: 'center',
  },
  menuTagline: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: FOREST_SOFT,
    textAlign: 'center',
    marginTop: 8,
  },
  menuSugerido: {
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  menuSugeridoText: { fontFamily: ViveFonts.semibold, fontSize: 10.5 },
  menuArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 2,
  },

  // ── Deck header ──────────────────────────────────────────────────────────
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  deckHeaderTitle: {
    flex: 1,
    fontFamily: ViveFonts.title,
    fontSize: 26,
    color: FOREST,
    marginLeft: 2,
  },

  // Chips de temas (deslizables)
  themeChipsRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: CARD,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexShrink: 0,
  },
  themeChipText: { fontFamily: ViveFonts.medium, fontSize: 12.5, color: FOREST },
  themeChipTextActive: { color: '#F7EFE4' },

  // ── Tarjetas del carrusel: misma estructura, acentos por recomendación ──
  cardPage: {
    width: SCREEN_W,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  deckScroll: {},
  cardShadow: { borderRadius: 28, backgroundColor: CARD, ...shadow },
  cardSurface: {
    borderRadius: 28,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: CARD,
  },
  cardHero: { position: 'relative', overflow: 'hidden', backgroundColor: '#D8DCC8' },
  cardHeroImage: { width: '100%', height: '100%' },
  cardHeroFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInitials: { fontFamily: ViveFonts.title, fontSize: 54, color: FOREST },
  cardFavorite: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF9ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    backgroundColor: CARD,
    marginTop: -17,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardName: {
    fontFamily: ViveFonts.title,
    fontSize: 23,
    lineHeight: 28,
    color: FOREST,
    flexShrink: 1,
  },
  cardMeta: { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT, marginTop: 3 },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  reasonText: { fontFamily: ViveFonts.bold, fontSize: 11 },
  cardBioWrap: { borderLeftWidth: 2, paddingLeft: 10, marginTop: 16 },
  cardBio: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: INK,
    lineHeight: 18,
  },
  motivoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  motivoText: { fontFamily: ViveFonts.medium, fontSize: 11, color: FOREST_SOFT, flexShrink: 1 },
  cardPayments: { fontFamily: ViveFonts.medium, fontSize: 10.5, color: FOREST_SOFT, marginTop: 12 },
  knowBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: FOREST,
    borderRadius: 24,
    minHeight: 44,
    marginTop: 18,
  },
  knowText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#FFF9ED' },

  // Dots del carrusel
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tint(FOREST, 0.22),
  },
  dotActive: {
    width: 20,
    backgroundColor: FOREST,
  },

  verListaBtn: { width: SCREEN_W, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 2 },
  verListaText: { fontFamily: ViveFonts.semibold, fontSize: 13.5, color: TERRACOTTA, textAlign: 'center' },

  // Deck close / empty
  deckClose: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 26,
    paddingHorizontal: 20,
    ...shadow,
  },
  deckCloseTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST, textAlign: 'center' },
  deckCloseSub: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT, textAlign: 'center', lineHeight: 18 },
  reintentar: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST, marginTop: 6, textDecorationLine: 'underline' },

  // Re-book
  rebook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    ...shadow,
  },
  rebookAvatar: { width: 38, height: 38, borderRadius: 19, flexShrink: 0 },
  rebookAvatarFallback: { backgroundColor: 'rgba(192,107,74,0.20)', alignItems: 'center', justifyContent: 'center' },
  rebookInitials: { fontFamily: ViveFonts.semibold, fontSize: 13, color: TERRACOTTA },
  rebookText: { flex: 1 },
  rebookTitle: { fontFamily: ViveFonts.semibold, fontSize: 13, color: FOREST },
  rebookSub: { fontFamily: ViveFonts.regular, fontSize: 11, color: FOREST_SOFT, marginTop: 1 },
  rebookCta: { backgroundColor: TERRACOTTA, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 8 },
  rebookCtaText: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: '#FFF6EC' },

  // Quiz
  quizWrap: {
    marginHorizontal: 20,
    marginTop: 18,
    borderRadius: 22,
    overflow: 'hidden',
    ...shadow,
  },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,107,74,0.25)',
    borderRadius: 22,
  },
  quizIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  quizText: { flex: 1 },
  quizTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: FOREST },
  quizSub: { fontFamily: ViveFonts.regular, fontSize: 11.5, color: '#8F6A55', marginTop: 2 },
  quizArrow: { fontSize: 22, color: TERRACOTTA, lineHeight: 26 },
});
