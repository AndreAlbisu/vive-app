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
import { opcionesGuardadas, etiquetaEstilo, etiquetasEnfoques, etiquetaGuia, etiquetasFocos } from '@/lib/enfoque';
import { logResourceEvent } from '@/lib/resourceEvents';
import { estaSuspendido } from '@/lib/coachVisibility';

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
  const [profileState, setProfileState] = useState<{ id: string; status: 'available' | 'unavailable' } | null>(null);
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
      .select('id, verified, availability_status, specialty, profesion, bio, estilo, enfoques, guia, focos, price_per_session, nationality, video_url, accepts_international, price_usd, mp_connected, accepts_paypal, accepts_usdt, suspendido_hasta, profiles!inner(name, avatar_url)')
      .eq('profile_id', pid)
      .single()
      .then(({ data, error }) => {
        if (error || !data || !(data as any).verified || (data as any).availability_status !== 'activo') {
          setProfileState({ id: pid, status: 'unavailable' });
          return;
        }
        setProfileState({ id: pid, status: 'available' });
        setNoDisponible(estaSuspendido({ suspendidoHasta: (data as any).suspendido_hasta ?? null }));
        // ⚠️ `coaches.id`, no `profiles.id`: `coach_credentials.coach_id`
        // apunta al PK de coaches, igual que `bookings.coach_id`.
        void listPublicCredentials((data as any).id).then(setCredenciales);
        setFetchedData({
          name: (data as any).profiles.name,
          specialty: etiquetaProfesionalPublica(data as any),
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
  }, [params.profileId]);

  useEffect(() => {
    const pid = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
    if (!pid) return;

    async function loadReviews() {
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('rating, comment, reviewer_id')
        .eq('reviewed_id', pid!)
        .eq('is_private', false)
        .order('created_at', { ascending: false });

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
      profileRows?.forEach(p => { nameMap[p.id] = p.name ?? 'Usuario'; });

      const avg = reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length;
      setLiveAvgRating(Math.round(avg * 10) / 10);
      setLiveReviews(reviewRows.map(r => ({
        rating: r.rating,
        comment: r.comment,
        reviewerName: nameMap[r.reviewer_id] ?? 'Usuario',
      })));
      setReviewsLoaded(true);
    }

    loadReviews();
  }, [params.profileId]);

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
  ].filter(Boolean).join(' · ');

  const displayRating = liveAvgRating ?? (params.rating ? parseFloat(params.rating) : null);
  const displayReviewCount = reviewsLoaded ? liveReviews.length : (params.reviewCount ? parseInt(params.reviewCount, 10) : 0);

  const videoPlayer = useVideoPlayer(prof.video_url, p => { p.loop = false; });

  // Un enlace viejo o un favorito puede abrir esta ruta sin pasar por el
  // catálogo. No se debe mostrar un perfil despublicado, ni siquiera usando
  // nombre/precio que hayan quedado en los parámetros de navegación.
  if (!profileId || profileState?.id !== profileId || profileState?.status === 'unavailable') {
    const loadingProfile = !!profileId && profileState?.id !== profileId;
    return (
      <AppBg>
        <SafeAreaView style={[s.page, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          {loadingProfile ? <ActivityIndicator color={ViveColors.primary} /> : (
            <>
              <Text style={{ color: ViveColors.text, fontFamily: ViveFonts.semibold, fontSize: 22, textAlign: 'center' }}>
                Este perfil ya no está disponible
              </Text>
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 12 }}>
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
              <MaterialIcons name="person" size={90} color="rgba(135,131,92,0.65)" />
            </View>
          )}

          {/* 🔴 23/09/2026: decía "Verificado por Vita", que sobre la foto se
              leía como que Vita responde por todo lo que hay en el perfil. Lo
              que se hizo es revisar la postulación (`verified`); lo que se
              verificó de cada título o matrícula está marcado uno por uno, en
              Formación. Ver docs/investigacion-producto-2026-09-23.md, punto 1. */}
          <View style={s.verifiedBadge}>
            <MaterialIcons name="verified" size={14} color="#565E32" />
            <Text style={s.verifiedText}>Perfil revisado por Vita</Text>
          </View>
        </View>

        <View style={s.infoSection}>
          <Text style={s.name}>{prof.name}</Text>
          <Text style={s.specialty}>{prof.specialty}</Text>

          {displayRating !== null && displayReviewCount > 0 && (
            <View style={s.ratingInline}>
              <MaterialIcons name="star" size={17} color="#C99A3F" />
              <Text style={s.ratingInlineText}>
                {displayRating.toFixed(1)} · {displayReviewCount} {displayReviewCount === 1 ? 'reseña' : 'reseñas'}
              </Text>
            </View>
          )}

          {/* El encuadre va acá, pegado a la especialidad, y no en un bloque
              propio más abajo: dice de qué TIPO es lo que esta persona ofrece,
              así que pertenece al renglón que dice qué ofrece. Ver
              `EncuadrePill` para por qué las dos variantes pesan igual. */}
          <View style={s.encuadreRow}>
            <EncuadrePill encuadre={encuadre} onInfo={() => setEncuadreOpen(true)} />
          </View>
          {!!prof.nationality && <Text style={s.metaLine}>{prof.nationality}</Text>}
          {!!paymentMethods && <Text style={s.paymentLine}>Acepta {paymentMethods}</Text>}
        </View>
        </View>

        {!!prof.bio && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Sobre mí</Text>
            <Text style={s.bio}>{prof.bio}</Text>
          </View>
        )}

        {prof.topics.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Temas que acompaña</Text>
            <View style={s.chipsRow}>
              {prof.topics.map(topic => (
                <View key={topic} style={s.chip}>
                  <Text style={s.chipText}>{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Cómo trabaja (M14) ────────────────────────────────────────────
            El estilo va primero y en castellano común, porque es lo que se le
            preguntó a la persona en el quiz. El enfoque va después, con el
            nombre de la escuela y su explicación de una línea: quien no lo
            conoce igual entiende qué significa. Si el profesional no contestó
            ninguna de las dos, la sección no existe. */}
        {(etiquetaEstilo(prof.estilo) || etiquetaGuia(prof.guia) || etiquetasFocos(prof.focos).length > 0
          || etiquetasEnfoques(prof.enfoques).length > 0) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Cómo trabaja</Text>
            {!!etiquetaEstilo(prof.estilo) && (
              <View style={s.workRow}>
                <Text style={s.workLabel}>Su estilo</Text>
                <Text style={s.workText}>{etiquetaEstilo(prof.estilo)}</Text>
              </View>
            )}
            {/* M14 ampliado (21/09/2026): cuánto guía y sobre qué trabaja, en
                primera persona como el estilo, porque son sus respuestas. */}
            {!!etiquetaGuia(prof.guia) && (
              <View style={s.workRow}>
                <Text style={s.workLabel}>Cómo acompaña</Text>
                <Text style={s.workText}>{etiquetaGuia(prof.guia)}</Text>
              </View>
            )}
            {etiquetasFocos(prof.focos).length > 0 && (
              <View style={s.workRow}>
                <Text style={s.workLabel}>Foco</Text>
                <Text style={s.workText}>
                  Trabajo sobre {listarY(etiquetasFocos(prof.focos).map(f => f.toLowerCase()))}
                </Text>
              </View>
            )}
            {opcionesGuardadas(prof.enfoques).map(e => {
              return (
                <View key={e.id} style={s.workRow}>
                  <Text style={s.workLabel}>{e.label}</Text>
                  <Text style={s.workText}>{e.desc}</Text>
                </View>
              );
            })}
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
                      color="#566245"
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
                        <Text style={s.credNumber}>
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

        {/* ── Video de introducción ─────────────────────────────────────── */}
        {prof.video_url && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Video de introducción</Text>
            <TouchableOpacity
              style={s.videoPlaceholder}
              activeOpacity={0.8}
              onPress={() => { setIsPlayingVideo(true); videoPlayer.play(); }}>
              <View style={s.playBtn}>
                <MaterialIcons name="play-arrow" size={32} color={ViveColors.primary} />
              </View>
              <Text style={s.videoCaption}>
                Conocé a {prof.name.split(' ')[0]} en 1 minuto
              </Text>
            </TouchableOpacity>
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

        {/* ── Recursos de este coach ────────────────────────────────────── */}
        {coachResources.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Recursos de {prof.name.split(' ')[0]}</Text>
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
                      color="rgba(135,131,92,0.58)"
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Reviews ──────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Reseñas</Text>

          {reviewsLoaded && displayRating !== null && displayReviewCount > 0 ? (
            <>
              {/* Rating general */}
              <View style={s.ratingOverall}>
                <Text style={s.ratingNumber}>{displayRating.toFixed(1)}</Text>
                <View style={s.ratingRight}>
                  <Stars rating={displayRating} size={18} />
                  <Text style={s.ratingCount}>{displayReviewCount} {displayReviewCount === 1 ? 'reseña' : 'reseñas'}</Text>
                </View>
              </View>

              {/* Lista de reviews */}
              <View style={s.reviewsList}>
                {liveReviews.slice(0, 5).map((review, i) => (
                  <View key={i} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <ReviewAvatar name={review.reviewerName} />
                      <View style={s.reviewMeta}>
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
            </>
          ) : reviewsLoaded ? (
            <View style={s.noReviews}>
              <Text style={s.noReviewsText}>Todavía no hay reseñas para este profesional</Text>
            </View>
          ) : (
            <View style={s.noReviews}>
              <Text style={s.noReviewsText}>Cargando reseñas…</Text>
            </View>
          )}
        </View>

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
            <MaterialIcons name="outlined-flag" size={15} color="rgba(135,131,92,0.75)" />
            <Text style={s.reportLinkText}>Reportar o bloquear a {prof.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Footer sticky ────────────────────────────────────────────────── */}
      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <View style={s.footerTop}>
            <Text style={s.price} numberOfLines={1}>
              {prof.priceFrom != null
                ? `Desde $${prof.priceFrom.toLocaleString('es-AR')}`
                : 'Precio por confirmar'}
            </Text>
            {prof.priceFrom != null && <Text style={s.priceUnit}>por sesión</Text>}
            {prof.acceptsInternational && prof.priceUsd != null && (
              <Text style={s.priceIntl} numberOfLines={1}>
                Exterior: USD {prof.priceUsd}
              </Text>
            )}
          </View>
            <TouchableOpacity
              style={[s.btnPrimary, (blocked || noDisponible) && s.btnPrimaryDisabled]}
              activeOpacity={0.85}
              disabled={blocked || noDisponible}
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
                {(blocked || noDisponible) ? 'No disponible por ahora' : 'Reservar sesión'}
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

/** "a, b y c" */
function listarY(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  page: { flex: 1 },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: ViveColors.text },
  favoriteBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Portada ───────────────────────────────────────────────────────────
  heroCard: {
    marginHorizontal: 20,
    marginTop: 10,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    backgroundColor: '#FBF8F1',
  },
  photoContainer: {
    width: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(86,94,50,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
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
  verifiedText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 12,
    color: '#565E32',
    letterSpacing: 0.2,
  },

  // ── Info básica ────────────────────────────────────────────────────────
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  name: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  specialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 16,
    color: ViveColors.primary,
    marginBottom: 4,
  },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  ratingInlineText: { fontFamily: ViveFonts.medium, fontSize: 13, color: ViveColors.text },
  metaLine: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    marginTop: 12,
  },
  paymentLine: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#726F57', marginTop: 8 },
  bio: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 21,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.22)',
    backgroundColor: 'rgba(86,94,50,0.05)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.text,
  },

  // ── Sección genérica ──────────────────────────────────────────────────
  section: {
    marginHorizontal: 20,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(86,94,50,0.14)',
  },
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 18,
    color: '#565E32',
    marginBottom: 14,
  },

  // ── Cómo trabaja (M14) ──────────────────────────────────────────────
  workRow: { marginBottom: 14 },
  workLabel: { fontFamily: ViveFonts.semibold, fontSize: 12, color: ViveColors.primaryInk, marginBottom: 3 },
  workText: { fontFamily: ViveFonts.regular, fontSize: 14, lineHeight: 21, color: ViveColors.text },

  // ── Formación ───────────────────────────────────────────────────────
  // El estado sin matrícula NO va en rojo ni con ícono de alerta: no es una
  // advertencia contra el coach, es información sobre qué tipo de sesión es.
  // Pintarlo de peligro sería castigar a alguien que no hizo nada mal.
  encuadreRow: { marginTop: 8, marginBottom: 2 },

  credList: { gap: 12, marginTop: 12 },
  credRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  credTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
  },
  // Verde de la marca y no ámbar, y sin caja: es la constatación de un hecho,
  // no una alerta. `flexShrink: 0` para que un título largo lo corte a él y no
  // al revés — el que se acorta con "…" tiene que ser el nombre, que sigue
  // legible, y no la palabra que califica la credencial.
  credVerif: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  credVerifTxt: {
    fontFamily: ViveFonts.semibold, fontSize: 10.5,
    color: '#42542F', letterSpacing: 0.2,
  },
  credTitle: {
    fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#565E32',
    lineHeight: 20, flexShrink: 1,
  },
  credMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#87835C', marginTop: 1 },
  credNumber: {
    fontFamily: ViveFonts.medium, fontSize: 12.5, color: '#566245', marginTop: 3,
  },

  // ── Recursos del coach ──────────────────────────────────────────────
  resourcesList: { gap: 10 },
  resourceCard: {
    backgroundColor: '#FBF8F1',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    padding: 14,
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resourceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(232,116,59,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceHeaderText: { flex: 1 },
  resourceTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
  },
  resourceMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
    marginTop: 2,
  },

  // ── Video ─────────────────────────────────────────────────────────────
  videoPlaceholder: {
    backgroundColor: '#FBF8F1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(232,197,71,0.18)',
    borderWidth: 2,
    borderColor: ViveColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCaption: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
  },
  videoModalBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModalPlayer: {
    width: '100%',
    height: '100%',
  },
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

  // ── Rating general ────────────────────────────────────────────────────
  ratingOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF8F1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    padding: 16,
    marginBottom: 14,
    gap: 14,
  },
  ratingNumber: {
    fontFamily: ViveFonts.bold,
    fontSize: 40,
    color: '#565E32',
    lineHeight: 48,
  },
  ratingRight: {
    gap: 4,
  },
  ratingCount: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: 'rgba(135,131,92,0.80)',
  },

  // ── Reviews ───────────────────────────────────────────────────────────
  noReviews: {
    backgroundColor: 'rgba(255,248,240,0.32)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  noReviewsText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: 'rgba(135,131,92,0.65)',
    textAlign: 'center',
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
    paddingVertical: 8,
  },
  reportLinkText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: 'rgba(135,131,92,0.75)',
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#FBF8F1',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(86,94,50,0.14)',
    padding: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },
  reviewMeta: {
    gap: 3,
  },
  reviewName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13,
    color: '#565E32',
  },
  reviewText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    lineHeight: 20,
  },

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
  price: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#565E32',
  },
  priceUnit: { fontFamily: ViveFonts.regular, fontSize: 11, color: '#726F57' },
  priceIntl: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(135,131,92,0.95)',
    marginTop: 2,
  },
  btnPrimary: {
    backgroundColor: '#565E32',
    borderRadius: 24,
    width: 156,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: { backgroundColor: 'rgba(86,94,50,0.35)' },
  btnPrimaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#F7EFE4',
    textAlign: 'center',
  },
});
