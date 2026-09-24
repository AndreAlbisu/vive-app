// admin — panel de administración.
//
// Las LECTURAS van directo a Supabase: `add-admin-flag.sql` agrega políticas de
// SELECT que se habilitan con `is_admin()`, así que la pantalla lista sin
// intermediarios. ⚠️ EXCEPCIÓN: `listCoachApplications` va por `admin-actions`
// porque lee el MAIL del coach — con la lectura client-side, cualquier usuario
// logueado podía leer el mail de todos los coaches (A4 fase 2).
//
// Las ESCRITURAS van todas por la edge function `admin-actions`. No es una
// vuelta de más: `lock-privileged-columns.sql` cerró `coaches.verified` para
// el cliente justo para que nadie se auto-apruebe, y `reports` nunca tuvo
// UPDATE desde el cliente. Escribir directo exigiría reabrir esas columnas.

import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { REPORT_REASONS, type ReportReason } from '@/lib/reports';
import { coachNetFor, platformDeliveryCost, type PayoutRail } from '@/lib/payout';
import { agruparComisiones, totalPorMoneda, type BookingForBilling, type CommissionGroup } from '@/lib/billing';

const FUNCTIONS_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

/** POST a una edge function con el token del usuario logueado.
 *
 *  `fn` es parte de la firma porque las garantías NO van por `admin-actions`:
 *  reusan `guarantee-claim`, que ya tiene las cinco validaciones de §9.3 y
 *  acepta un admin logueado además del service role. Duplicar esa lógica en
 *  otra función sería tener dos definiciones de la misma cláusula. */
async function callFunction(
  fn: 'admin-actions' | 'guarantee-claim',
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; data?: any }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Sesión vencida. Volvé a entrar.' };

  try {
    const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // El token del usuario, NO la anon key: es lo que le permite a la
        // función saber quién llama y confirmar que sea admin.
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    // `guarantee-claim` contesta 401 en texto plano, no JSON — parsear a ciegas
    // devolvería `{}` y el error quedaría como un "Error 401" sin explicación.
    const raw = await res.text();
    let json: any = {};
    try { json = raw ? JSON.parse(raw) : {}; } catch { json = { error: raw }; }

    if (!res.ok) return { ok: false, error: json?.error ?? `Error ${res.status}`, data: json };
    if (json?.warning) console.warn('[admin]', json.warning);
    return { ok: true, data: json };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error de red' };
  }
}

const callAdmin = (body: Record<string, unknown>) => callFunction('admin-actions', body);

// ─── Postulaciones de coaches ────────────────────────────────────────────────

export type ApplicationStatus = 'pendiente' | 'aprobada' | 'rechazada';

export type PendingCoach = {
  coachId: string;          // coaches.id
  profileId: string;        // coaches.profile_id
  name: string;
  email: string | null;
  specialty: string;
  bio: string | null;
  price: number | null;
  nationality: string | null;
  applicationVideoUrl: string | null;
  createdAt: string | null;
  verified: boolean;
  status: ApplicationStatus;
  notes: string | null;       // motivo del rechazo, si hubo
  reviewedAt: string | null;
  /** Coaches y nutricionistas: se comprometió a derivar lo clínico. null = no aplica o postulación vieja. */
  compromisoDerivar: boolean | null;
  /** "¿Qué hacés si alguien te cuenta que piensa en hacerse daño?" Se lee al revisar. */
  respuestaRiesgo: string | null;
  paisAtencion: string | null;
  provinciaAtencion: string | null;
};

/** Postulaciones en un estado dado, más viejas primero: es una cola con reloj —
 *  alguien está esperando del otro lado para poder trabajar.
 *
 *  ⚠️ Filtra por `application_status`, NO por `verified`. Antes filtraba por
 *  `verified = false`, que mezclaba "nadie la miró" con "la miramos y no": una
 *  rechazada volvía a la cola para siempre y por eso el panel solo podía
 *  aprobar. Son dos preguntas distintas — `verified` es "¿está en el catálogo?"
 *  y `application_status` es "¿en qué estado está la revisión?". */
