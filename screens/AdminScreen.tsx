// AdminScreen — panel de administración.
//
// Existe porque tres operaciones se venían haciendo con SQL a mano en el
// dashboard de Supabase, y una de ellas bloquea el negocio: `CoachApplication`
// inserta `verified: false` y nada en el código lo pasa a true, así que sin
// intervención manual ningún coach que se postule llega al catálogo.
//
// La pantalla LEE directo (políticas `*_select_admin`) y ESCRIBE solo por
// `admin-actions`. Mostrar esta pantalla no autoriza nada: la edge function
// revalida contra el JWT en cada acción.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, StatusBar, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import {
  listPendingCoaches, setCoachVerified, listPendingReports, resolveReport,
  listClaims, type PendingCoach, type AdminReport, type AdminClaim, type ReportResolution,
} from '@/lib/admin';

const FOREST = '#3A4F2A';
const OLIVE = '#87835C';

type Tab = 'coaches' | 'reportes' | 'garantias';

const TABS: { key: Tab; label: string }[] = [
  { key: 'coaches',   label: 'Postulaciones' },
  { key: 'reportes',  label: 'Reportes' },
  { key: 'garantias', label: 'Garantías' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('coaches');
  const [coaches, setCoaches] = useState<PendingCoach[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, r, g] = await Promise.all([listPendingCoaches(), listPendingReports(), listClaims()]);
    setCoaches(c); setReports(r); setClaims(g);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  // Defensa en profundidad: aunque la entrada esté oculta para quien no es
  // admin, alguien puede llegar por deep link. Lo que de verdad protege es
  // `admin-actions`, pero no tiene sentido mostrar una pantalla vacía.
  if (!authLoading && !isAdmin) {
    return (
      <AppBg>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.denied}>
            <MaterialCommunityIcons name="lock-outline" size={40} color="rgba(135,131,92,0.45)" />
            <Text style={s.deniedText}>Esta sección no está disponible para tu cuenta.</Text>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
              <Text style={s.deniedLink}>Volver</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AppBg>
    );
  }

  async function act(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setWorking(key);
    const res = await fn();
    setWorking(null);
    if (!res.ok) { Alert.alert('No se pudo', res.error ?? 'Probá de nuevo.'); return; }
    Alert.alert('Listo', okMsg);
    void load();
  }

  function confirmCoach(c: PendingCoach) {
    Alert.alert(
      `¿Aprobar a ${c.name}?`,
      'Va a aparecer en Conexiones y en las búsquedas, y va a poder recibir reservas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprobar',
          onPress: () => act(c.coachId, () => setCoachVerified(c.coachId, true), `${c.name} ya está publicado.`),
        },
      ],
    );
  }

  return (
    <AppBg>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#565E32" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Administración</Text>
          <View style={s.headerSpacer} />
        </View>

        <View style={s.tabs}>
          {TABS.map(t => {
            const on = tab === t.key;
            const count = t.key === 'coaches' ? coaches.length
                        : t.key === 'reportes' ? reports.length
                        : claims.filter(c => c.status === 'pedida').length;
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.tab, on && s.tabActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.8}>
                <Text style={[s.tabText, on && s.tabTextActive]}>{t.label}</Text>
                {count > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{count}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ViveColors.primary} />}>

          {loading && <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 32 }} />}

          {/* ── Postulaciones ─────────────────────────────────────────────── */}
          {!loading && tab === 'coaches' && (
            coaches.length === 0
              ? <Empty icon="account-check-outline" text="No hay postulaciones esperando." />
              : coaches.map(c => (
                <View key={c.coachId} style={s.card}>
                  <Text style={s.cardTitle}>{c.name}</Text>
                  <Text style={s.cardMeta}>
                    {c.specialty || 'Sin especialidad'}
                    {c.price ? ` · $${c.price.toLocaleString('es-AR')}` : ''}
                    {c.nationality ? ` · ${c.nationality}` : ''}
                  </Text>
                  <Text style={s.cardMeta}>Se postuló el {formatDate(c.createdAt)}</Text>
                  {!!c.email && <Text style={s.cardMeta}>{c.email}</Text>}
                  {!!c.bio && <Text style={s.cardBody} numberOfLines={4}>{c.bio}</Text>}

                  {!!c.applicationVideoUrl && (
                    <TouchableOpacity
                      style={s.linkRow}
                      onPress={() => Linking.openURL(c.applicationVideoUrl!)}
                      activeOpacity={0.7}>
                      <MaterialCommunityIcons name="play-circle-outline" size={16} color={FOREST} />
                      <Text style={s.linkText}>Ver video de postulación</Text>
                    </TouchableOpacity>
                  )}

                  <View style={s.actions}>
                    <TouchableOpacity
                      style={[s.btn, s.btnPrimary]}
                      onPress={() => confirmCoach(c)}
                      disabled={working === c.coachId}
                      activeOpacity={0.85}>
                      {working === c.coachId
                        ? <ActivityIndicator size="small" color="#F7EFE4" />
                        : <Text style={s.btnPrimaryText}>Aprobar</Text>}
                    </TouchableOpacity>
                  </View>
                  {/* Sin botón de rechazo: no hay estado para eso en `coaches` —
                      una postulación rechazada es indistinguible de una que
                      todavía no se miró. Anotado como pendiente. */}
                </View>
              ))
          )}

          {/* ── Reportes ──────────────────────────────────────────────────── */}
          {!loading && tab === 'reportes' && (
            reports.length === 0
              ? <Empty icon="flag-outline" text="No hay reportes sin revisar." />
              : reports.map(r => (
                <View key={r.id} style={s.card}>
                  <Text style={s.cardTitle}>{r.reason}</Text>
                  <Text style={s.cardMeta}>
                    {r.reporterName} reportó a {r.reportedName} · {formatDate(r.createdAt)}
                  </Text>
                  {!!r.details && <Text style={s.cardBody}>{r.details}</Text>}
                  <View style={s.actions}>
                    {(['accionado', 'revisado', 'descartado'] as ReportResolution[]).map(st => (
                      <TouchableOpacity
                        key={st}
                        style={[s.btn, s.btnGhost]}
                        onPress={() => act(`${r.id}-${st}`, () => resolveReport(r.id, st), `Reporte marcado como ${st}.`)}
                        disabled={working === `${r.id}-${st}`}
                        activeOpacity={0.8}>
                        <Text style={s.btnGhostText}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
          )}

          {/* ── Garantías ─────────────────────────────────────────────────── */}
          {!loading && tab === 'garantias' && (
            claims.length === 0
              ? <Empty icon="shield-check-outline" text="Todavía no se pidió ninguna garantía." />
              : (
                <>
                  <Text style={s.note}>
                    Las garantías se piden por mail (T&C §9.3) y se resuelven con el runbook.
                    Acá se ven, no se aprueban.
                  </Text>
                  {claims.map(c => (
                    <View key={c.id} style={s.card}>
                      <Text style={s.cardTitle}>{c.status}</Text>
                      <Text style={s.cardMeta}>Pedida el {formatDate(c.requestedAt)}</Text>
                      {!!c.resolvedAt && <Text style={s.cardMeta}>Resuelta el {formatDate(c.resolvedAt)}</Text>}
                      {!!c.notes && <Text style={s.cardBody}>{c.notes}</Text>}
                      <Text style={s.mono}>{c.bookingId}</Text>
                    </View>
                  ))}
                </>
              )
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBg>
  );
}

function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={s.empty}>
      <MaterialCommunityIcons name={icon} size={38} color="rgba(135,131,92,0.45)" />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,248,240,0.62)',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.5)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: ViveFonts.semibold, fontSize: 18, color: '#565E32' },
  headerSpacer: { width: 36 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,248,240,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  tabActive: { backgroundColor: 'rgba(58,79,42,0.10)', borderColor: 'rgba(58,79,42,0.28)' },
  tabText: { fontFamily: ViveFonts.medium, fontSize: 13, color: OLIVE },
  tabTextActive: { color: FOREST },
  badge: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9, backgroundColor: '#B5533A' },
  badgeText: { fontFamily: ViveFonts.semibold, fontSize: 11, color: '#F3EEDF', textAlign: 'center' },

  list: { paddingHorizontal: 20, gap: 12, flexGrow: 1 },
  note: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: OLIVE, lineHeight: 18, marginBottom: 2 },

  card: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)',
    padding: 16, gap: 4,
  },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 15.5, color: FOREST },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: 'rgba(135,131,92,0.95)' },
  cardBody: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: FOREST, lineHeight: 20, marginTop: 6 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10.5, color: 'rgba(135,131,92,0.75)', marginTop: 6 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkText: { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST, textDecorationLine: 'underline' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 92 },
  btnPrimary: { backgroundColor: '#565E32' },
  btnPrimaryText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#F7EFE4' },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(86,94,50,0.30)' },
  btnGhostText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#565E32' },

  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60, paddingHorizontal: 24 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14, color: OLIVE, textAlign: 'center' },

  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  deniedText: { fontFamily: ViveFonts.regular, fontSize: 14.5, color: OLIVE, textAlign: 'center', lineHeight: 21 },
  deniedLink: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST, marginTop: 4 },
});
