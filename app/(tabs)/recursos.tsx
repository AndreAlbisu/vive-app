import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMoodHistory } from '@/hooks/useMoodHistory';
import { useResourceProgress } from '@/hooks/useResourceProgress';
import { useRecommendedResource, type Reco, type Axis } from '@/hooks/useRecommendedResource';
import { DOORS } from '@/constants/conexionesDoors';

// ─── Tipos ───────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type CoachRecoItem = {
  id: string;
  resource_id: string;
  note: string | null;
  opened_at: string | null;
  created_at: string;
  coach_resources: {
    id: string;
    title: string;
    format: string;
    duration_seconds: number | null;
    topic_id: string;
  };
  coaches: {
    profiles: { name: string };
  };
};

type CoachResourceItem = {
  id: string;
  title: string;
  format: string;
  duration_seconds: number | null;
  topic_id: string;
  coaches: {
    profiles: { name: string };
  };
};

interface Tool {
  id: string;
  label: string;
  icon: IoniconName;
  duration: string;
  route?: string;
}

interface ToolGroup {
  id: string;
  title: string;
  subtitle: string;
  toolIds: string[];
}


// ─── Datos ───────────────────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',          icon: 'book-outline',          duration: 'Libre',      route: '/diario'      },
  { id: 'gratitud',    label: 'Gratitud',         icon: 'heart-outline',         duration: '5 min',      route: '/gratitud'    },
  { id: 'sueno',       label: 'Sueño',            icon: 'moon-outline',          duration: '10–20 min',  route: '/sueno'       },
  { id: 'respiracion', label: 'Respiración',      icon: 'cloud-outline',         duration: '3–8 min',    route: '/respiracion' },
  { id: 'meditacion',  label: 'Meditación',       icon: 'leaf-outline',          duration: '10–15 min',  route: '/meditacion'  },
  { id: 'escaner',     label: 'Escáner corporal', icon: 'body-outline',          duration: '8 min',      route: '/escaner'     },
  { id: 'relajacion',  label: 'Relajación',       icon: 'musical-notes-outline', duration: '10 min',     route: '/relajacion'  },
  { id: 'ruido',       label: 'Ruido blanco',     icon: 'volume-medium-outline', duration: 'Libre',      route: '/ruido'       },
  { id: 'lecturas',    label: 'Lecturas breves',  icon: 'library-outline',       duration: '5–10 min',   route: '/lecturas'    },
  { id: 'anclaje',     label: 'Anclaje',          icon: 'locate-outline',        duration: '2–3 min',    route: '/anclaje'     },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.id, t]));

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'reflexion',
    title: 'Para reflexionar',
    subtitle: 'Poner en palabras lo que pasa',
    toolIds: ['diario', 'gratitud'],
  },
  {
    id: 'calma',
    title: 'Para calmarte ahora',
    subtitle: 'Cuando la mente va rápido',
    toolIds: ['ruido', 'respiracion'],
  },
];

// ─── Colores locales ─────────────────────────────────────────────────────────
const FOREST       = '#3A4F2A';
const FOREST_SOFT  = '#6B7A56';
const CREAM_LIGHT  = '#F3EEDF';
const TERRACOTTA   = '#C1694F';
const TERRA_SOFT   = '#EAD3C6';
const GLASS_BG     = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// ─── StreakChip ───────────────────────────────────────────────────────────────
function StreakChip({ streak, weekActivity }: { streak: number; weekActivity: boolean[] }) {
  return (
    <View style={s.streakChip}>
      <Text style={s.streakText}>{streak} {streak === 1 ? 'día' : 'días'}</Text>
      <View style={s.streakDots}>
        {weekActivity.map((active, i) => (
          <View key={i} style={[s.streakDot, active && s.streakDotActive]} />
        ))}
      </View>
    </View>
  );
}