export async function listCoachApplications(status: ApplicationStatus = 'pendiente'): Promise<PendingCoach[]> {
  // 🔴 Pasa por `admin-actions` y no por una query directa porque LEE EL MAIL del
  // coach (A4 fase 2). Con la lectura client-side, cualquier usuario logueado
  // podía leer el mail de todos los coaches. La función confirma `is_admin` y
  // lee con service role; devuelve la lista ya mapeada a `PendingCoach`.
  const res = await callAdmin({ action: 'list_coach_applications', status });
  if (!res.ok) {
    console.warn('[admin] no se pudieron leer las postulaciones:', res.error);
    return [];
  }
  return (res.data?.applications ?? []) as PendingCoach[];
}

export function setCoachVerified(coachId: string, verified: boolean, notes?: string) {
  return callAdmin({ action: 'set_coach_verified', coach_id: coachId, verified, notes });
}

/** Rechaza una postulación. El motivo es obligatorio y le llega al coach por
 *  notificación: puede corregir y volver a enviarla (el trigger
 *  `trg_reset_application_on_edit` la devuelve a la cola al editar), así que sin
 *  motivo la segunda vuelta sería idéntica a la primera. */
export function rejectCoachApplication(coachId: string, reason: string) {
  return callAdmin({ action: 'reject_coach_application', coach_id: coachId, reason });
}

// ─── Sanciones ───────────────────────────────────────────────────────────────
// La escalera de T&C §10: advertencia → suspensión → baja. La aplica un humano
// mirando un caso; no hay algoritmo que sancione solo, y con la muestra de hoy
// tampoco debería haberlo (`scripts/diagnostico-fuga.sql`).

export type SancionNivel = 'advertencia' | 'suspension' | 'baja';

/**
 * 🔴 `motivo` NO es una nota interna: es el texto que va a leer la persona
 * sancionada, en su app y en la notificación. Escribirlo como si se lo dijeras
 * de frente, porque es literalmente eso.
 *
 * `dias` solo se usa —y es obligatorio— para `suspension`. La baja no vence.
 */
export function applySanction(args: {
  coachId: string;
  nivel: SancionNivel;
  motivo: string;
  dias?: number;
  evidencia?: string;
}) {
  return callAdmin({
    action: 'apply_sanction',
    coach_id: args.coachId,
    nivel: args.nivel,
    motivo: args.motivo,
    ...(args.dias != null ? { dias: args.dias } : {}),
    ...(args.evidencia ? { evidencia: args.evidencia } : {}),
  });
}

/** Levantar no borra: la fila queda con el motivo por el que se levantó. El
 *  historial tiene que poder contar también los errores nuestros. */
export function revokeSanction(sancionId: string, motivo: string) {
  return callAdmin({ action: 'revoke_sanction', sancion_id: sancionId, motivo });
}

export type AdminSancion = {
  id: string;
  coachId: string;
  coachName: string;
  nivel: SancionNivel;
  motivo: string;
  evidencia: string | null;
  /** ISO, o 'infinity' para una baja. Null en las advertencias. */
  hasta: string | null;
  createdAt: string;
  revocadaAt: string | null;
  revocadaMotivo: string | null;
  /** Capturas y PDFs. Solo los ve el equipo: el coach sancionado NO tiene acceso
   *  (ni a esta lista ni al texto de `evidencia`) — ver `add-sanction-evidence.sql`. */
  adjuntos: { id: string; mime: string; createdAt: string }[];
};

export async function listSanctions(): Promise<AdminSancion[]> {
  const res = await callAdmin({ action: 'list_sanctions' });
  if (!res.ok) {
    console.warn('[admin] no se pudieron leer las sanciones:', res.error);
    return [];
  }
  return (res.data?.sanciones ?? []) as AdminSancion[];
}

/**
 * Sube un adjunto de evidencia a una sanción ya creada.
 *
 * El archivo NO pasa por la edge function: ella firma una subida a un path que
 * elige, el archivo va directo a storage, y después ella confirma que llegó y lo
 * registra. Si la subida se corta a mitad de camino, no queda una fila huérfana.
 *
 * ⚠️ `mime` tiene que ser uno de los que acepta el bucket (jpeg, png, webp, heic,
 * pdf). El selector de fotos devuelve JPEG si se le pide calidad < 1, que es lo
 * que hace el panel — así una foto HEIC del iPhone no rebota.
 */
