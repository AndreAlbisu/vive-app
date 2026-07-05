import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { VITA_TOOL_MAP } from '@/constants/vitaTools';

const FOREST = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const TERRACOTTA = '#C1694F';
const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

type SavedItem = {
  id: string;                 // resource_id (slug de tool o uuid de coach)
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  meta: string;
  route: string;
};

const COACH_TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'volume-medium-outline',
  guia_pasos: 'list-outline',
  lectura_breve: 'book-outline',
};

const COACH_TYPE_LABEL: Record<string, string> = {
  audio: 'Audio',
  guia_pasos: 'Guía de pasos',
  lectura_breve: 'Lectura breve',
};

export default function RecursosGuardadosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }

    const { data: saved } = await supabase
      .from('saved_resources')
      .select('resource_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // saved_resources no tiene UNIQUE(user_id, resource_id) y toggleSave hace insert
    // (no upsert), así que puede haber filas duplicadas — dedup para no repetir keys.
    const ids = [...new Set((saved ?? []).map(r => r.resource_id as string))];
    if (ids.length === 0) { setItems([]); setLoading(false); return; }

    // slugs = tools de VITA; uuids = recursos de coaches
    const coachIds = ids.filter(id => !VITA_TOOL_MAP[id]);
    let coachById = new Map<string, any>();
    if (coachIds.length > 0) {
      const { data: rows } = await supabase
        .from('resources')
        .select('id, type, title, duration_min')
        .in('id', coachIds)
        .is('retired_at', null);
      coachById = new Map((rows ?? []).map(r => [r.id as string, r]));
    }

    const mapped = ids.map(id => {
      const tool = VITA_TOOL_MAP[id];
      if (tool) return { id, title: tool.label, icon: tool.ionicon, meta: tool.duration, route: tool.route };
      const r = coachById.get(id);
      if (r) return {
        id: r.id as string,
        title: r.title as string,
        icon: COACH_TYPE_ICON[r.type as string] ?? 'book-outline',
        meta: `${COACH_TYPE_LABEL[r.type as string] ?? r.type}${r.duration_min ? ` · ${r.duration_min} min` : ''}`,
        route: `/recurso?id=${r.id}`,
      };
      return null;
    }).filter(Boolean) as SavedItem[];

    setItems(mapped);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function unsave(id: string) {
    if (!user) return;
    setItems(prev => prev.filter(i => i.id !== id));
    await supabase
      .from('saved_resources')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_id', id);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Guardados</Text>
          <View style={s.headerSpacer} />
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={i => i.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="bookmark-outline" size={38} color="rgba(135,131,92,0.45)" />
                <Text style={s.emptyTitle}>Todavía no guardaste ningún recurso</Text>
                <Text style={s.emptyText}>Tocá el marcador en cualquier recurso para tenerlo acá.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <ScaleCard style={s.card} onPress={() => router.push(item.route as any)}>
                <View style={s.iconWrap}>
                  <Ionicons name={item.icon} size={22} color={FOREST} />
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.cardMeta} numberOfLines={1}>{item.meta}</Text>
                </View>
                <TouchableOpacity onPress={() => unsave(item.id)} hitSlop={8} activeOpacity={0.7}>
                  <Ionicons name="bookmark" size={20} color={TERRACOTTA} />
                </TouchableOpacity>
              </ScaleCard>
            )}
          />
        )}
      </SafeAreaView>
    </AppBg>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, fontFamily: ViveFonts.semibold, fontSize: 18,
    color: '#565E32', textAlign: 'center', letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },

  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12, flexGrow: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(58,79,42,0.08)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32', marginBottom: 2 },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32', textAlign: 'center' },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.80)', textAlign: 'center' },
});