// ─── RecommendedCard ──────────────────────────────────────────────────────────
// Tarjeta única que reemplaza al viejo bloque de mood + la CoachSection falsa.
// La lógica de qué recomendar vive en useRecommendedResource; acá solo se pinta.
function RecommendedCard({
  reco,
  onGoToCheckIn,
}: {
  reco: Reco | null;
  onGoToCheckIn: () => void;
}) {
  const router = useRouter();

  // Sin señal (ni ánimo ni tema ni historial) → invitamos al check-in, que es
  // justo lo que destraba la recomendación personalizada.
  if (!reco) {
    return (
      <LinearGradient
        colors={['#42542F', '#354526']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.moodCard}>
        <Text style={s.moodEyebrow}>CHECK-IN DE ÁNIMO</Text>
        <Text style={s.moodTitle}>{'¿Cómo te sentís hoy?'}</Text>
        <TouchableOpacity style={s.moodCta} onPress={onGoToCheckIn} activeOpacity={0.8}>
          <Ionicons name="happy-outline" size={20} color={TERRA_SOFT} />
          <Text style={s.moodCtaText}>Registrar mi estado de ánimo</Text>
          <Ionicons name="chevron-forward" size={16} color={TERRA_SOFT} />
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // Datos de presentación según el tipo de recurso recomendado.
  let icon: IoniconName;
  let title: string;
  let onPress: () => void;
  if (reco.kind === 'tool') {
    const tool = TOOL_MAP[reco.toolId];
    icon = tool?.icon ?? 'sparkles-outline';
    title = tool?.label ?? reco.toolId;
    onPress = () => { if (tool?.route) router.push(tool.route as any); };
  } else {
    icon = LIBRARY_TYPE_ICON[reco.resource.type] ?? 'book-outline';
    title = reco.resource.title;
    onPress = () => router.push({ pathname: '/recurso', params: { id: reco.resource.id } });
  }

  return (
    <LinearGradient
      colors={['#42542F', '#354526']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={s.moodCard}>
      <Text style={s.moodEyebrow}>{reco.eyebrow}</Text>
      <Text style={s.moodTitle}>Esto te puede servir ahora:</Text>
      <TouchableOpacity style={s.moodSuggestion} onPress={onPress} activeOpacity={0.8}>
        <View style={s.moodSuggestionIcon}>
          <Ionicons name={icon} size={20} color={TERRA_SOFT} />
        </View>
        <View style={s.moodSuggestionText}>
          <Text style={s.moodSuggestionTitle}>{title}</Text>
          <Text style={s.moodSuggestionWhy}>{reco.why}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={TERRA_SOFT} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ─── ContinueCard ─────────────────────────────────────────────────────────────
function ContinueCard({
  resourceId,
  progressSeconds,
  durationSeconds,
}: {
  resourceId: string;
  progressSeconds: number;
  durationSeconds: number;
}) {
  const router = useRouter();
  const tool = TOOL_MAP[resourceId];
  if (!tool) return null;

  const pct = progressSeconds / durationSeconds;
  const remainingMin = Math.ceil((durationSeconds - progressSeconds) / 60);
  const totalMin = Math.ceil(durationSeconds / 60);

  return (
    <ScaleCard
      style={s.continueCard}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.88}>
      <View style={s.continueIcon}>
        <Ionicons name={tool.icon} size={22} color={FOREST} />
      </View>
      <View style={s.continueText}>
        <Text style={s.continueTitle}>Continuar: {tool.label}</Text>
        <Text style={s.continueSub}>Te quedan {remainingMin} min de {totalMin}</Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>
      </View>
    </ScaleCard>
  );
}

// ─── CoachLibrarySection (recursos publicados por cualquier coach) ───────────
type LibraryResource = {
  id: string;
  type: string;
  title: string;
  duration_min: number | null;
  attributed_to_coach_id: string;
  coachName: string;
  axes: string[];   // resource_axes — alimenta la recomendación por eje
};

// Criterio del carrusel "Recursos de nuestros coaches": el TEMA lidera (para
// descubrir cosas fuera de tu propio coach), la recencia desempata. Tope 2 por
// coach para diversidad, y se excluye el que ya muestra la card de arriba.
// `list` entra ya ordenada por created_at desc (la query), así que la partición
// estable preserva la recencia dentro de cada grupo.
function rankCoachLibrary(
  list: LibraryResource[],
  interestAxes: Set<Axis>,
  excludeId: string | null,
): LibraryResource[] {
  const matches: LibraryResource[] = [];
  const rest: LibraryResource[] = [];
  for (const r of list) {
    if (r.id === excludeId) continue;
    const isMatch = interestAxes.size > 0 && r.axes.some(a => interestAxes.has(a as Axis));
    (isMatch ? matches : rest).push(r);
  }
  const ordered = [...matches, ...rest];

  const perCoach: Record<string, number> = {};
  const out: LibraryResource[] = [];
  for (const r of ordered) {
    const c = r.attributed_to_coach_id;
    if ((perCoach[c] ?? 0) >= 2) continue;   // tope 2 por coach
    perCoach[c] = (perCoach[c] ?? 0) + 1;
    out.push(r);
    if (out.length >= 12) break;
  }
  return out;
}

const LIBRARY_TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'volume-medium-outline',
  podcast: 'mic-outline',
  video: 'videocam-outline',
  guia_pasos: 'list-outline',
  lectura_breve: 'book-outline',
};

const LIBRARY_TYPE_LABEL: Record<string, string> = {
  audio: 'Audio guía',
  podcast: 'Podcast/Charla',
  video: 'Video',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

const FORMAT_COLOR: Record<string, string> = {
  audio:   '#C1694F',
  podcast: '#3B7FC4',
  video:   '#7B5EA7',
  lectura: '#4A7C59',
};
const FORMAT_LABEL: Record<string, string> = {
  audio: 'Audio', podcast: 'Podcast', video: 'Video', lectura: 'Lectura',
};
const FORMAT_ICON: Record<string, IoniconName> = {
  audio:   'volume-medium-outline',
  podcast: 'mic-outline',
  video:   'videocam-outline',
  lectura: 'book-outline',
};

function fmtDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.ceil(secs / 60);
  return m < 60 ? `${m} min` : `${Math.round(m / 60)}h`;
}

function CoachLibrarySection({
  resources,
  savedIds,
  onSave,
}: {
  resources: LibraryResource[];
  savedIds: Set<string>;
  onSave: (id: string) => void;
}) {
  const router = useRouter();
  if (resources.length === 0) return null;

  return (
    <View style={{ marginTop: 8 }}>
      <View style={s.libraryHeaderRow}>
        <Text style={[s.sectionTitle, s.sectionTitleFlush]}>Recursos de nuestros coaches</Text>
        <TouchableOpacity onPress={() => router.push('/explorar-recursos')} hitSlop={8} activeOpacity={0.7}>
          <Text style={s.exploreLink}>Explorar todo →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.libraryRow}>
        {resources.map(r => {
          const isSaved = savedIds.has(r.id);
          return (
            <ScaleCard
              key={r.id}
              style={s.libraryCard}
              onPress={() => router.push({ pathname: '/recurso', params: { id: r.id } })}
            >
              <View style={s.libraryCardHeader}>
                <Ionicons name={LIBRARY_TYPE_ICON[r.type] ?? 'book-outline'} size={20} color={FOREST} />
                <TouchableOpacity onPress={() => onSave(r.id)} hitSlop={8}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={16}
                    color={isSaved ? FOREST : 'rgba(135,131,92,0.60)'}
                  />
                </TouchableOpacity>
              </View>
              <Text style={s.libraryCardTitle} numberOfLines={2}>{r.title}</Text>
              <Text style={s.libraryCardMeta}>
                {LIBRARY_TYPE_LABEL[r.type] ?? r.type}{r.duration_min ? ` · ${r.duration_min} min` : ''}
              </Text>
              <Text style={s.libraryCardCoach} numberOfLines={1}>Por {r.coachName}</Text>
            </ScaleCard>
          );
        })}
      </ScrollView>
    </View>
  );
}


// ─── CoachRecoSection ─────────────────────────────────────────────────────────
function CoachRecoSection({
  recos,
  onPress,
}: {
  recos: CoachRecoItem[];
  onPress: (item: CoachRecoItem) => void;
}) {
  if (recos.length === 0) return null;

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.sectionTitle}>De tus coaches</Text>
      {recos.map(item => {
        const res = item.coach_resources;
        const color = FORMAT_COLOR[res.format] ?? TERRACOTTA;
        const isNew = !item.opened_at;
        const coachName = item.coaches?.profiles?.name ?? 'Tu coach';
        return (
          <ScaleCard
            key={item.id}
            style={s.recoCard}
            onPress={() => onPress(item)}
            activeOpacity={0.88}>
            {/* Cover strip */}
            <View style={[s.recoStrip, { backgroundColor: color }]}>
              <Ionicons name={FORMAT_ICON[res.format] ?? 'book-outline'} size={18} color="#fff" />
            </View>
            <View style={s.recoBody}>
              <View style={s.recoTopRow}>
                <Text style={s.recoTitle} numberOfLines={2}>{res.title}</Text>
                {isNew && <View style={s.recoBadge}><Text style={s.recoBadgeText}>NUEVO</Text></View>}
              </View>
              <Text style={s.recoCoach}>Por {coachName}</Text>
              {item.note ? <Text style={s.recoNote} numberOfLines={2}>"{item.note}"</Text> : null}
              <Text style={s.recoMeta}>
                {FORMAT_LABEL[res.format] ?? res.format}{res.duration_seconds ? ` · ${fmtDuration(res.duration_seconds)}` : ''}
              </Text>
            </View>
          </ScaleCard>
        );
      })}
    </View>
  );
}

