// reports — enviar un reporte sobre un usuario o coach.
// La tabla `reports` (scripts/add-reports.sql) tiene RLS: solo se inserta como
// uno mismo. El equipo VIVE revisa a mano; no hay bloqueo automático.

import { supabase, registrarEvento } from '@/lib/supabase';

export type ReportReason =
  | 'comportamiento'
  | 'contenido_ofensivo'
  | 'spam_estafa'
  | 'no_se_presento'
  | 'perfil_falso'
  | 'otro';

// La lista vive acá (no en la base): motivos compartidos para ambos sentidos.
export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'comportamiento', label: 'Comportamiento inapropiado o falta de respeto' },
  { key: 'contenido_ofensivo', label: 'Contenido ofensivo o inseguro' },
  { key: 'spam_estafa', label: 'Spam o intento de estafa' },
  { key: 'no_se_presento', label: 'No se presentó a la sesión' },
  { key: 'perfil_falso', label: 'Perfil falso o suplantación' },
  { key: 'otro', label: 'Otro' },
];

export interface SubmitReportInput {
  reportedId: string;
  reason: ReportReason;
  details?: string;
  salaId?: string | null;
}

/** Envía un reporte. Devuelve false si el insert falló (no finge éxito). */
export async function submitReport(reporterId: string, input: SubmitReportInput): Promise<boolean> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_id: input.reportedId,
    reason: input.reason,
    details: input.details?.trim() || null,
    sala_id: input.salaId ?? null,
  });
  if (error) {
    console.warn('[submitReport] no se pudo enviar el reporte:', error.message);
    return false;
  }
  void registrarEvento('reporte_enviado', { reported_id: input.reportedId, reason: input.reason });
  return true;
}
