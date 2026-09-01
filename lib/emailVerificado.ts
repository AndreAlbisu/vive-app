// ¿Hace falta que esta persona pruebe que la casilla es suya?
//
// 🔴 No se puede mirar `auth.users.email_confirmed_at`: el proyecto tiene
// "Confirm email" APAGADO, así que Supabase auto-confirma a todo el mundo en el
// alta y esa columna viene llena siempre. La constancia real es
// `profiles.email_verified_at`, que escribe la pantalla de verificación.

import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Google y Apple entregan el mail ya verificado por el proveedor: pedirle un
 * código a alguien que entró con un botón sería pedirle que pruebe algo que
 * Google ya probó.
 */
export function mailVieneDeProveedor(user: User | null | undefined): boolean {
  const meta = user?.app_metadata as { provider?: string; providers?: string[] } | undefined;
  const usados = [meta?.provider, ...(meta?.providers ?? [])].filter(Boolean) as string[];
  return usados.some(p => p === 'google' || p === 'apple');
}

/**
 * ⚠️ Falla ABIERTO: ante cualquier problema devuelve `false` y deja pasar.
 *
 * Si `email_verified_at` todavía no existe —el script no se corrió— el select
 * devuelve error, y un gate que se activara con ese error dejaría a **todo el
 * mundo sin poder reservar** por un problema de esquema. Un mail sin verificar
 * es un riesgo chico; una app donde nadie puede reservar, no.
 */
export async function necesitaVerificarMail(user: User | null | undefined): Promise<boolean> {
  if (!user) return false;
  if (mailVieneDeProveedor(user)) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('email_verified_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[mail] no se pudo leer email_verified_at:', error.message);
    return false;
  }
  return !data?.email_verified_at;
}
