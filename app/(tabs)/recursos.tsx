import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { FirstTimeTooltip } from '@/components/FirstTimeTooltip';

// ─── Types ────────────────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Tool {
  id: string;
  label: string;
  icon: IoniconName;
  route?: string;
}

interface CoachResource {
  id: string;
  title: string;
  subtitle: string;
  icon: IoniconName;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  { id: 'diario',      label: 'Diario',           icon: 'book-outline',           route: '/diario'   },
  { id: 'gratitud',    label: 'Gratitud',          icon: 'heart-outline',          route: '/gratitud' },
  { id: 'sueno',       label: 'Sueño',             icon: 'moon-outline'                               },
  { id: 'respiracion', label: 'Respiración',       icon: 'cloud-outline'                              },
  { id: 'meditacion',  label: 'Meditación',        icon: 'leaf-outline'                               },
  { id: 'escaner',     label: 'Escáner corporal',  icon: 'body-outline'                               },
  { id: 'relajacion',  label: 'Relajación',        icon: 'musical-notes-outline'                      },
  { id: 'ruido',       label: 'Ruido blanco',      icon: 'volume-medium-outline'                      },
  { id: 'lecturas',    label: 'Lecturas breves',   icon: 'library-outline'                            },
];

const COACH_RESOURCES: CoachResource[] = [
  { id: 'cr1', title: 'Respiración 4-7-8',  subtitle: 'Recomendado por María González · 5 min',  icon: 'cloud-outline'  },
  { id: 'cr2', title: 'Diario de gratitud', subtitle: 'Recomendado por María González · 10 min', icon: 'heart-outline'  },
];

// ─── Shadow ───────────────────────────────────────────────────────────────────
const shadow = Platform.select({
  ios: {
    shadowColor: ViveColors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

// ─── ToolCard ─────────────────────────────────────────────────────────────────
function ToolCard({ tool }: { tool: Tool }) {
  const router = useRouter();
  return (
    <ScaleCard
      style={s.toolCard}
      onPress={() => {
        if (tool.route) router.push(tool.route as any);
      }}
      activeOpacity={0.88}
    >
      <Ionicons name={tool.icon} size={28} color={ViveColors.text} />
      <Text style={s.toolLabel}>{tool.label}</Text>
    </ScaleCard>
  );
}

// ─── CoachResourceCard ────────────────────────────────────────────────────────
function CoachResourceCard({ resource }: { resource: CoachResource }) {
  return (
    <View style={s.coachCard}>
      <View style={s.coachIconWrap}>
        <Ionicons name={resource.icon} size={20} color={ViveColors.text} />
      </View>
      <View style={s.coachInfo}>
        <Text style={s.coachTitle}>{resource.title}</Text>
        <Text style={s.coachSubtitle}>{resource.subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={`${ViveColors.text}44`} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RecursosScreen() {
  return (
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
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <Text style={s.pageTitle}>Recursos</Text>

        {/* ── Recomendados por tu coach ───────────────────────────────── */}
        {COACH_RESOURCES.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Recomendados por tu coach</Text>
            {COACH_RESOURCES.map(r => (
              <CoachResourceCard key={r.id} resource={r} />
            ))}
          </>
        )}

        {/* ── Herramientas ────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, COACH_RESOURCES.length > 0 && s.sectionSpaced]}>
          Herramientas
        </Text>
        <View style={s.grid}>
          {[0, 1, 2].map(row => (
            <View key={row} style={s.gridRow}>
              {TOOLS.slice(row * 3, row * 3 + 3).map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ViveColors.background,
  },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Header
  pageTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: ViveColors.text,
    marginBottom: 20,
  },

  // Sections
  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: ViveColors.text,
    marginBottom: 12,
  },
  sectionSpaced: {
    marginTop: 28,
  },

  // Coach resource cards
  coachCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
    ...shadow,
  },
  coachIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: `${ViveColors.text}0D`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coachInfo: {
    flex: 1,
  },
  coachTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: ViveColors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  coachSubtitle: {
    fontFamily: ViveFonts.regular,
    fontSize: 11,
    color: `${ViveColors.text}77`,
    lineHeight: 16,
  },

  // Tool grid
  grid: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toolCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    minHeight: 96,
    ...shadow,
  },
  toolLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: ViveColors.text,
    textAlign: 'center',
    lineHeight: 15,
  },
});
