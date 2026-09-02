import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Linking, Image,
} from 'react-native';
import { ScaleCard } from '@/components/ScaleCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { recordCompletion } from '@/lib/resourceCompletions';
import { useRecursoAbierto } from '@/hooks/useRecursoAbierto';

type Resource = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  duration_min: number | null;
  content: any;
  attributed_to_coach_id: string | null;
  coachName: string | null;
  coachAvatarUrl: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  audio: 'Audio guía',
  podcast: 'Podcast/Charla',
  video: 'Video',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

const TYPE_ICONS: Record<string, string> = {
  audio: 'volume-high',
  podcast: 'podcast',
  video: 'video-outline',
  guia_pasos: 'format-list-numbered',
  lectura_breve: 'book-open-variant',
};

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// Links viejos a servicios de streaming (formato anterior del content de audio):
// no se pueden reproducir con expo-audio, se abren afuera como antes.
function isExternalAudio(url: string) {
  return /youtube\.com|youtu\.be|spotify\.com|drive\.google\.com/i.test(url);
}

function formatAudioTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// Paleta del lector — misma que LecturasScreen (la tool hardcodeada de Vita)
const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';

export default function ResourceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const resourceId = typeof params.id === 'string' ? params.id : undefined;
  // El 11º recurso: los de coach, con id dinámico. Mismo par abierto/completado
  // que las herramientas de Vita, así se pueden comparar entre sí — que es la
  // pregunta que importa acá (¿los recursos de coach se terminan más o menos
  // que los nuestros?).
  useRecursoAbierto(resourceId ?? 'desconocido');

  const { user, requestAuth } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinCount, setPinCount] = useState(0);
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [readingDone, setReadingDone] = useState(false);

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // Video: mismo criterio que el audio — el source se setea cuando carga el
  // recurso (replace), no en el render inicial (resource arranca en null).
  const videoPlayer = useVideoPlayer(null, p => { p.loop = false; });
  useEffect(() => {
    if (resource?.type === 'video' && resource.content?.url) {
      videoPlayer.replace({ uri: resource.content.url });
    }
  }, [resource, videoPlayer]);

  // 'none' → 'pending' (listo para votar) → 'submitted' (ya votó)
  const [feedbackState, setFeedbackState] = useState<'none' | 'pending' | 'submitted'>('none');
  const [guiaDone, setGuiaDone] = useState(false);
  const prevPlayingRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  function toggleAudio(url: string) {
    if (!audioLoaded) {
      player.replace({ uri: url });
      player.play();
      setAudioLoaded(true);
      return;
    }
    if (playerStatus.playing) player.pause();
    else player.play();
  }

  function closeReader() {
    setReaderOpen(false);
    setPageIdx(0);
    setReadingDone(false);
  }

  async function saveFeedback(sirvio: boolean) {
    if (!user || !resourceId) return;
    setFeedbackState('submitted');
    await supabase
      .from('resource_feedback')
      .upsert(
        { resource_id: resourceId, user_id: user.id, sirvio },
        { onConflict: 'resource_id,user_id' }
      );
  }

  useEffect(() => {
    if (!user || !resourceId) return;
    supabase
      .from('saved_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));

    supabase
      .from('pinned_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setPinCount(data?.length ?? 0);
        setPinned((data ?? []).some(p => p.resource_id === resourceId));
      });

    // Si ya votó antes, no volver a preguntar
    supabase
      .from('resource_feedback')
      .select('id')
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
      .maybeSingle()
      .then(({ data }) => { if (data) setFeedbackState('submitted'); });
  }, [user, resourceId]);

  // Detectar fin de audio nativo (currentTime llega al final)
  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playerStatus.playing;
    if (
      wasPlaying && !playerStatus.playing &&
      audioLoaded && playerStatus.duration > 1 &&
      playerStatus.currentTime >= playerStatus.duration - 1.5 &&
      feedbackState === 'none'
    ) {
      setFeedbackState('pending');
      if (user && resourceId) recordCompletion(user.id, resourceId).catch(() => {});
    }
  }, [playerStatus.playing]);

  async function toggleSave() {
    if (!user) { requestAuth('guardar_recurso'); return; }
    if (!resourceId) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    if (wasSaved) {
      await supabase
        .from('saved_resources')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resourceId);
    } else {
      // el UNIQUE(user_id,resource_id) (add-saved-resources-unique.sql) rechaza
      // el dup si ya estaba guardado; el error se ignora a propósito
      await supabase
        .from('saved_resources')
        .insert({ user_id: user.id, resource_id: resourceId });
    }
  }

  async function togglePin() {
    if (!user) { requestAuth('pinear_recurso'); return; }
    if (!resourceId) return;

    if (pinned) {
      setPinned(false);
      setPinCount(c => Math.max(0, c - 1));
      setPinNotice(null);
      await supabase
        .from('pinned_resources')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resourceId);
      return;
    }

    if (pinCount >= 4) {
      setPinNotice('Ya tenés 4 recursos en tu inicio. Quitá uno para fijar este');
      return;
    }

    setPinned(true);
    setPinCount(c => c + 1);
    setPinNotice(null);
    const { error } = await supabase
      .from('pinned_resources')
      .insert({ user_id: user.id, resource_id: resourceId });
    if (error) {
      // el trigger rechaza el 5to pin aunque el conteo local diga otra cosa
      setPinned(false);
      setPinCount(c => Math.max(0, c - 1));
      setPinNotice('Ya tenés 4 recursos en tu inicio. Quitá uno para fijar este');
    }
  }

  useEffect(() => {
    if (!resourceId) { setLoading(false); return; }

    supabase
      .from('resources')
      .select('id, type, title, description, duration_min, content, attributed_to_coach_id, profiles(name, avatar_url)')
      .eq('id', resourceId)
      .is('retired_at', null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setResource({
            id: data.id,
            type: data.type,
            title: data.title,
            description: data.description,
            duration_min: data.duration_min,
            content: data.content,
            attributed_to_coach_id: data.attributed_to_coach_id,
            coachName: (data as any).profiles?.name ?? null,
            coachAvatarUrl: (data as any).profiles?.avatar_url ?? null,
          });
        }
        setLoading(false);
      });
  }, [resourceId]);

  if (loading) {
    return (
      <AppBg>
      <SafeAreaView style={[s.safe, s.center]}>
        <ActivityIndicator size="large" color={ViveColors.primary} />
      </SafeAreaView>
      </AppBg>
    );
  }

  if (!resource) {
    return (
      <AppBg>
      <SafeAreaView style={[s.safe, s.center]}>
        <MaterialCommunityIcons name="leaf-off" size={36} color="rgba(135,131,92,0.38)" />
        <Text style={s.notFoundText}>Este recurso ya no está disponible</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.notFoundBtn} activeOpacity={0.8}>
          <Text style={s.notFoundBtnText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
      </AppBg>
    );
  }

  const initials = (resource.coachName ?? '')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // pages es la convención nueva; body es el formato anterior (una sola página)
  const pages: string[] = resource.type === 'lectura_breve'
    ? (Array.isArray(resource.content?.pages) && resource.content.pages.length > 0
        ? resource.content.pages
        : (resource.content?.body ? [resource.content.body] : []))
    : [];

  // ── Lector a pantalla completa — misma interfaz que LecturasScreen ──
  if (readerOpen && pages.length > 0) {
    const isLast = pageIdx === pages.length - 1;
    return (
      <AppBg>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.readerHeader}>
          <TouchableOpacity onPress={closeReader} style={s.readerBackBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={FOREST} />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <Text style={s.readerHeaderTitle}>Lectura breve</Text>
          <View style={{ width: 60 }} />
        </View>

        {readingDone ? (
          <View style={s.doneContent}>
            <MaterialCommunityIcons name="check-circle-outline" size={72} color={TERRACOTTA} />
            <Text style={s.doneTitle}>Lectura completada</Text>
            <Text style={s.doneSub}>Tomarte este espacio importa</Text>
            {feedbackState === 'pending' && (
              <View style={s.feedbackBox}>
                <Text style={s.feedbackQ}>¿Te sirvió?</Text>
                <View style={s.feedbackRow}>
                  <TouchableOpacity style={s.feedbackBtn} onPress={() => saveFeedback(true)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="thumb-up-outline" size={20} color={FOREST} />
                    <Text style={s.feedbackBtnText}>Sí</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.feedbackBtn} onPress={() => saveFeedback(false)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="thumb-down-outline" size={20} color={FOREST} />
                    <Text style={s.feedbackBtnText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {feedbackState === 'submitted' && (
              <Text style={s.feedbackThanks}>Gracias por tu respuesta</Text>
            )}
            <ScaleCard style={s.primaryBtn} onPress={closeReader} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </ScaleCard>
          </View>
        ) : (
          <>
            <View style={s.progressHeader}>
              {pages.map((_, i) => (
                <View key={i} style={[s.progressDot, i <= pageIdx && s.progressDotActive]} />
              ))}
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.readerScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={s.readerMetaRow}>
                <Text style={s.readingNum}>{pageIdx + 1} / {pages.length}</Text>
                {!!resource.duration_min && (
                  <Text style={s.readingDuration}>{resource.duration_min} min</Text>
                )}
              </View>

              <Text style={s.readerTitle}>{resource.title}</Text>
              {!!resource.content?.source && (
                <View style={s.sourceRow}>
                  <MaterialCommunityIcons name="book-open-variant" size={13} color={TERRACOTTA} />
                  <Text style={s.sourceText}>{resource.content.source}</Text>
                </View>
              )}

              <View style={s.bodyCard}>
                <Text style={s.bodyText}>{pages[pageIdx]}</Text>
              </View>

              <ScaleCard
                style={s.primaryBtn}
                onPress={() => {
                  if (isLast) {
                    setReadingDone(true);
                    if (feedbackState === 'none') setFeedbackState('pending');
                    if (user && resourceId) recordCompletion(user.id, resourceId).catch(() => {});
                  } else {
                    setPageIdx(pageIdx + 1);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>{isLast ? 'Terminé' : 'Siguiente'}</Text>
              </ScaleCard>

              <View style={{ height: 32 }} />
            </ScrollView>
          </>
        )}
      </SafeAreaView>
      </AppBg>
    );
  }

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#565E32" />
            <Text style={s.backText}>Atrás</Text>
          </TouchableOpacity>
          <View style={s.topActions}>
            <TouchableOpacity onPress={togglePin} hitSlop={8}>
              <MaterialCommunityIcons
                name={pinned ? 'pin' : 'pin-outline'}
                size={23}
                color={pinned ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSave} hitSlop={8}>
              <MaterialCommunityIcons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={saved ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {!!pinNotice && (
          <View style={s.pinNotice}>
            <MaterialCommunityIcons name="information-outline" size={15} color="#87835C" />
            <Text style={s.pinNoticeText}>{pinNotice}</Text>
          </View>
        )}

        {/* Ficha */}
        <View style={s.metaRow}>
          <View style={s.typeBadge}>
            <MaterialCommunityIcons
              name={(TYPE_ICONS[resource.type] ?? 'book-open-variant') as any}
              size={14}
              color={ViveColors.primary}
            />
            <Text style={s.typeBadgeText}>{TYPE_LABELS[resource.type] ?? resource.type}</Text>
          </View>
          {!!resource.duration_min && (
            <Text style={s.durationText}>{resource.duration_min} min</Text>
          )}
        </View>

        <Text style={s.title}>{resource.title}</Text>
        {!!resource.description && <Text style={s.description}>{resource.description}</Text>}

        {/* Autor — acceso opcional al perfil */}
        {!!resource.attributed_to_coach_id && !!resource.coachName && (
          <TouchableOpacity
            style={s.authorCard}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/profesional', params: { profileId: resource.attributed_to_coach_id! } })}
          >
            {resource.coachAvatarUrl ? (
              <Image source={{ uri: resource.coachAvatarUrl }} style={s.authorAvatar} />
            ) : (
              <View style={[s.authorAvatar, s.authorAvatarFallback]}>
                <Text style={s.authorInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.authorText}>
              <Text style={s.authorName}>Por {resource.coachName}</Text>
              <Text style={s.authorHint}>{resource.coachName.split(' ')[0]} comparte esto con la comunidad de Vita</Text>
            </View>
            <View style={s.authorLink}>
              <Text style={s.authorLinkText}>Ver perfil</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={ViveColors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Contenido — la experiencia de uso */}
        <View style={s.contentCard}>
          {(resource.type === 'audio' || resource.type === 'podcast') && !!resource.content?.url && (
            isExternalAudio(resource.content.url) ? (
              <TouchableOpacity
                style={s.audioBtn}
                onPress={() => Linking.openURL(resource.content.url)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="open-in-new" size={20} color={ViveColors.onPrimaryInk} />
                <Text style={s.audioBtnText}>Escuchar</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={s.audioBtn}
                  onPress={() => toggleAudio(resource.content.url)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons
                    name={playerStatus.playing ? 'pause-circle-outline' : 'play-circle-outline'}
                    size={22}
                    color={ViveColors.onPrimaryInk}
                  />
                  <Text style={s.audioBtnText}>{playerStatus.playing ? 'Pausar' : 'Escuchar'}</Text>
                </TouchableOpacity>
                {audioLoaded && playerStatus.duration > 0 && (
                  <Text style={s.audioTime}>
                    {formatAudioTime(playerStatus.currentTime)} / {formatAudioTime(playerStatus.duration)}
                  </Text>
                )}
              </View>
            )
          )}

          {resource.type === 'video' && !!resource.content?.url && (
            <VideoView
              player={videoPlayer}
              style={s.video}
              contentFit="contain"
              allowsFullscreen
              nativeControls
            />
          )}

          {resource.type === 'guia_pasos' && Array.isArray(resource.content?.steps) && (
            <View style={{ gap: 14 }}>
              {resource.content.steps.map((step: { title: string; body: string }, i: number) => (
                <View key={i} style={s.step}>
                  <View style={s.stepNumber}>
                    <Text style={s.stepNumberText}>{i + 1}</Text>
                  </View>
                  <View style={s.stepText}>
                    {!!step.title && <Text style={s.stepTitle}>{step.title}</Text>}
                    {!!step.body && <Text style={s.stepBody}>{step.body}</Text>}
                  </View>
                </View>
              ))}
              {!guiaDone && (
                <TouchableOpacity
                  style={s.audioBtn}
                  onPress={() => {
                    setGuiaDone(true);
                    if (feedbackState === 'none') setFeedbackState('pending');
                    if (user && resourceId) recordCompletion(user.id, resourceId).catch(() => {});
                  }}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color={ViveColors.onPrimaryInk} />
                  <Text style={s.audioBtnText}>Completé esta guía</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {resource.type === 'lectura_breve' && pages.length > 0 && (
            <TouchableOpacity
              style={s.audioBtn}
              onPress={() => setReaderOpen(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="book-open-variant" size={22} color={ViveColors.onPrimaryInk} />
              <Text style={s.audioBtnText}>Comenzar lectura</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Feedback post-uso — aparece para audio y guía una vez completados */}
        {feedbackState !== 'none' && resource.type !== 'lectura_breve' && (
          <View style={s.feedbackCard}>
            {feedbackState === 'pending' ? (
              <>
                <Text style={s.feedbackQ}>¿Te sirvió?</Text>
                <View style={s.feedbackRow}>
                  <TouchableOpacity style={s.feedbackBtn} onPress={() => saveFeedback(true)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="thumb-up-outline" size={20} color={FOREST} />
                    <Text style={s.feedbackBtnText}>Sí</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.feedbackBtn} onPress={() => saveFeedback(false)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="thumb-down-outline" size={20} color={FOREST} />
                    <Text style={s.feedbackBtnText}>No</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={s.feedbackThanks}>Gracias por tu respuesta</Text>
            )}
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  pinNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(86,94,50,0.08)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  pinNoticeText: { flex: 1, fontFamily: ViveFonts.regular, fontSize: 12, color: '#87835C' },
  backText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#87835C' },

  notFoundText: { fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.80)' },
  notFoundBtn: {
    backgroundColor: ViveColors.primaryInk,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  notFoundBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#F7EFE4' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(86,94,50,0.10)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  typeBadgeText: { fontFamily: ViveFonts.medium, fontSize: 12, color: '#565E32' },
  durationText: { fontFamily: ViveFonts.regular, fontSize: 12, color: '#87835C' },

  title: {
    fontFamily: ViveFonts.semibold,
    fontSize: 24,
    color: '#565E32',
    marginTop: 12,
    lineHeight: 30,
  },
  description: {
    fontFamily: ViveFonts.regular,
    fontSize: 14,
    color: '#87835C',
    lineHeight: 21,
    marginTop: 8,
  },

  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 12,
    marginTop: 18,
  },
  authorAvatar: { width: 40, height: 40, borderRadius: 20 },
  authorAvatarFallback: {
    backgroundColor: 'rgba(192,107,74,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitials: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#FFF8F0' },
  authorText: { flex: 1, gap: 2 },
  authorName: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32' },
  authorHint: { fontFamily: ViveFonts.regular, fontSize: 11, color: 'rgba(135,131,92,0.85)' },
  authorLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  authorLinkText: { fontFamily: ViveFonts.medium, fontSize: 12, color: ViveColors.primary },

  contentCard: {
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 18,
    marginTop: 18,
  },

  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ViveColors.primaryInk,
    borderRadius: 14,
    paddingVertical: 14,
  },
  audioBtnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#F7EFE4' },
  audioTime: { fontFamily: ViveFonts.medium, fontSize: 12, color: '#87835C', textAlign: 'center' },

  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: '#000', overflow: 'hidden' },

  step: { flexDirection: 'row', gap: 12 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(86,94,50,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { fontFamily: ViveFonts.semibold, fontSize: 13, color: '#565E32' },
  stepText: { flex: 1, gap: 3 },
  stepTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },
  stepBody: { fontFamily: ViveFonts.regular, fontSize: 13, color: '#87835C', lineHeight: 19 },

  // ── Lector — estilos calcados de LecturasScreen ──
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  readerBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  readerHeaderTitle: { fontFamily: ViveFonts.bold, fontSize: 22, color: FOREST, letterSpacing: -0.3 },

  progressHeader: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(63,81,47,0.15)' },
  progressDotActive: { backgroundColor: FOREST },

  readerScroll: { paddingHorizontal: 22, paddingTop: 8, gap: 16 },
  readerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readingNum: { fontFamily: ViveFonts.medium, fontSize: 12, color: FOREST_SOFT },
  readingDuration: { fontFamily: ViveFonts.regular, fontSize: 12, color: 'rgba(135,131,92,0.60)' },
  readerTitle: { fontFamily: ViveFonts.title, fontSize: 28, color: FOREST, lineHeight: 36, letterSpacing: -0.3 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -6 },
  sourceText: { fontFamily: ViveFonts.medium, fontSize: 11.5, color: TERRACOTTA, flex: 1 },

  bodyCard: { backgroundColor: GLASS, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER, padding: 20 },
  bodyText: { fontFamily: ViveFonts.regular, fontSize: 15, color: '#3A3A2A', lineHeight: 26 },

  primaryBtn: { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4, alignSelf: 'stretch' },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  doneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  doneTitle: { fontFamily: ViveFonts.title, fontSize: 28, color: FOREST, textAlign: 'center' },
  doneSub: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },

  feedbackBox:   { alignItems: 'center', gap: 12, width: '100%' },
  feedbackCard:  { marginTop: 20, marginHorizontal: 0, borderRadius: 18, borderWidth: 1, borderColor: GLASS_BORDER, backgroundColor: GLASS, padding: 18, alignItems: 'center', gap: 12 },
  feedbackQ:     { fontFamily: ViveFonts.semibold, fontSize: 15, color: FOREST },
  feedbackRow:   { flexDirection: 'row', gap: 12 },
  feedbackBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: 'rgba(58,79,42,0.25)', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: GLASS },
  feedbackBtnText: { fontFamily: ViveFonts.medium, fontSize: 14, color: FOREST },
  feedbackThanks: { fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST_SOFT, fontStyle: 'italic' },
});
