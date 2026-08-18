// AdminScreen — panel de administración.
//
// Existe porque tres operaciones se venían haciendo con SQL a mano en el
// dashboard de Supabase, y una de ellas bloquea el negocio: `CoachApplication`
// inserta una postulación y nada en el código la publica, así que sin
// intervención manual ningún coach que se postule llega al catálogo.
//
// La pantalla LEE directo (políticas `*_select_admin`) y ESCRIBE solo por edge
// function. Mostrar esta pantalla no autoriza nada: la función revalida contra
// el JWT en cada acción.
//
// ⚠️ Dos funciones distintas, a propósito: postulaciones y reportes van por
// `admin-actions`; las garantías por `guarantee-claim`, que ya tiene las cinco
// validaciones de §9.3. Reimplementarlas acá sería tener dos definiciones de la
// misma cláusula, y una de las dos envejecería.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, StatusBar, Alert, RefreshControl, Linking, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ViveColors, ViveFonts } from '@/constants/theme';
import { AppBg } from '@/components/ui/AppBg';
import { useAuth } from '@/context/AuthContext';
import {
  listCoachApplications, setCoachVerified, rejectCoachApplication,
  listPendingReports, resolveReport,
  listClaims, checkGuarantee, approveGuarantee, rejectGuarantee,
  listUsdtRefunds, markUsdtRefunded, type UsdtRefund,
  listAuditLog,
  type PendingCoach, type AdminReport, type AdminClaim, type ReportResolution,
  type AuditEntry, type GuaranteeCheck,
} from '@/lib/admin';

const FOREST = '#3A4F2A';
const OLIVE = '#87835C';
const CLAY = '#B5533A';

type Tab = 'coaches' | 'reportes' | 'garantias' | 'reembolsos' | 'auditoria';

