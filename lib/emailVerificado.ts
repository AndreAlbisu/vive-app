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
 * Un error de PostgREST/Postgres que dice que la columna no existe en el
 * esquema. Es el ÚNICO motivo por el que este gate se deja pasar ante un error.
 *
 * `42703` es el `undefined_column` de Postgres; `PGRST204` es el equivalente de
 * PostgREST cuando la columna no está en su cache de esquema. El chequeo del
 * mensaje es cinturón y tiradores por si el código no viaja.
 */
function esColumnaInexistente(error: { code?: string; message?: string }): boolean {
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('email_verified_at') && m.includes('does not exist');
}

/**
 * Antes fallaba ABIERTO ante CUALQUIER error, y el motivo era uno solo:
 * `email_verified_at` podía no existir todavía (el script sin correr), y un gate
 * que se activara por ese error dejaba a **todo el mundo sin poder reservar** por
 * un problema de esquema.
 *
 * ⚠️ La columna YA existe (corrida en 09/2026), así que ese motivo desapareció y
 * el fallback se estrechó a exactamente él: **solo un error de ESQUEMA (columna
 * inexistente) deja pasar**, como red de seguridad ante un rollback. Cualquier
 * otro error —transitorio, de permisos— ahora falla **CERRADO**: no poder
 * confirmar la verificación no es permiso para saltearla.
 *
 * 📌 Fallar cerrado ante un error transitorio es tolerable en los dos
 * llamadores: en la reserva, sin red la reserva falla igual un paso después; en
 * el muro de mail, se recupera al reabrir la app.
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
    if (esColumnaInexistente(error)) {
      console.warn('[mail] email_verified_at no existe en el esquema, se deja pasar:', error.message);
      return false;
    }
    console.warn('[mail] no se pudo leer email_verified_at, se pide verificar:', error.message);
    return true;
  }
  return !data?.email_verified_at;
}