export async function uploadSanctionEvidence(
  sancionId: string,
  uri: string,
  mime: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const firma = await callAdmin({ action: 'sanction_evidence_upload', sancion_id: sancionId, mime });
    if (!firma.ok) return { ok: false, error: firma.error ?? 'no se pudo preparar la subida' };
    const { path, token } = firma.data as { path: string; token: string };

    const bytes = await new File(uri).bytes();
    const { error: upErr } = await supabase.storage
      .from('sanction-evidence')
      .uploadToSignedUrl(path, token, bytes, { contentType: mime });
    if (upErr) return { ok: false, error: upErr.message };

    const reg = await callAdmin({ action: 'sanction_evidence_register', sancion_id: sancionId, path, mime });
    if (!reg.ok) return { ok: false, error: reg.error ?? 'se subió pero no se pudo registrar' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** URL firmada de 5 minutos. Abrirla queda auditado: es muy probable que la
 *  captura tenga mensajes privados de un cliente. */
export async function sanctionEvidenceUrl(evidenciaId: string): Promise<{ url?: string; error?: string }> {
  const res = await callAdmin({ action: 'sanction_evidence_url', evidencia_id: evidenciaId });
  if (!res.ok) return { error: res.error ?? 'no se pudo abrir' };
  return { url: (res.data as { url: string }).url };
}

// ─── Avisos de contacto ──────────────────────────────────────────────────────

export type SenalesDeCoach = {
  coachProfileId: string;
  coachId: string | null;
  nombre: string;
  /** Escritos por el coach. Son los que nadie más puede fabricar. */
  delCoach: number;
  /** De esos, cuántos fueron datos para cobrar y rebotaron. */
  bloqueados: number;
  enviadosIgual: number;
  /** Escritos por las personas que atiende. */
  deLaPersona: number;
  canales: Record<string, number>;
  senales: Record<string, number>;
  ultimo: string;
  personas: { userId: string; nombre: string; avisos: number; siguioReservando: boolean }[];
};

/**
 * Los avisos de contacto de los últimos 90 días, agrupados por coach.
 *
 * ⚠️ No son pruebas: son casos para mirar. `descartados` cuenta los eventos que
 * no escribió quien dicen que los escribió — si crece, alguien intenta
 * fabricarle avisos a un coach.
 */
export async function listContactSignals(): Promise<{ coaches: SenalesDeCoach[]; descartados: number }> {
  const res = await callAdmin({ action: 'list_contact_signals' });
  if (!res.ok) {
    console.warn('[admin] no se pudieron leer los avisos de contacto:', res.error);
    return { coaches: [], descartados: 0 };
  }
  return { coaches: (res.data?.coaches ?? []) as SenalesDeCoach[], descartados: Number(res.data?.descartados ?? 0) };
}

/** ¿Esta sanción está pesando ahora mismo? Misma cuenta que `estaSuspendido`
 *  del lado del coach: 'infinity' (la baja) no es una fecha parseable. */
export function sancionVigente(s: AdminSancion, now: Date = new Date()): boolean {
  if (s.revocadaAt) return false;
  if (s.nivel === 'advertencia') return false;   // no restringe nada, no "pesa"
  if (s.hasta === 'infinity') return true;
  const t = s.hasta ? new Date(s.hasta).getTime() : NaN;
  return Number.isFinite(t) && t > now.getTime();
}

// ─── Reportes ────────────────────────────────────────────────────────────────

export type AdminReport = {
  id: string;
  reason: string;        // etiqueta legible, ya resuelta contra REPORT_REASONS
  details: string | null;
  status: string;
  createdAt: string;
  reporterName: string;
  reportedName: string;
  reportedId: string;
};

const REASON_LABELS = new Map(REPORT_REASONS.map(r => [r.key as string, r.label]));

export async function listPendingReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, reason, details, status, created_at, reporter_id, reported_id')
    .eq('status', 'pendiente')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[admin] no se pudieron leer los reportes:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  // Los nombres se resuelven en una segunda consulta y no con un join anidado:
  // `reports` tiene DOS FKs a `profiles` (reporter y reported), así que un
  // `profiles!inner(...)` no sabe cuál traer y hay que desambiguar por nombre
  // de constraint. Con dos queries no depende de cómo se llame la constraint.
  const ids = [...new Set(data.flatMap(r => [r.reporter_id, r.reported_id]))];
  const { data: people } = await supabase
    .from('profiles').select('id, name').in('id', ids);
  const nameById = new Map((people ?? []).map(p => [p.id, p.name as string]));

  return data.map(r => ({
    id: r.id,
    reason: REASON_LABELS.get(r.reason as ReportReason) ?? r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    reporterName: nameById.get(r.reporter_id) ?? 'Alguien',
    reportedName: nameById.get(r.reported_id) ?? 'Cuenta eliminada',
    reportedId: r.reported_id,
  }));
}

export type ReportResolution = 'revisado' | 'accionado' | 'descartado';

export function resolveReport(reportId: string, status: ReportResolution) {
  return callAdmin({ action: 'resolve_report', report_id: reportId, status });
}

// ─── Garantías (§9.3) ────────────────────────────────────────────────────────

export type AdminClaim = {
  id: string;
  bookingId: string;
  status: string;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
};

export async function listClaims(): Promise<AdminClaim[]> {
  const { data, error } = await supabase
    .from('guarantee_claims')
    .select('id, booking_id, status, requested_at, resolved_at, resolved_by, notes')
    .order('requested_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[admin] no se pudieron leer las garantías:', error.message);
    return [];
  }
  return (data ?? []).map(c => ({
    id: c.id,
    bookingId: c.booking_id,
    status: c.status,
    requestedAt: c.requested_at,
    resolvedAt: c.resolved_at,
    resolvedBy: c.resolved_by ?? null,
    notes: c.notes,
  }));
}

