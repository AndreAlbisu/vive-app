// admin — panel de administración.
//
// Las LECTURAS van directo a Supabase: `add-admin-flag.sql` agrega políticas de
// SELECT que se habilitan con `is_admin()`, así que la pantalla lista sin
// intermediarios.
//
// Las ESCRITURAS van todas por la edge function `admin-actions`. No es una
// vuelta de más: `lock-privileged-columns.sql` cerró `coaches.verified` para
// el cliente justo para que nadie se auto-apruebe, y `reports` nunca tuvo
// UPDATE desde el cliente. Escribir directo exigiría reabrir esas columnas.

import { supabase } from '@/lib/supabase';
import { REPORT_REASONS, type ReportReason } from '@/lib/reports';

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
  const { data, error } = await supabase
    .from('coaches')
    .select('id, profile_id, specialty, bio, price_per_session, nationality, application_video_url, created_at, verified, application_status, application_notes, application_reviewed_at, profiles!inner(name, email)')
    .eq('application_status', status)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[admin] no se pudieron leer las postulaciones:', error.message);
    return [];
  }

  return (data ?? []).map((c: any) => {
    const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      coachId: c.id,
      profileId: c.profile_id,
      name: p?.name ?? 'Sin nombre',
      email: p?.email ?? null,
      specialty: c.specialty ?? '',
      bio: c.bio ?? null,
      price: c.price_per_session ?? null,
      nationality: c.nationality ?? null,
      applicationVideoUrl: c.application_video_url ?? null,
      createdAt: c.created_at ?? null,
      verified: !!c.verified,
      status: (c.application_status ?? 'pendiente') as ApplicationStatus,
      notes: c.application_notes ?? null,
      reviewedAt: c.application_reviewed_at ?? null,
    };
  });
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
