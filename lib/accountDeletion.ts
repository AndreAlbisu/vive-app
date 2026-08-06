// accountDeletion — baja de cuenta del propio usuario.
//
// Llama a la edge function `delete-account`, que es donde vive toda la lógica
// (borrar de auth.users necesita service role). Ver el header de esa función
// para el modelo de borrado + anonimización.

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type DeleteAccountResult =
  | { ok: true; steps: string[] }
  /** El coach tiene sesiones agendadas: tiene que cancelarlas antes. */
  | { ok: false; reason: 'coach_con_sesiones'; message: string }
  | { ok: false; reason: 'error'; message: string };

export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, reason: 'error', message: 'Tu sesión expiró. Volvé a entrar e intentá de nuevo.' };

  const { data, error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  // Ante un 4xx/5xx, supabase-js NO deja el body en `data`: lo deja en
  // `error.context`, que es la Response cruda. Leerlo de `data` (como se hacía
  // antes) perdía el motivo real y mostraba siempre "intentá más tarde" —
  // justo lo que hace imposible diagnosticar una baja fallida.
  if (error) {
    let body: { error?: string; message?: string; detail?: string } | null = null;
    if (error instanceof FunctionsHttpError) {
      try { body = await error.context.json(); } catch { /* body no-JSON */ }
    }
    if (body?.error === 'coach_con_sesiones') {
      return { ok: false, reason: 'coach_con_sesiones', message: body.message ?? 'Tenés sesiones agendadas.' };
    }
    const detail = body?.detail ?? body?.error ?? error.message;
    console.warn('[deleteMyAccount]', detail);
    return {
      ok: false,
      reason: 'error',
      message: `No pudimos eliminar tu cuenta.\n\n${detail}`,
    };
  }

  const body = data as { ok?: boolean; error?: string; message?: string; steps?: string[] };
  if (body?.error === 'coach_con_sesiones') {
    return { ok: false, reason: 'coach_con_sesiones', message: body.message ?? 'Tenés sesiones agendadas.' };
  }
  if (!body?.ok) {
    return { ok: false, reason: 'error', message: body?.message ?? 'No pudimos eliminar tu cuenta.' };
  }
  return { ok: true, steps: body.steps ?? [] };
}
