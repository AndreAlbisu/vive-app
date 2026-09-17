// appVersion — ¿la versión instalada alcanza para usar la app?
//
// La otra mitad de `scripts/add-app-version-gate.sql`. Existe ANTES de publicar
// en las tiendas a propósito: una app ya instalada sin este control no se puede
// obligar a actualizar nunca. Ver el encabezado del script.
//
// 🔴 FALLA ABIERTA en todos los caminos. Sin señal, la tabla no responde, una
// versión con formato raro: deja pasar. Un control de versión que deja afuera a
// quien no tiene internet —o a todos, por un typo en la base— es peor que no
// tenerlo. Bloquear es la excepción que tiene que estar probada, no el default.

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * La versión instalada, tal como está en `app.json`.
 *
 * ⚠️ Es la del manifiesto y no la del binario nativo, y hoy da lo mismo: el
 * proyecto no usa `expo-updates`, así que el JS y el binario salen siempre
 * juntos con el mismo número. Y en Expo Go es la única correcta — ahí la versión
 * "nativa" es la de Expo Go. Si algún día se suman actualizaciones por aire,
 * revisar esto: una OTA podría cambiar el JS sin cambiar el binario.
 */
export function versionInstalada(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/** '1.2.10' → [1, 2, 10]. `null` si no son tres números. */
function partes(v: string | null | undefined): number[] | null {
  if (!v) return null;
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Compara números por partes, no como texto: como texto '1.2.10' < '1.2.9', que
 * es exactamente el error que dejaría afuera a alguien actualizado.
 * Devuelve -1, 0 o 1; `null` si alguna no se entiende.
 */
export function compararVersiones(a: string, b: string): -1 | 0 | 1 | null {
  const pa = partes(a);
  const pb = partes(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/** true SOLO si las dos versiones se entienden y la instalada es menor. */
export function debeActualizar(instalada: string | null, minima: string | null): boolean {
  if (!instalada || !minima) return false;
  return compararVersiones(instalada, minima) === -1;
}

export type BloqueoDeVersion = { minima: string; storeUrl: string | null; mensaje: string | null };

/** Tope para no dejar a nadie esperando un control que igual falla abierto. */
const TIMEOUT_MS = 4000;

/**
 * Lee la política de su plataforma y decide. `null` = puede seguir.
 *
 * No se llama en el arranque de forma bloqueante: la app arranca igual y, si
 * esto vuelve diciendo que hay que actualizar, recién ahí aparece la pantalla.
 */
export async function chequearVersion(): Promise<BloqueoDeVersion | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;   // web: no hay tienda
  const instalada = versionInstalada();
  if (!instalada) return null;

  try {
    const consulta = supabase
      .from('app_version_gate')
      .select('min_version, store_url, mensaje')
      .eq('platform', Platform.OS)
      .maybeSingle();
    const tope = new Promise<{ data: null }>(resolve => setTimeout(() => resolve({ data: null }), TIMEOUT_MS));
    const { data } = (await Promise.race([consulta, tope])) as { data: any };

    if (!data || !debeActualizar(instalada, data.min_version)) return null;
    return {
      minima: data.min_version as string,
      storeUrl: (data.store_url ?? null) as string | null,
      mensaje: (data.mensaje ?? null) as string | null,
    };
  } catch {
    return null;
  }
}