/** Resultado de evaluar una reserva contra las 5 condiciones de §9.3.
 *  `eligible` viene de la función, no se decide acá. */
export type GuaranteeCheck =
  | { eligible: true; bookingId: string; amount: number | null; hoursSince: number | null }
  | { eligible: false; reasons: string[] };

/** Corre las validaciones de §9.3 SIN escribir nada. Es el `dry_run` del
 *  runbook: sirve para contestar el mail sabiendo si califica antes de
 *  comprometerse a nada. */
export async function checkGuarantee(bookingId: string): Promise<GuaranteeCheck | { error: string }> {
  const res = await callFunction('guarantee-claim', { booking_id: bookingId.trim(), dry_run: true });

  // Un 422 no es un fallo de la llamada: es la respuesta "no califica, y estos
  // son los motivos". Hay que leerla del body y no tratarla como error de red.
  if (!res.ok) {
    const reasons = res.data?.reasons;
    if (Array.isArray(reasons) && reasons.length > 0) return { eligible: false, reasons };
    return { error: res.error ?? 'No se pudo verificar.' };
  }

  return {
    eligible: true,
    bookingId: res.data?.booking_id ?? bookingId,
    amount: res.data?.amount ?? null,
    hoursSince: res.data?.hours_since_session ?? null,
  };
}

/** Aprueba: escribe el claim y marca `payment_status = 'reembolso_pendiente'`.
 *  El refund contra MP lo hace `mp-process-refunds` en su próxima corrida. */
export function approveGuarantee(bookingId: string) {
  return callFunction('guarantee-claim', { booking_id: bookingId.trim() });
}

/** Rechaza y deja constancia. Se registra aunque además no calificara: §9.3 se
 *  reserva denegar por abuso, y sin registro el reincidente es invisible. */
export function rejectGuarantee(bookingId: string, reason: string) {
  return callFunction('guarantee-claim', { booking_id: bookingId.trim(), reject: reason });
}

// ─── Reembolsos en USDT ──────────────────────────────────────────────────────
//
// El envío se hace A MANO desde la billetera de VIVE: automatizarlo exigiría la
// clave privada en el backend, y con el volumen actual el riesgo no se
// justifica. El panel es la lista de trabajo, no el que transfiere.

