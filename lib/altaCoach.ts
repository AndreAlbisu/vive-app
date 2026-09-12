// ¿Hay un alta de coach a medio hacer?
//
// 🔴 POR QUÉ EXISTE. El alta crea la cuenta y abre sesión ANTES de que la
// persona termine: primero verifica el mail, después llena la postulación. Si
// abandona por navegación, `useCerrarSesionAlSalir` cierra la sesión. Pero si
// **cierra la app** no corre nada, la sesión sobrevive, y al volver a abrir el
// `AuthRedirect` la ve como una sesión normal y la deposita en el Inicio **como
// usuario final** — con una cuenta que se creó queriendo ser profesional y un
// alta que nunca terminó.
//
// ── Por qué el marcador vive ahora en el SERVIDOR ─────────────────────────────
//
// Antes vivía SOLO en `AsyncStorage`, o sea en el teléfono: borrar los datos de
// la app lo saltea, y el agujero de arriba volvía a abrirse. Ahora la fuente de
// verdad es `profiles.coach_alta_paso` (ver `scripts/add-coach-alta-paso.sql`),
// que sobrevive a eso.
//
// ⚠️ Se mantiene un ESPEJO en `AsyncStorage`, por dos motivos y a propósito:
//  · Transición: hasta que la columna esté corrida, el servidor falla y el
//    espejo hace que el flujo ande exactamente como hoy (ver `esColumnaInexistente`).
//  · Lectura tolerante: en `pasoDelAlta`, un paso pendiente en CUALQUIERA de las
//    dos fuentes gana. Un falso "pendiente" solo reencamina al alta (recuperable);
//    un falso "no pendiente" es el bug que estamos cerrando. Se elige el lado
//    seguro.
//
// La API (marcarAlta / pasoDelAlta / limpiarAlta) no cambió: los 5 llamadores
// siguen igual.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const KEY = 'vita_alta_coach';

/** En qué paso quedó. Se guarda el paso y no un booleano para no hacerle
 *  repetir la verificación a quien ya la pasó. */
export type PasoAlta = 'verificar' | 'postular';

function esPaso(v: unknown): v is PasoAlta {
  return v === 'verificar' || v === 'postular';
}

/** El id de la sesión local, sin round-trip de red (a diferencia de getUser).
 *  Alcanza: estas funciones corren con una sesión recién abierta. */
async function userIdActual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** El error de que la columna todavía no existe (script sin correr). Es el único
 *  caso en que el servidor "no sabe" y hay que confiar en el espejo local. */
function esColumnaInexistente(error: { code?: string; message?: string }): boolean {
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('coach_alta_paso') && m.includes('does not exist');
}

async function leerLocal(): Promise<PasoAlta | null> {
  const v = await AsyncStorage.getItem(KEY);
  return esPaso(v) ? v : null;
}

export async function marcarAlta(paso: PasoAlta): Promise<void> {
  // El espejo local primero: es instantáneo y cubre el offline / pre-migración.
  await AsyncStorage.setItem(KEY, paso);
  const uid = await userIdActual();
  if (!uid) return;
  const { error } = await supabase
    .from('profiles')
    .update({ coach_alta_paso: paso })
    .eq('id', uid);
  if (error && !esColumnaInexistente(error)) {
    console.warn('[alta-coach] no se pudo guardar el paso en el servidor:', error.message);
  }
}

export async function pasoDelAlta(): Promise<PasoAlta | null> {
  // El servidor manda: sobrevive a borrar los datos de la app, que era el
  // agujero. Si tiene un paso, ese es el bueno.
  const uid = await userIdActual();
  if (uid) {
    const { data, error } = await supabase
      .from('profiles')
      .select('coach_alta_paso')
      .eq('id', uid)
      .maybeSingle();
    if (!error && esPaso(data?.coach_alta_paso)) {
      return data!.coach_alta_paso as PasoAlta;
    }
    // Servidor en null, columna sin migrar, o error de red → cae al espejo. No
    // se sobreescribe un pendiente local con el null del servidor: el lado seguro
    // es reencaminar al alta, no dejar entrar.
  }
  return leerLocal();
}

/** El alta terminó (se envió la postulación) o se abandonó (se cerró sesión). */
export async function limpiarAlta(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  const uid = await userIdActual();
  if (!uid) return;
  const { error } = await supabase
    .from('profiles')
    .update({ coach_alta_paso: null })
    .eq('id', uid);
  if (error && !esColumnaInexistente(error)) {
    console.warn('[alta-coach] no se pudo limpiar el paso en el servidor:', error.message);
  }
}
