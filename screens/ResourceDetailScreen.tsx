import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Linking, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';

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
  audio: 'Audio',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

const TYPE_ICONS: Record<string, string> = {
  audio: 'volume-high',
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

// Paleta del lector — misma que LecturasScreen (la tool hardcodeada de VITA)
const FOREST      = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const CREAM_LIGHT = '#F3EEDF';
const TERRACOTTA  = '#C1694F';

export default function ResourceDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const resourceId = typeof params.id === 'string' ? params.id : undefined;

  const { user, requestAuth } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [readingDone, setReadingDone] = useState(false);

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const [audioLoaded, setAudioLoaded] = useState(false);

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

  useEffect(() => {
    if (!user || !resourceId) return;
    supabase
      .from('saved_resources')
      .select('resource_id')
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, resourceId]);

  async function toggleSave() {
    if (!user) { requestAuth(); return; }
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
      await supabase
        .from('saved_resources')
        .insert({ user_id: user.id, resource_id: resourceId });
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
        <Text style={s.notFoundText}>Este recurso ya no está disponible.</Text>
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
            <Text style={s.doneSub}>Tomarte este espacio importa.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={closeReader} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Volver</Text>
            </TouchableOpacity>
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

              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => (isLast ? setReadingDone(true) : setPageIdx(pageIdx + 1))}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>{isLast ? 'Terminé' : 'Siguiente'}</Text>
              </TouchableOpacity>

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
          <TouchableOpacity onPress={toggleSave} hitSlop={8}>
            <MaterialCommunityIcons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={saved ? ViveColors.primary : 'rgba(135,131,92,0.72)'}
            />
          </TouchableOpacity>
        </View>

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
              <Text style={s.authorHint}>{resource.coachName.split(' ')[0]} comparte esto con la comunidad de VITA</Text>
            </View>
            <View style={s.authorLink}>
              <Text style={s.authorLinkText}>Ver perfil</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={ViveColors.primary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Contenido — la experiencia de uso */}
        <View style={s.contentCard}>
          {resource.type === 'audio' && !!resource.content?.url && (
            isExternalAudio(resource.content.url) ? (
              <TouchableOpacity
                style={s.audioBtn}
                onPress={() => Linking.openURL(resource.content.url)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="open-in-new" size={20} color="#565E32" />
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
                    color="#565E32"
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
            </View>
          )}

          {resource.type === 'lectura_breve' && pages.length > 0 && (
            <TouchableOpacity
              style={s.audioBtn}
              onPress={() => setReaderOpen(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="book-open-variant" size={22} color="#565E32" />
              <Text style={s.audioBtnText}>Comenzar lectura</Text>
            </TouchableOpacity>
          )}
        </View>

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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  backText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#87835C' },

  notFoundText: { fontFamily: ViveFonts.regular, fontSize: 14, color: 'rgba(135,131,92,0.80)' },
  notFoundBtn: {
    backgroundColor: ViveColors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  notFoundBtnText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32' },

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
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  audioBtnText: { fontFamily: ViveFonts.semibold, fontSize: 15, color: '#565E32' },
  audioTime: { fontFamily: ViveFonts.medium, fontSize: 12, color: '#87835C', textAlign: 'center' },

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
  readerTitle: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST, lineHeight: 36, letterSpacing: -0.3 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -6 },
  sourceText: { fontFamily: ViveFonts.medium, fontSize: 11.5, color: TERRACOTTA, flex: 1 },

  bodyCard: { backgroundColor: GLASS, borderRadius: 20, borderWidth: 1, borderColor: GLASS_BORDER, padding: 20 },
  bodyText: { fontFamily: ViveFonts.regular, fontSize: 15, color: '#3A3A2A', lineHeight: 26 },

  primaryBtn: { backgroundColor: FOREST, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4, alignSelf: 'stretch' },
  primaryBtnText: { fontFamily: ViveFonts.semibold, fontSize: 16, color: CREAM_LIGHT },

  doneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 18 },
  doneTitle: { fontFamily: ViveFonts.frauncesSerif, fontSize: 28, color: FOREST, textAlign: 'center' },
  doneSub: { fontFamily: ViveFonts.regular, fontSize: 15, color: FOREST_SOFT, textAlign: 'center', lineHeight: 23 },
});
