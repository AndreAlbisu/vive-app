import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFavoriteCoaches } from '@/hooks/useFavoriteCoaches';
import { supabase } from '@/lib/supabase';
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
import { useVideoPlayer, VideoView } from 'expo-video';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_PROFESIONAL = {
  name: 'Laura Méndez',
  specialty: 'Coach de vida',
  age: '34 años',
  nationality: 'Argentina',
  gender: 'Mujer',
  topics: [] as string[],
  priceFrom: 4500,
  video_url: null as string | null,
  avatar_url: null as string | null,
};

type LiveReview = { rating: number; comment: string | null; reviewerName: string };

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
  }>();
  const profileId = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
  const { favoriteIds, toggleFavorite } = useFavoriteCoaches(user?.id);
  const saved = !!profileId && favoriteIds.has(profileId);
  const [fetchedData, setFetchedData] = useState<Partial<typeof DEFAULT_PROFESIONAL> | null>(null);
  const [liveReviews, setLiveReviews] = useState<LiveReview[]>([]);
  const [liveAvgRating, setLiveAvgRating] = useState<number | null>(null);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  useEffect(() => {
    const pid = Array.isArray(params.profileId) ? params.profileId[0] : params.profileId;
    if (!pid) return;
    supabase
      .from('coaches')
      .select('id, specialty, price_per_session, nationality, video_url, profiles!inner(name, avatar_url)')
      .eq('profile_id', pid)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        setFetchedData({
          name: (data as any).profiles.name,
          specialty: (data as any).specialty,
          nationality: (data as any).nationality ?? DEFAULT_PROFESIONAL.nationality,
          priceFrom: (data as any).price_per_session,
          video_url: (data as any).video_url ?? null,
          avatar_url: (data as any).profiles.avatar_url ?? null,
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
            <Text style={s.verifiedText}>Verificado por VIVE</Text>
          </View>
        </View>

        {/* ── Info básica ──────────────────────────────────────────────── */}
        <View style={s.infoSection}>
          <Text style={s.name}>{prof.name}</Text>
          <Text style={s.specialty}>{prof.specialty}</Text>

          <Text style={s.metaLine}>
            {prof.age} · {prof.nationality} · {prof.gender}
          </Text>

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
              <Text style={s.noReviewsText}>Todavía no hay reseñas para este coach.</Text>
            </View>
          ) : null}
        </View>

        {/* Espaciador para el footer sticky */}
        <View style={{ height: 108 }} />
      </ScrollView>

      {/* ── Footer sticky ────────────────────────────────────────────────── */}
      <SafeAreaView style={s.footerSafe} edges={['bottom']}>
        <View style={s.footer}>
          <View style={s.footerTop}>
            <Text style={s.price}>
              Desde ${prof.priceFrom.toLocaleString('es-AR')} por sesión
            </Text>
          </View>
          <View style={s.footerButtons}>
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.85}
              onPress={() => {
                if (!isLoggedIn) { requestAuth(); return; }
                console.log('[ProfesionalScreen] coachId:', params.coachId, '| typeof:', typeof params.coachId);
                console.log('[ProfesionalScreen] profileId:', params.profileId, '| typeof:', typeof params.profileId);
                router.push({
                  pathname: '/booking-calendar',
                  params: {
                    name: prof.name,
                    specialty: prof.specialty,
                    priceFrom: String(prof.priceFrom),
                    coachId: params.coachId ?? params.profileId ?? '',
                  },
                });
              }}>
              <Text style={s.btnPrimaryText}>Reservar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSecondary, saved && s.btnSecondaryActive]}
              onPress={() => {
                if (!isLoggedIn) { requestAuth(); return; }
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
