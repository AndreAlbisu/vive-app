// El momento de pantalla completa (Parte C de la feature "Sobre vos") — cuándo
// vale la pena interrumpir con él. Puro — sin red, sin AsyncStorage, sin
// `Date.now()` adentro — así se testea entero. La lectura/escritura de la
// preferencia y del último momento mostrado vive aparte, en
// `lib/sobreVosMomentoStorage.ts` (mismo criterio que separa `weeklyReflection.ts`
// de `hooks/useDailyReflection.ts`: lo puro se testea, el I/O no).
//
// El texto y la señal salen siempre de `buildReflection()` (lib/weeklyReflection.ts)
// — no hay un banco de frases aparte acá. Este archivo solo decide CUÁNDO
// mostrar ese texto a pantalla completa, no QUÉ dice.

// Señales sin una noticia real detrás. `level` es el fallback sin comparación
// (le toca a cualquiera con ánimo parejo y poca actividad, literalmente todos
// los días — ver el comentario en weeklyReflection.ts sobre esa rama), y `empty`
// y `early` son las dos invitaciones a sumar registros: la primera sin nada
// cargado, la segunda con uno o dos. Ninguna de las dos tiene una noticia que
// justifique interrumpir a pantalla completa.
//
// 🔴 `piso-seguridad` está en la lista por el motivo OPUESTO, y conviene que se
// entienda: no es que no valga, es que el momento está diseñado para una noticia
// —se muestra UNA vez y no repite la misma señal—, y esto no es una noticia sino
// un ofrecimiento que tiene que seguir estando todos los días que dure la
// condición. Pasarlo por este gate lo mostraría una sola vez y nunca más, que es
// exactamente lo que no puede pasar. Vive en la tarjeta, persistente. Interrumpir a pantalla completa por
// cualquiera de las dos, todos los días, sería pedir lo mismo una y otra vez en
// vez de compartir algo que pasó.
const LOW_VALUE_SIGNALS = new Set(['level', 'empty', 'early', 'piso-seguridad']);

export function isSignalWorthMoment(signal: string): boolean {
  return !LOW_VALUE_SIGNALS.has(signal);
}

export type LastShown = { date: string; signal: string } | null;

/** ¿Corresponde disparar el momento hoy?
 *
 *  ⚠️ Simplificación consciente: si la señal de hoy es igual a la ÚLTIMA que
 *  se mostró, no vuelve a disparar, sin importar cuánto tiempo pasó. Una racha
 *  que sigue, una sesión de la semana que sigue contando, no son noticia nueva
 *  al día siguiente — pero tampoco lo son si la misma señal reaparece recién a
 *  los dos meses, y ahí sí sería razonable contarla de nuevo. No se resolvió
 *  con una ventana de tiempo a propósito: es una decisión de producto que no
 *  se discutió, y una ventana arbitraria sin acuerdo es peor que no tenerla. */
export function shouldShowMoment(params: {
  signal: string;
  prefEnabled: boolean;
  lastShown: LastShown;
}): boolean {
  const { signal, prefEnabled, lastShown } = params;
  if (!prefEnabled) return false;
  if (!isSignalWorthMoment(signal)) return false;
  if (lastShown && lastShown.signal === signal) return false;
  return true;
}
