import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, StatusBar, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ViveColors, ViveFonts } from '@/constants/theme';
import { ScaleCard } from '@/components/ScaleCard';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import { listReminders, setReminderEnabled, deleteReminder, type ReminderFull } from '@/lib/resourceReminders';

const FOREST = '#3A4F2A';
const FOREST_SOFT = '#6B7A56';
const TERRACOTTA = '#C1694F';
const GLASS = 'rgba(255,248,240,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.65)';

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtDays(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Todos los días';
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return 'Lun a vie';
  return sorted.map(d => DAY_SHORT[d]).join(', ');
}

function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function routeFor(r: ReminderFull): string {
  return r.kind === 'coach_resource' ? `/coach-recurso?id=${r.ref}` : `/${r.ref}`;
}

export default function MisRecordatoriosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<ReminderFull[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user) { setItems([]); setLoading(false); return; }
    listReminders(user.id).then(data => { setItems(data); setLoading(false); });
  }, [user]);

  useFocusEffect(load);

  async function toggle(r: ReminderFull) {
    if (!user) return;
    setItems(prev => prev.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
    await setReminderEnabled(user.id, r.id, !r.enabled);
  }

  async function remove(r: ReminderFull) {
    if (!user) return;
    setItems(prev => prev.filter(x => x.id !== r.id));
    await deleteReminder(user.id, r.id);
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Mis recordatorios</Text>
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
                <Ionicons name="notifications-outline" size={38} color="rgba(135,131,92,0.45)" />
                <Text style={s.emptyTitle}>Todavía no tenés recordatorios</Text>
                <Text style={s.emptyText}>Tocá la campanita en cualquier herramienta o recurso para armar uno</Text>
              </View>
            }
            renderItem={({ item }) => (
              <ScaleCard style={s.card} onPress={() => router.push(routeFor(item) as any)}>
                <View style={s.iconWrap}>
                  <Ionicons name="notifications" size={20} color={FOREST} />
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.cardMeta} numberOfLines={1}>{fmtDays(item.days)} · {fmtTime(item.hour, item.minute)}</Text>
                </View>
                <Switch
                  value={item.enabled}
                  onValueChange={() => toggle(item)}
                  trackColor={{ false: 'rgba(135,131,92,0.30)', true: TERRACOTTA }}
                  thumbColor="#fff"
                />
                <TouchableOpacity onPress={() => remove(item)} hitSlop={8} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={19} color="rgba(135,131,92,0.60)" />
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
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#565E32', marginBottom: 2 },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 12, color: FOREST_SOFT },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: ViveFonts.semibold, fontSize: 16, color: '#565E32', textAlign: 'center' },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 13, color: 'rgba(135,131,92,0.80)', textAlign: 'center' },
});
