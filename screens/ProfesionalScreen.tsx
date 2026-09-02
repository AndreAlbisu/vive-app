import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
import { listPublicCredentials, lineaCredencial, KIND_LABEL, type PublicCredential } from '@/lib/coachCredentials';
import ReportSheet from '@/components/ReportSheet';
import UserActionsSheet from '@/components/UserActionsSheet';
import { loadBlockedIds, onBlockedChange, isBlocked } from '@/lib/blocking';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useVideoPlayer, VideoView } from 'expo-video';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { PaymentBadges } from '@/components/PaymentBadges';
import { logResourceEvent } from '@/lib/resourceEvents';

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
  age: '',
  nationality: '',
  gender: '',
  topics: [] as string[],
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
  }>();
  const profileId = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);
  const saved = !!profileId && favoriteIds.has(profileId);
  const [fetchedData, setFetchedData] = useState<Partial<typeof DEFAULT_PROFESIONAL> | null>(null);
  const [liveReviews, setLiveReviews] = useState<LiveReview[]>([]);
  const [liveAvgRating, setLiveAvgRating] = useState<number | null>(null);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [coachResources, setCoachResources] = useState<CoachResource[]>([]);

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

  useEffect(() => {
    const pid = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
    if (!pid) return;
    supabase
      .from('coaches')
      .select('id, specialty, bio, price_per_session, nationality, video_url, accepts_international, price_usd, mp_connected, accepts_paypal, accepts_usdt, profiles!inner(name, avatar_url)')
      .eq('profile_id', pid)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        // ⚠️ `coaches.id`, no `profiles.id`: `coach_credentials.coach_id`
        // apunta al PK de coaches, igual que `bookings.coach_id`.
        void listPublicCredentials((data as any).id).then(setCredenciales);
        setFetchedData({
          name: (data as any).profiles.name,
          specialty: (data as any).specialty,
          nationality: (data as any).nationality ?? DEFAULT_PROFESIONAL.nationality,
          priceFrom: (data as any).price_per_session,
          video_url: (data as any).video_url ?? null,
          avatar_url: (data as any).profiles.avatar_url ?? null,
          bio: (data as any).bio ?? null,
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
    ...(params.specialty && { specialty: params.specialty }),
    ...(params.priceFrom && { priceFrom: parseInt(params.priceFrom, 10) }),
    ...fetchedData,
  };

  const displayRating = liveAvgRating ?? (params.rating ? parseFloat(params.rating) : null);
  const displayReviewCount = reviewsLoaded ? liveReviews.length : (params.reviewCount ? parseInt(params.reviewCount, 10) : 0);

  const videoPlayer = useVideoPlayer(prof.video_url, p => { p.loop = false; });

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* ── Botón atrás flotante ─────────────────────────────────────── */}
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="arrow-back-ios" size={18} color="#565E32" />
        </TouchableOpacity>

      </SafeAreaView>

      {/* ── Scroll ───────────────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* ── Foto grande ──────────────────────────────────────────────── */}
        <View style={s.photoContainer}>
          {prof.avatar_url ? (
            <Image source={{ uri: prof.avatar_url }} style={s.photoImage} />
          ) : (
            <View style={s.photoPlaceholder}>
              <MaterialIcons name="person" size={90} color="rgba(135,131,92,0.65)" />
            </View>
          )}

          {/* Badge verificado */}
          <View style={s.verifiedBadge}>
            <MaterialIcons name="verified" size={14} color="#565E32" />
            <Text style={s.verifiedText}>Verificado por Vita</Text>
          </View>

          {/* Atiende desde el exterior. Hasta ahora este dato solo se leía en
              `BookingScreen_Confirm` para decidir si dibujaba el botón de USDT,
              o sea que alguien desde afuera recorría el catálogo entero sin
              saber quién lo atiende. Es público a propósito. */}
          {prof.acceptsInternational && (
            <View style={s.intlBadge}>
              <MaterialIcons name="public" size={14} color="#565E32" />
              <Text style={s.verifiedText}>Atiende desde el exterior</Text>
            </View>
          )}
        </View>

        {/* ── Info básica ──────────────────────────────────────────────── */}
        <View style={s.infoSection}>
          <Text style={s.name}>{prof.name}</Text>
          <Text style={s.specialty}>{prof.specialty}</Text>

          <Text style={s.metaLine}>
            {prof.age} · {prof.nationality} · {prof.gender}
          </Text>

          {/* Presentación */}
          {!!prof.bio && (
            <Text style={s.bio}>{prof.bio}</Text>
          )}

          {/* Chips de temas */}
          {prof.topics.length > 0 && (
            <View style={s.chipsRow}>
              {prof.topics.map(topic => (
                <View key={topic} style={s.chip}>
                  <Text style={s.chipText}>{topic}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Formación ─────────────────────────────────────────────────────
            Solo credenciales verificadas por Vita. NO se muestra el documento:
            un diploma lleva nombre completo, a veces DNI y firma, y publicarlo
            sería exponer datos personales del profesional a cualquier visitante
            — además de abrir un canal de texto que ningún filtro puede moderar.
            Lo que se muestra es el dato que Vita chequeó. */}
        {credenciales.length > 0 && (
          <View style={s.section}>
            <View style={s.credHeader}>
              <Text style={s.sectionTitle}>Formación</Text>
              <View style={s.credBadge}>
                <MaterialCommunityIcons name="shield-check" size={12} color="#42542F" />
                <Text style={s.credBadgeTxt}>Verificado por Vita</Text>
              </View>
            </View>

            <View style={s.credList}>
              {credenciales.map(c => {
                const linea = lineaCredencial(c);
                return (
                  <View key={c.id} style={s.credRow}>
                    <MaterialCommunityIcons
                      name={c.kind === 'matricula' ? 'card-account-details-outline' : 'school-outline'}
                      size={18}
                      color="#6B7A56"
                      style={{ marginTop: 1 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.credTitle}>{c.title}</Text>
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
          ) : null}
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

        {/* Espaciador para el footer sticky */}
        <View style={{ height: 108 }} />
      </ScrollView>

      {/* ── Footer sticky ────────────────────────────────────────────────── */}
      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <View style={s.footerTop}>
            <Text style={s.price}>
              {prof.priceFrom != null
                ? `Desde $${prof.priceFrom.toLocaleString('es-AR')} por sesión`
                : 'Cargando precio…'}
            </Text>
            {/* Va acá y no arriba con el badge de verificado porque es
                información de PRECIO: quien está afuera necesita el número en
                dólares, no la etiqueta. Verlo recién en el checkout —que es lo
                que pasaba hasta ahora— obliga a recorrer todo el flujo para
                averiguar cuánto sale. */}
            {prof.acceptsInternational && prof.priceUsd != null && (
              <Text style={s.priceIntl}>
                Desde el exterior: USD {prof.priceUsd}
              </Text>
            )}
            {/* Sin `compact`: acá hay ancho de sobra (el footer apila precio y
                botones), así que se muestran los tres si acepta los tres. En la
                card del deck van recortados porque la fila se parte. */}
            <View style={s.payRow}>
              <PaymentBadges
                mp={prof.acceptsMp}
                paypal={prof.acceptsPaypal}
                usdt={prof.acceptsUsdt}
              />
            </View>
          </View>
          <View style={s.footerButtons}>
            <TouchableOpacity
              style={[s.btnPrimary, blocked && s.btnPrimaryDisabled]}
              activeOpacity={0.85}
              disabled={blocked}
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
                  },
                });
              }}>
              <Text style={s.btnPrimaryText}>
                {blocked ? 'Bloqueado' : 'Reservar sesión'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSecondary, saved && s.btnSecondaryActive]}
              onPress={() => {
                if (!isLoggedIn) { requestAuth('guardar_profesional'); return; }
                if (profileId) toggleFavorite(profileId);
              }}
              activeOpacity={0.8}>
              <MaterialIcons
                name={saved ? 'favorite' : 'favorite-border'}
                size={18}
                color={ViveColors.primary}
              />
              <Text style={s.btnSecondaryText}>
                {saved ? 'Guardado' : 'Guardar en favoritos'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    </AppBg>
  );
}

// ─── Sombra ──────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
});

// ─── Estilos ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backBtn: {
    margin: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Foto ──────────────────────────────────────────────────────────────
  photoContainer: {
    width: '100%',
    height: 300,
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
  intlBadge: {
    position: 'absolute',
    bottom: 54,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ViveColors.accent,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 5,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ViveColors.accent,
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
    paddingTop: 22,
    paddingBottom: 8,
  },
  name: {
    fontFamily: ViveFonts.semibold,
    fontSize: 28,
    color: '#565E32',
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  specialty: {
    fontFamily: ViveFonts.medium,
    fontSize: 16,
    color: ViveColors.primary,
    marginBottom: 8,
  },
  metaLine: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    marginBottom: 14,
  },
  bio: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#565E32',
    lineHeight: 21,
    marginBottom: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.primary,
  },

  // ── Sección genérica ──────────────────────────────────────────────────
  section: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 17,
    color: '#565E32',
    marginBottom: 14,
  },

  // ── Formación ───────────────────────────────────────────────────────
  credHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  credBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DCE5CB', borderRadius: 10,
    paddingVertical: 3, paddingHorizontal: 8, marginBottom: 14,
  },
  credBadgeTxt: { fontFamily: ViveFonts.semibold, fontSize: 10.5, color: '#42542F', letterSpacing: 0.2 },
  credList: { gap: 12 },
  credRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  credTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: '#565E32', lineHeight: 20 },
  credMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: '#87835C', marginTop: 1 },
  credNumber: {
    fontFamily: ViveFonts.medium, fontSize: 12.5, color: '#6B7A56', marginTop: 3,
  },

  // ── Recursos del coach ──────────────────────────────────────────────
  resourcesList: { gap: 10 },
  resourceCard: {
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
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
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...shadow,
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
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    padding: 16,
    marginBottom: 14,
    gap: 14,
    ...shadow,
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
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.60)',
    padding: 14,
    ...shadow,
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
    paddingTop: 14,
    paddingBottom: 8,
    gap: 10,
  },
  footerTop: {},
  price: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },
  payRow: { marginTop: 6 },
  priceIntl: {
    fontFamily: ViveFonts.regular,
    fontSize: 12.5,
    color: 'rgba(135,131,92,0.95)',
    marginTop: 2,
  },
  footerButtons: {
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: '#565E32',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: { backgroundColor: 'rgba(86,94,50,0.35)' },
  btnPrimaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 16,
    color: '#F7EFE4',
    letterSpacing: 0.2,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ViveColors.primary,
    paddingVertical: 12,
    gap: 8,
  },
  btnSecondaryActive: {
    backgroundColor: 'rgba(232,197,71,0.15)',
  },
  btnSecondaryText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.primary,
  },
});