export type UsdtRefund = {
  bookingId: string;
  monto: number | null;
  fecha: string;
  hora: string;
  coachName: string | null;
  /** null = todavía no la dio. Sin esto no hay adónde mandar la plata. */
  address: string | null;
  network: string | null;
};

export async function listUsdtRefunds(): Promise<UsdtRefund[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, usdt_amount, scheduled_date, scheduled_time, coach_name, refund_address, refund_network')
    .eq('payment_provider', 'usdt')
    .eq('payment_status', 'reembolso_pendiente')
    .order('scheduled_date', { ascending: true })
    .limit(100);

  if (error) {
    console.warn('[admin] no se pudieron leer los reembolsos:', error.message);
    return [];
  }
  return (data ?? []).map(b => ({
    bookingId: b.id,
    monto: b.usdt_amount != null ? Number(b.usdt_amount) : null,
    fecha: b.scheduled_date,
    hora: String(b.scheduled_time ?? '').slice(0, 5),
    coachName: b.coach_name ?? null,
    address: b.refund_address ?? null,
    network: b.refund_network ?? null,
  }));
}

/** Registra que el reembolso se pagó. NO transfiere: el hash es la prueba de
 *  que la plata salió, y la edge function lo exige con formato válido. */
export function markUsdtRefunded(bookingId: string, refundTxId: string) {
  return callFunction('admin-actions', {
    action: 'mark_usdt_refunded',
    booking_id: bookingId,
    refund_tx_id: refundTxId.trim(),
  });
}

// ─── Pagos a coaches (riel internacional) ────────────────────────────────────
//
// Solo existe para los rieles donde cobra VIVE. Con Mercado Pago el split ya le
// pagó al coach en el momento del cobro, así que no hay deuda que registrar; en
// el internacional la plata entra entera a la wallet de VIVE y se transfiere
// después, semanalmente y solo por sesiones ya realizadas — así siempre hay con
// qué reembolsar si algo se cae antes de la sesión.
//
// La transferencia se hace A MANO (banco o billetera). Esto es la lista de
// trabajo y el registro de que se pagó, no el que mueve la plata.

/** Lo que se le debe a un coach: sus sesiones impagas, agrupadas. */
export type CoachPayout = {
  coachId: string;
  coachName: string | null;
  /** Bruto y neto en USD. `neto` es lo que le corresponde al profesional por sus
   *  sesiones; `aTransferir` es eso menos el costo de entrega del método que
   *  eligió — y es el número que se tipea en la transferencia. */
  bruto: number;
  neto: number;
  /** Costo de entrega descontado (0 en transferencia bancaria). Se cobra una vez
   *  por PAGO, no por sesión. */
  costoEntrega: number;
  aTransferir: number;
  /** true si el costo de entrega se come todo lo que se le debe. Sin mínimo de
   *  acumulación (decisión de Andre), así que puede pasar con montos chicos —
   *  y hay que verlo, no transferir un número negativo. */
  /** 🔴 Una fila por `(coach, riel)` y no por coach: con la regla espejo (D4) cada
   *  reserva se paga por el riel por el que entró, así que un coach con sesiones
   *  cobradas por los dos rieles recibe DOS pagos, uno por cada uno. */
  rail: PayoutRail;
  noAlcanza: boolean;
  /** Lo que a VIVE le cuesta hacer el envío. **No sale del pago del coach** (D5);
   *  se muestra para poder comparar el costo real de cada riel. */
  costoPlataforma: number;
  sesiones: { bookingId: string; fecha: string; amount: number; feePct: number; neto: number }[];
  /** Datos de cobro. `null` = todavía no los cargó y no hay adónde mandar nada. */
  destino: {
    wallet: string | null;
    network: string | null;
    paypalEmail: string | null;
  } | null;
};

