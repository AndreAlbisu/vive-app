import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
import { listPublicCredentials, lineaCredencial, profesionDeMatricula, KIND_LABEL, type PublicCredential } from '@/lib/coachCredentials';
import { encuadreDeSesion } from '@/lib/credentialRules';
import { etiquetaProfesionalPublica } from '@/lib/tipoProfesional';
import { EncuadrePill } from '@/components/EncuadrePill';
import { EncuadreSheet } from '@/components/EncuadreSheet';
import { FotoAmpliada } from '@/components/FotoAmpliada';
import ReportSheet from '@/components/ReportSheet';
import UserActionsSheet from '@/components/UserActionsSheet';
import { loadBlockedIds, onBlockedChange, isBlocked } from '@/lib/blocking';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useVideoPlayer, VideoView } from 'expo-video';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { opcionesGuardadas } from '@/lib/enfoque';
import { logResourceEvent } from '@/lib/resourceEvents';
import { estaSuspendido } from '@/lib/coachVisibility';
import { firmaDeResena, motivoSinPerfil, frasesDeTrabajo, precioParaMostrar } from '@/lib/perfilProfesional';
import { enArgentina } from '@/lib/time';

// ─── Defaults ────────────────────────────────────────────────────────────────
// 🔴 Sin datos inventados. Esto arrancaba con 'Laura Méndez', 'Coach de vida' y
// **4500** —restos del mockup (`constants/searchData.ts`)— y esos valores se
// mostraban mientras viajaba la consulta y SE QUEDABAN si fallaba. O sea que el
// perfil público de un coach que cobra $1 podía decir $4500. Peor: ese número se
// pasaba después por params a la pantalla de confirmar (`priceFrom`), que hasta
// hoy lo insertaba tal cual en `bookings.amount`.
//
// Un precio falso en pantalla es peor que un espacio vacío: el vacío se lee como
// "todavía no cargó", el número se lee como el precio.
const DEFAULT_PROFESIONAL = {
  name: '',
  specialty: '',
  nationality: '',
  topics: [] as string[],
  estilo: null as string | null,
  enfoques: [] as string[],
  guia: null as string | null,
  focos: [] as string[],
  priceFrom: null as number | null,
  video_url: null as string | null,
  avatar_url: null as string | null,
  bio: null as string | null,
  acceptsInternational: false,
  priceUsd: null as number | null,
  acceptsMp: false,
  acceptsPaypal: false,
  acceptsUsdt: false,
};

type LiveReview = { rating: number; comment: string | null; reviewerName: string };

type CoachResource = {
  id: string;
  type: 'audio' | 'guia_pasos' | 'lectura_breve' | 'journaling' | 'gratitud';
  title: string;
  duration_min: number | null;
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  audio: 'Audio',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
  journaling: 'Diario',
  gratitud: 'Gratitud',
};

const RESOURCE_TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  audio: 'volume-up',
  guia_pasos: 'format-list-numbered',
  lectura_breve: 'menu-book',
  journaling: 'menu-book',
  gratitud: 'favorite-border',
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <MaterialIcons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-border'}
          size={size}
          color="#E8C547"
        />
      ))}
    </View>
  );
}

function ReviewAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={s.reviewAvatar}>
      <Text style={s.reviewAvatarText}>{initial}</Text>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function ProfesionalScreen() {
  const router = useRouter();
  const { user, isLoggedIn, requestAuth } = useAuth();
  const params = useLocalSearchParams<{
    name?: string;
    specialty?: string;
    rating?: string;
    reviewCount?: string;
    priceFrom?: string;
    coachId?: string;
    profileId?: string;
    resourceId?: string;
    /** La puerta por la que la persona llegó hasta acá, si llegó por una. */
    tema?: string;
  }>();
  const profileId = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);
  const saved = !!profileId && favoriteIds.has(profileId);
  const [fetchedData, setFetchedData] = useState<Partial<typeof DEFAULT_PROFESIONAL> | null>(null);
  // 'error' es "no se pudo preguntar" (sin señal, timeout), distinto de
  // 'unavailable', que es "el perfil no está". Ver `motivoSinPerfil`.
  const [profileState, setProfileState] = useState<{ id: string; status: 'available' | 'unavailable' | 'error' } | null>(null);
  const [intento, setIntento] = useState(0);
  const [todasLasResenas, setTodasLasResenas] = useState(false);
  // `coaches.id` (no `profile_id`): es la clave de `bookings.coach_id`.
  const [coachRowId, setCoachRowId] = useState<string | null>(null);
  // undefined = todavía no se sabe; mientras tanto no se muestra.
  const [garantiaDisponible, setGarantiaDisponible] = useState<boolean | undefined>(undefined);
  const [liveReviews, setLiveReviews] = useState<LiveReview[]>([]);
  const [liveAvgRating, setLiveAvgRating] = useState<number | null>(null);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // 🔴 Sancionado: suspendido o dado de baja. Al perfil se llega también por
  // favoritos, por un recurso o por un link guardado — caminos que no pasan por
  // el catálogo, que es el único que filtraba. Sin esto la persona elegía día y
  // horario y recién le rebotaba al confirmar.
  const [noDisponible, setNoDisponible] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [coachResources, setCoachResources] = useState<CoachResource[]>([]);
  const [encuadreOpen, setEncuadreOpen] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(false);

  // Acá alcanza con el cache propio (a diferencia de la Sala, donde hacen falta
  // las dos direcciones): a este perfil se llega desde el catálogo, y el
  // catálogo ya filtra a los que bloqueé. Lo que resta es que el perfil sepa
  // mostrar "Desbloquear" si se llegó por un link viejo o un favorito.
  useEffect(() => {
    if (!user || !profileId) return;
    let mounted = true;
    const sync = () => { if (mounted) setBlocked(isBlocked(profileId)); };
    void loadBlockedIds(user.id).then(sync);
    const off = onBlockedChange(sync);
    return () => { mounted = false; off(); };
  }, [user, profileId]);

  // 🔴 Solo las VERIFICADAS, y salen de la vista `coach_credentials_public`, no
  // de la tabla: la tabla no tiene lectura pública y si la tuviera expondría
  // `file_path` —el path del documento— porque RLS filtra filas, no columnas.
  // El documento en sí no llega nunca hasta acá; lo que se muestra es el dato.
  const [credenciales, setCredenciales] = useState<PublicCredential[]>([]);
  // `coach_credentials_public` ya filtra por `verificada`, así que basta con que
  // exista una de tipo matrícula: la vista no devuelve pendientes ni rechazadas.
  const encuadre = encuadreDeSesion(credenciales);

  useEffect(() => {
    const pid = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
    if (!pid) return;
    supabase
      .from('coaches')
      .select('id, slug, verified, availability_status, specialty, profesion, bio, estilo, enfoques, guia, focos, price_per_session, nationality, video_url, accepts_international, price_usd, mp_connected, accepts_paypal, accepts_usdt, suspendido_hasta, profiles!inner(name, avatar_url, gender)')
      .eq('profile_id', pid)
      .single()
      .then(({ data, error }) => {
        if (error && motivoSinPerfil(error) === 'error_red') {
          setProfileState({ id: pid, status: 'error' });
          return;
        }
        if (error || !data || !(data as any).verified || (data as any).availability_status !== 'activo') {
          setProfileState({ id: pid, status: 'unavailable' });
          return;
        }
        setProfileState({ id: pid, status: 'available' });
        setCoachRowId((data as any).id);
        setNoDisponible(estaSuspendido({ suspendidoHasta: (data as any).suspendido_hasta ?? null }));
        // ⚠️ `coaches.id`, no `profiles.id`: `coach_credentials.coach_id`
        // apunta al PK de coaches, igual que `bookings.coach_id`.
        void listPublicCredentials((data as any).id).then(setCredenciales);
        setFetchedData({
          name: (data as any).profiles.name,
          specialty: etiquetaProfesionalPublica(data as any, (data as any).profiles.gender),
          nationality: (data as any).nationality ?? DEFAULT_PROFESIONAL.nationality,
          priceFrom: (data as any).price_per_session,
          video_url: (data as any).video_url ?? null,
          avatar_url: (data as any).profiles.avatar_url ?? null,
          bio: (data as any).bio ?? null,
          estilo: (data as any).estilo ?? null,
          enfoques: ((data as any).enfoques ?? []) as string[],
          guia: (data as any).guia ?? null,
          focos: ((data as any).focos ?? []) as string[],
          // Los dos juntos, misma condición que el filtro de búsqueda y que el
          // botón de USDT en el checkout: sin precio en dólares el cobro del
          // exterior no se puede armar, así que anunciarlo sería prometer algo
          // que la pantalla de pago no va a ofrecer.
          acceptsInternational: !!(data as any).accepts_international && (data as any).price_usd != null,
          priceUsd: (data as any).price_usd ?? null,
          // Con qué se le puede pagar. Las tarjetas del deck y del buscador ya
          // lo mostraban, pero el perfil —el paso del medio, donde se decide— lo
          // perdía, y quien entra por link directo nunca pasó por una tarjeta:
          // se enteraba recién en el checkout.
          //
          // 🔴 PayPal y USDT van atados a `price_usd`, igual que
          // `acceptsInternational` acá arriba: sin precio en dólares
          // `paypal-create-payment` y `usdt-create-payment` rechazan el cobro,
          // así que el cartelito estaría anunciando un medio que el checkout no
          // ofrece. Hoy hay coaches en esa situación — con el riel en `true` y
          // el precio en null.
          acceptsMp: !!(data as any).mp_connected,
          acceptsPaypal: !!(data as any).accepts_paypal && (data as any).price_usd != null,
          acceptsUsdt: !!(data as any).accepts_usdt && (data as any).price_usd != null,
        });

        supabase
          .from('coach_topics')
          .select('topic')
          .eq('coach_id', (data as any).id)
          .then(({ data: topicRows }) => {
            setFetchedData(prev => ({ ...prev, topics: (topicRows ?? []).map(t => t.topic as string) }));
          });

      });
  }, [params.profileId, intento]);

  // ── Garantía de primera sesión (T&C §9.3) ──────────────────────────────
  // Se muestra solo a quien todavía la tiene: vale una vez por persona en toda
  // la app y para la primera sesión con cada profesional. Mostrársela a quien
  // ya la usó sería una promesa en el punto de venta que no se cumple (art. 8
  // Ley 24.240: lo que se anuncia integra el contrato). Por eso se la había
  // sacado del checkout en agosto, cuando todavía no existía el mecanismo.
  // Sin sesión iniciada no hay historia: la tiene. Si la consulta falla, no se
  // muestra: ante la duda, no prometer.
  useEffect(() => {
    if (!user) { setGarantiaDisponible(true); return; }
    if (!coachRowId) return;
    let vivo = true;
    void Promise.all([
      supabase.from('guarantee_claims').select('id')
        .eq('user_id', user.id).in('status', ['pedida', 'aprobada']).limit(1),
      supabase.from('bookings').select('id')
        .eq('user_id', user.id).eq('coach_id', coachRowId)
        .in('status', ['confirmada', 'completada']).limit(1),
    ]).then(([claims, sesiones]) => {
      if (!vivo) return;
      if (claims.error || sesiones.error) { setGarantiaDisponible(false); return; }
      setGarantiaDisponible((claims.data ?? []).length === 0 && (sesiones.data ?? []).length === 0);
    });
    return () => { vivo = false; };
  }, [user, coachRowId]);

  useEffect(() => {
    const pid = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
    if (!pid) return;

    async function loadReviews() {
      const { data: reviewRows, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating, comment, reviewer_id')
        .eq('reviewed_id', pid!)
        .eq('is_private', false)
        .order('created_at', { ascending: false });

      // Si la consulta falló no sabemos si hay reseñas: no se marca como cargado,
      // así no aparece "Nuevo en Vita" sobre alguien que tiene veinte.
      if (reviewsError) return;
      if (!reviewRows || reviewRows.length === 0) {
        setReviewsLoaded(true);
        return;
      }

      const reviewerIds = reviewRows.map(r => r.reviewer_id);
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', reviewerIds);

      const nameMap: Record<string, string> = {};
      profileRows?.forEach(p => { if (p.name) nameMap[p.id] = p.name; });

      const avg = reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length;
      setLiveAvgRating(Math.round(avg * 10) / 10);
      setLiveReviews(reviewRows.map(r => ({
        rating: r.rating,
        comment: r.comment,
        reviewerName: firmaDeResena(nameMap[r.reviewer_id]),
      })));
      setReviewsLoaded(true);
    }

    loadReviews();
  }, [params.profileId, intento]);

  useEffect(() => {
    const pid = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
    if (!pid) return;

    supabase
      .from('resources')
      .select('id, type, title, duration_min')
      .eq('attributed_to_coach_id', pid)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCoachResources((data ?? []) as CoachResource[]);
      });
  }, [params.profileId]);

  const prof = {
    ...DEFAULT_PROFESIONAL,
    ...(params.name && { name: params.name }),
    ...(params.priceFrom && { priceFrom: parseInt(params.priceFrom, 10) }),
    ...fetchedData,
  };
  const { width } = useWindowDimensions();
  const photoHeight = Math.min(250, Math.max(205, width * 0.58));
  const paymentMethods = [
    prof.acceptsMp && 'Mercado Pago',
    prof.acceptsPaypal && 'PayPal',
    prof.acceptsUsdt && 'USDT',
  ].filter(Boolean) as string[];

  const displayRating = liveAvgRating ?? (params.rating ? parseFloat(params.rating) : null);
  const displayReviewCount = reviewsLoaded ? liveReviews.length : (params.reviewCount ? parseInt(params.reviewCount, 10) : 0);

  const videoPlayer = useVideoPlayer(prof.video_url, p => { p.loop = false; });

  const primerNombre = prof.name.split(' ')[0];
  const puedeReservar = !blocked && !noDisponible;
  const hayResenas = reviewsLoaded && displayRating !== null && displayReviewCount > 0;
  const resenasVisibles = todasLasResenas ? liveReviews : liveReviews.slice(0, 3);
  const frases = frasesDeTrabajo(prof.estilo, prof.guia, prof.focos);
  const escuelas = opcionesGuardadas(prof.enfoques);
  const hayComoTrabaja = prof.topics.length > 0 || frases.length > 0 || escuelas.length > 0;
  const precio = precioParaMostrar(
    { ars: prof.priceFrom, usd: prof.priceUsd, cobraExterior: prof.acceptsInternational },
    enArgentina(),
  );

  // Un enlace viejo o un favorito puede abrir esta ruta sin pasar por el
  // catálogo. No se debe mostrar un perfil despublicado, ni siquiera usando
  // nombre/precio que hayan quedado en los parámetros de navegación.
  if (!profileId || profileState?.id !== profileId || profileState?.status !== 'available') {
    const loadingProfile = !!profileId && profileState?.id !== profileId;
    const errorRed = profileState?.id === profileId && profileState?.status === 'error';
    return (
      <AppBg>
        <SafeAreaView style={[s.page, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          {loadingProfile ? <ActivityIndicator color={ViveColors.primary} /> : (
            <>
              <Text style={s.estadoTitulo}>
                {errorRed ? 'No pudimos cargar el perfil' : 'Este perfil ya no está disponible'}
              </Text>
              {errorRed && (
                <>
                  <Text style={s.estadoTexto}>Revisá tu conexión y probá de nuevo.</Text>
                  <TouchableOpacity
                    onPress={() => { setProfileState(null); setIntento(n => n + 1); }}
                    style={s.estadoBtn}
                    accessibilityRole="button">
                    <Text style={s.estadoBtnTxt}>Reintentar</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12, padding: 12 }}>
                <Text style={{ color: ViveColors.primaryInk, fontFamily: ViveFonts.medium }}>Volver</Text>
              </TouchableOpacity>
            </>
          )}
        </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.page} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back-ios" size={19} color={ViveColors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profesional</Text>
        <TouchableOpacity
          style={s.favoriteBtn}
          onPress={() => {
            if (!isLoggedIn) { requestAuth('guardar_profesional'); return; }
            if (profileId) toggleFavorite(profileId);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Quitar de favoritos' : 'Guardar en favoritos'}>
          <MaterialIcons name={saved ? 'favorite' : 'favorite-border'} size={24} color={saved ? ViveColors.primaryInk : ViveColors.text} />
        </TouchableOpacity>
      </View>

      {/* ── Scroll ───────────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        <View style={s.heroCard}>
        <View style={[s.photoContainer, { height: photoHeight }]}>
          {prof.avatar_url ? (
            <Pressable
              onPress={() => setFotoAmpliada(true)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Foto de ${prof.name}. Tocá para verla en grande.`}
              style={s.photoImage}
            >
              <Image source={{ uri: prof.avatar_url }} style={s.photoImage} />
            </Pressable>
          ) : (
            <View style={s.photoPlaceholder}>
              <MaterialIcons name="person" size={90} color="rgba(86,98,69,0.45)" />
            </View>
          )}

          {/* 🔴 23/09/2026: decía "Verificado por Vita", que sobre la foto se
              leía como que Vita responde por todo lo que hay en el perfil. Lo
              que se hizo es revisar la postulación (`verified`); lo que se
              verificó de cada título o matrícula está marcado uno por uno, en
              Formación. Ver docs/investigacion-producto-2026-09-23.md, punto 1. */}
          <View style={s.verifiedBadge}>
            <MaterialIcons name="verified" size={14} color={ViveColors.text} />
            <Text style={s.verifiedText}>Perfil revisado por Vita</Text>
          </View>
        </View>

        <View style={s.infoSection}>
          <Text style={s.name}>{prof.name}</Text>
          <Text style={s.specialty}>{prof.specialty}</Text>
          {/* La nacionalidad va con quién es, no con la sesión: pegada a
              "60 minutos" no se sabía si era de dónde es o dónde atiende. */}
          {!!prof.nationality && <Text style={s.nacionalidad}>Nacionalidad: {prof.nationality}</Text>}

          {/* Sin reseñas todavía se dice "Nuevo en Vita" y no "no hay reseñas":
              al lanzar es el caso de todos, y dicho en negativo se lee como un
              punto en contra de alguien que recién empieza. */}
          {hayResenas ? (
            <View style={s.ratingInline}>
              <MaterialIcons name="star" size={17} color="#C99A3F" />
              <Text style={s.ratingInlineText}>
                {displayRating!.toFixed(1)} · {displayReviewCount} {displayReviewCount === 1 ? 'reseña' : 'reseñas'}
              </Text>
            </View>
          ) : reviewsLoaded ? (
            <View style={s.ratingInline}>
              <MaterialCommunityIcons name="sprout-outline" size={16} color={ViveColors.softInk} />
              <Text style={s.ratingInlineText}>Nuevo en Vita</Text>
            </View>
          ) : null}

          {/* El encuadre va acá, pegado a la especialidad, y no en un bloque
              propio más abajo: dice de qué TIPO es lo que esta persona ofrece,
              así que pertenece al renglón que dice qué ofrece. Ver
              `EncuadrePill` para por qué las dos variantes pesan igual. */}
          <View style={s.encuadreRow}>
            <EncuadrePill encuadre={encuadre} onInfo={() => setEncuadreOpen(true)} />
          </View>

          {/* ── Pagos y garantía ──────────────────────────────────────────
              01/10/2026: este bloque tuvo también videollamada, duración y
              próximo lugar; Andre los sacó (hoy toda sesión es por videollamada
              y de 60 minutos, y la fecha libre aparece con un toque en
              "Reservar"). Los medios de pago pasaron por una línea junto al
              precio, que se veía mal, y quedaron acá como chips: solo los que
              este profesional acepta. */}
          {(paymentMethods.length > 0 || (garantiaDisponible && puedeReservar)) && (
          <View style={s.facts}>
            {paymentMethods.length > 0 && (
              <View style={s.pagosBlock}>
                <Text style={s.pagosLabel}>Acepta</Text>
                <View style={s.chipsRow}>
                  {paymentMethods.map(m => (
                    <View key={m} style={s.chip}>
                      <Text style={s.chipText}>{m}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {garantiaDisponible && puedeReservar && (
              <TouchableOpacity
                style={s.factRow}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/legal', params: { doc: 'terminos' } })}
                accessibilityRole="link"
                accessibilityLabel="Garantía de primera sesión. Si no te convence, te devolvemos lo que pagaste. Ver condiciones.">
                <MaterialIcons name="verified-user" size={17} color={ViveColors.accent} />
                <Text style={s.factText}>
                  <Text style={s.factStrong}>Garantía de primera sesión.</Text>
                  {' '}Si no te convence, te devolvemos lo que pagaste.{' '}
                  <Text style={s.factLink}>Ver condiciones</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
          )}

        </View>
        </View>

        {/* ── Sobre mí + video ───────────────────────────────────────────────
            El video va grande, debajo de la bio (Andre, 01/10/2026): primero
            se lee quién es y enseguida se lo ve contarlo. En la portada iba
            como una tarjeta chica y quedaba como un dato más. */}
        {(!!prof.bio || !!prof.video_url) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Sobre mí</Text>
            {!!prof.bio && <Text style={s.bio}>{prof.bio}</Text>}
            {!!prof.video_url && (
              <TouchableOpacity
                style={[s.videoCard, !!prof.bio && { marginTop: 18 }]}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={`Ver el video de presentación de ${primerNombre}`}
                onPress={() => { setIsPlayingVideo(true); videoPlayer.play(); }}>
                {/* Fondo liso con la foto en un círculo, y no la foto de
                    fondo: esa es la misma de la portada, a un scroll de
                    distancia, y se veía repetida (capturas del 01/10/2026).
                    Un cuadro del video sería lo ideal, pero generarlo
                    (`generateThumbnailsAsync` + expo-image) cerraba la app en
                    el iPhone. */}
                <View style={s.videoCara}>
                  {prof.avatar_url ? (
                    <Image source={{ uri: prof.avatar_url }} style={s.videoCaraImg} />
                  ) : (
                    <MaterialIcons name="person" size={44} color="rgba(247,239,228,0.7)" />
                  )}
                  <View style={s.playBtn}>
                    <MaterialIcons name="play-arrow" size={26} color={ViveColors.onPrimaryInk} />
                  </View>
                </View>
                <Text style={s.videoTitle}>Mirá cómo se presenta</Text>
                <Text style={s.videoCaption}>Un video corto de {primerNombre}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Cómo trabaja (M14) ────────────────────────────────────────────
            01/10/2026, después de verlo en el iPhone: eran siete títulos en
            terracota uno abajo del otro, y "Su estilo: Las dos cosas" no se
            entendía sin la pregunta. Ahora son tres bloques: los temas, cómo
            trabaja en frases que se entienden solas (`frasesDeTrabajo`) y las
            escuelas con su explicación. Si no hay nada, la sección no existe. */}
        {hayComoTrabaja && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Cómo trabaja</Text>
            {prof.topics.length > 0 && (
              <View style={s.workBlock}>
                <Text style={s.workLabel}>Temas que acompaña</Text>
                <View style={s.chipsRow}>
                  {prof.topics.map(topic => (
                    <View key={topic} style={s.chip}>
                      <Text style={s.chipText}>{topic}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {frases.length > 0 && (
              <View style={s.workBlock}>
                <Text style={s.workLabel}>Su forma de trabajar</Text>
                {frases.map(f => (
                  <View key={f} style={s.fraseRow}>
                    <View style={s.fraseDot} />
                    <Text style={[s.workText, { flex: 1 }]}>{f}</Text>
                  </View>
                ))}
              </View>
            )}
            {escuelas.length > 0 && (
              <View style={s.workBlock}>
                <Text style={s.workLabel}>{escuelas.length === 1 ? 'Enfoque' : 'Enfoques'}</Text>
                {escuelas.map(e => (
                  <View key={e.id} style={s.escuelaRow}>
                    <Text style={s.escuelaNombre}>{e.label}</Text>
                    <Text style={s.workText}>{e.desc}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Formación ─────────────────────────────────────────────────────
            Solo credenciales verificadas por Vita. NO se muestra el documento:
            un diploma lleva nombre completo, a veces DNI y firma, y publicarlo
            sería exponer datos personales del profesional a cualquier visitante
            — además de abrir un canal de texto que ningún filtro puede moderar.
            Lo que se muestra es el dato que Vita chequeó. */}
        {credenciales.length > 0 && (
          <View style={s.section}>
            {/* 🔴 El escudo "Verificado por Vita" estaba ACÁ, en la cabecera, y
                de ahí salían los dos problemas que esta sección tenía.

                Un escudo a nivel sección cubre todo lo que hay debajo por
                igual, así que sobre un "Lic. en Psicología · UBA" se leía como
                *Vita responde por este psicólogo* — cuando lo que Vita chequeó
                fue ese título y nada más. Para compensarlo había abajo un
                cartel ámbar ("un título no habilita por sí solo…") que era la
                CUARTA vez que la app decía lo mismo: ya está en la etiqueta
                siempre visible pegada a la especialidad, en el sheet que abre
                al tocarla, y otra vez completa en el checkout antes de pagar.
                Y estaba pintado como alerta, así que se leía como una
                advertencia contra alguien que no hizo nada malo.

                Un badge que sobreafirma no se arregla con un párrafo que lo
                desmienta: se arregla haciendo que diga lo que hizo. Ahora el
                "Verificado" va por credencial (`credVerif`), donde es exacto —
                `coach_credentials_public` solo devuelve verificadas, así que
                todas las filas de esta lista lo son. Sin escudo de sección no
                hay sobreafirmación, y sin sobreafirmación el cartel no tiene
                nada que compensar. */}
            <Text style={s.sectionTitle}>Formación</Text>

            <View style={s.credList}>
              {credenciales.map(c => {
                const linea = lineaCredencial(c);
                const deQue = profesionDeMatricula(c);
                return (
                  <View key={c.id} style={s.credRow}>
                    <MaterialCommunityIcons
                      name={c.kind === 'matricula' ? 'card-account-details-outline' : 'school-outline'}
                      size={18}
                      color={ViveColors.softInk}
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      {/* El "Verificado" va en la línea del título y no debajo:
                          es lo que califica a ESA credencial, y separado de
                          ella volvería a flotar sobre toda la fila. */}
                      <View style={s.credTitleRow}>
                        <Text style={s.credTitle}>{c.title}</Text>
                        <View style={s.credVerif}>
                          <MaterialCommunityIcons name="shield-check" size={11} color="#42542F" />
                          <Text style={s.credVerifTxt}>Verificado</Text>
                        </View>
                      </View>
                      {/* De qué profesión es la matrícula lo decidió quien miró
                          el documento, no el texto del perfil. */}
                      {!!deQue && <Text style={s.credMeta}>{deQue}</Text>}
                      {!!linea && <Text style={s.credMeta}>{linea}</Text>}
                      {/* El número de matrícula se muestra entero a propósito:
                          es público por definición y es lo único de esta
                          sección que un usuario puede ir a verificar por su
                          cuenta. Ocultarlo le sacaría todo el valor. */}
                      {!!c.registrationNumber && (
                        <Text style={s.credNumber} selectable>
                          {KIND_LABEL[c.kind] === 'Matrícula' ? '' : `${KIND_LABEL[c.kind]} `}
                          {c.registrationNumber}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <Modal
          visible={isPlayingVideo}
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={() => { videoPlayer.pause(); setIsPlayingVideo(false); }}>
          <View style={s.videoModalBg}>
            <VideoView
              player={videoPlayer}
              style={s.videoModalPlayer}
              contentFit="contain"
              nativeControls
            />
            <TouchableOpacity
              style={s.videoModalCloseBtn}
              onPress={() => { videoPlayer.pause(); setIsPlayingVideo(false); }}
              hitSlop={12}>
              <MaterialIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* ── Reseñas ──────────────────────────────────────────────────────
            Solo si hay. Sin reseñas, la portada ya dice "Nuevo en Vita"; una
            sección vacía al final repetía lo mismo en negativo. */}
        {hayResenas && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Reseñas</Text>
            {/* El número grande con una o dos reseñas promete más de lo que
                hay: hasta tres, hablan las reseñas solas. */}
            {displayReviewCount >= 3 && (
            <View style={s.ratingOverall}>
              <Text style={s.ratingNumber}>{displayRating!.toFixed(1)}</Text>
              <View style={s.ratingRight}>
                <Stars rating={displayRating!} size={18} />
                <Text style={s.ratingCount}>{displayReviewCount} {displayReviewCount === 1 ? 'reseña' : 'reseñas'}</Text>
              </View>
            </View>
            )}

            <View style={s.reviewsList}>
              {resenasVisibles.map((review, i) => (
                <View key={i} style={s.reviewCard}>
                  <View style={s.reviewHeader}>
                    <ReviewAvatar name={review.reviewerName} />
                    <View style={s.reviewMeta}>
                      {/* Nombre e inicial, nunca completo: ver `firmaDeResena`. */}
                      <Text style={s.reviewName}>{review.reviewerName}</Text>
                      <Stars rating={review.rating} size={12} />
                    </View>
                  </View>
                  {!!review.comment && (
                    <Text style={s.reviewText}>{review.comment}</Text>
                  )}
                </View>
              ))}
            </View>
            {liveReviews.length > 3 && (
              <TouchableOpacity
                onPress={() => setTodasLasResenas(v => !v)}
                style={s.verMas}
                accessibilityRole="button">
                <Text style={s.verMasTxt}>
                  {todasLasResenas ? 'Ver menos' : `Ver las ${liveReviews.length} reseñas`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Recursos de este coach ────────────────────────────────────── */}
        {coachResources.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recursos de {primerNombre}</Text>
            <View style={s.resourcesList}>
              {coachResources.map(resource => (
                <TouchableOpacity
                  key={resource.id}
                  style={s.resourceCard}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/recurso', params: { id: resource.id } })}
                >
                  <View style={s.resourceHeader}>
                    <View style={s.resourceIconWrap}>
                      <MaterialIcons
                        name={RESOURCE_TYPE_ICONS[resource.type] ?? 'menu-book'}
                        size={18}
                        color={ViveColors.primary}
                      />
                    </View>
                    <View style={s.resourceHeaderText}>
                      <Text style={s.resourceTitle}>{resource.title}</Text>
                      <Text style={s.resourceMeta}>
                        {RESOURCE_TYPE_LABELS[resource.type] ?? resource.type}
                        {resource.duration_min ? ` · ${resource.duration_min} min` : ''}
                      </Text>
                    </View>
                    <MaterialIcons
                      name="chevron-right"
                      size={22}
                      color={ViveColors.softInk}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Reportar / bloquear (oculto en el propio perfil) */}
        {user?.id !== profileId && (
          <TouchableOpacity
            style={s.reportLink}
            onPress={() => {
              if (!isLoggedIn) { requestAuth('reportar_profesional'); return; }
              setActionsOpen(true);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="outlined-flag" size={15} color={ViveColors.softInk} />
            <Text style={s.reportLinkText}>Reportar o bloquear a {primerNombre}</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Footer sticky ────────────────────────────────────────────────── */}
      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <View style={s.footerTop}>
            {/* Un solo precio, el que le sirve a quien mira: pesos en
                Argentina, dólares desde afuera si los cobra. Antes eran tres
                renglones ("$1 / por sesión / Exterior: USD 50") y la barra se
                comía un sexto de la pantalla. Sin "Desde": el precio es uno. */}
            <Text style={s.price} numberOfLines={1}>
              {precio ?? 'Precio por confirmar'}
              {!!precio && <Text style={s.priceUnit}> la sesión</Text>}
            </Text>
          </View>
            <TouchableOpacity
              style={[s.btnPrimary, !puedeReservar && s.btnPrimaryDisabled]}
              activeOpacity={0.85}
              disabled={!puedeReservar}
              onPress={() => {
                // El motivo de más valor de todos: es la rama que monetiza.
                if (!isLoggedIn) { requestAuth('reservar_sesion'); return; }
                const resourceId = Array.isArray(params.resourceId) ? params.resourceId[0] : params.resourceId;
                if (resourceId && user) logResourceEvent(user.id, resourceId, 'booking_started');
                router.push({
                  pathname: '/booking-calendar',
                  params: {
                    name: prof.name,
                    specialty: prof.specialty,
                    ...(prof.priceFrom != null && { priceFrom: String(prof.priceFrom) }),
                    coachId: params.coachId ?? params.profileId ?? '',
                    ...(params.tema && { tema: Array.isArray(params.tema) ? params.tema[0] : params.tema }),
                  },
                });
              }}>
              <Text style={s.btnPrimaryText}>
                {puedeReservar ? 'Reservar sesión' : 'No disponible por ahora'}
              </Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
      </SafeAreaView>

      <UserActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        targetId={profileId ?? ''}
        targetName={prof.name}
        blocked={blocked}
        onReport={() => setReportOpen(true)}
        onBlockChange={setBlocked}
      />

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        reportedName={prof.name}
        reportedId={profileId ?? ''}
      />

      <FotoAmpliada
        uri={fotoAmpliada ? prof.avatar_url : null}
        onCerrar={() => setFotoAmpliada(false)}
      />

      <EncuadreSheet
        visible={encuadreOpen}
        encuadre={encuadre}
        onCerrar={() => setEncuadreOpen(false)}
      />
    </AppBg>
  );
}



// ─── Estilos ─────────────────────────────────────────────────────────────────
// 01/10/2026: los cinco olivas escritos a mano (#565E32, #87835C, #726F57,
// #566245 y transparencias) pasan a los dos tokens del tema: `text` para lo
// principal y `softInk` para lo secundario. #87835C daba 3.6:1 sobre el crema,
// por debajo del 4.5 de AA, y era el color de las reseñas y los metadatos.
// La biografía sube a 16 px (el mínimo de la guía): es lo que más se lee.
const CARD = '#FBF8F1';
const BORDE = 'rgba(86,94,50,0.14)';

const s = StyleSheet.create({
  page: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: ViveColors.text },
  favoriteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },

  // ── Estados sin perfil ────────────────────────────────────────────────
  estadoTitulo: { color: ViveColors.text, fontFamily: ViveFonts.semibold, fontSize: 22, textAlign: 'center' },
  estadoTexto: {
    color: ViveColors.softInk, fontFamily: ViveFonts.regular, fontSize: 15,
    textAlign: 'center', marginTop: 8,
  },
  estadoBtn: {
    marginTop: 20, minHeight: 48, paddingHorizontal: 28, borderRadius: 24,
    backgroundColor: ViveColors.text, alignItems: 'center', justifyContent: 'center',
  },
  estadoBtnTxt: { color: ViveColors.onPrimaryInk, fontFamily: ViveFonts.semibold, fontSize: 15 },

  // ── Portada ───────────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: 20,
    marginTop: 10,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDE,
    backgroundColor: CARD,
  },
  photoContainer: { width: '100%' },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(86,94,50,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  verifiedBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,248,241,0.96)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
  },
  verifiedText: { fontFamily: ViveFonts.semibold, fontSize: 12, color: ViveColors.text, letterSpacing: 0.2 },

  infoSection: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  name: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  specialty: { fontFamily: ViveFonts.medium, fontSize: 16, color: ViveColors.primaryInk },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  ratingInlineText: { fontFamily: ViveFonts.medium, fontSize: 14, color: ViveColors.text },
  // El estado sin matrícula NO va en rojo ni con ícono de alerta: no es una
  // advertencia contra el coach, es información sobre qué tipo de sesión es.
  // Pintarlo de peligro sería castigar a alguien que no hizo nada mal.
  encuadreRow: { marginTop: 10 },

  facts: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDE,
    gap: 14,
  },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  factText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 20, color: ViveColors.softInk },
  factStrong: { fontFamily: ViveFonts.semibold, color: ViveColors.accent },
  factLink: { fontFamily: ViveFonts.semibold, color: ViveColors.primaryInk },
  pagosBlock: { gap: 6 },
  pagosLabel: { fontFamily: ViveFonts.semibold, fontSize: 13, color: ViveColors.softInk },
  nacionalidad: { fontFamily: ViveFonts.regular, fontSize: 13, color: ViveColors.softInk, marginTop: 2 },

  // El video: fondo oliva, la cara en un círculo con el play encima, y el
  // texto abajo. Crema sobre oliva da 6.1:1.
  videoCard: {
    width: '100%',
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: ViveColors.text,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 4,
  },
  videoCara: { width: 104, height: 104, marginBottom: 12 },
  videoCaraImg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: 'rgba(247,239,228,0.9)',
  },
  playBtn: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ViveColors.primaryInk,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: ViveColors.text,
  },
  videoTitle: { fontFamily: ViveFonts.semibold, fontSize: 18, color: ViveColors.onPrimaryInk, textAlign: 'center' },
  videoCaption: { fontFamily: ViveFonts.regular, fontSize: 14, color: ViveColors.onPrimaryInk, opacity: 0.85, textAlign: 'center' },
  videoModalBg: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  videoModalPlayer: { width: '100%', height: '100%' },
  videoModalCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Sección genérica ──────────────────────────────────────────────────
  section: {
    marginHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: BORDE,
  },
  sectionTitle: { fontFamily: ViveFonts.semibold, fontSize: 18, color: ViveColors.text, marginBottom: 14 },
  bio: { fontFamily: ViveFonts.regular, fontSize: 16, color: ViveColors.text, lineHeight: 25 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.22)',
    backgroundColor: 'rgba(86,94,50,0.05)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  chipText: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.text },

  // ── Cómo trabaja (M14) ──────────────────────────────────────────────
  workBlock: { marginBottom: 20, gap: 8 },
  fraseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  fraseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ViveColors.softInk, marginTop: 9 },
  escuelaRow: { gap: 1 },
  escuelaNombre: { fontFamily: ViveFonts.semibold, fontSize: 15, color: ViveColors.text },
  workLabel: { fontFamily: ViveFonts.semibold, fontSize: 13, color: ViveColors.primaryInk, marginBottom: 3 },
  workText: { fontFamily: ViveFonts.regular, fontSize: 15, lineHeight: 22, color: ViveColors.text },

  // ── Formación ───────────────────────────────────────────────────────
  credList: { gap: 14, marginTop: 4 },
  credRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  credTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // Verde de la marca y no ámbar, y sin caja: es la constatación de un hecho,
  // no una alerta. `flexShrink: 0` para que un título largo lo corte a él y no
  // al revés — el que se acorta con "…" tiene que ser el nombre, que sigue
  // legible, y no la palabra que califica la credencial.
  credVerif: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  credVerifTxt: { fontFamily: ViveFonts.semibold, fontSize: 11, color: '#42542F', letterSpacing: 0.2 },
  credTitle: { fontFamily: ViveFonts.semibold, fontSize: 15, color: ViveColors.text, lineHeight: 21, flexShrink: 1 },
  credMeta: { fontFamily: ViveFonts.regular, fontSize: 13, color: ViveColors.softInk, marginTop: 1 },
  credNumber: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.softInk, marginTop: 3 },

  // ── Reseñas ─────────────────────────────────────────────────────────
  ratingOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDE,
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  ratingNumber: { fontFamily: ViveFonts.bold, fontSize: 40, color: ViveColors.text, lineHeight: 48 },
  ratingRight: { gap: 4 },
  ratingCount: { fontFamily: ViveFonts.regular, fontSize: 13, color: ViveColors.softInk },
  reviewsList: { gap: 12 },
  reviewCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDE, padding: 14 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(86,94,50,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: ViveColors.text },
  reviewMeta: { gap: 3 },
  reviewName: { fontFamily: ViveFonts.semibold, fontSize: 14, color: ViveColors.text },
  reviewText: { fontFamily: ViveFonts.regular, fontSize: 15, color: ViveColors.text, lineHeight: 22 },
  verMas: { alignSelf: 'center', marginTop: 14, paddingVertical: 10, paddingHorizontal: 16 },
  verMasTxt: { fontFamily: ViveFonts.semibold, fontSize: 14, color: ViveColors.primaryInk },

  // ── Recursos del coach ──────────────────────────────────────────────
  resourcesList: { gap: 10 },
  resourceCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDE, padding: 14 },
  resourceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resourceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232,116,59,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceHeaderText: { flex: 1 },
  resourceTitle: { fontFamily: ViveFonts.semibold, fontSize: 15, color: ViveColors.text },
  resourceMeta: { fontFamily: ViveFonts.regular, fontSize: 13, color: ViveColors.softInk, marginTop: 2 },

  // ── Pie ─────────────────────────────────────────────────────────────
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
  },
  reportLinkText: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.softInk },

  // ── Footer sticky ─────────────────────────────────────────────────────
  footerSafe: {
    backgroundColor: 'rgba(247,239,228,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(86,94,50,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.5)',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerTop: { flex: 1, minWidth: 0 },
  price: { fontFamily: ViveFonts.semibold, fontSize: 18, color: ViveColors.text },
  priceUnit: { fontFamily: ViveFonts.regular, fontSize: 14, color: ViveColors.softInk },
  btnPrimary: {
    backgroundColor: ViveColors.text,
    borderRadius: 24,
    width: 168,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: { backgroundColor: 'rgba(86,94,50,0.35)' },
  btnPrimaryText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: ViveColors.onPrimaryInk, textAlign: 'center' },
});
