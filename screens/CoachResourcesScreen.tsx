import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ViveColors, ViveFonts, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { VITA_TOOL_MAP } from '@/constants/vitaTools';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ─── Recursos publicados ──────────────────────────────────────────────────────
type MCIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type PublishedResource = { id: string; type: string; title: string; duration_min: number | null };

const TYPE_META: Record<string, { label: string; icon: MCIcon; iconBg: string; iconColor: string }> = {
  audio:         { label: 'Audio',          icon: 'volume-high',           iconBg: '#E8EFF6', iconColor: ViveColors.calm },
  guia_pasos:    { label: 'Guía de pasos',  icon: 'format-list-numbered',  iconBg: '#FDF0E8', iconColor: ViveColors.primary },
  lectura_breve: { label: 'Lectura breve',  icon: 'book-open-variant',     iconBg: '#E8F5EE', iconColor: ViveColors.accent },
};

const EXPLORE_CATS = [
  { id: 'diario', label: 'Diario', emoji: '📔' }, { id: 'respiracion', label: 'Respiración', emoji: '🌬️' },
  { id: 'meditacion', label: 'Meditación', emoji: '🧘' }, { id: 'audio', label: 'Audios', emoji: '🎧' },
  { id: 'lecturas', label: 'Lecturas', emoji: '📖' }, { id: 'herramienta', label: 'Herramientas', emoji: '🧰' },
];

const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CoachResourcesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [myResources, setMyResources] = useState<PublishedResource[]>([]);
  const [sirvioCounts, setSirvioCounts] = useState<Record<string, number>>({});
  const [loadingResources, setLoadingResources] = useState(true);

  const loadPublished = useCallback(async () => {
    if (!user) { setLoadingResources(false); return; }

    // attributed_to_coach_id es profiles.id — coincide con user.id, sin pasar por coaches
    const { data } = await supabase
      .from('resources')
      .select('id, type, title, duration_min')
      .eq('attributed_to_coach_id', user.id)
      .is('retired_at', null)
      .order('created_at', { ascending: false });

    setMyResources((data ?? []) as PublishedResource[]);

    const { data: feedback } = await supabase.rpc('get_my_resource_feedback_summary');
    const counts: Record<string, number> = {};
    for (const row of feedback ?? []) {
      counts[row.resource_id] = Number(row.sirvio_count) || 0;
    }
    setSirvioCounts(counts);
    setLoadingResources(false);
  }, [user]);

  useFocusEffect(useCallback(() => { loadPublished(); }, [loadPublished]));

  return (
    <AppBg>
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        <Text style={s.pageTitle}>Recursos</Text>

        {/* Propose button */}
        <TouchableOpacity
          style={s.proposeBtn}
          onPress={() => router.push('/resource-proposal-new')}
          activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#565E32" />
          <Text style={s.proposeBtnText}>Proponer recurso a VIVE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.myProposalsLink}
          onPress={() => router.push('/resource-proposals')}
          activeOpacity={0.75}>
          <Text style={s.myProposalsLinkText}>Ver mis propuestas enviadas</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={ViveColors.primary} />
        </TouchableOpacity>

        {/* Mis recursos publicados */}
        <Text style={s.sectionTitle}>Mis recursos</Text>
        {loadingResources ? (
          <View style={s.resourcesLoading}>
            <ActivityIndicator size="small" color={ViveColors.primary} />
          </View>
        ) : myResources.length === 0 ? (
          <View style={s.resourcesEmpty}>
            <MaterialCommunityIcons name="sprout-outline" size={28} color="rgba(135,131,92,0.45)" />
            <Text style={s.resourcesEmptyText}>
              Cuando VITA publique tu primera propuesta, la vas a ver acá.
            </Text>
          </View>
        ) : (
          myResources.map(r => {
            const meta = TYPE_META[r.type] ?? TYPE_META.lectura_breve;
            const sirvio = sirvioCounts[r.id] ?? 0;
            return (
              <View key={r.id} style={s.resourceCard}>
                <View style={[s.resourceIcon, { backgroundColor: meta.iconBg }]}>
                  <MaterialCommunityIcons name={meta.icon} size={22} color={meta.iconColor} />
                </View>
                <View style={s.resourceInfo}>
                  <Text style={s.resourceTitle}>{r.title}</Text>
                  <Text style={s.resourceMeta}>
                    {meta.label}{r.duration_min ? ` · ${r.duration_min} min` : ''}
                  </Text>
                  {sirvio > 0 && (
                    <Text style={s.resourceFeedback}>
                      {sirvio === 1 ? 'A 1 persona le sirvió' : `A ${sirvio} personas les sirvió`} 💛
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Explorar biblioteca */}
        <Text style={[s.sectionTitle, s.sectionSpaced]}>Biblioteca VIVE</Text>
        <View style={s.exploreGrid}>
          {[0, 1].map(row => (
            <View key={row} style={s.exploreRow}>
              {EXPLORE_CATS.slice(row * 3, row * 3 + 3).map(cat => (
                <ScaleCard key={cat.id} style={s.exploreCat} onPress={() => { const r = VITA_TOOL_MAP[cat.id]?.route; if (r) router.push(r as any); }}>
                  <Text style={s.exploreCatEmoji}>{cat.emoji}</Text>
                  <Text style={s.exploreCatLabel}>{cat.label}</Text>
                </ScaleCard>
              ))}
            </View>
          ))}
        </View>

        <View style={{ height: TAB_BAR_CLEARANCE }} />
      </ScrollView>
    </SafeAreaView>
    </AppBg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 22 },

  pageTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 26,
    color: '#565E32',
    marginBottom: 16,
  },

  proposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ViveColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 28,
    gap: 8,
  },
  proposeBtnText: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
  },

  myProposalsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: -16,
    marginBottom: 28,
    paddingVertical: 8,
  },
  myProposalsLinkText: {
    fontFamily: ViveFonts.medium,
    fontSize: 13,
    color: ViveColors.primary,
  },

  sectionTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 15,
    color: '#565E32',
    marginBottom: 12,
  },
  sectionSpaced: { marginTop: 28 },

  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  resourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resourceInfo: { flex: 1 },
  resourceTitle: {
    fontFamily: ViveFonts.semibold,
    fontSize: 14,
    color: '#565E32',
    marginBottom: 2,
  },
  resourceMeta: {
    fontFamily: ViveFonts.regular,
    fontSize: 12,
    color: '#87835C',
  },
  resourceFeedback: {
    fontFamily: ViveFonts.medium,
    fontSize: 12,
    color: ViveColors.accent,
    marginTop: 3,
  },

  resourcesLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  resourcesEmpty: {
    backgroundColor: GLASS,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  resourcesEmptyText: {
    fontFamily: ViveFonts.regular,
    fontSize: 13,
    color: '#87835C',
    textAlign: 'center',
    lineHeight: 19,
  },

  exploreGrid: { gap: 10 },
  exploreRow: { flexDirection: 'row', gap: 10 },
  exploreCat: {
    flex: 1,
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingVertical: 18,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 84,
  },
  exploreCatEmoji: { fontSize: 26 },
  exploreCatLabel: {
    fontFamily: ViveFonts.medium,
    fontSize: 11,
    color: '#565E32',
    textAlign: 'center',
  },
});