/** Devuelve el error en vez de tragárselo: si el script `add-coach-payouts.sql`
 *  no se corrió, la consulta falla por columna inexistente y una lista vacía se
 *  leería como "no hay nada que pagar" — que es exactamente lo contrario. Este
 *  proyecto ya se comió esa confusión tres veces (el cron de reembolsos con el
 *  placeholder, el webhook muerto, la pestaña de reembolsos sin policy). */
export async function listCoachPayouts(): Promise<{ rows: CoachPayout[]; error: string | null }> {
  // Dos consultas y no un join: `coach_payout_accounts` se lee por una policy
  // distinta (`coach_payout_select_admin`), y con un embed de PostgREST un coach
  // sin datos de cobro cargados desaparecería de la lista en vez de aparecer
  // marcado — que es justo el caso que hay que ver.
  const { data, error } = await supabase
    .from('bookings')
    .select('id, coach_id, coach_name, scheduled_date, amount, platform_fee_pct, payment_provider')
    .neq('payment_provider', 'mp')
    .eq('status', 'completada')
    .eq('payment_status', 'aprobado')
    .is('paid_out_at', null)
    .order('scheduled_date', { ascending: true })
    .limit(500);

  if (error) {
    console.warn('[admin] no se pudieron leer los pagos pendientes:', error.message);
    return { rows: [], error: error.message };
  }
  if (!data?.length) return { rows: [], error: null };

  const coachIds = [...new Set(data.map(b => b.coach_id).filter(Boolean))];
  const { data: cuentas } = await supabase
    .from('coach_payout_accounts')
    .select('coach_id, wallet, network, paypal_email')
    .in('coach_id', coachIds);

  const porCoach = new Map<string, CoachPayout>();
  for (const b of data) {
    const amount = Number(b.amount ?? 0);
    // El `?? 20` no debería activarse nunca: la columna es NOT NULL con default
    // 20. Está para que una fila rara no propague NaN al monto a transferir.
    const feePct = Number(b.platform_fee_pct ?? 20);
    const neto = coachNetFor(amount, feePct);

    // 🔴 La clave es `(coach, riel)`. Agrupar solo por coach mezclaría dólares de
    // PayPal con dólares de la wallet, que son dos pagos distintos y por vías que
    // no se cruzan — no se puede fondear PayPal con cripto.
    const rail = (b.payment_provider === 'usdt' ? 'usdt' : 'paypal') as PayoutRail;
    const key = `${b.coach_id}|${rail}`;
    let entry = porCoach.get(key);
    if (!entry) {
      const c = cuentas?.find(x => x.coach_id === b.coach_id);
      entry = {
        coachId: b.coach_id,
        coachName: b.coach_name ?? null,
        rail,
        bruto: 0,
        neto: 0,
        costoEntrega: 0,
        costoPlataforma: 0,
        aTransferir: 0,
        noAlcanza: false,
        sesiones: [],
        destino: c
          ? {
              wallet: c.wallet ?? null,
              network: c.network ?? null,
              paypalEmail: c.paypal_email ?? null,
            }
          : null,
      };
      porCoach.set(key, entry);
    }
    entry.bruto += amount;
    entry.neto += neto;
    entry.sesiones.push({ bookingId: b.id, fecha: b.scheduled_date, amount, feePct, neto });
  }

  // El acumulado se redondea al final: sumar netos ya redondeados arrastra
  // centavos, y el total es la cifra que se tipea en la transferencia.
  //
  // El costo de entrega se descuenta ACÁ y no por sesión, porque se paga una vez
  // por transferencia — descontarlo en cada sesión multiplicaría el cobro por la
  // cantidad de sesiones de la semana, que es justo lo contrario de cómo funciona.
  const rows = [...porCoach.values()]
    .map(e => {
      const neto = Math.round(e.neto * 100) / 100;
      // D5: al coach no se le descuenta nada, así que lo que se le transfiere ES
      // su neto. `costoEntrega` queda en 0 y se conserva para no romper lo que lo
      // lee; el costo real vive en `costoPlataforma`, del lado de VIVE.
      return {
        ...e,
        bruto: Math.round(e.bruto * 100) / 100,
        neto,
        costoEntrega: 0,
        costoPlataforma: platformDeliveryCost(neto, e.rail),
        aTransferir: neto,
        noAlcanza: neto <= 0,
      };
    })
    .sort((a, b) => b.aTransferir - a.aTransferir);
  return { rows, error: null };
}

