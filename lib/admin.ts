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

async function callAdmin(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: 'Sesión vencida. Volvé a entrar.' };

  try {
    const res = await fetch(`${FUNCTIONS_URL}/admin-actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // El token del usuario, NO la anon key: es lo que le permite a la
        // función saber quién llama y confirmar que sea admin.
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error ?? `Error ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error de red' };
  }
}

// ─── Postulaciones de coaches ────────────────────────────────────────────────

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
};

/** Postulaciones sin aprobar, más viejas primero: es una cola con reloj —
 *  alguien está esperando del otro lado para poder trabajar. */
export async function listPendingCoaches(): Promise<PendingCoach[]> {
  const { data, error } = await supabase
    .from('coaches')
    .select('id, profile_id, specialty, bio, price_per_session, nationality, application_video_url, created_at, verified, profiles!inner(name, email)')
    .eq('verified', false)
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
    };
  });
}

export function setCoachVerified(coachId: string, verified: boolean, notes?: string) {
  return callAdmin({ action: 'set_coach_verified', coach_id: coachId, verified, notes });
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
  notes: string | null;
};

export async function listClaims(): Promise<AdminClaim[]> {
  const { data, error } = await supabase
    .from('guarantee_claims')
    .select('id, booking_id, status, requested_at, resolved_at, notes')
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
    notes: c.notes,
  }));
}