const TABS: { key: Tab; label: string }[] = [
  { key: 'coaches',   label: 'Postulaciones' },
  { key: 'reportes',  label: 'Reportes' },
  { key: 'garantias', label: 'Garantías' },
  { key: 'reembolsos', label: 'Reembolsos' },
  { key: 'auditoria', label: 'Registro' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, string> = {
  set_coach_verified:       'cambió la publicación de un coach',
  reject_coach_application: 'rechazó una postulación',
  resolve_report:           'resolvió un reporte',
};

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('coaches');
  const [coaches, setCoaches] = useState<PendingCoach[]>([]);
  const [rejected, setRejected] = useState<PendingCoach[]>([]);
  const [showRejected, setShowRejected] = useState(false);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [refunds, setRefunds] = useState<UsdtRefund[]>([]);
  const [txInput, setTxInput] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  // Rechazo de postulación: qué tarjeta tiene el campo abierto y qué se escribió.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [c, rej, r, g, rf, a] = await Promise.all([
      listCoachApplications('pendiente'),
      listCoachApplications('rechazada'),
      listPendingReports(),
      listClaims(),
      listUsdtRefunds(),
      listAuditLog(),
    ]);
    setCoaches(c); setRejected(rej); setReports(r); setClaims(g); setRefunds(rf); setAudit(a);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  // Defensa en profundidad: aunque la entrada esté oculta para quien no es
  // admin, alguien puede llegar por deep link. Lo que de verdad protege es la
  // edge function, pero no tiene sentido mostrar una pantalla vacía.
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

  function submitRejection(c: PendingCoach) {
    const reason = rejectReason.trim();
    if (!reason) { Alert.alert('Falta el motivo', 'El motivo le llega al coach para que sepa qué corregir.'); return; }
    setRejecting(null);
    setRejectReason('');
    void act(
      c.coachId,
      () => rejectCoachApplication(c.coachId, reason),
      `Le avisamos a ${c.name}. Si corrige y vuelve a enviar, aparece otra vez acá.`,
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
          style={s.tabsWrap}>
          {TABS.map(t => {
            const on = tab === t.key;
            const count = t.key === 'coaches' ? coaches.length
                        : t.key === 'reportes' ? reports.length
                        : t.key === 'reembolsos' ? refunds.length
                        : 0;
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
        </ScrollView>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}>
          <ScrollView
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ViveColors.primary} />}>

            {loading && <ActivityIndicator size="small" color={ViveColors.primary} style={{ marginTop: 32 }} />}

            {/* ── Postulaciones ───────────────────────────────────────────── */}
            {!loading && tab === 'coaches' && (
              <>
                {coaches.length === 0
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

                      {/* Segunda vuelta: el motivo del rechazo anterior se
                          conserva a propósito — es lo que dice si la persona
                          corrigió lo que se le señaló. */}
                      {!!c.notes && (
                        <View style={s.priorNote}>
                          <Text style={s.priorNoteLabel}>Rechazada antes por:</Text>
                          <Text style={s.priorNoteText}>{c.notes}</Text>
                        </View>
                      )}

                      {!!c.applicationVideoUrl && (
                        <TouchableOpacity
                          style={s.linkRow}
                          onPress={() => Linking.openURL(c.applicationVideoUrl!)}
                          activeOpacity={0.7}>
                          <MaterialCommunityIcons name="play-circle-outline" size={16} color={FOREST} />
                          <Text style={s.linkText}>Ver video de postulación</Text>
                        </TouchableOpacity>
                      )}

                      {rejecting === c.coachId ? (
                        <View style={s.rejectBox}>
                          <Text style={s.rejectLabel}>
                            Este texto le llega a {c.name}. Decile qué corregir: puede volver a enviarla.
                          </Text>
                          <TextInput
                            style={s.input}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            placeholder="El video no se ve o el link no abre."
                            placeholderTextColor="rgba(135,131,92,0.55)"
                            multiline
                            autoFocus
                          />
                          <View style={s.actions}>
                            <TouchableOpacity
                              style={[s.btn, s.btnGhost]}
                              onPress={() => { setRejecting(null); setRejectReason(''); }}
                              activeOpacity={0.8}>
                              <Text style={s.btnGhostText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[s.btn, s.btnDanger]}
                              onPress={() => submitRejection(c)}
                              disabled={working === c.coachId}
                              activeOpacity={0.85}>
                              {working === c.coachId
                                ? <ActivityIndicator size="small" color="#F7EFE4" />
                                : <Text style={s.btnPrimaryText}>Enviar rechazo</Text>}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
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
                          <TouchableOpacity
                            style={[s.btn, s.btnGhost]}
                            onPress={() => { setRejecting(c.coachId); setRejectReason(''); }}
                            activeOpacity={0.8}>
                            <Text style={s.btnGhostText}>Rechazar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}

                {rejected.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={s.disclosure}
                      onPress={() => setShowRejected(v => !v)}
                      activeOpacity={0.7}>
                      <MaterialCommunityIcons
                        name={showRejected ? 'chevron-down' : 'chevron-right'}
                        size={18} color={OLIVE} />
                      <Text style={s.disclosureText}>
                        {rejected.length} rechazada{rejected.length > 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                    {showRejected && rejected.map(c => (
                      <View key={c.coachId} style={[s.card, s.cardMuted]}>
                        <Text style={s.cardTitle}>{c.name}</Text>
                        <Text style={s.cardMeta}>Rechazada el {formatDate(c.reviewedAt)}</Text>
                        {!!c.notes && <Text style={s.cardBody}>{c.notes}</Text>}
                        <Text style={s.hint}>
                          Si corrige su postulación vuelve sola a la cola de arriba.
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ── Reportes ────────────────────────────────────────────────── */}
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

            {/* ── Garantías ───────────────────────────────────────────────── */}
            {!loading && tab === 'garantias' && (
              <GuaranteePanel claims={claims} onDone={load} />
            )}

            {/* ── Reembolsos en USDT ──────────────────────────────────────── */}
            {/* El panel NO transfiere: lista lo que hay que devolver y registra
                el hash como prueba. Automatizar el envío exigiría la clave
                privada de la wallet en el backend — quien accediera a ese
                secret vaciaría la billetera entera, no un reembolso. */}
            {!loading && tab === 'reembolsos' && (
              refunds.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyText}>No hay reembolsos pendientes</Text></View>
              ) : (
                refunds.map(r => (
                  <View key={r.bookingId} style={s.card}>
                    <Text style={s.cardTitle}>
                      {r.monto != null ? `${r.monto.toFixed(2)} USDT` : 'monto desconocido'}
                    </Text>
                    <Text style={s.cardMeta}>
                      {r.fecha} · {r.hora} hs{r.coachName ? ` · ${r.coachName}` : ''}
                    </Text>

                    {r.address ? (
                      <>
                        <Text style={s.mono} selectable>{r.network} · {r.address}</Text>
                        <TextInput
                          style={s.input}
                          value={txInput[r.bookingId] ?? ''}
                          onChangeText={v => setTxInput(prev => ({ ...prev, [r.bookingId]: v }))}
                          placeholder="Hash de la transacción (64 hex)"
                          placeholderTextColor="rgba(135,131,92,0.45)"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          style={[s.btn, s.btnPrimary, { marginTop: 10 }]}
                          activeOpacity={0.85}
                          onPress={async () => {
                            const tx = (txInput[r.bookingId] ?? '').trim();
                            const res: any = await markUsdtRefunded(r.bookingId, tx);
                            if (res?.error) { Alert.alert('No se pudo registrar', res.error); return; }
                            setTxInput(prev => ({ ...prev, [r.bookingId]: '' }));
                            void load();
                          }}>
                          <Text style={s.btnPrimaryText}>Marcar reembolsado</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      // Sin dirección no hay adónde mandar la plata. Se dice
                      // explícito para que no parezca que el reembolso está
                      // trabado por otra cosa.
                      <Text style={s.cardBody}>
                        ⚠️ La persona todavía no dio su dirección de reembolso. Pedísela por chat.
                      </Text>
                    )}
                  </View>
                ))
              )
            )}

            {/* ── Registro de auditoría ───────────────────────────────────── */}
            {!loading && tab === 'auditoria' && (
              audit.length === 0
                ? <Empty icon="history" text="Todavía no hay acciones registradas." />
                : (
                  <>
                    <Text style={s.note}>
                      Quién hizo qué desde el panel. Se escribe con service role y no se puede
                      editar desde la app, ni siquiera siendo admin.
                    </Text>
                    {audit.map(e => (
                      <View key={e.id} style={s.card}>
                        <Text style={s.cardTitle}>
                          {e.adminEmail ?? 'Cuenta eliminada'}
                        </Text>
                        <Text style={s.cardMeta}>
                          {ACTION_LABELS[e.action] ?? e.action} · {formatDateTime(e.createdAt)}
                        </Text>
                        {!!e.details && (
                          <Text style={s.cardBody}>
                            {Object.entries(e.details)
                              .filter(([, v]) => v !== null && v !== undefined && v !== '')
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </Text>
                        )}
                        {!!e.targetId && <Text style={s.mono}>{e.targetId}</Text>}
                      </View>
                    ))}
                  </>
                )
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBg>
  );
}

/** Garantías de primera sesión (§9.3).
 *
 *  El intake sigue siendo el mail, así que no hay una cola de solicitudes que
 *  listar: `guarantee-claim` crea la fila recién al resolverla, ya en 'aprobada'
 *  o 'rechazada'. Por eso el flujo empieza por pegar el ID de la reserva que
 *  vino en el mail y no por elegir de una lista.
 *
 *  ⚠️ Esto reemplaza el `curl` de docs/garantia-runbook.md, no lo duplica: llama
 *  a la misma función con el mismo payload. */
function GuaranteePanel({ claims, onDone }: { claims: AdminClaim[]; onDone: () => void }) {
  const [bookingId, setBookingId] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GuaranteeCheck | { error: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!bookingId.trim()) return;
    setChecking(true);
    setResult(null);
    const res = await checkGuarantee(bookingId);
    setResult(res);
    setChecking(false);
  }

  function reset() {
    setBookingId(''); setResult(null); setReason('');
  }

  async function approve() {
    setBusy(true);
    const res = await approveGuarantee(bookingId);
    setBusy(false);
    if (!res.ok) { Alert.alert('No se pudo', res.error ?? 'Probá de nuevo.'); return; }
    Alert.alert('Aprobada', 'El reembolso queda marcado. mp-process-refunds lo ejecuta en la próxima corrida (cada 5 min).');
    reset(); onDone();
  }

  async function reject() {
    if (!reason.trim()) { Alert.alert('Falta el motivo', 'Queda registrado para poder detectar reincidencia.'); return; }
    setBusy(true);
    const res = await rejectGuarantee(bookingId, reason.trim());
    setBusy(false);
    if (!res.ok) { Alert.alert('No se pudo', res.error ?? 'Probá de nuevo.'); return; }
    Alert.alert('Rechazada', 'Queda registrada la denegación.');
    reset(); onDone();
  }

  const eligible = result && 'eligible' in result && result.eligible;
  const notEligible = result && 'eligible' in result && !result.eligible;
  const errored = result && 'error' in result;

  return (
    <>
      <Text style={s.note}>
        Las garantías se piden por mail (T&C §9.3). Pegá el ID de la reserva que vino en el
        mail para ver si califica antes de contestar.
      </Text>

      <View style={s.card}>
        <TextInput
          style={s.input}
          value={bookingId}
          onChangeText={setBookingId}
          placeholder="ID de la reserva"
          placeholderTextColor="rgba(135,131,92,0.55)"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btn, s.btnPrimary]}
            onPress={check}
            disabled={checking || !bookingId.trim()}
            activeOpacity={0.85}>
            {checking
              ? <ActivityIndicator size="small" color="#F7EFE4" />
              : <Text style={s.btnPrimaryText}>Verificar</Text>}
          </TouchableOpacity>
          {!!result && (
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={reset} activeOpacity={0.8}>
              <Text style={s.btnGhostText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>

        {errored && (
          <Text style={[s.cardBody, { color: CLAY }]}>{(result as { error: string }).error}</Text>
        )}

        {notEligible && (
          <View style={s.resultBox}>
            <Text style={[s.resultTitle, { color: CLAY }]}>No califica</Text>
            {(result as { eligible: false; reasons: string[] }).reasons.map((r, i) => (
              <Text key={i} style={s.cardBody}>· {r}</Text>
            ))}
            <Text style={s.hint}>
              Podés rechazarla igual y dejar constancia — §9.3 permite denegar por abuso, y sin
              registro el reincidente es invisible.
            </Text>
          </View>
        )}

        {eligible && (
          <View style={s.resultBox}>
            <Text style={[s.resultTitle, { color: FOREST }]}>Califica</Text>
            <Text style={s.cardBody}>
              {(result as any).amount != null
                ? `Reintegro total: $${Number((result as any).amount).toLocaleString('es-AR')}`
                : 'Reintegro total'}
              {(result as any).hoursSince != null ? ` · ${(result as any).hoursSince}hs desde la sesión` : ''}
            </Text>
          </View>
        )}

        {(eligible || notEligible) && (
          <>
            <TextInput
              style={[s.input, { marginTop: 10 }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Motivo del rechazo (solo si vas a rechazar)"
              placeholderTextColor="rgba(135,131,92,0.55)"
              multiline
            />
            <View style={s.actions}>
              {eligible && (
                <TouchableOpacity
                  style={[s.btn, s.btnPrimary]}
                  onPress={approve}
                  disabled={busy}
                  activeOpacity={0.85}>
                  {busy
                    ? <ActivityIndicator size="small" color="#F7EFE4" />
                    : <Text style={s.btnPrimaryText}>Aprobar y reembolsar</Text>}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.btn, s.btnDanger]}
                onPress={reject}
                disabled={busy}
                activeOpacity={0.85}>
                <Text style={s.btnPrimaryText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {claims.length > 0 && (
        <>
          <Text style={[s.note, { marginTop: 12 }]}>Resueltas</Text>
          {claims.map(c => (
            <View key={c.id} style={[s.card, s.cardMuted]}>
              <Text style={s.cardTitle}>{c.status}</Text>
              <Text style={s.cardMeta}>
                {formatDate(c.resolvedAt ?? c.requestedAt)}
                {c.resolvedBy ? ` · ${c.resolvedBy}` : ''}
              </Text>
              {!!c.notes && <Text style={s.cardBody}>{c.notes}</Text>}
              <Text style={s.mono}>{c.bookingId}</Text>
            </View>
          ))}
        </>
      )}
    </>
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

  tabsWrap: { flexGrow: 0 },
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
  badge: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9, backgroundColor: CLAY },
  badgeText: { fontFamily: ViveFonts.semibold, fontSize: 11, color: '#F3EEDF', textAlign: 'center' },

  list: { paddingHorizontal: 20, gap: 12, flexGrow: 1 },
  note: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: OLIVE, lineHeight: 18, marginBottom: 2 },
  hint: { fontFamily: ViveFonts.regular, fontSize: 12, color: OLIVE, lineHeight: 17, marginTop: 8, fontStyle: 'italic' },

  card: {
    backgroundColor: 'rgba(255,248,240,0.80)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)',
    padding: 16, gap: 4,
  },
  cardMuted: { opacity: 0.72 },
  cardTitle: { fontFamily: ViveFonts.semibold, fontSize: 15.5, color: FOREST },
  cardMeta: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: 'rgba(135,131,92,0.95)' },
  cardBody: { fontFamily: ViveFonts.regular, fontSize: 13.5, color: FOREST, lineHeight: 20, marginTop: 6 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10.5, color: 'rgba(135,131,92,0.75)', marginTop: 6 },

  priorNote: {
    marginTop: 10, padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(181,83,58,0.08)',
    borderWidth: 1, borderColor: 'rgba(181,83,58,0.18)',
  },
  priorNoteLabel: { fontFamily: ViveFonts.semibold, fontSize: 11.5, color: CLAY },
  priorNoteText: { fontFamily: ViveFonts.regular, fontSize: 13, color: FOREST, lineHeight: 19, marginTop: 2 },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkText: { fontFamily: ViveFonts.medium, fontSize: 13, color: FOREST, textDecorationLine: 'underline' },

  rejectBox: { marginTop: 12, gap: 8 },
  rejectLabel: { fontFamily: ViveFonts.regular, fontSize: 12.5, color: OLIVE, lineHeight: 18 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1, borderColor: 'rgba(86,94,50,0.22)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: ViveFonts.regular, fontSize: 14, color: FOREST,
    minHeight: 44,
  },
  resultBox: { marginTop: 12 },
  resultTitle: { fontFamily: ViveFonts.semibold, fontSize: 14.5 },

  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginTop: 4 },
  disclosureText: { fontFamily: ViveFonts.medium, fontSize: 13, color: OLIVE },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 92 },
  btnPrimary: { backgroundColor: '#565E32' },
  btnPrimaryText: { fontFamily: ViveFonts.semibold, fontSize: 14, color: '#F7EFE4' },
  btnDanger: { backgroundColor: CLAY },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(86,94,50,0.30)' },
  btnGhostText: { fontFamily: ViveFonts.medium, fontSize: 13, color: '#565E32' },

  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60, paddingHorizontal: 24 },
  emptyText: { fontFamily: ViveFonts.regular, fontSize: 14, color: OLIVE, textAlign: 'center' },

  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  deniedText: { fontFamily: ViveFonts.regular, fontSize: 14.5, color: OLIVE, textAlign: 'center', lineHeight: 21 },
  deniedLink: { fontFamily: ViveFonts.semibold, fontSize: 14.5, color: FOREST, marginTop: 4 },
});
