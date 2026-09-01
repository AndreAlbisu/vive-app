// El silencio de la tarjeta "Sobre vos" — cuándo NO decir nada.
//
// Puro: sin red, sin AsyncStorage, sin `Date.now()` adentro. La lectura y la
// escritura de qué se dijo la última vez viven en `lib/sobreVosMomentoStorage.ts`
// (mismo criterio que ya separa `sobreVosMomento.ts` de su storage, y
// `weeklyReflection.ts` de `useDailyReflection.ts`: lo puro se testea, el I/O no).
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// `docs/la-voz-de-sofia.md` §3.3: *"Una presencia idéntica cada mañana se vuelve
// empapelado en una semana. A veces un amigo no dice nada, y eso también es
// estar."*
//
// El caso real es la señal `level`, el fallback de `buildReflection()` sin
// comparación: le toca a cualquiera con el ánimo parejo y poca actividad, o sea
// literalmente todos los días. Tiene cuatro variantes justamente para no repetir
// la misma frase, pero cuatro frases distintas diciendo lo mismo siguen diciendo
// lo mismo.
//
// ⚠️ El doc pide **una regla, no una ausencia por azar**. Podría haberse hecho
// con el hash del día (mismo truco que `variantFor`) y habría salido más barato,
// pero eso es azar disfrazado de regla: callaría días en los que la señal recién
// cambió y hablaría en el tercer día idéntico. La regla es la de abajo, y mira
// lo único que importa: si esto ya se dijo ayer.

/** Lo último que la tarjeta efectivamente dijo. `null` = nunca, o se perdió. */
export type LastSpoken = { date: string; signal: string } | null;

// Las señales que pueden callarse. Hoy es una sola.
//
// ⚠️ La lista es de **inclusión**, no de exclusión, y eso es a propósito: una
// señal nueva nace hablando y hay que agregarla acá a mano para que pueda
// callarse. Al revés —callar todo menos una lista de importantes— un descuido
// silencia algo que había que decir, que es el modo de falla caro. `empty` no
// entra: es la invitación a registrar, y sin ella la tarjeta no explica qué hace.
const PUEDEN_CALLARSE = new Set(['level']);

/** El día de calendario anterior a `dayKey` (YYYY-MM-DD), sin mirar el reloj. */
export function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  const yy = prev.getFullYear();
  const mm = String(prev.getMonth() + 1).padStart(2, '0');
  const dd = String(prev.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** ¿La tarjeta se calla hoy?
 *
 *  Se calla cuando la señal puede callarse Y es la misma que se dijo AYER. Como
 *  el día que se calla no se registra nada (ver `markSpoken` en el storage), al
 *  día siguiente `lastSpoken` ya queda a dos días de distancia y vuelve a
 *  hablar. En una racha larga de `level` eso da: habla, calla, habla, calla —
 *  nunca dos silencios seguidos, que sería desaparecer en vez de callarse.
 *
 *  Un hueco (no abrió la app en una semana) también hace que hable: `lastSpoken`
 *  no es de ayer. Después de una ausencia, decir algo es lo correcto. */
export function shouldStaySilent(params: {
  signal: string;
  lastSpoken: LastSpoken;
  dayKey: string;
}): boolean {
  const { signal, lastSpoken, dayKey } = params;
  if (!PUEDEN_CALLARSE.has(signal)) return false;
  if (!lastSpoken) return false;
  if (lastSpoken.signal !== signal) return false;
  return lastSpoken.date === previousDayKey(dayKey);
}