// ─── ExploreSection ───────────────────────────────────────────────────────────
const FORMATS = ['audio', 'podcast', 'video', 'lectura'] as const;

function ExploreSection({
  resources,
  savedIds,
  onSave,
  selectedDoor,
  onSelectDoor,
  selectedFormat,
  onSelectFormat,
}: {
  resources: CoachResourceItem[];
  savedIds: Set<string>;
  onSave: (id: string) => void;
  selectedDoor: string | null;
  onSelectDoor: (id: string | null) => void;
  selectedFormat: string | null;
  onSelectFormat: (f: string | null) => void;
}) {
  const router = useRouter();

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={s.sectionTitle}>Explorar por tema</Text>

      {/* Chips de puertas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}>
        <TouchableOpacity
          style={[s.chip, !selectedDoor && s.chipActive]}
          onPress={() => onSelectDoor(null)}
          activeOpacity={0.75}>
          <Text style={[s.chipText, !selectedDoor && s.chipTextActive]}>Todos</Text>
        </TouchableOpacity>
        {DOORS.map(door => {
          const active = selectedDoor === door.id;
          return (
            <TouchableOpacity
              key={door.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => onSelectDoor(active ? null : door.id)}
              activeOpacity={0.75}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{door.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Filtro de formato */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.chipsRow, { marginTop: 6 }]}>
        {FORMATS.map(f => {
          const active = selectedFormat === f;
          return (
            <TouchableOpacity
              key={f}
              style={[s.chip, s.chipSmall, active && { backgroundColor: FORMAT_COLOR[f] + '22', borderColor: FORMAT_COLOR[f] }]}
              onPress={() => onSelectFormat(active ? null : f)}
              activeOpacity={0.75}>
              <Ionicons name={FORMAT_ICON[f]} size={11} color={active ? FORMAT_COLOR[f] : FOREST_SOFT} />
              <Text style={[s.chipText, s.chipTextSmall, active && { color: FORMAT_COLOR[f] }]}>{FORMAT_LABEL[f]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Grilla 2 columnas */}
      {resources.length === 0 ? (
        <Text style={s.emptyText}>No hay recursos para este tema todavía.</Text>
      ) : (
        <View style={s.exploreGrid}>
          {resources.map((r, i) => {
            const color = FORMAT_COLOR[r.format] ?? TERRACOTTA;
            const isSaved = savedIds.has(r.id);
            const coachName = r.coaches?.profiles?.name ?? '';
            return (
              <ScaleCard
                key={r.id}
                style={[s.exploreCard, i % 2 === 0 ? { marginRight: 5 } : { marginLeft: 5 }]}
                onPress={() => router.push({ pathname: '/coach-recurso', params: { id: r.id } } as any)}
                activeOpacity={0.88}>
                <View style={[s.exploreCover, { backgroundColor: color + '22' }]}>
                  <Ionicons name={FORMAT_ICON[r.format] ?? 'book-outline'} size={22} color={color} />
                </View>
                <TouchableOpacity style={s.exploreBookmark} onPress={() => onSave(r.id)} hitSlop={8}>
                  <Ionicons
                    name={isSaved ? 'bookmark' : 'bookmark-outline'}
                    size={14}
                    color={isSaved ? TERRACOTTA : 'rgba(135,131,92,0.55)'}
                  />
                </TouchableOpacity>
                <Text style={s.exploreTitle} numberOfLines={3}>{r.title}</Text>
                <Text style={s.exploreMeta}>
                  {FORMAT_LABEL[r.format]}{r.duration_seconds ? ` · ${fmtDuration(r.duration_seconds)}` : ''}
                </Text>
                {coachName ? <Text style={s.exploreCoach} numberOfLines={1}>Por {coachName}</Text> : null}
              </ScaleCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── ToolCard ─────────────────────────────────────────────────────────────────
function ToolCard({
  tool,
  saved,
  onSave,
}: {
  tool: Tool;
  saved: boolean;
  onSave: () => void;
}) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.toolCard}
      onPress={() => { if (tool.route) router.push(tool.route as any); }}
      activeOpacity={0.88}>
      <TouchableOpacity style={s.bookmarkBtn} onPress={onSave} hitSlop={8}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={15}
          color={saved ? TERRACOTTA : '#87835C'}
        />
      </TouchableOpacity>
      <View style={s.toolIconWrap}>
        <Ionicons name={tool.icon} size={24} color={FOREST} />
      </View>
      <Text style={s.toolLabel}>{tool.label}</Text>
      <Text style={s.toolDuration}>{tool.duration}</Text>
    </ScaleCard>
  );
}

// ─── ToolsCarousel ────────────────────────────────────────────────────────────
// Todas las tools de VITA en un solo carrusel horizontal (antes: 3 grillas
// verticales). Comprime a una fila y le deja espacio a los recursos de coach.
// El orden preserva la intención de TOOL_GROUPS (calma → reflexión → descanso).
function ToolsCarousel({
  savedIds,
  onSave,
}: {
  savedIds: Set<string>;
  onSave: (id: string) => void;
}) {
  const seen = new Set<string>();
  const tools: Tool[] = [];
  for (const g of TOOL_GROUPS) {
    for (const id of g.toolIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = TOOL_MAP[id];
      if (t) tools.push(t);
    }
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.toolsRow}>
      {tools.map(tool => (
        <ToolCard
          key={tool.id}
          tool={tool}
          saved={savedIds.has(tool.id)}
          onSave={() => onSave(tool.id)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecursosScreen() {
  const router = useRouter();
  const { user, requestAuth } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [libraryResources, setLibraryResources] = useState<LibraryResource[]>([]);
  const [coachRecos, setCoachRecos] = useState<CoachRecoItem[]>([]);
  const [exploreResources, setExploreResources] = useState<CoachResourceItem[]>([]);
  const [selectedDoor, setSelectedDoor] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  // ── Cargar biblioteca de recursos publicados por coaches (tabla resources vieja) ──
  useEffect(() => {
    supabase
      .from('resources')
      .select('id, type, title, duration_min, attributed_to_coach_id, profiles!inner(name), resource_axes(axis)')
      .not('attributed_to_coach_id', 'is', null)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (!data) return;
        setLibraryResources(data.map((r: any) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          duration_min: r.duration_min,
          attributed_to_coach_id: r.attributed_to_coach_id,
          coachName: r.profiles?.name ?? 'un coach',
          axes: (r.resource_axes ?? []).map((a: any) => a.axis),
        })));
      });
  }, []);

  // ── Recomendaciones de coaches al usuario ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('resource_recommendations')
      .select('id, resource_id, note, opened_at, created_at, coach_resources!inner(id, title, format, duration_seconds, topic_id), coaches!inner(profiles!inner(name))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setCoachRecos(data as any); });
  }, [user]);

  // ── Explorar coach_resources con filtros ────────────────────────────────────
  useEffect(() => {
    let query = supabase
      .from('coach_resources')
      .select('id, title, format, duration_seconds, topic_id, coaches!inner(profiles!inner(name))')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20);
    if (selectedDoor) query = query.eq('topic_id', selectedDoor);
    if (selectedFormat) query = query.eq('format', selectedFormat);
    query.then(({ data }) => { if (data) setExploreResources(data as any); });
  }, [selectedDoor, selectedFormat]);

  const { entries: moodEntries } = useMoodHistory(user?.id, 1);
  const todayMoodEntry = moodEntries[0];

  const { streak, weekActivity, lastInProgress, completedInLast7Days } =
    useResourceProgress(user?.id);

  const { reco, interestAxes, excludeId } = useRecommendedResource({
    userId: user?.id,
    todayMood: todayMoodEntry,
    library: libraryResources,
    recentlyDone: completedInLast7Days,
  });

  // Carrusel rankeado por tema (ver rankCoachLibrary)
  const rankedLibrary = useMemo(
    () => rankCoachLibrary(libraryResources, interestAxes, excludeId),
    [libraryResources, interestAxes, excludeId],
  );

  // ── Cargar guardados ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('saved_resources').select('resource_id').eq('user_id', user.id),
      supabase.from('resource_saves').select('resource_id').eq('user_id', user.id),
    ]).then(([old, newer]) => {
      const ids = new Set<string>();
      (old.data ?? []).forEach(r => ids.add(r.resource_id as string));
      (newer.data ?? []).forEach(r => ids.add(r.resource_id as string));
      setSavedIds(ids);
    });
  }, [user]);

  async function toggleSave(resourceId: string, isCoachResource = false) {
    if (!user) { requestAuth(); return; }
    const isSaved = savedIds.has(resourceId);
    setSavedIds(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(resourceId); else next.add(resourceId);
      return next;
    });
    const table = isCoachResource ? 'resource_saves' : 'saved_resources';
    if (isSaved) {
      await supabase.from(table).delete().eq('user_id', user.id).eq('resource_id', resourceId);
    } else {
      await supabase.from(table).insert({ user_id: user.id, resource_id: resourceId });
    }
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <FirstTimeTooltip
          storageKey="vive_tooltip_recursos"
          icon="book-open-outline"
          title="Recursos para vos"
          description="Herramientas de bienestar para usar cuando quieras, a tu ritmo."
          delay={800}
        />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.container}
          showsVerticalScrollIndicator={false}>

          {/* 1. Header + racha + guardados */}
          <View style={s.header}>
            <Text style={s.pageTitle}>Recursos</Text>
            <View style={s.headerActions}>
              {streak > 0 && (
                <StreakChip streak={streak} weekActivity={weekActivity} />
              )}
              <TouchableOpacity
                onPress={() => (user ? router.push('/recursos-guardados') : requestAuth())}
                hitSlop={8}
                activeOpacity={0.7}>
                <Ionicons name="bookmark-outline" size={22} color={FOREST} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Recomendación personalizada (ánimo + tema) */}
          <RecommendedCard
            reco={reco}
            onGoToCheckIn={() => router.push('/')}
          />

          {/* 3. Continuar donde dejaste */}
          {lastInProgress && (
            <ContinueCard {...lastInProgress} />
          )}

          {/* 4. De tus coaches — recomendaciones personalizadas por chat */}
          <CoachRecoSection
            recos={coachRecos}
            onPress={async item => {
              if (!item.opened_at) {
                await supabase
                  .from('resource_recommendations')
                  .update({ opened_at: new Date().toISOString() })
                  .eq('id', item.id)
                  .is('opened_at', null);
                setCoachRecos(prev => prev.map(r =>
                  r.id === item.id ? { ...r, opened_at: new Date().toISOString() } : r
                ));
              }
              router.push({ pathname: '/coach-recurso', params: { id: item.resource_id } } as any);
            }}
          />

          {/* 5. Herramientas de Vive */}
          <Text style={s.sectionTitle}>Herramientas de Vive</Text>
          <ToolsCarousel savedIds={savedIds} onSave={toggleSave} />

          {/* Biblioteca de recursos de coaches (tabla resources vieja — resource_saves para UUIDs) */}
          <CoachLibrarySection
            resources={rankedLibrary}
            savedIds={savedIds}
            onSave={id => toggleSave(id, true)}
          />

          {/* 6. Explorar por tema — coach_resources publicados */}
          <ExploreSection
            resources={exploreResources}
            savedIds={savedIds}
            onSave={id => toggleSave(id, true)}
            selectedDoor={selectedDoor}
            onSelectDoor={setSelectedDoor}
            selectedFormat={selectedFormat}
            onSelectFormat={setSelectedFormat}
          />

          <View style={{ height: TAB_BAR_CLEARANCE }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1 },
  scroll:    { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 20 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 34,
    color: FOREST,
    lineHeight: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  // ── StreakChip ─────────────────────────────────────────────────────────────
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 4,
  },
  streakText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: FOREST,
  },
  streakDots:    { flexDirection: 'row', gap: 4 },
  streakDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(63,81,47,0.18)' },
  streakDotActive: { backgroundColor: TERRACOTTA },

  // ── MoodContextBlock ───────────────────────────────────────────────────────
  moodCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  moodEyebrow: {
    fontFamily: ViveFonts.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(201,207,175,0.9)',
    marginBottom: 8,
  },
  moodTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: CREAM_LIGHT,
    lineHeight: 26,
    marginBottom: 14,
  },
  moodEmphasis: {
    fontStyle: 'italic',
    color: TERRA_SOFT,
  },
  moodSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 13,
  },
  moodSuggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(234,211,198,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moodSuggestionText: { flex: 1 },
  moodSuggestionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: CREAM_LIGHT,
    marginBottom: 2,
  },
  moodSuggestionWhy: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(201,207,175,0.85)',
    lineHeight: 15,
  },
  moodCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 13,
  },
  moodCtaText: {
    flex: 1,
    fontFamily: ViveFonts.medium,
    fontSize: 14,
    color: CREAM_LIGHT,
  },

  // ── ContinueCard ──────────────────────────────────────────────────────────
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 14,
  },
  continueIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  continueText: { flex: 1, minWidth: 0 },
  continueTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: FOREST,
    marginBottom: 2,
  },
  continueSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    marginBottom: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(235,229,215,0.80)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: TERRACOTTA,
    borderRadius: 3,
  },

  // ── Sección "De tu coach" ─────────────────────────────────────────────────
  sectionTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 20,
    color: FOREST,
    marginTop: 8,
    marginBottom: 10,
  },
  libraryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitleFlush: { marginTop: 0, marginBottom: 0, flexShrink: 1 },
  exploreLink: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: TERRACOTTA,
    marginLeft: 10,
  },
  coachCard: {
    backgroundColor: GLASS_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 16,
    marginBottom: 24,
  },
  libraryRow: { gap: 10, paddingBottom: 4 },
  libraryCard: {
    width: 140,
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 6,
  },
  libraryCardTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: FOREST,
    lineHeight: 17,
  },
  libraryCardMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
  },
  libraryCardCoach: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: 'rgba(58,79,42,0.55)',
    fontStyle: 'italic',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachInitials: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 16,
    color: '#FFF3E8',
  },
  coachHeaderText: { flex: 1 },
  coachName: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: FOREST,
  },
  coachUpdated: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 1,
  },
  coachBadge: {
    backgroundColor: TERRA_SOFT,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coachBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 10.5,
    color: '#8F4A2E',
  },
  coachNote: {
    fontFamily: ViveFonts.frauncesSerif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: '#2E3624',
    lineHeight: 21,
    paddingBottom: 12,
  },
  coachResources: { gap: 8 },
  libraryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  coachResRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: CREAM_LIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(63,81,47,0.10)',
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  coachResIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: GLASS_BG,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachResText: { flex: 1 },
  coachResTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: FOREST,
  },
  coachResSub: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    marginTop: 1,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.6,
    borderColor: FOREST_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: FOREST_SOFT,
    borderColor: FOREST_SOFT,
  },

  // ── Grupos de herramientas ────────────────────────────────────────────────
  groupSection: { marginBottom: 24 },
  groupTitle: {
    fontFamily: ViveFonts.frauncesSerif,
    fontSize: 19,
    color: FOREST,
    marginBottom: 2,
  },
  groupSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 11.5,
    color: FOREST_SOFT,
    marginBottom: 12,
  },
  grid:    { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },

  // ── ToolCard ──────────────────────────────────────────────────────────────
  toolsRow: { gap: 10, paddingBottom: 4, paddingRight: 8 },
  toolCard: {
    width: 108,
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 108,
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(235,229,215,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: FOREST,
    textAlign: 'center',
    lineHeight: 15,
  },
  toolDuration: {
    fontFamily: ViveFonts.regular,
    fontSize: 9.5,
    color: FOREST_SOFT,
    textAlign: 'center',
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── CoachRecoSection ──────────────────────────────────────────────────────
  recoCard: {
    flexDirection: 'row',
    backgroundColor: GLASS_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 10,
    overflow: 'hidden',
  },
  recoStrip: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  recoBody: {
    flex: 1,
    padding: 13,
    gap: 3,
  },
  recoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recoTitle: {
    flex: 1,
    fontFamily: ViveFonts.semibold,
    fontSize: 13.5,
    color: FOREST,
    lineHeight: 18,
  },
  recoBadge: {
    backgroundColor: TERRACOTTA,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  recoBadgeText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  recoCoach: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: FOREST_SOFT,
    fontStyle: 'italic',
  },
  recoNote: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: FOREST,
    lineHeight: 17,
    opacity: 0.8,
  },
  recoMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: FOREST_SOFT,
  },

  // ── ExploreSection ────────────────────────────────────────────────────────
  chipsRow: {
    gap: 7,
    paddingBottom: 2,
  },
  chip: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: FOREST,
    borderColor: FOREST,
  },
  chipText: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: FOREST,
  },
  chipTextActive: {
    color: '#F3EEDF',
  },
  chipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipTextSmall: {
    fontSize: 11,
  },
  emptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: FOREST_SOFT,
    textAlign: 'center',
    marginVertical: 20,
  },
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  exploreCard: {
    width: '50%',
    backgroundColor: GLASS_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  exploreCover: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreBookmark: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  exploreTitle: {
    fontFamily: ViveFonts.medium,
    fontSize: 12.5,
    color: FOREST,
    lineHeight: 17,
  },
  exploreMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 10.5,
    color: FOREST_SOFT,
  },
  exploreCoach: {
    fontFamily: ViveFonts.regular,
    fontSize: 10,
    color: 'rgba(58,79,42,0.55)',
    fontStyle: 'italic',
  },

});
