import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LastShown } from './sobreVosMomento';

// I/O de la Parte C/E — separado de lib/sobreVosMomento.ts (que es puro y
// tiene tests) porque importar AsyncStorage rompe la resolución de módulos de
// Jest si queda en el mismo archivo. Mismo criterio que ya separa
// `weeklyReflection.ts` de `hooks/useDailyReflection.ts`.

const PREF_KEY       = 'vita:momento:enabled';
const LAST_SHOWN_KEY = 'vita:momento:lastShown';

/** Preferencia de auto-disparo (Parte E). Default `true` — apagar es un acto
 *  explícito, no el estado de arranque. No vive en `profiles`: acaba de
 *  hardenearse el privilegio de UPDATE por columna ahí (sesión 90-91,
 *  lock-privileged-columns.sql), y esto es una preferencia de UI sin necesidad
 *  de sincronizar entre dispositivos — mismo criterio que ya usa el caché de
 *  IA de `useDailyReflection`. Apagarla NO afecta poder reabrir el momento
 *  tocando la card persistente, solo el auto-disparo tras el check-in. */
export async function getMomentPref(): Promise<boolean> {
  const v = await AsyncStorage.getItem(PREF_KEY);
  return v !== 'false';
}

export async function setMomentPref(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, String(enabled));
}

export async function getLastShown(): Promise<LastShown> {
  const raw = await AsyncStorage.getItem(LAST_SHOWN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function markMomentShown(dayKey: string, signal: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SHOWN_KEY, JSON.stringify({ date: dayKey, signal }));
}
