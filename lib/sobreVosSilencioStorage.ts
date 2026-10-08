import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LastSpoken } from './sobreVosSilencio';

// I/O del silencio de la tarjeta — separado de lib/sobreVosSilencio.ts (que es
// puro y tiene tests) porque importar AsyncStorage rompe la resolución de
// módulos de Jest si queda en el mismo archivo. Mismo criterio que ya separa
// `weeklyReflection.ts` de `hooks/useDailyReflection.ts`.

const LAST_SPOKEN_KEY = 'vita:sobrevos:ultimoHabla';

// ── Silencio de la tarjeta (§3.3) ───────────────────────────────────────────
// Se guarda SOLO lo último que la tarjeta efectivamente dijo. Los días que se
// calla no escriben nada, y de eso depende que la regla de `shouldStaySilent`
// alterne sola en vez de silenciarse para siempre: si el silencio también se
// registrara, `lastSpoken` sería de ayer todos los días y la tarjeta no volvería
// a hablar nunca.
//
// Por dispositivo y no en `profiles`, mismo criterio que el caché de IA: es estado de presentación, no un dato de la
// persona, y no vale una columna nueva en una tabla con privilegios endurecidos.

export async function getLastSpoken(): Promise<LastSpoken> {
  const raw = await AsyncStorage.getItem(LAST_SPOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function markSpoken(dayKey: string, signal: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SPOKEN_KEY, JSON.stringify({ date: dayKey, signal }));
}