/** Registra que se le transfirió al coach. NO transfiere: `reference` es el
 *  comprobante (hash de la tx o número de operación del banco), y sin él no se
 *  puede marcar nada — igual criterio que `markUsdtRefunded`.
 *
 *  Va en lote a propósito: una transferencia semanal cubre varias sesiones, y
 *  marcarlas de a una dejaría la mitad pagada si algo falla en el medio. */
export function markCoachPaid(bookingIds: string[], reference: string) {
  return callAdmin({
    action: 'mark_coach_paid',
    booking_ids: bookingIds,
    payout_reference: reference.trim(),
  });
}

// ─── Facturación ─────────────────────────────────────────────────────────────
//
// 🔴 NO emite facturas ni decide qué es facturable — es material en bruto para
// llevarle al contador. Las tres preguntas abiertas (qué facturar, a quién, cada
// cuánto) están en `docs/fiscal-instrucciones.md` §2.1, y ninguna se responde
// desde el código.
//
// Por eso trae las **cobradas y las reembolsadas por separado** en vez de
// aplicar un criterio: elegir uno acá sería hornear una respuesta que todavía no
// existe. La comisión de una reserva reembolsada normalmente se revierte, pero
// "normalmente" no es una regla que pueda fijar este archivo.

export type CommissionReport = {
  cobradas: CommissionGroup[];
  reembolsadas: CommissionGroup[];
  /** Total cobrado POR MONEDA. Es un mapa y no un número para que sumar pesos
   *  con dólares sea imposible por accidente. */
  totales: Record<string, number>;
  error: string | null;
};

export async function listCommissionReport(): Promise<CommissionReport> {
  const { data, error } = await supabase
    .from('bookings')
    .select('scheduled_date, coach_id, coach_name, amount, platform_fee_pct, currency, payment_provider, payment_status')
    // 'contracargo' entra igual que 'reembolsado': los dos revierten la comisión,
    // y dejarlo afuera haría que una sesión disputada desapareciera del material
    // que se le lleva al contador.
    .in('payment_status', ['aprobado', 'reembolsado', 'contracargo'])
    .order('scheduled_date', { ascending: false })
    .limit(2000);

  if (error) {
    console.warn('[admin] no se pudo leer la facturación:', error.message);
    return { cobradas: [], reembolsadas: [], totales: {}, error: error.message };
  }

  const filas = (data ?? []) as BookingForBilling[];
  const cobradas = agruparComisiones(filas.filter(b => b.payment_status === 'aprobado'));
  return {
    cobradas,
    reembolsadas: agruparComisiones(
      filas.filter(b => b.payment_status === 'reembolsado' || b.payment_status === 'contracargo'),
    ),
    totales: totalPorMoneda(cobradas),
    error: null,
  };
}

// ─── Auditoría ───────────────────────────────────────────────────────────────

export type AuditEntry = {
  id: string;
  adminEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, any> | null;
  createdAt: string;
};

export async function listAuditLog(limit = 50): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('id, admin_email, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[admin] no se pudo leer la auditoría:', error.message);
    return [];
  }
  return (data ?? []).map(e => ({
    id: e.id,
    adminEmail: e.admin_email ?? null,
    action: e.action,
    targetType: e.target_type,
    targetId: e.target_id ?? null,
    details: e.details ?? null,
    createdAt: e.created_at,
  }));
}

// ── Credenciales de profesionales ────────────────────────────────────────────
// 🔴 Todo pasa por `admin-actions` y no por una query directa: el bucket
// `coach-credentials` es privado y `coach_credentials` no tiene policy de
// lectura para admins a propósito. La única puerta al documento es la edge
// function con service role, que además audita quién lo abrió.

