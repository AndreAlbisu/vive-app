// sessionIssues — "Tengo un problema con esta sesión".
//
// Tabla `session_issues` (scripts/add-session-issues.sql). Reportan las dos
// partes de una reserva; quién es y en qué rol lo decide la base, no la app. El
// equipo responde desde el panel (`admin-actions` → `respond_session_issue`) y
// la persona lee la respuesta acá.
//
// 📌 Plazo prometido: 24 horas hábiles (decisión de Andre, 23/09/2026). Vive en
// una sola constante porque es una promesa: si cambia, cambia en todos lados.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/logging';

export const PLAZO_RESPUESTA = '24 horas hábiles';

export type MotivoProblema = 'no_puedo_entrar' | 'audio_video' | 'otro_no_llego' | 'cobro' | 'otro';
export type RolProblema = 'cliente' | 'profesional';
export type EstadoProblema = 'recibido' | 'en_revision' | 'resuelto';

/** Los motivos, con el texto según quién reporta: "el profesional no llegó" del
 *  lado del cliente es "la persona no se conectó" del lado del profesional. */
export function motivosPara(rol: RolProblema): { valor: MotivoProblema; label: string }[] {
  return [
    { valor: 'no_puedo_entrar', label: 'No puedo entrar a la llamada' },
    { valor: 'audio_video', label: 'No se ve o no se escucha' },
    { valor: 'otro_no_llego', label: rol === 'cliente' ? 'El profesional no llegó' : 'La persona no se conectó' },
    { valor: 'cobro', label: rol === 'cliente' ? 'Un problema con el cobro' : 'Un problema con el cobro de esta sesión' },
    { valor: 'otro', label: 'Otra cosa' },
  ];
}

export function textoEstado(estado: EstadoProblema): string {
  switch (estado) {
    case 'recibido': return 'Recibido';
    case 'en_revision': return 'Lo estamos revisando';
    case 'resuelto': return 'Resuelto';
  }
}

export type ProblemaSesion = {
  id: string;
  motivo: MotivoProblema;
  detalle: string | null;
  estado: EstadoProblema;
  respuesta: string | null;
  respondidoAt: string | null;
  createdAt: string;
};

/** El caso más reciente de quien está logueado sobre esta reserva (RLS: solo
 *  los propios), o null si nunca reportó. */
export async function getProblemaSesion(bookingId: string): Promise<ProblemaSesion | null> {
  const { data, error } = await supabase
    .from('session_issues')
    .select('id, motivo, detalle, estado, respuesta, respondido_at, created_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    motivo: data.motivo as MotivoProblema,
    detalle: (data.detalle as string | null) ?? null,
    estado: data.estado as EstadoProblema,
    respuesta: (data.respuesta as string | null) ?? null,
    respondidoAt: (data.respondido_at as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

/** Abre un caso. El contexto técnico es chico y no tiene contenido: sirve para
 *  saber si el problema es de una versión o de una plataforma. */
export async function reportarProblema(input: {
  bookingId: string;
  motivo: MotivoProblema;
  detalle: string;
  estadoSesion?: string;
}): Promise<{ ok: true } | { ok: false; yaAbierto: boolean }> {
  const detalle = input.detalle.trim().slice(0, 500);
  const { error } = await supabase.from('session_issues').insert({
    booking_id: input.bookingId,
    motivo: input.motivo,
    detalle: detalle || null,
    contexto_tecnico: {
      plataforma: Platform.OS,
      version_so: String(Platform.Version),
      version_app: Constants.expoConfig?.version ?? null,
      estado_sesion: input.estadoSesion ?? null,
    },
  });
  if (!error) return { ok: true };
  // El índice de "un caso abierto por reserva": ya reportó y no lo vio.
  if (error.code === '23505') return { ok: false, yaAbierto: true };
  void logError('SessionIssue: no se pudo registrar el reporte', error);
  return { ok: false, yaAbierto: false };
}
