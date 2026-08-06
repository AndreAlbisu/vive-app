// accountDeletion — baja de cuenta del propio usuario.
//
// Llama a la edge function `delete-account`, que es donde vive toda la lógica
// (borrar de auth.users necesita service role). Ver el header de esa función
// para el modelo de borrado + anonimización.

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

  // supabase-js mete el body de un 4xx/5xx en el error, así que hay que leerlo
  // de ahí para poder distinguir el caso del coach de una falla real.
  if (error) {
    const body = (data ?? null) as { error?: string; message?: string } | null;
    if (body?.error === 'coach_con_sesiones') {
      return { ok: false, reason: 'coach_con_sesiones', message: body.message ?? 'Tenés sesiones agendadas.' };
    }
    console.warn('[deleteMyAccount]', error.message);
    return { ok: false, reason: 'error', message: 'No pudimos eliminar tu cuenta. Intentá de nuevo en unos minutos.' };
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