export type AdminCredential = {
  id: string;
  coach_id: string;
  coach_name: string | null;
  specialty: string | null;
  kind: 'titulo' | 'matricula' | 'certificacion';
  title: string;
  institution: string | null;
  year: number | null;
  registration_number: string | null;
  has_file: boolean;
  /** ¿Ese coach YA tiene una matrícula verificada? Aprobar un título no habilita
   *  la marca de profesional en el perfil: solo la matrícula lo hace. Sin este
   *  dato el admin aprueba a ciegas y el coach no entiende por qué su perfil no
   *  cambió. */
  coach_has_matricula: boolean;
  review_notes: string | null;
  created_at: string;
};

export async function listPendingCredentials(): Promise<AdminCredential[]> {
  const res = await callFunction('admin-actions', { action: 'list_pending_credentials' });
  if (!res.ok) {
    console.error('[admin] listPendingCredentials:', res.error);
    return [];
  }
  return (res.data?.credentials ?? []) as AdminCredential[];
}

/** URL firmada, válida 5 minutos. Corta a propósito: un link largo que se
 *  filtre por historial o pantalla compartida es el documento entero regalado. */
export async function credentialFileUrl(credentialId: string): Promise<{ url?: string; error?: string }> {
  const res = await callFunction('admin-actions', {
    action: 'credential_file_url',
    credential_id: credentialId,
  });
  if (!res.ok) return { error: res.error ?? 'no se pudo abrir el documento' };
  return { url: res.data?.url as string };
}

/** De qué profesión es una matrícula. Obligatoria al verificar una. */
export type ProfesionMatricula = 'psicologia' | 'nutricion' | 'otra';

export async function reviewCredential(
  credentialId: string,
  verified: boolean,
  notes?: string,
  profesion?: ProfesionMatricula,
): Promise<{ ok: boolean; error?: string }> {
  const res = await callFunction('admin-actions', {
    action: 'review_credential',
    credential_id: credentialId,
    verified,
    notes: notes ?? null,
    profesion: profesion ?? null,
  });
  return { ok: res.ok, error: res.error };
}

// ─── Problemas con sesiones (`session_issues`) ──────────────────────────────
// Lectura por la policy `session_issues_select_admin`; responder va por
// `admin-actions` (`respond_session_issue`), que además avisa a la persona.

export type AdminSessionIssue = {
  id: string;
  bookingId: string;
  rol: 'cliente' | 'profesional';
  motivo: string;
  detalle: string | null;
  estado: 'recibido' | 'en_revision' | 'resuelto';
  respuesta: string | null;
  contexto: Record<string, unknown> | null;
  createdAt: string;
  reporterName: string;
  sesion: string | null;
};

export async function listOpenSessionIssues(): Promise<AdminSessionIssue[]> {
  const { data, error } = await supabase
    .from('session_issues')
    .select('id, booking_id, reporter_id, rol, motivo, detalle, estado, respuesta, contexto_tecnico, created_at, bookings(scheduled_date, scheduled_time)')
    .neq('estado', 'resuelto')
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[admin] no se pudieron leer los problemas de sesión:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const ids = [...new Set(data.map(r => r.reporter_id as string))];
  const { data: people } = await supabase.from('profiles').select('id, name').in('id', ids);
  const nameById = new Map((people ?? []).map(p => [p.id, p.name as string]));

  return data.map(r => {
    const b: any = Array.isArray((r as any).bookings) ? (r as any).bookings[0] : (r as any).bookings;
    return {
      id: r.id as string,
      bookingId: r.booking_id as string,
      rol: r.rol as AdminSessionIssue['rol'],
      motivo: r.motivo as string,
      detalle: (r.detalle as string | null) ?? null,
      estado: r.estado as AdminSessionIssue['estado'],
      respuesta: (r.respuesta as string | null) ?? null,
      contexto: (r.contexto_tecnico as Record<string, unknown> | null) ?? null,
      createdAt: r.created_at as string,
      reporterName: nameById.get(r.reporter_id as string) ?? 'Alguien',
      sesion: b ? `${b.scheduled_date} ${String(b.scheduled_time).slice(0, 5)} hs` : null,
    };
  });
}

export function respondSessionIssue(issueId: string, respuesta: string, estado: 'en_revision' | 'resuelto') {
  return callAdmin({ action: 'respond_session_issue', issue_id: issueId, respuesta, estado });
}
